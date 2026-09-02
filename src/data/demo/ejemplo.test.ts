import { describe, expect, it } from 'vitest';
import {
  gradesPresent,
  projectSnapshotSchema,
  scopeCurriculum,
  summarizeFindings,
  validateSnapshot,
} from '@/domain';
import { buildDemoSnapshot, DEMO_INFO } from './ejemplo.ts';

/**
 * Prueba golden del proyecto de demostración.
 *
 * Es la red de seguridad del ejemplo: cualquier cambio en el modelo que lo rompa
 * se detecta aquí y no cuando un docente abre la aplicación por primera vez y se
 * encuentra una pantalla en blanco.
 */

const snapshot = buildDemoSnapshot();

describe('proyecto de demostración', () => {
  it('valida contra el esquema del proyecto', () => {
    expect(() => projectSnapshotSchema.parse(snapshot)).not.toThrow();
  });

  it('son dos situaciones del mismo curso', () => {
    expect(snapshot.learningSituations).toHaveLength(2);
    expect(snapshot.activities).toHaveLength(DEMO_INFO.activities);
    expect(snapshot.project.grade).toBe(1);
  });

  it('intervienen las ocho materias de 1.º de ESO', () => {
    expect(snapshot.subjects).toHaveLength(8);
    expect([...snapshot.subjects].map((s) => s.shortName).sort()).toEqual([
      'BYG',
      'EFI',
      'EPV',
      'GEH',
      'LCL',
      'LEX',
      'MAT',
      'MUS',
    ]);
  });

  /**
   * Que todas participen de verdad, no solo que estén dadas de alta.
   *
   * Una materia sin actividades sería una fila más en la matriz de contribución
   * con un cero: aparece, pero no interviene. El ejemplo debe demostrar lo
   * contrario.
   */
  it('todas las materias tienen al menos una actividad a su cargo', () => {
    const conActividad = new Set(
      snapshot.edges.filter((e) => e.type === 'responsable_de').map((e) => e.sourceId),
    );
    const docenteDe = new Map(snapshot.teachers.map((t) => [t.id, t.initials]));
    const sinActividad = snapshot.teachers
      .filter((t) => !conActividad.has(t.id))
      .map((t) => docenteDe.get(t.id));
    expect(sinActividad, `Materias sin actividad: ${sinActividad.join(', ')}`).toEqual([]);
  });

  it('las dos situaciones tienen actividades de varias materias', () => {
    const materiaDe = new Map<string, string>();
    for (const edge of snapshot.edges) {
      if (edge.type === 'responsable_de') materiaDe.set(edge.targetId, edge.sourceId);
    }
    for (const situacion of snapshot.learningSituations) {
      const materias = new Set(
        snapshot.activities
          .filter((a) => a.learningSituationId === situacion.id)
          .map((a) => materiaDe.get(a.id)),
      );
      expect(materias.size, `«${situacion.title}» solo tiene una materia`).toBeGreaterThanOrEqual(
        4,
      );
    }
  });

  it('no produce ningún ERROR de validación', () => {
    const errores = validateSnapshot(snapshot).filter((f) => f.severity === 'ERROR');
    expect(
      errores,
      `El ejemplo tiene errores:\n${errores.map((e) => `  - ${e.message}`).join('\n')}`,
    ).toEqual([]);
  });
});

describe('usa currículo REAL, no inventado', () => {
  it('ninguna versión curricular está marcada como demostración', () => {
    expect(snapshot.curriculumVersions.every((v) => !v.isDemo)).toBe(true);
  });

  it('ningún código lleva el prefijo DEMO', () => {
    const codigos = [
      ...snapshot.evaluationCriteria,
      ...snapshot.basicKnowledge,
      ...snapshot.competencies,
    ].map((e) => e.officialCode ?? '');
    expect(codigos.some((c) => c.startsWith('DEMO.'))).toBe(false);
  });

  it('cita la Orden de 30 de mayo de 2023', () => {
    expect(snapshot.curriculumVersions[0]?.normativa).toContain('30 de mayo de 2023');
  });

  it('las actividades desarrollan criterios reales del catálogo', () => {
    const conCriterio = snapshot.edges.filter((e) => e.type === 'desarrolla');
    expect(conCriterio.length).toBeGreaterThanOrEqual(snapshot.activities.length);

    const ids = new Set(snapshot.evaluationCriteria.map((c) => c.id));
    for (const edge of conCriterio) {
      expect(ids.has(edge.targetId)).toBe(true);
    }
  });

  it('moviliza los saberes que la norma relaciona con esos criterios', () => {
    const moviliza = snapshot.edges.filter((e) => e.type === 'moviliza');
    expect(moviliza.length).toBeGreaterThan(0);
  });
});

/**
 * El currículo del ejemplo está acotado a un curso.
 *
 * Es el requisito que motivó `scope.ts`: un docente de 1.º no debe encontrarse
 * criterios de 3.º entre los suyos, ni siquiera atenuados. Si el generador del
 * subconjunto se descuidara, esta prueba lo cazaría antes que nadie.
 */
describe('acotado a 1.º de ESO', () => {
  it('el currículo cargado es solo de primer curso', () => {
    expect(gradesPresent(snapshot)).toEqual([1]);
  });

  it('acotar a 1.º no descarta nada, y acotar a 3.º lo descarta todo', () => {
    const primero = scopeCurriculum(snapshot, 1);
    expect(primero.criteria).toHaveLength(snapshot.evaluationCriteria.length);

    const tercero = scopeCurriculum(snapshot, 3);
    expect(tercero.criteria).toHaveLength(0);
  });

  it('todos los saberes declaran a qué curso pertenecen', () => {
    const sinCurso = snapshot.basicKnowledge.filter((s) => s.gradeSpan === null);
    expect(sinCurso, `${sinCurso.length} saberes sin curso`).toEqual([]);
  });
});

describe('coherencia del ejemplo', () => {
  it('la cadena de dependencias cruza materias', () => {
    const materiaDe = new Map<string, string>();
    for (const edge of snapshot.edges) {
      if (edge.type === 'responsable_de') materiaDe.set(edge.targetId, edge.sourceId);
    }
    const cruzadas = snapshot.edges.filter(
      (e) => e.type === 'depende_de' && materiaDe.get(e.sourceId) !== materiaDe.get(e.targetId),
    );
    expect(cruzadas.length).toBeGreaterThan(4);
  });

  it('las sesiones caen dentro del periodo del proyecto', () => {
    for (const sesion of snapshot.sessions) {
      expect(sesion.date >= snapshot.project.startDate).toBe(true);
      expect(sesion.date <= snapshot.project.endDate).toBe(true);
    }
  });

  it('ninguna sesión cae en un día no lectivo', () => {
    const noLectivos = new Set(snapshot.project.nonSchoolDays);
    const caidas = snapshot.sessions.filter((s) => noLectivos.has(s.date));
    expect(caidas.map((s) => s.date)).toEqual([]);
  });

  it('produce los mismos identificadores en cada construcción', () => {
    expect(buildDemoSnapshot().project.id).toBe(snapshot.project.id);
  });

  it('deja alertas útiles, ni cero ni un muro', () => {
    const resumen = summarizeFindings(validateSnapshot(snapshot));
    expect(resumen.ADVERTENCIA + resumen.SUGERENCIA).toBeGreaterThan(0);
    expect(resumen.ADVERTENCIA).toBeLessThan(40);
  });
});
