import type { Edge, NodeRef } from './edge.ts';
import type { EdgeType, NodeType } from './enums.ts';
import type { Uuid } from './primitives.ts';

/**
 * Recorrido del grafo (§31, trazabilidad).
 *
 * Funciones puras sobre una lista de aristas. No conocen React, ni Cytoscape, ni
 * de dónde salieron los datos: reciben aristas y devuelven respuestas. Esto es lo
 * que permite probarlas sin montar nada y reutilizarlas en un backend.
 *
 * El índice de adyacencia se construye una vez y se consulta muchas. Recorrer el
 * array de aristas en cada pregunta funcionaría con el proyecto DEMO y se
 * arrastraría con los 1500 enlaces que exige la §28.
 */

export interface AdjacencyIndex {
  /** Aristas que salen de cada nodo. */
  readonly outgoing: ReadonlyMap<Uuid, readonly Edge[]>;
  /** Aristas que entran en cada nodo. */
  readonly incoming: ReadonlyMap<Uuid, readonly Edge[]>;
  /** Aristas agrupadas por tipo, para las consultas del tipo "todas las dependencias". */
  readonly byType: ReadonlyMap<EdgeType, readonly Edge[]>;
  /** Tipo de nodo conocido para cada identificador visto en alguna arista. */
  readonly nodeTypes: ReadonlyMap<Uuid, NodeType>;
}

function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

/**
 * Construye los índices a partir de las aristas.
 *
 * Coste lineal. Se recalcula cuando cambian las aristas, no en cada render: quien
 * lo llame debe memoizarlo (ver `src/features/` y la nota sobre selectores en el
 * README de la carpeta).
 */
export function buildAdjacency(edges: readonly Edge[]): AdjacencyIndex {
  const outgoing = new Map<Uuid, Edge[]>();
  const incoming = new Map<Uuid, Edge[]>();
  const byType = new Map<EdgeType, Edge[]>();
  const nodeTypes = new Map<Uuid, NodeType>();

  for (const edge of edges) {
    pushInto(outgoing, edge.sourceId, edge);
    pushInto(incoming, edge.targetId, edge);
    pushInto(byType, edge.type, edge);
    nodeTypes.set(edge.sourceId, edge.sourceType);
    nodeTypes.set(edge.targetId, edge.targetType);
  }

  return { outgoing, incoming, byType, nodeTypes };
}

export interface NeighbourQuery {
  /** Limita a estos tipos de arista. Si se omite, todos. */
  readonly edgeTypes?: readonly EdgeType[];
  /** Limita a vecinos de estos tipos de nodo. Si se omite, todos. */
  readonly nodeTypes?: readonly NodeType[];
  /** Sentido del recorrido. Por defecto, ambos. */
  readonly direction?: 'outgoing' | 'incoming' | 'both';
}

/** Un vecino, con la arista que llevó hasta él. */
export interface Neighbour {
  readonly node: NodeRef;
  readonly edge: Edge;
  readonly direction: 'outgoing' | 'incoming';
}

/**
 * Vecinos directos de un nodo.
 *
 * Devuelve la arista además del nodo porque el motivo de la relación importa
 * tanto como el destino: en el panel lateral no basta con decir que una actividad
 * se conecta con un criterio, hay que decir que lo *desarrolla* y con qué peso.
 */
export function neighbours(
  index: AdjacencyIndex,
  nodeId: Uuid,
  query: NeighbourQuery = {},
): Neighbour[] {
  const direction = query.direction ?? 'both';
  const result: Neighbour[] = [];

  const accept = (edge: Edge, neighbourType: NodeType): boolean => {
    if (query.edgeTypes && !query.edgeTypes.includes(edge.type)) return false;
    if (query.nodeTypes && !query.nodeTypes.includes(neighbourType)) return false;
    return true;
  };

  if (direction === 'outgoing' || direction === 'both') {
    for (const edge of index.outgoing.get(nodeId) ?? []) {
      if (accept(edge, edge.targetType)) {
        result.push({
          node: { id: edge.targetId, type: edge.targetType },
          edge,
          direction: 'outgoing',
        });
      }
    }
  }

  if (direction === 'incoming' || direction === 'both') {
    for (const edge of index.incoming.get(nodeId) ?? []) {
      if (accept(edge, edge.sourceType)) {
        result.push({
          node: { id: edge.sourceId, type: edge.sourceType },
          edge,
          direction: 'incoming',
        });
      }
    }
  }

  return result;
}

export interface TraversalOptions extends NeighbourQuery {
  /** Profundidad máxima. Por defecto sin límite. */
  readonly maxDepth?: number;
}

