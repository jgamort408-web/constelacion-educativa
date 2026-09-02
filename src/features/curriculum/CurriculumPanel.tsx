import { useMemo, useState } from 'react';
import type { EvaluationCriterion, ProjectSnapshot, Uuid } from '@/domain';
import type { FuenteCurricular } from '@/data';
import { FUENTES } from '@/data';
import { gradesPresent, spanLabel } from '@/domain';

/**
 * Catálogo curricular del proyecto (§9).
 *
 * Muestra los criterios y saberes realmente cargados, agrupados por materia y
 * competencia, y permite asignar un criterio a la actividad seleccionada.
 *
 * Dos reglas de presentación que no son estéticas:
 *
 *   1. **Cada elemento dice de dónde viene.** Un criterio del Real Decreto y uno
 *      de demostración no pueden parecer lo mismo: el segundo no se puede citar
 *      en una programación.
 *   2. **El tramo de cursos se muestra tal cual es.** Si un criterio cubre 3.º y
 *      4.º, se dice. Presentarlo como «de 3.º» sería inventar una división que la
 *      norma no hace (ver docs/FUENTE-CURRICULO.md).
 */

/** Centinela del selector de materia: no es un identificador de materia. */
const TODAS = '__todas__';

interface Props {
  snapshot: ProjectSnapshot;
  selectedId: Uuid | null;
  cargando: boolean;
  onCargarOficial: (fuente: FuenteCurricular) => void;
  onRetirarOficial: () => void;
  onAsignar: (criterionId: Uuid) => void;
  /**
   * Curso al que se acota el catálogo. `null` los muestra todos.
   *
   * Viene de fuera y no de un estado local a propósito: el mapa, los informes y
   * este panel comparten el mismo curso, así que un docente que acota a 1.º lo
   * acota en toda la aplicación y no se encuentra tres listas distintas del
   * mismo currículo según por dónde entre.
   */
  grade: number | null;
  onGrade: (grade: number | null) => void;
}

