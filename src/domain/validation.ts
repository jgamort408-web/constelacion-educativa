import { EDGE_RULES, type Severity } from './enums.ts';
import { detectCycles } from './graph.ts';
import type { Uuid } from './primitives.ts';
import type { ProjectSnapshot } from './snapshot.ts';

/**
 * Detección automática de problemas (§11).
 *
 * La distinción entre las tres severidades es una decisión de producto, no de
 * ingeniería, y conviene tenerla escrita:
 *
 *   - **ERROR**: los datos son incoherentes. El proyecto, tal como está, no puede
 *     ejecutarse. Referencias rotas, ciclos de dependencia, aristas imposibles.
 *   - **ADVERTENCIA**: los datos son válidos pero algo huele mal pedagógicamente.
 *     Un criterio sin evaluar, una materia sobrecargada.
 *   - **SUGERENCIA**: una mejora posible. Nunca bloquea nada.
 *
 * Mezclarlas convierte el panel de alertas en ruido que se acaba ignorando, que es
 * exactamente lo contrario de lo que pide la §11.
 */

export interface Finding {
  /** Identificador estable de la regla, para poder silenciarla o enlazarla. */
  readonly rule: string;
  readonly severity: Severity;
  /** Mensaje dirigido a un docente, no a un programador. */
  readonly message: string;
  /** Nodos implicados, para poder resaltarlos en el mapa. */
  readonly nodeIds: readonly Uuid[];
  /** Qué hacer al respecto, cuando hay una acción clara. */
  readonly hint?: string;
}

type Rule = (snapshot: ProjectSnapshot) => Finding[];

/** Índice de identificadores existentes, para detectar referencias rotas. */
function collectKnownIds(snapshot: ProjectSnapshot): Set<Uuid> {
  const ids = new Set<Uuid>([snapshot.project.id]);
  const collections = [
    snapshot.subjects,
    snapshot.teachers,
    snapshot.learningSituations,
    snapshot.activities,
    snapshot.sessions,
    snapshot.milestones,
    snapshot.finalProducts,
    snapshot.competencies,
    snapshot.evaluationCriteria,
    snapshot.basicKnowledge,
    snapshot.assessmentInstruments,
    snapshot.evidences,
  ];
  for (const collection of collections) {
    for (const entity of collection) ids.add(entity.id);
  }
  return ids;
}

/**
 * ERROR · dos elementos comparten identificador.
 *
 * Rompe la premisa sobre la que descansa todo lo demás: que un identificador
 * designa una cosa. Si se cuela, la base de datos sobrescribe silenciosamente uno
 * con el otro al guardar, y el docente pierde datos sin que nada avise.
 */
const duplicateIds: Rule = (snapshot) => {
  const findings: Finding[] = [];
  const seen = new Set<Uuid>();
  const reported = new Set<Uuid>();

  const check = (id: Uuid, what: string): void => {
    if (seen.has(id)) {
      if (!reported.has(id)) {
        reported.add(id);
        findings.push({
          rule: 'identificador-duplicado',
          severity: 'ERROR',
          message: `Hay más de un elemento (${what}) con el mismo identificador.`,
          nodeIds: [id],
          hint: 'Al guardar, uno sobrescribiría al otro. Regenera el identificador de uno de los dos.',
        });
      }
      return;
    }
    seen.add(id);
  };

  for (const entity of [
    ...snapshot.subjects,
    ...snapshot.teachers,
    ...snapshot.learningSituations,
    ...snapshot.activities,
    ...snapshot.sessions,
    ...snapshot.milestones,
    ...snapshot.finalProducts,
    ...snapshot.competencies,
    ...snapshot.evaluationCriteria,
    ...snapshot.basicKnowledge,
    ...snapshot.assessmentInstruments,
    ...snapshot.evidences,
  ]) {
    check(entity.id, 'entidad');
  }

  for (const edge of snapshot.edges) {
    check(edge.id, `relación «${EDGE_RULES[edge.type].label}»`);
  }

  return findings;
};

/** ERROR · una arista apunta a algo que no existe. */
const danglingEdges: Rule = (snapshot) => {
  const known = collectKnownIds(snapshot);
  const findings: Finding[] = [];

  for (const edge of snapshot.edges) {
    const missing: Uuid[] = [];
    if (!known.has(edge.sourceId)) missing.push(edge.sourceId);
    if (!known.has(edge.targetId)) missing.push(edge.targetId);
    if (missing.length > 0) {
      findings.push({
        rule: 'arista-huerfana',
        severity: 'ERROR',
        message: `Una relación de tipo «${EDGE_RULES[edge.type].label}» apunta a un elemento que ya no existe.`,
        nodeIds: missing,
        hint: 'Suele ocurrir al borrar un elemento sin borrar sus relaciones. Elimina la relación.',
      });
    }
  }

  return findings;
};

