import { useEffect, useMemo, useState } from 'react';
import { buildAdjacency, buildNodeIndex, summarizeFindings } from '@/domain';
import { mutation, singlePatch } from '@/data';
import { newId } from '@/utils/ids.ts';
import {
  selectCanRedo,
  selectCanUndo,
  selectError,
  selectFindings,
  selectLastAction,
  selectSelectedId,
  selectCurriculumNotice,
  selectLoadingCurriculum,
  selectSnapshot,
  selectStatus,
  useAppStore,
} from '@/app/store.ts';
import type { SemanticLevel } from '@/graph';
import { project, SEMANTIC_LEVELS } from '@/graph';
import { AlertsPanel } from '@/features/alerts/AlertsPanel.tsx';
import { CurriculumPanel } from '@/features/curriculum/CurriculumPanel.tsx';
import { MapControls } from '@/features/map/MapControls.tsx';
import { StarMap } from '@/features/map/StarMap.tsx';
import { ContributionMatrix } from '@/features/matrix/ContributionMatrix.tsx';
import { NodeList } from '@/features/explorer/NodeList.tsx';
import { ReportsPanel } from '@/features/reports/ReportsPanel.tsx';
import { TraceabilityPanel } from '@/features/traceability/TraceabilityPanel.tsx';
import { useHighContrast } from '@/hooks/useHighContrast.ts';

/**
 * Armazón de la aplicación.
 *
 * Todavía sin el mapa estelar: esto es la representación en lista y árbol de los
 * mismos datos que dibujará el grafo en la fase 4. Ambas leerán del mismo store, y
 * por eso no podrán discrepar (§5).
 */

type Tab = 'mapa' | 'informes' | 'trazabilidad' | 'matriz' | 'curriculo' | 'alertas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'mapa', label: 'Mapa estelar' },
  { id: 'informes', label: 'Informes' },
  { id: 'trazabilidad', label: 'Trazabilidad' },
  { id: 'matriz', label: 'Matriz de contribución' },
  { id: 'curriculo', label: 'Currículo' },
  { id: 'alertas', label: 'Alertas' },
];

