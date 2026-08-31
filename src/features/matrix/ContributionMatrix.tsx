import { useMemo, useState } from 'react';
import type { ContributionResult, ProjectSnapshot } from '@/domain';
import { buildContributionMatrix } from '@/domain';

/**
 * Matriz de contribución interdisciplinar (§6).
 *
 * Cada celda es pulsable y despliega su desglose completo. Ese es el requisito de
 * la §20: un porcentaje que no se puede explicar es una caja negra, y en algo que
 * un equipo docente va a usar para repartir trabajo, una caja negra es
 * directamente inaceptable.
 *
 * Las celdas con valor manual se distinguen por forma además de por color —llevan
 * un punto y un borde—, porque la §16 prohíbe que el color sea el único portador
 * de información.
 */

interface Props {
  snapshot: ProjectSnapshot;
}

export function ContributionMatrix({ snapshot }: Props) {
  const [openCell, setOpenCell] = useState<string | null>(null);

  const scopeIds = useMemo(
    () => snapshot.learningSituations.map((situation) => situation.id),
    [snapshot.learningSituations],
  );

  const matrix = useMemo(() => buildContributionMatrix(snapshot, scopeIds), [snapshot, scopeIds]);

  const detail: ContributionResult | undefined = useMemo(() => {
    if (openCell === null) return undefined;
    const [subjectId, scopeId] = openCell.split('|');
    if (subjectId === undefined || scopeId === undefined) return undefined;
    return matrix.get(subjectId)?.get(scopeId);
  }, [matrix, openCell]);

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <caption className="sr-only">
            Porcentaje de contribución de cada materia a cada situación de aprendizaje
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pb-2 text-left font-normal text-tinta-500">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase">Materia</span>
              </th>
              {snapshot.learningSituations.map((situation, position) => (
                <th
                  key={situation.id}
                  scope="col"
                  className="pb-2 pl-3 text-right align-bottom font-normal"
                >
                  <span className="font-mono text-[10px] tracking-[0.12em] text-tinta-500 uppercase">
                    SdA {position + 1}
                  </span>
                  <span className="block max-w-[8rem] truncate text-xs text-tinta-300">
                    {situation.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.subjects.map((subject) => (
              <tr key={subject.id} className="border-t border-cielo-700">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                      style={{ backgroundColor: subject.color }}
                    />
                    <span className="text-tinta-100">{subject.name}</span>
                  </span>
                </th>
                {snapshot.learningSituations.map((situation) => {
                  const cell = matrix.get(subject.id)?.get(situation.id);
                  const key = `${subject.id}|${situation.id}`;
                  const percent = Math.round((cell?.total ?? 0) * 100);
                  const isManual = cell?.mode === 'MANUAL';

                  return (
                    <td key={situation.id} className="py-1 pl-3 text-right">
                      <button
                        type="button"
                        aria-expanded={openCell === key}
                        onClick={() => {
                          setOpenCell(openCell === key ? null : key);
                        }}
                        className={`w-full rounded px-2 py-1 text-right font-mono text-xs tabular-nums transition-colors hover:bg-cielo-700 ${
                          openCell === key ? 'bg-cielo-700 text-laton-400' : 'text-tinta-100'
                        } ${isManual ? 'border border-laton-500/50' : 'border border-transparent'}`}
                        title={
                          isManual
                            ? 'Valor fijado por el equipo docente'
                            : 'Valor calculado. Pulsa para ver cómo.'
                        }
                      >
                        {percent} %{isManual && <span aria-hidden="true"> ·</span>}
                        {isManual && <span className="sr-only"> (fijado manualmente)</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-tinta-500">
        Las celdas con borde y punto llevan un valor fijado por el equipo docente. El resto los
        calcula la aplicación. Pulsa cualquiera para ver el desglose.
      </p>

      {detail && <Breakdown result={detail} />}
    </div>
  );
}

/** El desglose de una celda: de dónde sale exactamente ese porcentaje. */
function Breakdown({ result }: { result: ContributionResult }) {
  return (
    <div className="rounded border border-cielo-600 bg-cielo-800 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-tinta-100">
          Cómo se obtiene el {Math.round(result.total * 100)} %
        </h3>
        <span className="font-mono text-[10px] tracking-[0.1em] text-laton-500 uppercase">
          {result.mode === 'MANUAL' ? 'Fijado por el equipo' : 'Calculado'}
        </span>
      </div>

      {result.mode === 'MANUAL' && result.calculatedAlternative !== undefined && (
        <p className="mt-2 rounded bg-cielo-700 px-3 py-2 text-xs text-tinta-300">
          El cálculo daría {Math.round(result.calculatedAlternative * 100)} %. Se muestra el valor
          del equipo docente: la aplicación no lo sobrescribe.
        </p>
      )}

      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-tinta-500">
            <th scope="col" className="pb-1 text-left font-normal">
              Factor
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Bruto
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Normalizado
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Peso
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Aporta
            </th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {result.breakdown.map((factor) => (
            <tr key={factor.factor} className="border-t border-cielo-700">
              <td className="py-1 pr-2 font-sans text-tinta-300">{factor.label}</td>
              <td className="py-1 text-right text-tinta-500">
                {factor.raw} / {factor.outOf}
              </td>
              <td className="py-1 text-right text-tinta-300">
                {Math.round(factor.normalized * 100)} %
              </td>
              <td className="py-1 text-right text-tinta-500">{factor.weight.toFixed(2)}</td>
              <td className="py-1 text-right text-tinta-100">
                {Math.round(factor.points * 100)} %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
