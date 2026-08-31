import type { Edge } from './edge.ts';
import type { ContributionMode } from './enums.ts';
import type { Uuid, Weight } from './primitives.ts';
import type { ContributionWeights } from './project.ts';
import type { ProjectSnapshot } from './snapshot.ts';

/**
 * Cuánto contribuye una materia a algo (§20).
 *
 * El requisito no es calcular un número: es calcular un número **que se pueda
 * explicar**. Por eso el resultado nunca es un `number`, siempre es un desglose
 * con el total al lado. Si el panel lateral no puede mostrar de dónde sale el 72 %,
 * el algoritmo está mal diseñado, por muy acertado que sea el 72 %.
 */

/** Un factor del cálculo, con todos sus pasos a la vista. */
export interface ContributionFactor {
  readonly factor: 'sesiones' | 'actividades' | 'criterios' | 'productoFinal' | 'evaluacion';
  /** Etiqueta para la interfaz. */
  readonly label: string;
  /** El dato bruto: cuántas sesiones, cuántas actividades. */
  readonly raw: number;
  /** El total contra el que se compara, para que el bruto signifique algo. */
  readonly outOf: number;
  /** `raw / outOf`, entre 0 y 1. */
  readonly normalized: number;
  /** El peso configurado para este factor. */
  readonly weight: number;
  /** `normalized * weight`: lo que este factor aporta al total. */
  readonly points: number;
}

export interface ContributionResult {
  readonly subjectId: Uuid;
  /** Ámbito medido: una situación, una actividad o el proyecto entero. */
  readonly scopeId: Uuid;
  readonly total: Weight;
  readonly breakdown: readonly ContributionFactor[];
  readonly mode: ContributionMode;
  /**
   * Presente solo cuando el valor mostrado es manual y el cálculo discrepa.
   *
   * No se aplica: se enseña. La §6 prohíbe que la máquina corrija en silencio al
   * docente, así que la discrepancia es información, no una acción.
   */
  readonly calculatedAlternative?: Weight;
}

const FACTOR_LABELS: Record<ContributionFactor['factor'], string> = {
  sesiones: 'Sesiones dedicadas',
  actividades: 'Actividades lideradas',
  criterios: 'Criterios desarrollados',
  productoFinal: 'Aportación al producto final',
  evaluacion: 'Peso en la evaluación',
};

function factor(
  name: ContributionFactor['factor'],
  raw: number,
  outOf: number,
  weight: number,
): ContributionFactor {
  const normalized = outOf > 0 ? raw / outOf : 0;
  return {
    factor: name,
    label: FACTOR_LABELS[name],
    raw,
    outOf,
    normalized,
    weight,
    points: normalized * weight,
  };
}

/** Actividades que pertenecen al ámbito medido. */
function activitiesInScope(snapshot: ProjectSnapshot, scopeId: Uuid): readonly string[] {
  if (scopeId === snapshot.project.id) {
    return snapshot.activities.map((activity) => activity.id);
  }
  const direct = snapshot.activities.filter((activity) => activity.learningSituationId === scopeId);
  if (direct.length > 0) return direct.map((activity) => activity.id);
  // El ámbito puede ser una actividad concreta.
  return snapshot.activities.filter((activity) => activity.id === scopeId).map((a) => a.id);
}

/**
 * Calcula la contribución de una materia a un ámbito.
 *
 * Cada factor se normaliza contra el total del ámbito, no contra un máximo
 * arbitrario. Así, «Matemáticas aporta el 35 % de las sesiones» significa
 * exactamente eso, y no depende de cuántas materias haya en el proyecto.
 *
 * Los pesos vienen del proyecto y son configurables: la herramienta no impone qué
 * significa participar, solo obliga a que el equipo lo haga explícito.
 */