export function App() {
  const status = useAppStore(selectStatus);
  const error = useAppStore(selectError);
  const snapshot = useAppStore(selectSnapshot);
  const findings = useAppStore(selectFindings);
  const selectedId = useAppStore(selectSelectedId);
  const canUndo = useAppStore(selectCanUndo);
  const canRedo = useAppStore(selectCanRedo);
  const lastAction = useAppStore(selectLastAction);
  const loadingCurriculum = useAppStore(selectLoadingCurriculum);
  const curriculumNotice = useAppStore(selectCurriculumNotice);

  const load = useAppStore((state) => state.load);
  const select = useAppStore((state) => state.select);
  const apply = useAppStore((state) => state.apply);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const adoptCurriculum = useAppStore((state) => state.adoptOfficialCurriculum);
  const dropCurriculum = useAppStore((state) => state.dropOfficialCurriculum);

  const contraste = useHighContrast();

  const [tab, setTab] = useState<Tab>('mapa');
  const [level, setLevel] = useState<SemanticLevel>('CONSTELACIONES');
  const [subjectIds, setSubjectIds] = useState<readonly string[]>([]);
  const [minWeight, setMinWeight] = useState(0);
  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  /**
   * Curso al que se acota el currículo.
   *
   * `undefined` significa «el docente no ha elegido», y entonces manda el curso
   * del proyecto. No es lo mismo que `null`, que significa «los quiere todos».
   * Confundirlos haría que abrir un proyecto de 1.º enseñara los criterios de
   * toda la etapa, que es justo lo que había que arreglar.
   */
  const [gradeElegido, setGradeElegido] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    void load();
  }, [load]);

  // Atajos 1-5 para los niveles del mapa (§16: todo accesible por teclado).
  // Se ignoran mientras se escribe en un campo, o teclear un número en un
  // formulario cambiaría la vista bajo los pies de quien escribe.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const position = Number(event.key);
      if (Number.isInteger(position) && position >= 1 && position <= SEMANTIC_LEVELS.length) {
        const next = SEMANTIC_LEVELS[position - 1];
        if (next) {
          setTab('mapa');
          setLevel(next);
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Se derivan del snapshot, no se guardan en el store: es lo que garantiza que
  // todas las vistas hablen de lo mismo.
  const adjacency = useMemo(() => buildAdjacency(snapshot?.edges ?? []), [snapshot?.edges]);
  const nodes = useMemo(() => (snapshot ? buildNodeIndex(snapshot) : new Map()), [snapshot]);
  const summary = useMemo(() => summarizeFindings(findings), [findings]);

  // La proyección del grafo también se deriva: el mapa y el panel de trazabilidad
  // leen el mismo snapshot, así que no pueden mostrar cosas distintas (§5).
  const grade = gradeElegido === undefined ? (snapshot?.project.grade ?? null) : gradeElegido;

  const projection = useMemo(
    () => (snapshot ? project(snapshot, level, { subjectIds, minWeight, weekIndex, grade }) : null),
    [snapshot, level, subjectIds, minWeight, weekIndex, grade],
  );

  if (status === 'cargando' || status === 'inicial') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-tinta-500">Abriendo el proyecto…</p>
      </main>
    );
  }

  if (status === 'error' || !snapshot) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6">
        <h1 className="text-xl font-semibold text-tinta-100">No se pudo abrir el proyecto</h1>
        <p className="text-sm text-tinta-300">{error}</p>
      </main>
    );
  }

  const isDemo = snapshot.curriculumVersions.some((version) => version.isDemo);

  /** Renombra la actividad seleccionada, para probar el CRUD y el deshacer. */
  function renameSelected() {
    if (!snapshot) return;
    const activity = snapshot.activities.find((candidate) => candidate.id === selectedId);
    if (!activity) return;

    void apply(
      singlePatch(
        `Renombró «${activity.title}»`,
        mutation.upsert('activity', { ...activity, title: `${activity.title} (revisada)` }),
      ),
    );
  }

  /**
   * Asigna un criterio de evaluación a la actividad seleccionada.
   *
   * Crea la arista «desarrolla», que es lo que hace que ese criterio aparezca en
   * la trazabilidad, en el mapa y en el cálculo de contribución de esa materia.
   */
  function assignCriterion(criterionId: string) {
    if (!snapshot || selectedId === null) return;
    const activity = snapshot.activities.find((a) => a.id === selectedId);
    const criterion = snapshot.evaluationCriteria.find((c) => c.id === criterionId);
    if (!activity || !criterion) return;

    const yaMoviliza = new Set(
      snapshot.edges
        .filter((e) => e.type === 'moviliza' && e.sourceId === activity.id)
        .map((e) => e.targetId),
    );

    /**
     * Los saberes que la norma relaciona con este criterio.
     *
     * Van en el mismo patch, no en otro: asignar un criterio y movilizar sus
     * saberes es un solo acto pedagógico, y si se partiera en dos escrituras un
     * fallo a mitad dejaría la actividad con el criterio pero sin los saberes.
     * Deshacer también los quita juntos.
     */
    const saberes = snapshot.basicKnowledge.filter(
      (saber) =>
        saber.officialCode !== null &&
        criterion.relatedKnowledgeCodes.includes(saber.officialCode) &&
        !yaMoviliza.has(saber.id),
    );

    const etiqueta =
      saberes.length > 0
        ? `Asignó ${criterion.officialCode ?? 'un criterio'} y ${saberes.length} saberes a «${activity.title}»`
        : `Asignó ${criterion.officialCode ?? 'un criterio'} a «${activity.title}»`;

    void apply({
      label: etiqueta,
      mutations: [
        mutation.upsert('edge', {
          id: newId(),
          projectId: snapshot.project.id,
          type: 'desarrolla',
          sourceId: activity.id,
          sourceType: 'ACTIVIDAD',
          targetId: criterion.id,
          targetType: 'CRITERIO_EVALUACION',
          metadata: {
            weight: null,
            mode: 'MANUAL',
            sessions: null,
            criteriaIds: [],
            note: 'Asignado desde el catálogo curricular',
          },
        }),
        ...saberes.map((saber) =>
          mutation.upsert('edge', {
            id: newId(),
            projectId: snapshot.project.id,
            type: 'moviliza',
            sourceId: activity.id,
            sourceType: 'ACTIVIDAD',
            targetId: saber.id,
            targetType: 'SABER_BASICO',
            metadata: {
              weight: null,
              mode: 'MANUAL',
              sessions: null,
              criteriaIds: [criterion.id],
              note: `La norma lo relaciona con ${criterion.officialCode ?? 'este criterio'}`,
            },
          }),
        ),
      ],
    });
  }

  return (
    <div className="marco mx-auto flex min-h-screen max-w-[1240px] flex-col px-6 pb-16">
      <a href="#contenido" className="salto">
        Saltar al contenido
      </a>

      <header className="no-imprimir border-b border-cielo-600 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-laton-500 uppercase">
              Constelación Educativa · v0.1 en construcción
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-tinta-100">{snapshot.project.title}</h1>
            <p className="mt-1 text-sm text-tinta-300">
              {snapshot.project.course} · {snapshot.project.startDate} a {snapshot.project.endDate}
            </p>
          </div>

          {isDemo && (
            <p className="max-w-xs rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <strong className="font-semibold">Datos de demostración.</strong> Los códigos
              curriculares llevan prefijo <code>DEMO.</code> y no proceden de ninguna norma.
            </p>
          )}
        </div>

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] text-tinta-500">
          <Stat label="Materias" value={snapshot.subjects.length} />
          <Stat label="Situaciones" value={snapshot.learningSituations.length} />
          <Stat label="Actividades" value={snapshot.activities.length} />
          <Stat label="Sesiones" value={snapshot.sessions.length} />
          <Stat label="Relaciones" value={snapshot.edges.length} />
          <Stat label="Criterios" value={snapshot.evaluationCriteria.length} />
          <Stat label="Errores" value={summary.ERROR} />
          <Stat label="Advertencias" value={summary.ADVERTENCIA} />
        </dl>
      </header>

      <div className="no-imprimir flex flex-wrap items-center gap-2 border-b border-cielo-700 py-3">
        <button
          type="button"
          onClick={renameSelected}
          disabled={selectedId === null}
          className="rounded border border-borde-500 px-3 py-1 text-xs text-tinta-300 hover:border-laton-500 hover:text-laton-400 disabled:opacity-40"
        >
          Renombrar la actividad seleccionada
        </button>
        <button
          type="button"
          onClick={() => void undo()}
          disabled={!canUndo}
          className="rounded border border-borde-500 px-3 py-1 text-xs text-tinta-300 hover:border-laton-500 hover:text-laton-400 disabled:opacity-40"
        >
          Deshacer
        </button>
        <button
          type="button"
          onClick={() => void redo()}
          disabled={!canRedo}
          className="rounded border border-borde-500 px-3 py-1 text-xs text-tinta-300 hover:border-laton-500 hover:text-laton-400 disabled:opacity-40"
        >
          Rehacer
        </button>
        {lastAction && (
          <span className="font-mono text-[11px] text-tinta-500">Último cambio: {lastAction}</span>
        )}
        <button
          type="button"
          onClick={contraste.alternar}
          aria-pressed={contraste.activo}
          className="ml-auto rounded border border-borde-500 px-3 py-1 text-xs text-tinta-300 hover:border-laton-500 hover:text-laton-400"
        >
          Alto contraste: {contraste.activo ? 'activado' : 'desactivado'}
        </button>
        <span className="font-mono text-[11px] text-tinta-500">Guardado en tu navegador</span>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {curriculumNotice && (
        <p role="status" className="mt-3 rounded bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {curriculumNotice}
        </p>
      )}

      <main id="contenido" className="grid flex-1 gap-8 pt-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="no-imprimir lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Proyecto
          </h2>
          <NodeList snapshot={snapshot} nodes={nodes} selectedId={selectedId} onSelect={select} />
        </aside>

        <section className="min-w-0">
          <div
            role="tablist"
            className="no-imprimir mb-5 flex flex-wrap gap-1 border-b border-cielo-700"
          >
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => {
                  setTab(entry.id);
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === entry.id
                    ? 'border-laton-500 text-laton-400'
                    : 'border-transparent text-tinta-500 hover:text-tinta-300'
                }`}
              >
                {entry.label}
                {entry.id === 'alertas' && findings.length > 0 && (
                  <span className="ml-2 font-mono text-[10px] tabular-nums">{findings.length}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'mapa' && projection && (
            <div className="flex flex-col gap-5">
              <MapControls
                snapshot={snapshot}
                level={level}
                onLevel={setLevel}
                subjectIds={subjectIds}
                onSubjects={setSubjectIds}
                minWeight={minWeight}
                onMinWeight={setMinWeight}
                weekIndex={weekIndex}
                onWeek={setWeekIndex}
                grade={grade}
                onGrade={setGradeElegido}
              />
              <StarMap
                projection={projection}
                selectedId={selectedId}
                onSelect={select}
                highContrast={contraste.activo}
                titulo={snapshot.project.title}
              />
            </div>
          )}
          {tab === 'informes' && (
            <ReportsPanel
              snapshot={snapshot}
              grade={grade}
              onGrade={setGradeElegido}
              subjectIds={subjectIds}
              onSubjects={setSubjectIds}
            />
          )}
          {tab === 'trazabilidad' && (
            <TraceabilityPanel
              snapshot={snapshot}
              index={adjacency}
              nodes={nodes}
              selectedId={selectedId}
              onSelect={select}
            />
          )}
          {tab === 'matriz' && <ContributionMatrix snapshot={snapshot} />}
          {tab === 'curriculo' && (
            <CurriculumPanel
              snapshot={snapshot}
              selectedId={selectedId}
              cargando={loadingCurriculum}
              onCargarOficial={(fuente) => void adoptCurriculum(fuente)}
              onRetirarOficial={() => void dropCurriculum()}
              onAsignar={assignCriterion}
              grade={grade}
              onGrade={setGradeElegido}
            />
          )}
          {tab === 'alertas' && <AlertsPanel findings={findings} nodes={nodes} onSelect={select} />}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="tracking-[0.1em] uppercase">{label}</dt>
      <dd className="text-sm text-tinta-100 tabular-nums">{value}</dd>
    </div>
  );
}