/** ERROR · una arista conecta tipos que no admite su definición. */
const invalidEdgeEndpoints: Rule = (snapshot) => {
  const findings: Finding[] = [];

  for (const edge of snapshot.edges) {
    const rule = EDGE_RULES[edge.type];
    const fromOk = rule.from.includes(edge.sourceType);
    const toOk = rule.to.includes(edge.targetType);
    if (!fromOk || !toOk) {
      findings.push({
        rule: 'extremos-invalidos',
        severity: 'ERROR',
        message: `La relación «${rule.label}» no puede ir de ${edge.sourceType} a ${edge.targetType}.`,
        nodeIds: [edge.sourceId, edge.targetId],
        hint: `«${rule.label}» solo admite ${rule.from.join(' o ')} → ${rule.to.join(' o ')}.`,
      });
    }
  }

  return findings;
};

/** ERROR · dos actividades se esperan mutuamente. */
const dependencyCycles: Rule = (snapshot) => {
  const titleOf = new Map(snapshot.activities.map((a) => [a.id, a.title]));
  return detectCycles(snapshot.edges).map((cycle) => ({
    rule: 'ciclo-dependencias',
    severity: 'ERROR' as const,
    message: `Estas actividades dependen unas de otras en círculo y ninguna puede empezar: ${cycle
      .map((id) => titleOf.get(id) ?? id)
      .join(' → ')}.`,
    nodeIds: cycle,
    hint: 'Elimina una de las dependencias del círculo.',
  }));
};

/**
 * ERROR · una actividad necesita un resultado que todavía no existe.
 *
 * La comparación correcta no es entre fechas de comienzo, sino entre el **final**
 * del prerrequisito y el **comienzo** de quien lo necesita: si Tecnología empieza
 * su maqueta cuando Matemáticas aún no ha terminado el presupuesto, el problema es
 * real aunque Matemáticas empezara antes (§11).
 *
 * Se compara fecha y hora, no solo fecha. Un prerrequisito impartido a primera
 * hora y una actividad dependiente a última del mismo día es una secuencia
 * perfectamente válida, y marcarla como error entrenaría al docente a ignorar el
 * panel de alertas.
 */
const dependencyAfterDependent: Rule = (snapshot) => {
  const findings: Finding[] = [];
  const sessionsByActivity = new Map<Uuid, string[]>();

  for (const edge of snapshot.edges) {
    if (edge.type !== 'ejecuta') continue;
    const session = snapshot.sessions.find((candidate) => candidate.id === edge.sourceId);
    if (!session) continue;
    const moments = sessionsByActivity.get(edge.targetId) ?? [];
    moments.push(`${session.date}T${session.startTime}`);
    sessionsByActivity.set(edge.targetId, moments);
  }

  const sorted = (activityId: Uuid): string[] =>
    [...(sessionsByActivity.get(activityId) ?? [])].sort();
  const readable = (moment: string): string => moment.replace('T', ' a las ');
  const titleOf = new Map(snapshot.activities.map((a) => [a.id, a.title]));

  for (const edge of snapshot.edges) {
    if (edge.type !== 'depende_de') continue;

    const dependentStart = sorted(edge.sourceId)[0];
    const prerequisiteEnd = sorted(edge.targetId).at(-1);
    if (dependentStart === undefined || prerequisiteEnd === undefined) continue;

    if (prerequisiteEnd >= dependentStart) {
      findings.push({
        rule: 'dependencia-tardia',
        severity: 'ERROR',
        message: `«${titleOf.get(edge.sourceId) ?? edge.sourceId}» empieza el ${readable(
          dependentStart,
        )}, pero «${titleOf.get(edge.targetId) ?? edge.targetId}», que necesita, no termina hasta el ${readable(prerequisiteEnd)}.`,
        nodeIds: [edge.sourceId, edge.targetId],
        hint: 'Adelanta la actividad de la que se depende, o retrasa la que la necesita.',
      });
    }
  }

  return findings;
};

