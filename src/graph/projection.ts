import type { EdgeType, NodeType, ProjectSnapshot, Uuid } from '@/domain';
import { buildContributionMatrix, computeContribution } from '@/domain';

/**
 * Proyección del dominio al grafo visual (§3, §4).
 *
 * Es una función pura: recibe el proyecto, un nivel y unos filtros, y devuelve qué
 * nodos y aristas hay que dibujar. No conoce Cytoscape ni React, así que se puede
 * probar sin montar nada y sin navegador.
 *
 * Que el filtrado ocurra **aquí y no en Cytoscape** es lo que hace posible el
 * requisito de la §28. Dibujar 1500 aristas y luego ocultar mil es lento; calcular
 * antes cuáles hacen falta y entregar solo esas, no.
 */

/** Los cinco niveles conceptuales de la §4. */
export const SEMANTIC_LEVELS = [
  'GALAXIA',
  'CONSTELACIONES',
  'ACTIVIDADES',
  'CURRICULO',
  'SESIONES',
] as const;

export type SemanticLevel = (typeof SEMANTIC_LEVELS)[number];

export const LEVEL_INFO: Record<SemanticLevel, { title: string; description: string }> = {
  GALAXIA: {
    title: 'Galaxia',
    description: 'El proyecto y las materias que participan en él.',
  },
  CONSTELACIONES: {
    title: 'Constelaciones',
    description: 'Las situaciones de aprendizaje y qué materias intervienen en cada una.',
  },
  ACTIVIDADES: {
    title: 'Actividades',
    description: 'Cada situación descompuesta en actividades, con sus dependencias.',
  },
  CURRICULO: {
    title: 'Currículo',
    description: 'Los criterios de evaluación y saberes que moviliza cada actividad.',
  },
  SESIONES: {
    title: 'Sesiones',
    description: 'El reparto real de las actividades en sesiones y fechas.',
  },
};

export interface GraphNode {
  readonly id: Uuid;
  readonly label: string;
  readonly type: NodeType;
  /** Color de la materia asociada, o null si el nodo no pertenece a ninguna. */
  readonly color: string | null;
  /** Tamaño relativo: las situaciones son mayores que las actividades (§3). */
  readonly size: number;
  /** Texto largo para el título accesible y el tooltip. */
  readonly detail: string;
}

export interface GraphEdge {
  readonly id: Uuid;
  readonly source: Uuid;
  readonly target: Uuid;
  readonly type: EdgeType;
  /** Intensidad 0..1, o null si esta relación no tiene ponderación. */
  readonly weight: number | null;
  /** Si la ponderación la fijó un docente. Se dibuja distinto (§16, §20). */
  readonly manual: boolean;
  readonly label: string;
}

