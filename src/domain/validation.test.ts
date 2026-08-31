import { describe, expect, it } from 'vitest';
import { summarizeFindings, validateSnapshot } from './validation.ts';
import type { ProjectSnapshot } from './snapshot.ts';
import { baseSnapshot, ids, makeEdge, testId } from './testing.ts';

/**
 * El motor de alertas (§11).
 *
 * Cada prueba comprueba dos cosas: que la regla dispara cuando debe, y que **no**
 * dispara cuando no debe. Lo segundo importa más: un panel que avisa de todo es
 * un panel que nadie mira.
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

const OFFICIAL_VERSION = {
  id: testId('oficial'),
  source: 'Fuente oficial cargada por el docente',
  normativa: 'Referencia normativa aportada en la importación',
  publishedAt: '2023-05-30',
  importedAt: '2026-09-01T08:00:00.000Z',
  version: '1',
  isDemo: false,
};

function activity(id: string, title: string) {
  return {
    id,
    projectId: P,
    learningSituationId: ids.sda1,
    title,
    description: '',
    estimatedSessions: 1,
    status: 'PENDIENTE' as const,
    product: '',
    materials: '',
  };
}

function session(id: string, subjectId: string, date: string, weekIndex = 0) {
  return {
    id,
    projectId: P,
    subjectId,
    date,
    startTime: '08:00',
    durationMinutes: 60,
    weekIndex,
    notes: '',
  };
}

function findingsFor(snapshot: ProjectSnapshot, rule: string) {
  return validateSnapshot(snapshot).filter((finding) => finding.rule === rule);
}

describe('identificadores duplicados', () => {
  it('detecta dos entidades con el mismo identificador', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'Primera'), activity(ids.act1, 'Segunda')],
    });
    const findings = findingsFor(snapshot, 'identificador-duplicado');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('ERROR');
  });

  it('detecta dos aristas con el mismo identificador', () => {
    const duplicated = makeEdge(P, 'depende_de', [ids.act1, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']);
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A'), activity(ids.act2, 'B')],
      edges: [duplicated, { ...duplicated }],
    });
    expect(findingsFor(snapshot, 'identificador-duplicado')).toHaveLength(1);
  });

  it('informa una sola vez por identificador repetido, no una por repetición', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A'), activity(ids.act1, 'B'), activity(ids.act1, 'C')],
    });
    expect(findingsFor(snapshot, 'identificador-duplicado')).toHaveLength(1);
  });

  it('no avisa cuando todos los identificadores son distintos', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A'), activity(ids.act2, 'B')],
    });
    expect(findingsFor(snapshot, 'identificador-duplicado')).toHaveLength(0);
  });
});

describe('referencias rotas', () => {
  it('detecta una arista que apunta a algo inexistente', () => {
    const snapshot = baseSnapshot({
      edges: [
        makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
      ],
    });
    const findings = findingsFor(snapshot, 'arista-huerfana');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('ERROR');
  });

  it('no avisa cuando ambos extremos existen', () => {
    const snapshot = baseSnapshot({
      learningSituations: [
        { id: ids.sda1, projectId: P, title: 'S', description: '', order: 0, estimatedSessions: 2 },
      ],
      activities: [activity(ids.act1, 'A')],
      edges: [
        makeEdge(P, 'forma_parte_de', [ids.act1, 'ACTIVIDAD'], [ids.sda1, 'SITUACION_APRENDIZAJE']),
      ],
    });
    expect(findingsFor(snapshot, 'arista-huerfana')).toHaveLength(0);
  });
});

describe('extremos inválidos', () => {
  it('rechaza una relación entre tipos que no la admiten', () => {
    const snapshot = baseSnapshot({
      learningSituations: [
        { id: ids.sda1, projectId: P, title: 'S', description: '', order: 0, estimatedSessions: 2 },
      ],
      activities: [activity(ids.act1, 'A')],
      // «ejecuta» va de SESION a ACTIVIDAD, nunca de ACTIVIDAD a SITUACION.
      edges: [makeEdge(P, 'ejecuta', [ids.act1, 'ACTIVIDAD'], [ids.sda1, 'SITUACION_APRENDIZAJE'])],
    });
    const findings = findingsFor(snapshot, 'extremos-invalidos');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.hint).toContain('SESION');
  });

  it('acepta las relaciones bien formadas', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A')],
      sessions: [session(ids.ses1, ids.mat, '2026-10-05')],
      edges: [makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD'])],
    });
    expect(findingsFor(snapshot, 'extremos-invalidos')).toHaveLength(0);
  });
});

describe('ciclos de dependencia', () => {
  it('avisa cuando dos actividades se esperan mutuamente', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'Analizar'), activity(ids.act2, 'Redactar')],
      edges: [
        makeEdge(P, 'depende_de', [ids.act1, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
        makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
      ],
    });
    const findings = findingsFor(snapshot, 'ciclo-dependencias');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('ERROR');
    expect(findings[0]?.message).toContain('Analizar');
  });

  it('no avisa en una cadena lineal', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A'), activity(ids.act2, 'B')],
      edges: [makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD'])],
    });
    expect(findingsFor(snapshot, 'ciclo-dependencias')).toHaveLength(0);
  });
});

describe('dependencia impartida demasiado tarde', () => {
  it('avisa si el prerrequisito va después de quien lo necesita', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'Analizar datos'), activity(ids.act2, 'Redactar informe')],
      sessions: [
        session(ids.ses1, ids.mat, '2026-10-20'), // el prerrequisito, tarde
        session(ids.ses2, ids.len, '2026-10-06'), // la dependiente, antes
      ],
      edges: [
        makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD']),
        makeEdge(P, 'ejecuta', [ids.ses2, 'SESION'], [ids.act2, 'ACTIVIDAD']),
        makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
      ],
    });
    const findings = findingsFor(snapshot, 'dependencia-tardia');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Redactar informe');
  });

  it('no avisa cuando el orden temporal es correcto', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'Analizar'), activity(ids.act2, 'Redactar')],
      sessions: [
        session(ids.ses1, ids.mat, '2026-10-06'),
        session(ids.ses2, ids.len, '2026-10-20'),
      ],
      edges: [
        makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD']),
        makeEdge(P, 'ejecuta', [ids.ses2, 'SESION'], [ids.act2, 'ACTIVIDAD']),
        makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
      ],
    });
    expect(findingsFor(snapshot, 'dependencia-tardia')).toHaveLength(0);
  });

  it('no avisa si alguna de las dos no está programada todavía', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A'), activity(ids.act2, 'B')],
      edges: [makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD'])],
    });
    expect(findingsFor(snapshot, 'dependencia-tardia')).toHaveLength(0);
  });
});

describe('criterios sin instrumento', () => {
  it('avisa de un criterio desarrollado sin forma de evaluarlo', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'Radiografía')],
      curriculumVersions: [OFFICIAL_VERSION],
      evaluationCriteria: [
        {
          id: ids.crit1,
          officialCode: 'MAT.3.1',
          name: 'Criterio',
          description: '',
          curriculumVersionId: OFFICIAL_VERSION.id,
          competencyId: ids.mat,
          subjectId: ids.mat,
          weight: null,
        },
      ],
      edges: [
        makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
      ],
    });
    const findings = findingsFor(snapshot, 'criterio-sin-instrumento');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('ADVERTENCIA');
  });

  it('no avisa cuando existe una evidencia asociada', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'Radiografía')],
      curriculumVersions: [OFFICIAL_VERSION],
      evaluationCriteria: [
        {
          id: ids.crit1,
          officialCode: 'MAT.3.1',
          name: 'Criterio',
          description: '',
          curriculumVersionId: OFFICIAL_VERSION.id,
          competencyId: ids.mat,
          subjectId: ids.mat,
          weight: null,
        },
      ],
      assessmentInstruments: [
        {
          id: ids.instrumento,
          projectId: P,
          type: 'RUBRICA',
          title: 'Rúbrica del informe',
          description: '',
          weight: null,
        },
      ],
      evidences: [
        {
          id: testId('evidencia'),
          projectId: P,
          activityId: ids.act1,
          instrumentId: ids.instrumento,
          criterionId: ids.crit1,
          description: '',
          collectedAt: null,
        },
      ],
      edges: [
        makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
      ],
    });
    expect(findingsFor(snapshot, 'criterio-sin-instrumento')).toHaveLength(0);
  });
});

describe('semana desequilibrada', () => {
  it('avisa si una materia acapara más del 60 % de una semana', () => {
    const snapshot = baseSnapshot({
      subjects: [
        {
          id: ids.mat,
          projectId: P,
          name: 'Matemáticas',
          shortName: 'MAT',
          color: '#4c7ef3',
          weeklySessions: 4,
        },
      ],
      sessions: [
        session(ids.ses1, ids.mat, '2026-10-05'),
        session(testId('s2'), ids.mat, '2026-10-06'),
        session(testId('s3'), ids.mat, '2026-10-07'),
        session(testId('s4'), ids.len, '2026-10-08'),
      ],
    });
    const findings = findingsFor(snapshot, 'semana-desequilibrada');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('75');
  });

  it('no avisa con muy pocas sesiones, donde el reparto no significa nada', () => {
    const snapshot = baseSnapshot({
      sessions: [session(ids.ses1, ids.mat, '2026-10-05')],
    });
    expect(findingsFor(snapshot, 'semana-desequilibrada')).toHaveLength(0);
  });
});

describe('datos de demostración', () => {
  it('recuerda que los criterios DEMO no son oficiales', () => {
    const snapshot = baseSnapshot({
      curriculumVersions: [DEMO_VERSION],
      evaluationCriteria: [
        {
          id: ids.crit1,
          officialCode: 'DEMO.MAT.3.1',
          name: 'Criterio de ejemplo',
          description: '',
          curriculumVersionId: ids.version,
          competencyId: ids.mat,
          subjectId: ids.mat,
          weight: null,
        },
      ],
    });
    const findings = findingsFor(snapshot, 'curriculo-de-demostracion');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('SUGERENCIA');
  });

  it('no avisa cuando el currículo procede de una fuente cargada por el docente', () => {
    const snapshot = baseSnapshot({
      curriculumVersions: [OFFICIAL_VERSION],
      evaluationCriteria: [
        {
          id: ids.crit1,
          officialCode: 'MAT.3.1',
          name: 'Criterio',
          description: '',
          curriculumVersionId: OFFICIAL_VERSION.id,
          competencyId: ids.mat,
          subjectId: ids.mat,
          weight: null,
        },
      ],
    });
    expect(findingsFor(snapshot, 'curriculo-de-demostracion')).toHaveLength(0);
  });
});

describe('orden y resumen', () => {
  it('devuelve los errores antes que las advertencias y sugerencias', () => {
    const snapshot = baseSnapshot({
      activities: [activity(ids.act1, 'A')],
      edges: [
        makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
      ],
    });
    const severities = validateSnapshot(snapshot).map((f) => f.severity);
    const firstWarning = severities.indexOf('ADVERTENCIA');
    const lastError = severities.lastIndexOf('ERROR');
    if (firstWarning !== -1 && lastError !== -1) {
      expect(lastError).toBeLessThan(firstWarning);
    }
  });

  it('cuenta los hallazgos por severidad', () => {
    const summary = summarizeFindings([
      { rule: 'a', severity: 'ERROR', message: '', nodeIds: [] },
      { rule: 'b', severity: 'ERROR', message: '', nodeIds: [] },
      { rule: 'c', severity: 'SUGERENCIA', message: '', nodeIds: [] },
    ]);
    expect(summary).toEqual({ ERROR: 2, ADVERTENCIA: 0, SUGERENCIA: 1 });
  });

  it('un proyecto vacío no produce ningún error', () => {
    const errors = validateSnapshot(baseSnapshot()).filter((f) => f.severity === 'ERROR');
    expect(errors).toEqual([]);
  });
});
