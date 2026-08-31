import { useMemo, useRef } from 'react';
import type { NodeDescriptor, ProjectSnapshot, Uuid } from '@/domain';

/**
 * Lista de actividades agrupadas por situación de aprendizaje.
 *
 * Es el sustituto navegable del mapa mientras el mapa no existe, y seguirá
 * existiendo después: la §16 exige poder recorrer la aplicación entera con el
 * teclado, y un canvas no lo permite.
 *
 * Las flechas mueven el foco dentro de la lista y el Tab sale de ella, que es el
 * comportamiento que espera cualquiera que navegue por teclado en un árbol.
 */

interface Props {
  snapshot: ProjectSnapshot;
  nodes: Map<Uuid, NodeDescriptor>;
  selectedId: Uuid | null;
  onSelect: (id: Uuid) => void;
}

export function NodeList({ snapshot, nodes, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () =>
      snapshot.learningSituations.map((situation) => ({
        situation,
        activities: snapshot.activities.filter(
          (activity) => activity.learningSituationId === situation.id,
        ),
      })),
    [snapshot.learningSituations, snapshot.activities],
  );

  /** Materias implicadas en una actividad, para mostrar sus colores. */
  const subjectsOf = useMemo(() => {
    const criterionSubject = new Map(
      snapshot.evaluationCriteria.map((criterion) => [criterion.id, criterion.subjectId]),
    );
    const result = new Map<Uuid, Set<Uuid>>();

    for (const edge of snapshot.edges) {
      if (edge.type !== 'desarrolla') continue;
      const subjectId = criterionSubject.get(edge.targetId);
      if (subjectId === undefined) continue;
      const set = result.get(edge.sourceId) ?? new Set<Uuid>();
      set.add(subjectId);
      result.set(edge.sourceId, set);
    }

    return result;
  }, [snapshot.edges, snapshot.evaluationCriteria]);

  const colorOf = useMemo(
    () => new Map(snapshot.subjects.map((subject) => [subject.id, subject.color])),
    [snapshot.subjects],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const buttons = [
      ...(containerRef.current?.querySelectorAll<HTMLButtonElement>('button[data-node]') ?? []),
    ];
    const position = buttons.findIndex((button) => button === document.activeElement);
    const next = event.key === 'ArrowDown' ? position + 1 : position - 1;
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-4"
      role="tree"
      aria-label="Actividades del proyecto"
    >
      {groups.map(({ situation, activities }) => (
        <section key={situation.id} role="group" aria-labelledby={`sit-${situation.id}`}>
          <button
            type="button"
            data-node
            id={`sit-${situation.id}`}
            onClick={() => {
              onSelect(situation.id);
            }}
            className={`w-full rounded px-2 py-1 text-left ${
              selectedId === situation.id ? 'bg-cielo-700' : ''
            }`}
          >
            <span className="font-mono text-[10px] tracking-[0.12em] text-laton-500 uppercase">
              SdA · {situation.estimatedSessions} sesiones
            </span>
            <span className="block text-sm font-semibold text-tinta-100">{situation.title}</span>
          </button>

          <ul className="mt-1 flex flex-col gap-0.5 border-l border-cielo-600 pl-2">
            {activities.map((activity) => {
              const subjectIds = [...(subjectsOf.get(activity.id) ?? [])];
              const isSelected = selectedId === activity.id;

              return (
                <li key={activity.id} role="treeitem" aria-selected={isSelected}>
                  <button
                    type="button"
                    data-node
                    onClick={() => {
                      onSelect(activity.id);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors ${
                      isSelected ? 'bg-cielo-700 text-laton-400' : 'hover:bg-cielo-800'
                    }`}
                  >
                    <span aria-hidden="true" className="flex flex-none gap-0.5">
                      {subjectIds.map((subjectId) => (
                        <span
                          key={subjectId}
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: colorOf.get(subjectId) ?? '#767d96' }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {nodes.get(activity.id)?.label ?? activity.title}
                    </span>
                    <span className="font-mono text-[10px] text-tinta-500 tabular-nums">
                      {activity.estimatedSessions}s
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
