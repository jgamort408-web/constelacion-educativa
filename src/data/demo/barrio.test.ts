import { describe, expect, it } from 'vitest';
import { projectSnapshotSchema, summarizeFindings, validateSnapshot } from '@/domain';
import { buildDemoSnapshot, DEMO_INFO } from './barrio.ts';

/**
 * Prueba golden del proyecto de demostración.
 *
 * Es la red de seguridad del ejemplo: cualquier cambio en el modelo que rompa el
 * DEMO se detecta aquí y no cuando un docente abre la aplicación por primera vez
 * y se encuentra una pantalla en blanco.
 */

describe('proyecto de demostración', () => {
  const snapshot = buildDemoSnapshot();

  it('valida contra el esquema del proyecto', () => {
    expect(() => projectSnapshotSchema.parse(snapshot)).not.toThrow();
  });

  it('tiene el tamaño que promete la §26: 5 materias y 12-15 actividades', () => {
    expect(snapshot.subjects).toHaveLength(5);
    expect(snapshot.activities.length).toBeGreaterThanOrEqual(12);
    expect(snapshot.activities.length).toBeLessThanOrEqual(15);
    expect(DEMO_INFO.activities).toBe(snapshot.activities.length);
  });

  it('no produce ningún ERROR de validación', () => {
    const findings = validateSnapshot(snapshot);
    const errors = findings.filter((finding) => finding.severity === 'ERROR');
    expect(
      errors,
      `El proyecto DEMO tiene errores:\n${errors.map((e) => `  - ${e.message}`).join('\n')}`,
    ).toEqual([]);
  });

  it('sí produce advertencias y sugerencias, que es lo que hace útil el ejemplo', () => {
    // Un DEMO impoluto no enseñaría para qué sirve el panel de alertas.
    const summary = summarizeFindings(validateSnapshot(snapshot));
    expect(summary.ADVERTENCIA + summary.SUGERENCIA).toBeGreaterThan(0);
  });
});

describe('seguridad curricular del ejemplo', () => {
  const snapshot = buildDemoSnapshot();

  it('todas sus versiones curriculares están marcadas como demostración', () => {
    expect(snapshot.curriculumVersions.every((version) => version.isDemo)).toBe(true);
  });

  it('ningún código curricular puede confundirse con uno oficial', () => {
    const codes = [
      ...snapshot.evaluationCriteria,
      ...snapshot.basicKnowledge,
      ...snapshot.competencies,
    ].map((element) => element.officialCode);

    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(code, `El código «${code}» no lleva el prefijo DEMO.`).toMatch(/^DEMO\./);
    }
  });

  it('la versión curricular avisa expresamente de que no procede de ninguna norma', () => {
    const version = snapshot.curriculumVersions[0];
    expect(version?.normativa).toContain('NINGUNA');
    expect(version?.publishedAt).toBeNull();
  });

  it('el motor de validación recuerda que el currículo es de demostración', () => {
    const findings = validateSnapshot(snapshot).filter(
      (finding) => finding.rule === 'curriculo-de-demostracion',
    );
    expect(findings).toHaveLength(1);
  });
});

describe('coherencia interdisciplinar del ejemplo', () => {
  const snapshot = buildDemoSnapshot();

  it('cada actividad pertenece a una situación existente', () => {
    const situationIds = new Set(snapshot.learningSituations.map((s) => s.id));
    for (const activity of snapshot.activities) {
      expect(situationIds.has(activity.learningSituationId)).toBe(true);
    }
  });

  it('tiene dependencias reales entre materias distintas', () => {
    const subjectOfActivity = new Map<string, string>();
    for (const edge of snapshot.edges) {
      if (edge.type === 'responsable_de') subjectOfActivity.set(edge.targetId, edge.sourceId);
    }

    const crossSubject = snapshot.edges.filter(
      (edge) =>
        edge.type === 'depende_de' &&
        subjectOfActivity.get(edge.sourceId) !== subjectOfActivity.get(edge.targetId),
    );

    // Sin dependencias entre materias, el proyecto no sería interdisciplinar:
    // serían cinco asignaturas trabajando en paralelo sobre el mismo tema.
    expect(crossSubject.length).toBeGreaterThan(3);
  });

  it('todas las materias participan en al menos una actividad', () => {
    const participating = new Set(
      snapshot.edges.filter((edge) => edge.sourceType === 'MATERIA').map((edge) => edge.sourceId),
    );
    for (const subject of snapshot.subjects) {
      expect(participating.has(subject.id), `${subject.name} no participa en nada`).toBe(true);
    }
  });

  it('el producto final recibe aportaciones de varias actividades', () => {
    const product = snapshot.finalProducts[0];
    const contributions = snapshot.edges.filter(
      (edge) => edge.type === 'contribuye_a' && edge.targetId === product?.id,
    );
    expect(contributions.length).toBeGreaterThan(1);
  });

  it('las sesiones caen dentro del periodo del proyecto', () => {
    for (const session of snapshot.sessions) {
      expect(session.date >= snapshot.project.startDate).toBe(true);
      expect(session.date <= snapshot.project.endDate).toBe(true);
    }
  });

  it('genera los mismos identificadores en cada construcción', () => {
    const otra = buildDemoSnapshot();
    expect(otra.project.id).toBe(snapshot.project.id);
    expect(otra.activities.map((a) => a.id)).toEqual(snapshot.activities.map((a) => a.id));
  });
});