export function computeContribution(
  snapshot: ProjectSnapshot,
  subjectId: Uuid,
  scopeId: Uuid,
  weights: ContributionWeights = snapshot.project.contributionWeights,
): ContributionResult {
  const scopeActivityIds = new Set(activitiesInScope(snapshot, scopeId));

  // Sesiones: cuántas de las del ámbito son de esta materia.
  const scopeSessions = snapshot.sessions.filter((session) => {
    if (scopeId === snapshot.project.id) return true;
    return snapshot.edges.some(
      (edge) =>
        edge.type === 'ejecuta' &&
        edge.sourceId === session.id &&
        scopeActivityIds.has(edge.targetId),
    );
  });
  const subjectSessions = scopeSessions.filter((session) => session.subjectId === subjectId);

  // Actividades: en cuántas participa la materia, vía aristas.
  const activityIds = [...scopeActivityIds];
  const subjectActivityIds = new Set(
    snapshot.edges
      .filter(
        (edge) =>
          edge.sourceId === subjectId &&
          edge.sourceType === 'MATERIA' &&
          scopeActivityIds.has(edge.targetId),
      )
      .map((edge) => edge.targetId),
  );
  // Una actividad también cuenta si desarrolla criterios de esta materia.
  const criteriaOfSubject = new Set(
    snapshot.evaluationCriteria
      .filter((criterion) => criterion.subjectId === subjectId)
      .map((criterion) => criterion.id),
  );
  for (const edge of snapshot.edges) {
    if (
      edge.type === 'desarrolla' &&
      scopeActivityIds.has(edge.sourceId) &&
      criteriaOfSubject.has(edge.targetId)
    ) {
      subjectActivityIds.add(edge.sourceId);
    }
  }

  // Criterios: cuántos de los desarrollados en el ámbito son de esta materia.
  const criteriaInScope = new Set(
    snapshot.edges
      .filter((edge) => edge.type === 'desarrolla' && scopeActivityIds.has(edge.sourceId))
      .map((edge) => edge.targetId),
  );
  const subjectCriteriaInScope = [...criteriaInScope].filter((id) => criteriaOfSubject.has(id));

  // Producto final: aristas `contribuye_a` desde la materia o sus actividades.
  const finalProductIds = new Set(snapshot.finalProducts.map((product) => product.id));
  const contributionsToProduct = snapshot.edges.filter(
    (edge) => edge.type === 'contribuye_a' && finalProductIds.has(edge.targetId),
  );
  const subjectContributionsToProduct = contributionsToProduct.filter(
    (edge) => edge.sourceId === subjectId || subjectActivityIds.has(edge.sourceId),
  );

  // Evaluación: evidencias recogidas contra criterios de esta materia.
  const evidencesInScope = snapshot.evidences.filter((evidence) =>
    scopeActivityIds.has(evidence.activityId),
  );
  const subjectEvidences = evidencesInScope.filter((evidence) =>
    criteriaOfSubject.has(evidence.criterionId),
  );

  const breakdown: ContributionFactor[] = [
    factor('sesiones', subjectSessions.length, scopeSessions.length, weights.sessions),
    factor('actividades', subjectActivityIds.size, activityIds.length, weights.activities),
    factor('criterios', subjectCriteriaInScope.length, criteriaInScope.size, weights.criteria),
    factor(
      'productoFinal',
      subjectContributionsToProduct.length,
      contributionsToProduct.length,
      weights.finalProduct,
    ),
    factor('evaluacion', subjectEvidences.length, evidencesInScope.length, weights.assessment),
  ];

  // Se divide por la suma de pesos y no por el número de factores: si el equipo
  // pone a cero el peso de la evaluación, ese factor no debe diluir el resultado.
  const weightSum = breakdown.reduce((sum, item) => sum + item.weight, 0);
  const points = breakdown.reduce((sum, item) => sum + item.points, 0);
  const total = weightSum > 0 ? points / weightSum : 0;

  return {
    subjectId,
    scopeId,
    total: Math.min(1, Math.max(0, total)),
    breakdown,
    mode: 'CALCULADA',
  };
}

/**
 * Resuelve qué contribución mostrar cuando existe un valor manual.
 *
 * **El valor manual siempre gana.** Si el cálculo discrepa, la discrepancia se
 * adjunta como `calculatedAlternative` para que la interfaz pueda ofrecer
 * adoptarla, pero no se aplica nunca por iniciativa propia. Esta función es el
 * único sitio donde se decide eso, precisamente para que no se decida en veinte
 * sitios distintos (§6, §20).
 */
export function resolveContribution(
  calculated: ContributionResult,
  manualEdge: Edge | undefined,
): ContributionResult {
  if (!manualEdge || manualEdge.metadata.mode !== 'MANUAL' || manualEdge.metadata.weight === null) {
    return calculated;
  }

  const manual = manualEdge.metadata.weight;
  const differs = Math.abs(manual - calculated.total) > 0.005;

  return {
    ...calculated,
    total: manual,
    mode: 'MANUAL',
    ...(differs ? { calculatedAlternative: calculated.total } : {}),
  };
}

/**
 * La matriz de contribución interdisciplinar (§6).
 *
 * Filas: materias. Columnas: los ámbitos que se pidan (situaciones, actividades,
 * el proyecto). Cada celda conserva su desglose completo, para que pulsar sobre un
 * porcentaje pueda explicarlo sin recalcular nada.
 */
export function buildContributionMatrix(
  snapshot: ProjectSnapshot,
  scopeIds: readonly Uuid[],
): Map<Uuid, Map<Uuid, ContributionResult>> {
  const matrix = new Map<Uuid, Map<Uuid, ContributionResult>>();

  for (const subject of snapshot.subjects) {
    const row = new Map<Uuid, ContributionResult>();
    for (const scopeId of scopeIds) {
      const calculated = computeContribution(snapshot, subject.id, scopeId);
      const manualEdge = snapshot.edges.find(
        (edge) =>
          edge.sourceId === subject.id &&
          edge.targetId === scopeId &&
          edge.metadata.mode === 'MANUAL',
      );
      row.set(scopeId, resolveContribution(calculated, manualEdge));
    }
    matrix.set(subject.id, row);
  }

  return matrix;
}
