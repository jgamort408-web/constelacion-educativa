import { describe, expect, it } from 'vitest';
import {
  buildContributionMatrix,
  computeContribution,
  resolveContribution,
} from './contribution.ts';
import type { ProjectSnapshot } from './snapshot.ts';
import { baseSnapshot, ids, makeEdge } from './testing.ts';

/**
 * El requisito de la §20 no es que el número sea correcto: es que sea explicable
 * y que el valor puesto por un docente sea intocable. Estas pruebas vigilan
 * ambas cosas, y la segunda es la que más importa.
 */

const P = ids.project;
const DEMO_VERSION = {
  id: ids.version,
  source: 'Datos de prueba',
  normativa: '',
  publishedAt: null,
  importedAt: '2026-09-01T08:00:00.000Z',
  version: '1',
  isDemo: true,
};

function scenario(): ProjectSnapshot {
  return baseSnapshot({
    subjects: [
      {
        id: ids.mat,
        projectId: P,
        name: 'Matemáticas',
        shortName: 'MAT',
        color: '#4c7ef3',
        weeklySessions: 4,
      },
      {
        id: ids.len,
        projectId: P,
        name: 'Lengua',
        shortName: 'LEN',
        color: '#e0715c',
        weeklySessions: 4,
      },
    ],
    learningSituations: [
      {
        id: ids.sda1,
        projectId: P,
        title: 'Conocemos el barrio',
        description: '',
        order: 0,
        estimatedSessions: 6,
      },
    ],
    activities: [
      {
        id: ids.act1,
        projectId: P,
        learningSituationId: ids.sda1,
        title: 'Radiografía estadística',
        description: '',
        order: 0,
        estimatedSessions: 2,
        status: 'PENDIENTE',
        product: '',
        materials: '',
      },
      {
        id: ids.act2,
        projectId: P,
        learningSituationId: ids.sda1,
        title: 'Redactamos conclusiones',
        description: '',
        order: 1,
        estimatedSessions: 2,
        status: 'PENDIENTE',
        product: '',
        materials: '',
      },
    ],
    sessions: [
      {
        id: ids.ses1,
        projectId: P,
        subjectId: ids.mat,
        date: '2026-10-05',
        startTime: '08:00',
        durationMinutes: 60,
        weekIndex: 0,
        notes: '',
      },
      {
        id: ids.ses2,
        projectId: P,
        subjectId: ids.len,
        date: '2026-10-06',
        startTime: '10:00',
        durationMinutes: 60,
        weekIndex: 0,
        notes: '',
      },
    ],
    curriculumVersions: [DEMO_VERSION],
    evaluationCriteria: [
      {
        id: ids.crit1,
        officialCode: 'DEMO.MAT.3.1',
        name: 'Criterio de Matemáticas',
        description: '',
        curriculumVersionId: ids.version,
        competencyId: ids.mat,
        subjectId: ids.mat,
        weight: null,
        relatedKnowledgeCodes: [],
      },
      {
        id: ids.crit2,
        officialCode: 'DEMO.LEN.3.1',
        name: 'Criterio de Lengua',
        description: '',
        curriculumVersionId: ids.version,
        competencyId: ids.len,
        subjectId: ids.len,
        weight: null,
        relatedKnowledgeCodes: [],
      },
    ],
    edges: [
      makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD']),
      makeEdge(P, 'ejecuta', [ids.ses2, 'SESION'], [ids.act2, 'ACTIVIDAD']),
      makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
      makeEdge(P, 'desarrolla', [ids.act2, 'ACTIVIDAD'], [ids.crit2, 'CRITERIO_EVALUACION']),
    ],
  });
}

describe('computeContribution', () => {
  it('devuelve un total entre 0 y 1', () => {
    const result = computeContribution(scenario(), ids.mat, ids.sda1);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
  });

  it('desglosa todos los factores, que es el requisito de la §20', () => {
    const result = computeContribution(scenario(), ids.mat, ids.sda1);
    expect(result.breakdown.map((f) => f.factor)).toEqual([
      'sesiones',
      'actividades',
      'criterios',
      'productoFinal',
      'evaluacion',
    ]);
  });

  it('cada factor muestra el dato bruto y contra qué se compara', () => {
    const result = computeContribution(scenario(), ids.mat, ids.sda1);
    const sessions = result.breakdown.find((f) => f.factor === 'sesiones');
    expect(sessions?.raw).toBe(1);
    expect(sessions?.outOf).toBe(2);
    expect(sessions?.normalized).toBeCloseTo(0.5);
  });

  it('los puntos de cada factor son normalizado por peso', () => {
    const result = computeContribution(scenario(), ids.mat, ids.sda1);
    for (const item of result.breakdown) {
      expect(item.points).toBeCloseTo(item.normalized * item.weight);
    }
  });

  it('reparte al 50 % dos materias con implicación simétrica', () => {
    const snapshot = scenario();
    const mat = computeContribution(snapshot, ids.mat, ids.sda1);
    const len = computeContribution(snapshot, ids.len, ids.sda1);
    expect(mat.total).toBeCloseTo(len.total, 5);
  });

  it('da más contribución a la materia con más sesiones', () => {
    const snapshot = scenario();
    snapshot.sessions.push({
      id: 'aaaaaaaa-0000-4000-8000-aaaaaaaa0000',
      projectId: P,
      subjectId: ids.mat,
      date: '2026-10-07',
      startTime: '09:00',
      durationMinutes: 60,
      weekIndex: 0,
      notes: '',
    });
    snapshot.edges.push(
      makeEdge(
        P,
        'ejecuta',
        ['aaaaaaaa-0000-4000-8000-aaaaaaaa0000', 'SESION'],
        [ids.act1, 'ACTIVIDAD'],
      ),
    );

    const mat = computeContribution(snapshot, ids.mat, ids.sda1);
    const len = computeContribution(snapshot, ids.len, ids.sda1);
    expect(mat.total).toBeGreaterThan(len.total);
  });

  it('un factor con peso cero no diluye el resultado', () => {
    const snapshot = scenario();
    const conPesoCompleto = computeContribution(snapshot, ids.mat, ids.sda1, {
      sessions: 1,
      activities: 0,
      criteria: 0,
      finalProduct: 0,
      assessment: 0,
    });
    // Matemáticas tiene 1 de 2 sesiones: con todo el peso en sesiones, exactamente 0,5.
    expect(conPesoCompleto.total).toBeCloseTo(0.5);
  });

  it('no divide por cero cuando el ámbito está vacío', () => {
    const snapshot = baseSnapshot();
    const result = computeContribution(snapshot, ids.mat, ids.sda1);
    expect(result.total).toBe(0);
    expect(Number.isNaN(result.total)).toBe(false);
  });

  it('marca el resultado como CALCULADA', () => {
    expect(computeContribution(scenario(), ids.mat, ids.sda1).mode).toBe('CALCULADA');
  });
});