/** Un nodo alcanzado durante un recorrido, con la distancia y el camino recorrido. */
export interface ReachedNode {
  readonly node: NodeRef;
  readonly depth: number;
  /** Aristas atravesadas desde el origen, en orden. */
  readonly path: readonly Edge[];
}

/**
 * Recorrido en anchura desde un nodo.
 *
 * En anchura y no en profundidad porque la pregunta que responde es «qué hay cerca
 * de esto», y el orden por distancia es el que el panel lateral necesita para
 * mostrar primero lo directamente relacionado.
 *
 * Devuelve el camino completo hasta cada nodo, que es lo que permite responder la
 * pregunta de la §31: no solo *qué* está relacionado, sino *por qué*.
 */
export function traverse(
  index: AdjacencyIndex,
  startId: Uuid,
  options: TraversalOptions = {},
): ReachedNode[] {
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
  const visited = new Set<Uuid>([startId]);
  const result: ReachedNode[] = [];

  let frontier: ReachedNode[] = [
    {
      node: { id: startId, type: index.nodeTypes.get(startId) ?? 'PROYECTO' },
      depth: 0,
      path: [],
    },
  ];

  while (frontier.length > 0 && (frontier[0]?.depth ?? 0) < maxDepth) {
    const next: ReachedNode[] = [];

    for (const current of frontier) {
      for (const neighbour of neighbours(index, current.node.id, options)) {
        if (visited.has(neighbour.node.id)) continue;
        visited.add(neighbour.node.id);
        const reached: ReachedNode = {
          node: neighbour.node,
          depth: current.depth + 1,
          path: [...current.path, neighbour.edge],
        };
        result.push(reached);
        next.push(reached);
      }
    }

    frontier = next;
  }

  return result;
}

/**
 * Ciclos en las relaciones de dependencia.
 *
 * Un ciclo significa que dos actividades se esperan mutuamente: el proyecto es
 * imposible de ejecutar y hay que avisar antes de que el equipo docente lo
 * descubra en mitad del trimestre (§11).
 *
 * Devuelve los identificadores de cada ciclo encontrado, en orden, para poder
 * señalarlos en el mapa.
 */
export function detectCycles(edges: readonly Edge[], edgeType: EdgeType = 'depende_de'): Uuid[][] {
  const relevant = edges.filter((edge) => edge.type === edgeType);
  const successors = new Map<Uuid, Uuid[]>();
  for (const edge of relevant) {
    pushInto(successors, edge.sourceId, edge.targetId);
  }

  const cycles: Uuid[][] = [];
  const seen = new Set<Uuid>();
  const onStack = new Set<Uuid>();
  const stack: Uuid[] = [];

  const visit = (nodeId: Uuid): void => {
    seen.add(nodeId);
    onStack.add(nodeId);
    stack.push(nodeId);

    for (const successor of successors.get(nodeId) ?? []) {
      if (!seen.has(successor)) {
        visit(successor);
      } else if (onStack.has(successor)) {
        const start = stack.indexOf(successor);
        if (start !== -1) cycles.push(stack.slice(start));
      }
    }

    stack.pop();
    onStack.delete(nodeId);
  };

  for (const nodeId of successors.keys()) {
    if (!seen.has(nodeId)) visit(nodeId);
  }

  return cycles;
}

/**
 * Orden topológico de las dependencias.
 *
 * Es el orden en que las actividades pueden ejecutarse sin que ninguna espere a
 * otra posterior. Devuelve `null` si hay ciclos, porque entonces no existe tal
 * orden y fingir uno sería peor que no dar ninguno.
 */
export function topologicalOrder(
  edges: readonly Edge[],
  nodeIds: readonly Uuid[],
  edgeType: EdgeType = 'depende_de',
): Uuid[] | null {
  const relevant = edges.filter((edge) => edge.type === edgeType);
  const inDegree = new Map<Uuid, number>(nodeIds.map((id) => [id, 0]));
  const successors = new Map<Uuid, Uuid[]>();

  for (const edge of relevant) {
    // `depende_de` apunta de la actividad dependiente a su prerrequisito, así que
    // el orden de ejecución va en sentido contrario a la arista.
    pushInto(successors, edge.targetId, edge.sourceId);
    inDegree.set(edge.sourceId, (inDegree.get(edge.sourceId) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: Uuid[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    order.push(current);

    for (const successor of successors.get(current) ?? []) {
      const remaining = (inDegree.get(successor) ?? 0) - 1;
      inDegree.set(successor, remaining);
      if (remaining === 0) queue.push(successor);
    }
  }

  return order.length === inDegree.size ? order : null;
}
