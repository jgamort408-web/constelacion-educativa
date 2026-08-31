import type { ProjectSnapshot, Uuid } from '@/domain';
import type { SemanticLevel } from '@/graph';
import { LEVEL_INFO, SEMANTIC_LEVELS } from '@/graph';

/**
 * Controles del mapa: nivel semántico y filtros (§4, §22).
 *
 * El nivel se elige a mano y **no** lo cambia el zoom de la cámara. La §4 pide que
 * acercarse revele más detalle, pero que el gesto de acercarse cambie por su
 * cuenta lo que se está mirando desorienta: uno acerca para ver mejor algo
 * concreto y de pronto está en otra vista. El docente manda.
 */

interface Props {
  snapshot: ProjectSnapshot;
  level: SemanticLevel;
  onLevel: (level: SemanticLevel) => void;
  subjectIds: readonly Uuid[];
  onSubjects: (ids: readonly Uuid[]) => void;
  minWeight: number;
  onMinWeight: (value: number) => void;
  weekIndex: number | null;
  onWeek: (value: number | null) => void;
}

export function MapControls({
  snapshot,
  level,
  onLevel,
  subjectIds,
  onSubjects,
  minWeight,
  onMinWeight,
  weekIndex,
  onWeek,
}: Props) {
  const weeks = [...new Set(snapshot.sessions.map((session) => session.weekIndex))].sort(
    (a, b) => a - b,
  );

  function toggleSubject(id: Uuid) {
    onSubjects(
      subjectIds.includes(id) ? subjectIds.filter((other) => other !== id) : [...subjectIds, id],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
          Nivel de detalle
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {SEMANTIC_LEVELS.map((candidate, position) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={level === candidate}
              onClick={() => {
                onLevel(candidate);
              }}
              className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                level === candidate
                  ? 'border-laton-500 bg-laton-500/10 text-laton-400'
                  : 'border-borde-500 text-tinta-300 hover:border-tinta-100'
              }`}
            >
              <span className="font-mono text-[10px] text-tinta-500">{position + 1}</span>{' '}
              {LEVEL_INFO[candidate].title}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-tinta-500">{LEVEL_INFO[level].description}</p>
      </div>

      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">Materias</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {snapshot.subjects.map((subject) => {
            const active = subjectIds.length === 0 || subjectIds.includes(subject.id);
            return (
              <button
                key={subject.id}
                type="button"
                aria-pressed={subjectIds.includes(subject.id)}
                onClick={() => {
                  toggleSubject(subject.id);
                }}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? 'border-borde-500 text-tinta-100'
                    : 'border-cielo-600 text-tinta-500 line-through'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? subject.color : '#3a4160' }}
                />
                {subject.shortName}
              </button>
            );
          })}
          {subjectIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onSubjects([]);
              }}
              className="rounded px-2 py-1 text-xs text-tinta-500 underline underline-offset-2 hover:text-laton-400"
            >
              Ver todas
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-1 text-xs text-tinta-300">
          <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Conexiones por encima de {Math.round(minWeight * 100)} %
          </span>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.1}
            value={minWeight}
            onChange={(event) => {
              onMinWeight(Number(event.target.value));
            }}
            className="w-48 accent-laton-500"
          />
        </label>

        {level === 'SESIONES' && (
          <label className="flex flex-col gap-1 text-xs text-tinta-300">
            <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
              Semana
            </span>
            <select
              value={weekIndex ?? ''}
              onChange={(event) => {
                onWeek(event.target.value === '' ? null : Number(event.target.value));
              }}
              className="rounded border border-borde-500 bg-cielo-800 px-2 py-1 text-tinta-100"
            >
              <option value="">Todas</option>
              {weeks.map((week) => (
                <option key={week} value={week}>
                  Semana {week + 1}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