/** ADVERTENCIA · una actividad desarrolla un criterio sin instrumento para evaluarlo. */
const criterionWithoutInstrument: Rule = (snapshot) => {
  const findings: Finding[] = [];
  const evaluated = new Set(
    snapshot.evidences.map((evidence) => `${evidence.activityId}:${evidence.criterionId}`),
  );
  const criterionName = new Map(
    snapshot.evaluationCriteria.map((c) => [c.id, c.officialCode ?? c.name]),
  );
  const titleOf = new Map(snapshot.activities.map((a) => [a.id, a.title]));

  for (const edge of snapshot.edges) {
    if (edge.type !== 'desarrolla') continue;
    if (evaluated.has(`${edge.sourceId}:${edge.targetId}`)) continue;

    findings.push({
      rule: 'criterio-sin-instrumento',
      severity: 'ADVERTENCIA',
      message: `«${titleOf.get(edge.sourceId) ?? edge.sourceId}» desarrolla el criterio ${
        criterionName.get(edge.targetId) ?? edge.targetId
      } pero no tiene ningún instrumento asociado para evaluarlo.`,
      nodeIds: [edge.sourceId, edge.targetId],
      hint: 'Asocia una rúbrica, una lista de cotejo o una observación a esta actividad.',
    });
  }

  return findings;
};

/**
 * SUGERENCIA · qué parte del currículo cargado sigue sin trabajarse.
 *
 * Emite **un solo hallazgo con el recuento**, no uno por criterio. La diferencia
 * importa: al cargar el currículo oficial entran ciento sesenta y cinco criterios
 * de golpe, y una advertencia por cada uno convertía el panel en un muro de ruido
 * que enterraba los errores de verdad. Con el catálogo completo cargado, «no
 * trabajado todavía» es el estado normal de la mayoría, no una anomalía.
 *
 * Por eso también baja de ADVERTENCIA a SUGERENCIA: informa de la cobertura, no
 * señala un fallo.
 */
const untouchedCriteria: Rule = (snapshot) => {
  if (snapshot.evaluationCriteria.length === 0) return [];

  const worked = new Set(
    snapshot.edges.filter((edge) => edge.type === 'desarrolla').map((edge) => edge.targetId),
  );
  const pendientes = snapshot.evaluationCriteria.filter((criterion) => !worked.has(criterion.id));
  if (pendientes.length === 0) return [];

  const total = snapshot.evaluationCriteria.length;
  const cubiertos = total - pendientes.length;
  const muestra = pendientes
    .slice(0, 4)
    .map((criterion) => criterion.officialCode ?? criterion.name.slice(0, 30))
    .join(', ');

  return [
    {
      rule: 'cobertura-curricular',
      severity: 'SUGERENCIA',
      message:
        `El proyecto trabaja ${cubiertos} de los ${total} criterios cargados. ` +
        `Quedan ${pendientes.length} sin asignar a ninguna actividad, entre ellos ${muestra}.`,
      nodeIds: pendientes.slice(0, 12).map((criterion) => criterion.id),
      hint: 'Es normal si acabas de cargar el currículo completo: un proyecto no cubre toda la materia.',
    },
  ];
};

/** ADVERTENCIA · una situación de aprendizaje que no aporta al producto final. */
const situationWithoutProductLink: Rule = (snapshot) => {
  if (snapshot.finalProducts.length === 0) return [];

  const finalProductIds = new Set(snapshot.finalProducts.map((product) => product.id));
  const activitiesBySituation = new Map<Uuid, Uuid[]>();
  for (const activity of snapshot.activities) {
    const list = activitiesBySituation.get(activity.learningSituationId) ?? [];
    list.push(activity.id);
    activitiesBySituation.set(activity.learningSituationId, list);
  }

  const contributes = new Set(
    snapshot.edges
      .filter((edge) => edge.type === 'contribuye_a' && finalProductIds.has(edge.targetId))
      .map((edge) => edge.sourceId),
  );

  return snapshot.learningSituations
    .filter((situation) => {
      if (contributes.has(situation.id)) return false;
      const activities = activitiesBySituation.get(situation.id) ?? [];
      return !activities.some((id) => contributes.has(id));
    })
    .map((situation) => ({
      rule: 'situacion-sin-producto',
      severity: 'ADVERTENCIA' as const,
      message: `«${situation.title}» no contribuye de forma explícita al producto final.`,
      nodeIds: [situation.id],
      hint: 'Si sí aporta, conéctala al producto final. Si no, revisa por qué está en el proyecto.',
    }));
};

