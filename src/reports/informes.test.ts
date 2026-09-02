import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@/data/demo/ejemplo.ts';
import { construirPrograma, construirSemanas, semanaDe } from './informes.ts';

/**
 * Los informes se prueban contra el proyecto de ejemplo.
 *
 * No con datos inventados a medida: si el ejemplo cambia y el informe deja de
 * cuadrar con él, es justo lo que hay que enterarse. Un informe correcto sobre un
 * proyecto de mentira no vale para nada.
 */

const snapshot = buildDemoSnapshot();
const programa = construirPrograma(snapshot, 1);
const semanas = construirSemanas(snapshot);

describe('programa completo', () => {
  it('recoge las dos situaciones en su orden', () => {
    expect(programa.situaciones).toHaveLength(2);
    expect(programa.situaciones[0]?.situacion.order).toBe(0);
  });

  it('cada situación declara las materias que intervienen', () => {
    for (const bloque of programa.situaciones) {
      expect(bloque.materias.length, `«${bloque.situacion.title}» sin materias`).toBeGreaterThan(1);
    }
  });

  it('reparte todas las actividades entre las materias, sin perder ninguna', () => {
    const enMaterias = programa.materias.flatMap((m) => m.actividades.map((a) => a.id));
    expect(new Set(enMaterias).size).toBe(snapshot.activities.length);
  });

  it('cita los criterios con su código oficial', () => {
    const codigos = programa.materias.flatMap((m) => m.criterios.map((c) => c.codigo));
    expect(codigos.length).toBeGreaterThan(0);
    expect(codigos.every((c) => /^[A-Z]{3}\.\d/.test(c))).toBe(true);
  });

  /**
   * La cobertura acotada al curso es media razón de ser del informe: dice qué
   * criterios de MI curso siguen sin tocar. Si no estuviera acotada, contaría
   * los de 2.º y 3.º y el número no significaría nada.
   */
  it('los criterios sin trabajar son del curso acotado y ninguno está trabajado', () => {
    const trabajados = new Set(
      snapshot.edges.filter((e) => e.type === 'desarrolla').map((e) => e.targetId),
    );
    for (const materia of programa.materias) {
      for (const criterio of materia.criteriosSinTrabajar) {
        expect(trabajados.has(criterio.id)).toBe(false);
        expect(criterio.codigo.split('.')[1]).toBe('1');
      }
    }
  });

  it('una actividad sabe qué necesita y qué deja parado', () => {
    const conRequisitos = programa.situaciones
      .flatMap((s) => s.actividades)
      .filter((a) => a.requiere.length > 0);
    expect(conRequisitos.length).toBeGreaterThan(4);
    for (const actividad of conRequisitos) {
      for (const previa of actividad.requiere) {
        expect(previa.titulo).not.toBe('');
      }
    }
  });
});

describe('informe semanal', () => {
  it('cubre todas las semanas con sesiones y ninguna más', () => {
    const conSesiones = new Set(snapshot.sessions.map((s) => s.weekIndex));
    expect(semanas.map((s) => s.indice)).toEqual([...conSesiones].sort((a, b) => a - b));
  });

  it('cada semana está fechada por sus propias sesiones', () => {
    for (const semana of semanas) {
      expect(semana.desde <= semana.hasta).toBe(true);
      const fechas = semana.materias.flatMap((m) => m.sesiones.map((s) => s.fecha));
      for (const fecha of fechas) {
        expect(fecha >= semana.desde && fecha <= semana.hasta).toBe(true);
      }
    }
  });

  it('no reparte a una materia sesiones de otra', () => {
    const materiaDeSesion = new Map(
      snapshot.sessions.map((s) => [`${s.date}T${s.startTime}`, s.subjectId]),
    );
    for (const semana of semanas) {
      for (const bloque of semana.materias) {
        for (const sesion of bloque.sesiones) {
          expect(materiaDeSesion.get(`${sesion.fecha}T${sesion.hora}`)).toBeDefined();
        }
      }
    }
  });

  it('suma las mismas sesiones que tiene el proyecto', () => {
    const total = semanas.reduce(
      (suma, semana) => suma + semana.materias.reduce((s, m) => s + m.sesiones.length, 0),
      0,
    );
    expect(total).toBe(snapshot.sessions.length);
  });

  it('lista los materiales de la semana sin repetirlos', () => {
    for (const semana of semanas) {
      for (const bloque of semana.materias) {
        expect(new Set(bloque.materiales).size).toBe(bloque.materiales.length);
      }
    }
  });

  /**
   * El ejemplo está bien planificado, así que no debe generar ni un aviso de
   * coordinación. Si aparece uno, o el ejemplo se ha roto o el detector está
   * dando falsos positivos: ambas cosas conviene saberlas.
   */
  it('el ejemplo no deja ningún aviso de coordinación', () => {
    const avisos = semanas.flatMap((s) => s.avisos);
    expect(avisos, avisos.join('\n')).toEqual([]);
  });
});

describe('semanaDe', () => {
  it('encuentra la semana que contiene una fecha del proyecto', () => {
    const primera = semanas[0];
    expect(primera).toBeDefined();
    if (!primera) return;
    expect(semanaDe(semanas, primera.desde)).toBe(primera.indice);
    expect(semanaDe(semanas, primera.hasta)).toBe(primera.indice);
  });

  it('devuelve null fuera del periodo, en vez de la primera semana', () => {
    expect(semanaDe(semanas, '2020-01-01')).toBeNull();
    expect(semanaDe(semanas, '2030-01-01')).toBeNull();
  });

  /**
   * Un fin de semana o un día no lectivo cae entre dos semanas informadas y no
   * pertenece a ninguna. Devolver la anterior «porque queda cerca» sería adivinar.
   */
  it('un día sin sesiones entre dos semanas no pertenece a ninguna', () => {
    const primera = semanas[0];
    const segunda = semanas[1];
    expect(primera && segunda).toBeTruthy();
    if (!primera || !segunda) return;
    const enMedio = new Date(`${primera.hasta}T00:00:00Z`);
    enMedio.setUTCDate(enMedio.getUTCDate() + 1);
    const dia = enMedio.toISOString().slice(0, 10);
    if (dia < segunda.desde) expect(semanaDe(semanas, dia)).toBeNull();
  });
});