export interface GraphProjection {
  readonly level: SemanticLevel;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export interface GraphFilters {
  /** Materias visibles. Vacío significa todas (§22). */
  readonly subjectIds?: readonly Uuid[];
  /** Umbral mínimo de intensidad para dibujar una arista ponderada. */
  readonly minWeight?: number;
  /** Semana concreta del proyecto, para el nivel de sesiones. */
  readonly weekIndex?: number | null;
}

/** Tamaños relativos por tipo de nodo. El proyecto es el sol del sistema. */
const SIZE: Record<NodeType, number> = {
  PROYECTO: 82,
  SITUACION_APRENDIZAJE: 54,
  MATERIA: 44,
  PRODUCTO_FINAL: 40,
  ACTIVIDAD: 28,
  HITO: 26,
  DOCENTE: 24,
  COMPETENCIA_ESPECIFICA: 22,
  CRITERIO_EVALUACION: 18,
  SABER_BASICO: 16,
  SESION: 12,
};

function node(
  id: Uuid,
  type: NodeType,
  label: string,
  detail: string,
  color: string | null,
): GraphNode {
  return { id, type, label, detail, color, size: SIZE[type] };
}

/** Trunca una etiqueta larga: en un nodo del grafo no cabe una frase entera. */
function short(text: string, max = 34): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Construye la proyección para un nivel.
 *
 * Cada nivel es un conjunto distinto de nodos, no el mismo conjunto más o menos
 * ampliado. Eso es exactamente lo que pide la §4: el zoom cambia el nivel de
 * detalle, no el tamaño.
 */
export function project(
  snapshot: ProjectSnapshot,
  level: SemanticLevel,
  filters: GraphFilters = {},
): GraphProjection {
  const visibleSubjects =
    filters.subjectIds && filters.subjectIds.length > 0
      ? new Set(filters.subjectIds)
      : new Set(snapshot.subjects.map((subject) => subject.id));

  const minWeight = filters.minWeight ?? 0;
  const colorOf = new Map(snapshot.subjects.map((subject) => [subject.id, subject.color]));
  const subjectName = new Map(snapshot.subjects.map((subject) => [subject.id, subject.name]));

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const included = new Set<Uuid>();

  const addNode = (candidate: GraphNode): void => {
    if (included.has(candidate.id)) return;
    included.add(candidate.id);
    nodes.push(candidate);
  };

  const addEdge = (candidate: GraphEdge): void => {
    // Una arista solo se dibuja si ambos extremos están en el nivel. Dibujar la
    // mitad de una relación es peor que no dibujarla: sugiere que el nodo que
    // falta no existe.
    if (!included.has(candidate.source) || !included.has(candidate.target)) return;
    if (candidate.weight !== null && candidate.weight < minWeight) return;
    edges.push(candidate);
  };

  const projectNode = node(
    snapshot.project.id,
    'PROYECTO',
    short(snapshot.project.title),
    snapshot.project.title,
    null,
  );

  const subjectNodes = snapshot.subjects
    .filter((subject) => visibleSubjects.has(subject.id))
    .map((subject) => node(subject.id, 'MATERIA', subject.shortName, subject.name, subject.color));

  // ── Nivel 1 · GALAXIA ────────────────────────────────────────────────────
  if (level === 'GALAXIA') {
    addNode(projectNode);
    subjectNodes.forEach(addNode);

    for (const subject of snapshot.subjects) {
      if (!visibleSubjects.has(subject.id)) continue;
      const contribution = computeContribution(snapshot, subject.id, snapshot.project.id);
      addEdge({
        id: `galaxia:${subject.id}`,
        source: subject.id,
        target: snapshot.project.id,
        type: 'participa_en',
        weight: contribution.total,
        manual: contribution.mode === 'MANUAL',
        label: `${Math.round(contribution.total * 100)} %`,
      });
    }

    return { level, nodes, edges };
  }

  // ── Nivel 2 · CONSTELACIONES ─────────────────────────────────────────────
  if (level === 'CONSTELACIONES') {
    addNode(projectNode);
    subjectNodes.forEach(addNode);

    for (const situation of snapshot.learningSituations) {
      addNode(
        node(
          situation.id,
          'SITUACION_APRENDIZAJE',
          short(situation.title),
          situation.description,
          null,
        ),
      );
      addEdge({
        id: `sda:${situation.id}`,
        source: situation.id,
        target: snapshot.project.id,
        type: 'forma_parte_de',
        weight: null,
        manual: false,
        label: '',
      });
    }

    const matrix = buildContributionMatrix(
      snapshot,
      snapshot.learningSituations.map((situation) => situation.id),
    );

    for (const subject of snapshot.subjects) {
      if (!visibleSubjects.has(subject.id)) continue;
      for (const situation of snapshot.learningSituations) {
        const cell = matrix.get(subject.id)?.get(situation.id);
        if (!cell || cell.total <= 0) continue;
        addEdge({
          id: `part:${subject.id}:${situation.id}`,
          source: subject.id,
          target: situation.id,
          type: 'participa_en',
          weight: cell.total,
          manual: cell.mode === 'MANUAL',
          label: `${Math.round(cell.total * 100)} %`,
        });
      }
    }

    return { level, nodes, edges };
  }

  // A partir de aquí todos los niveles parten de situaciones y actividades.
  const criterionSubject = new Map(
    snapshot.evaluationCriteria.map((criterion) => [criterion.id, criterion.subjectId]),
  );

  /** Materias implicadas en una actividad, deducidas de los criterios que desarrolla. */
  const subjectsOfActivity = new Map<Uuid, Set<Uuid>>();
  for (const edge of snapshot.edges) {
    if (edge.type !== 'desarrolla') continue;
    const subjectId = criterionSubject.get(edge.targetId);
    if (subjectId === undefined) continue;
    const set = subjectsOfActivity.get(edge.sourceId) ?? new Set<Uuid>();
    set.add(subjectId);
    subjectsOfActivity.set(edge.sourceId, set);
  }

  /** Una actividad es visible si alguna de sus materias lo es. */
  const activityVisible = (activityId: Uuid): boolean => {
    const subjects = subjectsOfActivity.get(activityId);
    if (!subjects || subjects.size === 0) return true;
    return [...subjects].some((subjectId) => visibleSubjects.has(subjectId));
  };

  /** Color de una actividad: el de su materia, si solo hay una. */
  const activityColor = (activityId: Uuid): string | null => {
    const subjects = [...(subjectsOfActivity.get(activityId) ?? [])];
    if (subjects.length !== 1) return null;
    return colorOf.get(subjects[0] ?? '') ?? null;
  };

  const situationTitle = new Map(
    snapshot.learningSituations.map((situation) => [situation.id, situation.title]),
  );

  for (const situation of snapshot.learningSituations) {
    addNode(
      node(
        situation.id,
        'SITUACION_APRENDIZAJE',
        short(situation.title),
        situation.description,
        null,
      ),
    );
  }

  for (const activity of snapshot.activities) {
    if (!activityVisible(activity.id)) continue;
    addNode(
      node(
        activity.id,
        'ACTIVIDAD',
        short(activity.title),
        situationTitle.get(activity.learningSituationId) ?? '',
        activityColor(activity.id),
      ),
    );
    addEdge({
      id: `parte:${activity.id}`,
      source: activity.id,
      target: activity.learningSituationId,
      type: 'forma_parte_de',
      weight: null,
      manual: false,
      label: '',
    });
  }

  // Las dependencias entre actividades son lo que hace interdisciplinar al
  // proyecto, así que se dibujan en todos los niveles a partir del tercero.
  for (const edge of snapshot.edges) {
    if (edge.type !== 'depende_de') continue;
    addEdge({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'depende_de',
      weight: null,
      manual: false,
      label: '',
    });
  }

  // ── Nivel 3 · ACTIVIDADES ────────────────────────────────────────────────
  if (level === 'ACTIVIDADES') {
    for (const product of snapshot.finalProducts) {
      addNode(node(product.id, 'PRODUCTO_FINAL', short(product.title), product.description, null));
    }
    for (const edge of snapshot.edges) {
      if (edge.type !== 'contribuye_a') continue;
      addEdge({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        type: 'contribuye_a',
        weight: edge.metadata.weight,
        manual: edge.metadata.mode === 'MANUAL',
        label: '',
      });
    }
    return { level, nodes, edges };
  }

  // ── Nivel 4 · CURRÍCULO ──────────────────────────────────────────────────
  if (level === 'CURRICULO') {
    for (const criterion of snapshot.evaluationCriteria) {
      if (!visibleSubjects.has(criterion.subjectId)) continue;
      addNode(
        node(
          criterion.id,
          'CRITERIO_EVALUACION',
          criterion.officialCode ?? short(criterion.name, 18),
          criterion.name,
          colorOf.get(criterion.subjectId) ?? null,
        ),
      );
    }

    for (const knowledge of snapshot.basicKnowledge) {
      if (!visibleSubjects.has(knowledge.subjectId)) continue;
      addNode(
        node(
          knowledge.id,
          'SABER_BASICO',
          short(knowledge.name, 22),
          `${knowledge.block} · ${subjectName.get(knowledge.subjectId) ?? ''}`,
          colorOf.get(knowledge.subjectId) ?? null,
        ),
      );
    }

    for (const edge of snapshot.edges) {
      if (edge.type === 'desarrolla') {
        addEdge({
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          type: 'desarrolla',
          weight: edge.metadata.weight,
          manual: edge.metadata.mode === 'MANUAL',
          label: '',
        });
      } else if (edge.type === 'moviliza') {
        addEdge({
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          type: 'moviliza',
          weight: null,
          manual: false,
          label: '',
        });
      }
    }

    return { level, nodes, edges };
  }

  // ── Nivel 5 · SESIONES ───────────────────────────────────────────────────
  for (const session of snapshot.sessions) {
    if (!visibleSubjects.has(session.subjectId)) continue;
    if (filters.weekIndex != null && session.weekIndex !== filters.weekIndex) continue;
    addNode(
      node(
        session.id,
        'SESION',
        session.date.slice(5),
        `${session.date} ${session.startTime} · ${subjectName.get(session.subjectId) ?? ''}`,
        colorOf.get(session.subjectId) ?? null,
      ),
    );
  }

  for (const edge of snapshot.edges) {
    if (edge.type !== 'ejecuta') continue;
    addEdge({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'ejecuta',
      weight: null,
      manual: false,
      label: '',
    });
  }

  return { level, nodes, edges };
}

/**
 * Los nodos y aristas que hay que resaltar al seleccionar uno (§3).
 *
 * Devuelve los identificadores implicados. Quién los pinte es problema del
 * componente; decidir cuáles son, es problema del dominio visual y se prueba aquí.
 *
 * Si el nodo seleccionado **no está en este nivel** devuelve conjuntos vacíos, y
 * eso significa «no resaltes nada», no «atenúa todo». La diferencia importa: la
 * selección se conserva al cambiar de nivel, así que un docente que tenía elegida
 * una actividad y sube al nivel de galaxia se encontraba el mapa entero apagado
 * sin ningún nodo encendido, que parece una aplicación rota.
 */
export function highlightFor(
  projection: GraphProjection,
  selectedId: Uuid | null,
): { nodes: Set<Uuid>; edges: Set<Uuid> } {
  const nodes = new Set<Uuid>();
  const edges = new Set<Uuid>();
  if (selectedId === null) return { nodes, edges };
  if (!projection.nodes.some((node) => node.id === selectedId)) return { nodes, edges };

  nodes.add(selectedId);
  for (const edge of projection.edges) {
    if (edge.source === selectedId || edge.target === selectedId) {
      edges.add(edge.id);
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  }

  return { nodes, edges };
}
