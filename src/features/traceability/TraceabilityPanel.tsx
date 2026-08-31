import { useMemo } from 'react';
import type { AdjacencyIndex, NodeDescriptor, ProjectSnapshot, Uuid } from '@/domain';
import { EDGE_RULES, neighbours, nodeTypeLabel } from '@/domain';

/**
 * Panel de trazabilidad (§31).
 *
 * Responde la pregunta que ninguna programación en tabla responde bien: **por qué
 * existe esta actividad y quién depende de ella**. Se recorre en ambos sentidos.
 *
 * No es solo una vista alternativa al mapa: es la representación **accesible** del
 * grafo. Cytoscape dibuja sobre un canvas, que para un lector de pantalla es un
 * rectángulo vacío; este árbol expone exactamente los mismos nodos y relaciones
 * con semántica real y navegación por teclado. Las dos vistas leen del mismo
 * store, así que no pueden discrepar.
 */

interface Props {
  snapshot: ProjectSnapshot;
  index: AdjacencyIndex;
  nodes: Map<Uuid, NodeDescriptor>;
  selectedId: Uuid | null;
  onSelect: (id: Uuid) => void;
}

/** Un grupo de vecinos que comparten tipo de relación y sentido. */
interface RelationGroup {
  key: string;
  title: string;
  entries: { descriptor: NodeDescriptor; weight: number | null; note: string }[];
}

export function TraceabilityPanel({ snapshot, index, nodes, selectedId, onSelect }: Props) {
  const selected = selectedId === null ? undefined : nodes.get(selectedId);

  const groups = useMemo<RelationGroup[]>(() => {
    if (selectedId === null) return [];

    const collected = new Map<string, RelationGroup>();

    for (const neighbour of neighbours(index, selectedId)) {
      const rule = EDGE_RULES[neighbour.edge.type];
      const outgoing = neighbour.direction === 'outgoing';
      // El mismo tipo de arista se lee distinto según el sentido: desde una
      // actividad, «desarrolla» apunta a criterios; desde un criterio, lo que
      // llega son las actividades que lo desarrollan.
      const title = outgoing ? rule.label : `${rule.label} ←`;
      const key = `${neighbour.edge.type}:${neighbour.direction}`;

      const descriptor = nodes.get(neighbour.node.id);
      if (!descriptor) continue;

      const group = collected.get(key) ?? { key, title, entries: [] };
      group.entries.push({
        descriptor,
        weight: neighbour.edge.metadata.weight,
        note: neighbour.edge.metadata.note,
      });
      collected.set(key, group);
    }

    // Dentro de cada grupo, orden alfabético. En las sesiones, cuyo rótulo es la
    // fecha en formato ISO, eso equivale a orden cronológico, que es como un
    // docente espera leer «cuándo se imparte esto».
    for (const group of collected.values()) {
      group.entries.sort((a, b) => a.descriptor.label.localeCompare(b.descriptor.label, 'es'));
    }

    return [...collected.values()].sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }, [index, nodes, selectedId]);

  /**
   * Todos los prerrequisitos transitivos, no solo una rama.
   *
   * Una actividad puede depender de varias a la vez: «Redacción del informe
   * diagnóstico» necesita el análisis de Geografía **y** las entrevistas de
   * Lengua. Seguir solo el primer camino mostraría una de las dos y ocultaría la
   * otra, que es peor que no mostrar nada: el docente creería que ya lo tiene todo.
   *
   * Se recorre en anchura y se agrupa por distancia, de forma que lo que aparece
   * arriba es lo que hay que hacer primero.
   */
  const prerequisites = useMemo(() => {
    if (selectedId === null) return [];

    const depthOf = new Map<Uuid, number>();
    const seen = new Set<Uuid>([selectedId]);
    let frontier: Uuid[] = [selectedId];
    let depth = 0;

    while (frontier.length > 0 && depth < 12) {
      depth += 1;
      const next: Uuid[] = [];

      for (const nodeId of frontier) {
        for (const previous of neighbours(index, nodeId, {
          edgeTypes: ['depende_de'],
          direction: 'outgoing',
        })) {
          if (seen.has(previous.node.id)) continue;
          seen.add(previous.node.id);
          depthOf.set(previous.node.id, depth);
          next.push(previous.node.id);
        }
      }

      frontier = next;
    }

    return (
      [...depthOf.entries()]
        // Mayor distancia primero: lo más lejano en la cadena es lo que va antes.
        .sort(([, a], [, b]) => b - a)
        .flatMap(([nodeId]) => {
          const descriptor = nodes.get(nodeId);
          return descriptor ? [descriptor] : [];
        })
    );
  }, [index, nodes, selectedId]);

  if (!selected) {
    return (
      <p className="text-tinta-500">
        Selecciona un elemento para ver de qué depende y a qué afecta.
      </p>
    );
  }

  const activity = snapshot.activities.find((candidate) => candidate.id === selected.id);

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-cielo-600 pb-4">
        <p className="font-mono text-[10px] tracking-[0.14em] text-laton-500 uppercase">
          {nodeTypeLabel(selected.type)}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-tinta-100">{selected.label}</h2>
        {selected.detail && <p className="mt-1 text-sm text-tinta-300">{selected.detail}</p>}
        {activity?.description && (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-tinta-300">
            {activity.description}
          </p>
        )}
        {activity?.materials && (
          <p className="mt-3 text-xs text-tinta-500">
            <span className="text-tinta-300">Materiales:</span> {activity.materials}
          </p>
        )}
      </header>

      {prerequisites.length > 0 && (
        <section aria-labelledby="cadena">
          <h3
            id="cadena"
            className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase"
          >
            Antes hay que haber hecho
          </h3>
          <ol className="mt-2 flex flex-col gap-1">
            {prerequisites.map((node, position) => (
              <li key={node.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[10px] text-tinta-500">{position + 1}</span>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(node.id);
                  }}
                  className="rounded text-left text-tinta-300 underline decoration-cielo-600 underline-offset-2 hover:text-laton-400"
                >
                  {node.label}
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm">
              <span className="font-mono text-[10px] text-laton-500">
                {prerequisites.length + 1}
              </span>
              <span className="font-medium text-tinta-100">{selected.label}</span>
            </li>
          </ol>
        </section>
      )}

      <section aria-labelledby="relaciones">
        <h3
          id="relaciones"
          className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase"
        >
          Relaciones
        </h3>

        <div className="mt-2 flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="text-xs text-tinta-500">{group.title}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {group.entries.map((entry) => (
                  <li key={`${group.key}:${entry.descriptor.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(entry.descriptor.id);
                      }}
                      title={entry.note}
                      className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left hover:bg-cielo-700"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 flex-none translate-y-px rounded-full"
                        style={{ backgroundColor: entry.descriptor.color ?? '#767d96' }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-tinta-100">
                        {entry.descriptor.label}
                      </span>
                      <span className="font-mono text-[10px] text-tinta-500 tabular-nums">
                        {entry.weight === null ? '' : `${Math.round(entry.weight * 100)} %`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