describe('resolveContribution', () => {
  it('el valor manual gana siempre sobre el calculado', () => {
    const calculated = computeContribution(scenario(), ids.mat, ids.sda1);
    const manual = makeEdge(
      P,
      'participa_en',
      [ids.mat, 'MATERIA'],
      [ids.sda1, 'SITUACION_APRENDIZAJE'],
      {
        weight: 0.9,
        mode: 'MANUAL',
      },
    );

    const resolved = resolveContribution(calculated, manual);
    expect(resolved.total).toBe(0.9);
    expect(resolved.mode).toBe('MANUAL');
  });

  it('conserva la discrepancia para poder mostrarla, sin aplicarla', () => {
    const calculated = computeContribution(scenario(), ids.mat, ids.sda1);
    const manual = makeEdge(
      P,
      'participa_en',
      [ids.mat, 'MATERIA'],
      [ids.sda1, 'SITUACION_APRENDIZAJE'],
      {
        weight: 0.9,
        mode: 'MANUAL',
      },
    );

    const resolved = resolveContribution(calculated, manual);
    expect(resolved.calculatedAlternative).toBeCloseTo(calculated.total);
    expect(resolved.total).not.toBe(calculated.total);
  });

  it('no señala discrepancia cuando manual y calculado coinciden', () => {
    const calculated = computeContribution(scenario(), ids.mat, ids.sda1);
    const manual = makeEdge(
      P,
      'participa_en',
      [ids.mat, 'MATERIA'],
      [ids.sda1, 'SITUACION_APRENDIZAJE'],
      {
        weight: calculated.total,
        mode: 'MANUAL',
      },
    );

    expect(resolveContribution(calculated, manual).calculatedAlternative).toBeUndefined();
  });

  it('una propuesta de IA no sobrescribe el cálculo', () => {
    const calculated = computeContribution(scenario(), ids.mat, ids.sda1);
    const propuesta = makeEdge(
      P,
      'participa_en',
      [ids.mat, 'MATERIA'],
      [ids.sda1, 'SITUACION_APRENDIZAJE'],
      {
        weight: 0.99,
        mode: 'PROPUESTA_IA',
      },
    );

    const resolved = resolveContribution(calculated, propuesta);
    expect(resolved.total).toBeCloseTo(calculated.total);
    expect(resolved.mode).toBe('CALCULADA');
  });

  it('mantiene el cálculo si no hay arista manual', () => {
    const calculated = computeContribution(scenario(), ids.mat, ids.sda1);
    expect(resolveContribution(calculated, undefined)).toEqual(calculated);
  });
});

describe('buildContributionMatrix', () => {
  it('produce una fila por materia y una columna por ámbito', () => {
    const matrix = buildContributionMatrix(scenario(), [ids.sda1]);
    expect(matrix.size).toBe(2);
    expect(matrix.get(ids.mat)?.size).toBe(1);
  });

  it('cada celda conserva su desglose, para poder explicarse al pulsarla', () => {
    const matrix = buildContributionMatrix(scenario(), [ids.sda1]);
    expect(matrix.get(ids.mat)?.get(ids.sda1)?.breakdown).toHaveLength(5);
  });

  it('respeta los valores manuales dentro de la matriz', () => {
    const snapshot = scenario();
    snapshot.edges.push(
      makeEdge(P, 'participa_en', [ids.mat, 'MATERIA'], [ids.sda1, 'SITUACION_APRENDIZAJE'], {
        weight: 0.77,
        mode: 'MANUAL',
      }),
    );

    const matrix = buildContributionMatrix(snapshot, [ids.sda1]);
    expect(matrix.get(ids.mat)?.get(ids.sda1)?.total).toBe(0.77);
  });
});
