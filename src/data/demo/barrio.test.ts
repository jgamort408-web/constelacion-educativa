import { describe, expect, it } from 'vitest';
import { projectSnapshotSchema, summarizeFindings, validateSnapshot } from '@/domain';
import { buildDemoSnapshot, DEMO_INFO } from './barrio.ts';

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

  it('es una sola situación con tres materias', () => {
    expect(snapshot.learningSituations).toHaveLength(1);
    expect(snapshot.subjects).toHaveLength(3);
    expect(snapshot.activities).toHaveLength(DEMO_INFO.activities);
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

describe('coherencia del ejemplo', () => {
  it('la cadena de dependencias cruza las tres materias', () => {
    const materiaDe = new Map<string, string>();
    for (const edge of snapshot.edges) {
      if (edge.type === 'responsable_de') materiaDe.set(edge.targetId, edge.sourceId);
    }
    const cruzadas = snapshot.edges.filter(
      (e) => e.type === 'depende_de' && materiaDe.get(e.sourceId) !== materiaDe.get(e.targetId),
    );
    expect(cruzadas.length).toBeGreaterThan(2);
  });

  it('las sesiones caen dentro del periodo del proyecto', () => {
    for (const sesion of snapshot.sessions) {
      expect(sesion.date >= snapshot.project.startDate).toBe(true);
      expect(sesion.date <= snapshot.project.endDate).toBe(true);
    }
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
