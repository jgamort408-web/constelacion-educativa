import type { EdgeType, NodeType, ProjectSnapshot, Uuid } from '@/domain';
import { buildContributionMatrix, computeContribution } from '@/domain';
import { ASPECTO, iconoDeCriterio } from './iconos.ts';

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
  /**
   * Nodo contenedor, para agrupar visualmente.
   *
   * Los criterios cuelgan de su competencia y las competencias de su materia, de
   * modo que en pantalla forman islas en vez de una nube revuelta: el criterio
   * 1.2.1 aparece dentro de la competencia 1.2, que aparece dentro de su materia.
   */
  readonly parent?: Uuid;
  /**
   * Clave de ordenación natural.
   *
   * Ordenar por texto pone el 10 justo detrás del 1, porque compara carácter a
   * carácter. Esta clave rellena los números con ceros para que 1, 2, … 9, 10
   * salgan en su orden.
   */
  readonly sortKey: string;
  /** Silueta del nodo. La forma es el segundo portador de información (§16). */
  readonly shape: string;
  /** Icono en línea, como data URI. */
  readonly icono: string;
  /** Qué representa el icono, para el panel y los lectores de pantalla. */
  readonly iconoRotulo: string;
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

/**
 * Clave de orden que respeta el valor de los números.
 *
 * «MAT.1.10.2» debe ir después de «MAT.1.9.1», no entre «MAT.1.1» y «MAT.1.2».
 * Se consigue rellenando cada tramo numérico a seis cifras.
 */
export function naturalKey(texto: string): string {
  return texto.replace(/\d+/g, (n) => n.padStart(6, '0'));
}

function node(
  id: Uuid,
  type: NodeType,
  label: string,
  detail: string,
  color: string | null,
  extra: { parent?: Uuid; sortKey?: string } = {},
): GraphNode {
  const aspecto = ASPECTO[type];
  // Los criterios llevan además el icono de su familia de verbo: dice qué pide
  // hacer, que es más útil que repetir el símbolo genérico de «criterio».
  const propio =
    type === 'CRITERIO_EVALUACION'
      ? iconoDeCriterio(detail || label)
      : { icono: aspecto.icono, rotulo: aspecto.rotulo };

  return {
    id,
    type,
    label,
    detail,
    color,
    size: SIZE[type],
    sortKey: naturalKey(extra.sortKey ?? label),
    shape: aspecto.shape,
    icono: propio.icono,
    iconoRotulo: propio.rotulo,
    ...(extra.parent === undefined ? {} : { parent: extra.parent }),
  };
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

    return ordenar({ level, nodes, edges });
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
    // Las materias son los contenedores de primer nivel: cada una recoge sus
    // competencias, y cada competencia sus criterios. Sin esta jerarquía los
    // criterios de tres materias salían mezclados y era imposible encontrar uno.
    subjectNodes.forEach(addNode);

    const competenciasConCriterios = new Set(
      snapshot.evaluationCriteria.map((criterion) => criterion.competencyId),
    );

    for (const competency of snapshot.competencies) {
      if (!visibleSubjects.has(competency.subjectId)) continue;
      if (!competenciasConCriterios.has(competency.id)) continue;
      addNode(
        node(
          competency.id,
          'COMPETENCIA_ESPECIFICA',
          competency.officialCode ?? short(competency.name, 16),
          competency.description,
          colorOf.get(competency.subjectId) ?? null,
          { parent: competency.subjectId, sortKey: competency.officialCode ?? competency.name },
        ),
      );
    }

    for (const criterion of snapshot.evaluationCriteria) {
      if (!visibleSubjects.has(criterion.subjectId)) continue;
      addNode(
        node(
          criterion.id,
          'CRITERIO_EVALUACION',
          criterion.officialCode ?? short(criterion.name, 18),
          criterion.description,
          colorOf.get(criterion.subjectId) ?? null,
          {
            // Cuelga de su competencia si está dibujada; si no, de su materia.
            parent: included.has(criterion.competencyId)
              ? criterion.competencyId
              : criterion.subjectId,
            sortKey: criterion.officialCode ?? criterion.name,
          },
        ),
      );
    }

    for (const knowledge of snapshot.basicKnowledge) {
      if (!visibleSubjects.has(knowledge.subjectId)) continue;
      addNode(
        node(
          knowledge.id,
          'SABER_BASICO',
          knowledge.officialCode ?? short(knowledge.name, 20),
          `${knowledge.block} · ${knowledge.description}`,
          colorOf.get(knowledge.subjectId) ?? null,
          { parent: knowledge.subjectId, sortKey: knowledge.officialCode ?? knowledge.name },
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

    return ordenar({ level, nodes, edges });
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

  return ordenar({ level, nodes, edges });
}

/** Devuelve la proyección con los nodos en orden natural. */
function ordenar(proyeccion: GraphProjection): GraphProjection {
  return {
    ...proyeccion,
    nodes: [...proyeccion.nodes].sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'es')),
  };
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
): { nodes: Set<Uuid>; edges: Set<Uuid>; ancestors: Set<Uuid> } {
  const nodes = new Set<Uuid>();
  const edges = new Set<Uuid>();
  const ancestors = new Set<Uuid>();
  if (selectedId === null) return { nodes, edges, ancestors };
  if (!projection.nodes.some((node) => node.id === selectedId)) {
    return { nodes, edges, ancestors };
  }

  nodes.add(selectedId);
  for (const edge of projection.edges) {
    if (edge.source === selectedId || edge.target === selectedId) {
      edges.add(edge.id);
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  }

  /**
   * Los contenedores de lo resaltado tampoco se atenúan.
   *
   * Un criterio vive dentro de su competencia y esta dentro de su materia. Si
   * esos dos contenedores se apagan, el criterio queda encerrado en una caja
   * oscura y parece que no se ha encendido, aunque sus conexiones sí lo estén.
   * Es lo que hacía que seleccionar un criterio iluminara sus aristas pero no a
   * él mismo.
   */
  const padreDe = new Map(projection.nodes.map((node) => [node.id, node.parent]));
  for (const id of nodes) {
    let actual = padreDe.get(id);
    let saltos = 0;
    while (actual !== undefined && saltos < 6) {
      ancestors.add(actual);
      actual = padreDe.get(actual);
      saltos += 1;
    }
  }

  return { nodes, edges, ancestors };
}