export function CurriculumPanel({
  snapshot,
  selectedId,
  cargando,
  onCargarOficial,
  onRetirarOficial,
  onAsignar,
  grade,
  onGrade,
}: Props) {
  // `Uuid` es un alias de string, así que una unión con 'todas' no aporta tipo.
  // El centinela va aparte para que el compilador siga distinguiéndolos.
  const [materiaId, setMateriaId] = useState<string>(TODAS);
  const [busqueda, setBusqueda] = useState('');
  const cursos = useMemo(() => gradesPresent(snapshot), [snapshot]);

  const versiones = useMemo(
    () => new Map(snapshot.curriculumVersions.map((v) => [v.id, v])),
    [snapshot.curriculumVersions],
  );
  const materias = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.id, s])),
    [snapshot.subjects],
  );

  /** Criterios de la actividad seleccionada, para no ofrecer duplicados. */
  const yaAsignados = useMemo(() => {
    if (selectedId === null) return new Set<Uuid>();
    return new Set(
      snapshot.edges
        .filter((e) => e.type === 'desarrolla' && e.sourceId === selectedId)
        .map((e) => e.targetId),
    );
  }, [snapshot.edges, selectedId]);

  /** Saberes por materia, para poder buscar en ellos y mostrarlos. */
  const saberesPorCodigo = useMemo(
    () => new Map(snapshot.basicKnowledge.map((s) => [s.officialCode ?? s.id, s])),
    [snapshot.basicKnowledge],
  );

  const grupos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    /**
     * Un criterio casa si lo dice su texto, su código, o el de alguno de los
     * saberes que la norma le asocia.
     *
     * Buscar solo en los criterios dejaba fuera justo el vocabulario que un
     * docente teclea: «proporcionalidad», «tectónica de placas», «texto
     * expositivo». Eso está en los saberes, no en los criterios, que están
     * redactados en términos de destrezas.
     */
    const casa = (criterio: EvaluationCriterion): boolean => {
      if (texto === '') return true;
      if (criterio.description.toLowerCase().includes(texto)) return true;
      if ((criterio.officialCode ?? '').toLowerCase().includes(texto)) return true;
      return criterio.relatedKnowledgeCodes.some((codigo) => {
        const saber = saberesPorCodigo.get(codigo);
        return (
          codigo.toLowerCase().includes(texto) ||
          (saber?.description.toLowerCase().includes(texto) ?? false)
        );
      });
    };

    const competenciasVisibles = snapshot.competencies.filter((competencia) => {
      if (materiaId !== TODAS && competencia.subjectId !== materiaId) return false;
      if (grade !== null) {
        const { from, to } = competencia.gradeSpan;
        if (grade < from || grade > to) return false;
      }
      return true;
    });

    return competenciasVisibles
      .map((competencia) => ({
        competencia,
        criterios: snapshot.evaluationCriteria.filter(
          (criterio) => criterio.competencyId === competencia.id && casa(criterio),
        ),
      }))
      .filter((grupo) => grupo.criterios.length > 0)
      .sort((a, b) => {
        const materiaA = materias.get(a.competencia.subjectId)?.name ?? '';
        const materiaB = materias.get(b.competencia.subjectId)?.name ?? '';
        return (
          materiaA.localeCompare(materiaB, 'es') ||
          (a.competencia.officialCode ?? '').localeCompare(b.competencia.officialCode ?? '', 'es')
        );
      });
  }, [
    snapshot.competencies,
    snapshot.evaluationCriteria,
    materiaId,
    grade,
    busqueda,
    materias,
    saberesPorCodigo,
  ]);

  const hayOficial = snapshot.curriculumVersions.some((v) => !v.isDemo);
  const cargado = snapshot.curriculumVersions.find((v) => !v.isDemo);
  const pendientes = snapshot.pendingCurriculumReferences.length;
  const totalCriterios = snapshot.evaluationCriteria.length;
  const actividad = snapshot.activities.find((a) => a.id === selectedId);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded border border-cielo-600 bg-cielo-800 p-4">
        <p className="text-sm text-tinta-100">
          {cargado
            ? `Currículo cargado: ${cargado.source.split(' · ')[0]}.`
            : 'Solo hay currículo de demostración.'}
        </p>
        {cargado ? (
          <p className="mt-1 max-w-prose text-xs text-tinta-500">{cargado.normativa}</p>
        ) : (
          <p className="mt-1 text-xs text-tinta-500">
            Elige la fuente con la que quieres trabajar. No son intercambiables.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(FUENTES) as FuenteCurricular[]).map((clave) => (
            <button
              key={clave}
              type="button"
              onClick={() => {
                onCargarOficial(clave);
              }}
              disabled={cargando}
              title={FUENTES[clave].detalle}
              className="rounded border border-borde-500 px-3 py-1.5 text-xs text-tinta-300 hover:border-laton-500 hover:text-laton-400 disabled:opacity-40"
            >
              {cargando ? 'Cargando…' : `Cargar ${FUENTES[clave].titulo}`}
            </button>
          ))}
          {hayOficial && (
            <button
              type="button"
              onClick={onRetirarOficial}
              disabled={cargando}
              className="rounded border border-cielo-600 px-3 py-1.5 text-xs text-tinta-500 hover:border-borde-500 hover:text-tinta-300 disabled:opacity-40"
            >
              Retirar
            </button>
          )}
        </div>

        {pendientes > 0 && (
          <p className="mt-3 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <strong className="font-semibold">{pendientes} elementos pendientes.</strong> La norma
            los recoge pero no se pudieron extraer del PDF del boletín. Consúltalos en la fuente
            antes de citarlos.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-tinta-300">
          <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Materia
          </span>
          <select
            value={materiaId}
            onChange={(e) => {
              setMateriaId(e.target.value);
            }}
            className="rounded border border-borde-500 bg-cielo-800 px-2 py-1 text-tinta-100"
          >
            <option value={TODAS}>Todas</option>
            {snapshot.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-tinta-300">
          <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Curso
          </span>
          <select
            value={grade ?? ''}
            onChange={(e) => {
              onGrade(e.target.value === '' ? null : Number(e.target.value));
            }}
            className="rounded border border-borde-500 bg-cielo-800 px-2 py-1 text-tinta-100"
          >
            {/*
              Los cursos salen del currículo cargado, no de una lista fija. Con
              una lista fija de 1.º a 3.º, importar 4.º dejaría sus criterios
              visibles pero imposibles de aislar, y nadie entendería por qué.
            */}
            {cursos.map((candidato) => (
              <option key={candidato} value={candidato}>
                {candidato}.º ESO
              </option>
            ))}
            <option value="">Todos</option>
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs text-tinta-300">
          <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Buscar en criterios y saberes
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
            }}
            placeholder="proporcionalidad, tectónica, MAT.1.3…"
            className="rounded border border-borde-500 bg-cielo-800 px-2 py-1 text-tinta-100 placeholder:text-tinta-500"
          />
        </label>
      </div>

      <p className="text-xs text-tinta-500">
        {grupos.reduce((suma, g) => suma + g.criterios.length, 0)} criterios visibles de{' '}
        {totalCriterios} cargados.
        {actividad ? (
          <>
            {' '}
            Se asignarán a <span className="text-tinta-300">«{actividad.title}»</span>.
          </>
        ) : (
          ' Selecciona una actividad en la barra lateral para poder asignarlos.'
        )}
      </p>

      <div className="flex flex-col gap-5">
        {grupos.map(({ competencia, criterios }) => {
          const materia = materias.get(competencia.subjectId);
          const version = versiones.get(competencia.curriculumVersionId);

          return (
            <section key={competencia.id} className="border-l-2 border-cielo-600 pl-4">
              <header className="flex flex-wrap items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 flex-none translate-y-px rounded-full"
                  style={{ backgroundColor: materia?.color ?? '#5a6390' }}
                />
                <span className="font-mono text-[11px] text-laton-500">
                  {competencia.officialCode}
                </span>
                <span className="text-xs text-tinta-500">
                  {materia?.name} · {spanLabel(competencia.gradeSpan)}
                </span>
                {version?.isDemo === true && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-amber-300 uppercase">
                    demostración
                  </span>
                )}
              </header>
              <p className="mt-1 max-w-prose text-sm text-tinta-300">{competencia.description}</p>

              <ul className="mt-3 flex flex-col gap-1.5">
                {criterios.map((criterio) => {
                  const asignado = yaAsignados.has(criterio.id);
                  return (
                    <li key={criterio.id} className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onAsignar(criterio.id);
                        }}
                        disabled={selectedId === null || asignado}
                        title={
                          asignado
                            ? 'Ya asignado a esta actividad'
                            : 'Asignar a la actividad seleccionada'
                        }
                        className="mt-0.5 flex-none rounded border border-borde-500 px-2 py-0.5 font-mono text-[10px] text-tinta-300 hover:border-laton-500 hover:text-laton-400 disabled:border-cielo-600 disabled:opacity-40"
                      >
                        {asignado ? '✓ asignado' : '+ asignar'}
                      </button>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-mono text-[11px] text-tinta-500">
                          {criterio.officialCode}
                        </span>{' '}
                        <span className="text-tinta-100">{criterio.description}</span>
                        {criterio.relatedKnowledgeCodes.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {criterio.relatedKnowledgeCodes.map((codigo) => {
                              const saber = saberesPorCodigo.get(codigo);
                              return (
                                <span
                                  key={codigo}
                                  title={saber?.description ?? 'Saber no cargado'}
                                  className="rounded bg-cielo-700 px-1.5 py-0.5 font-mono text-[9px] text-tinta-500"
                                >
                                  {codigo}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {grupos.length === 0 && (
          <p className="text-sm text-tinta-500">
            Ningún criterio coincide con el filtro.
            {!hayOficial && ' Prueba a cargar el currículo oficial.'}
          </p>
        )}
      </div>
    </div>
  );
}