/** ADVERTENCIA · una semana en la que una materia acapara las sesiones. */
const weeklyOverload: Rule = (snapshot) => {
  const findings: Finding[] = [];
  const byWeek = new Map<number, Map<Uuid, number>>();

  for (const session of snapshot.sessions) {
    const week = byWeek.get(session.weekIndex) ?? new Map<Uuid, number>();
    week.set(session.subjectId, (week.get(session.subjectId) ?? 0) + 1);
    byWeek.set(session.weekIndex, week);
  }

  const subjectName = new Map(snapshot.subjects.map((s) => [s.id, s.name]));

  for (const [weekIndex, counts] of byWeek) {
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (total < 4) continue; // Con muy pocas sesiones el reparto no significa nada.

    for (const [subjectId, count] of counts) {
      if (count / total > 0.6) {
        findings.push({
          rule: 'semana-desequilibrada',
          severity: 'ADVERTENCIA',
          message: `En la semana ${weekIndex + 1}, ${subjectName.get(subjectId) ?? subjectId} concentra ${Math.round(
            (count / total) * 100,
          )} % de las sesiones del proyecto.`,
          nodeIds: [subjectId],
          hint: 'Reparte alguna actividad hacia semanas contiguas si el equipo lo ve razonable.',
        });
      }
    }
  }

  return findings;
};

/** SUGERENCIA · elementos curriculares de demostración presentes en el proyecto. */
const demoDataPresent: Rule = (snapshot) => {
  const demoVersions = new Set(
    snapshot.curriculumVersions.filter((version) => version.isDemo).map((version) => version.id),
  );
  if (demoVersions.size === 0) return [];

  const demoCriteria = snapshot.evaluationCriteria.filter((criterion) =>
    demoVersions.has(criterion.curriculumVersionId),
  );
  if (demoCriteria.length === 0) return [];

  return [
    {
      rule: 'curriculo-de-demostracion',
      severity: 'SUGERENCIA' as const,
      message: `Este proyecto usa ${demoCriteria.length} criterios de demostración. No son códigos oficiales y no deben citarse en una programación.`,
      nodeIds: demoCriteria.map((criterion) => criterion.id),
      hint: 'Carga el currículo oficial con el importador y reasigna los criterios.',
    },
  ];
};

/** SUGERENCIA · una actividad sin docente responsable. */
const activityWithoutOwner: Rule = (snapshot) => {
  const owned = new Set(
    snapshot.edges.filter((edge) => edge.type === 'responsable_de').map((edge) => edge.targetId),
  );

  return snapshot.activities
    .filter((activity) => !owned.has(activity.id))
    .map((activity) => ({
      rule: 'actividad-sin-responsable',
      severity: 'SUGERENCIA' as const,
      message: `«${activity.title}» no tiene ningún docente asignado como responsable.`,
      nodeIds: [activity.id],
      hint: 'Sin responsable, esta actividad no aparecerá en la vista «Esta semana» de nadie.',
    }));
};

const RULES: readonly Rule[] = [
  duplicateIds,
  danglingEdges,
  invalidEdgeEndpoints,
  dependencyCycles,
  dependencyAfterDependent,
  criterionWithoutInstrument,
  untouchedCriteria,
  situationWithoutProductLink,
  weeklyOverload,
  demoDataPresent,
  activityWithoutOwner,
];

const SEVERITY_ORDER: Record<Severity, number> = { ERROR: 0, ADVERTENCIA: 1, SUGERENCIA: 2 };

/**
 * Ejecuta todas las reglas y devuelve los hallazgos ordenados por gravedad.
 *
 * Es una función pura sobre el snapshot: no consulta la base de datos ni el estado
 * de la interfaz. Puede correrse en un test, en un script de línea de comandos o
 * antes de importar un archivo.
 */
export function validateSnapshot(snapshot: ProjectSnapshot): Finding[] {
  return RULES.flatMap((rule) => rule(snapshot)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

/** Cuenta los hallazgos por severidad, para las insignias del panel. */
export function summarizeFindings(findings: readonly Finding[]): Record<Severity, number> {
  return {
    ERROR: findings.filter((f) => f.severity === 'ERROR').length,
    ADVERTENCIA: findings.filter((f) => f.severity === 'ADVERTENCIA').length,
    SUGERENCIA: findings.filter((f) => f.severity === 'SUGERENCIA').length,
  };
}
