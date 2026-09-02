import { useMemo, useState } from 'react';
import type { ProjectSnapshot, Uuid } from '@/domain';
import { gradesPresent } from '@/domain';
import type { FichaActividad, LineaCriterio, Semana, SemanaMateria } from '@/reports';
import { construirPrograma, construirSemanas, semanaDe } from '@/reports';

/**
 * Los informes en texto (§13).
 *
 * ── A qué pregunta responde cada vista ──
 *   · **Programa completo** · «¿qué es este proyecto?». Es el documento que se
 *     lleva a la reunión de departamento o se adjunta a la programación.
 *   · **Por materia** · «¿qué me toca impartir a mí?». Es el que cada docente
 *     imprime y se guarda, con sus criterios, sus saberes y sus dependencias.
 *   · **Semana a semana** · «¿qué toca esta semana?». Es el que se mira el
 *     domingo por la noche, y el único que cruza las materias para avisar de lo
 *     que otro tiene que haber terminado antes.
 *
 * ── Sobre la exportación a PDF ──
 * Se hace con el diálogo de impresión del navegador y una hoja de estilo de
 * impresión, no generando el PDF en JavaScript. Es una decisión, no una renuncia:
 * el navegador compone texto real —seleccionable, buscable y accesible—, parte
 * las páginas por donde el CSS le dice y respeta las tildes sin que haya que
 * empaquetar una fuente. Una biblioteca de PDF pesaría cientos de kilobytes para
 * producir un documento peor compuesto.
 */

type Vista = 'programa' | 'materias' | 'semanas';

const VISTAS: { id: Vista; rotulo: string; explicacion: string }[] = [
  {
    id: 'programa',
    rotulo: 'Programa completo',
    explicacion: 'El proyecto entero: situaciones, actividades y currículo movilizado.',
  },
  {
    id: 'materias',
    rotulo: 'Por materia',
    explicacion: 'Lo que le toca impartir a cada materia, con sus criterios y sus saberes.',
  },
  {
    id: 'semanas',
    rotulo: 'Semana a semana',
    explicacion: 'Qué toca cada semana, materia a materia, con materiales y avisos.',
  },
];

interface Props {
  snapshot: ProjectSnapshot;
  grade: number | null;
  onGrade: (grade: number | null) => void;
  subjectIds: readonly Uuid[];
  onSubjects: (ids: readonly Uuid[]) => void;
}

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

const BOTON =
  'rounded border border-borde-500 px-3 py-1 text-xs text-tinta-300 transition-colors hover:border-laton-500 hover:text-laton-400';

export function ReportsPanel({ snapshot, grade, onGrade, subjectIds, onSubjects }: Props) {
  const [vista, setVista] = useState<Vista>('programa');

  const programa = useMemo(() => construirPrograma(snapshot, grade), [snapshot, grade]);
  const semanas = useMemo(() => construirSemanas(snapshot), [snapshot]);
  const cursos = useMemo(() => gradesPresent(snapshot), [snapshot]);

  /**
   * La semana que se muestra. `null` las muestra todas.
   *
   * Arranca en la semana en curso si el proyecto está en marcha. Quien abre esta
   * pestaña un lunes quiere saber qué toca ese lunes, no leerse el trimestre; y
   * quien imprime, quiere una hoja, no ocho.
   */
  const [semanaElegida, setSemanaElegida] = useState<number | null | undefined>(undefined);
  const semanaActual =
    semanaElegida === undefined
      ? semanaDe(semanas, new Date().toISOString().slice(0, 10))
      : semanaElegida;
  const semanasVisibles =
    semanaActual === null ? semanas : semanas.filter((s) => s.indice === semanaActual);

  const visible = (id: Uuid): boolean => subjectIds.length === 0 || subjectIds.includes(id);
  const materias = programa.materias.filter((m) => visible(m.materia.id));

  const seleccion =
    subjectIds.length === 0
      ? 'todas las materias'
      : snapshot.subjects
          .filter((s) => subjectIds.includes(s.id))
          .map((s) => s.name)
          .join(', ');

  function alternar(id: Uuid) {
    onSubjects(
      subjectIds.includes(id) ? subjectIds.filter((otro) => otro !== id) : [...subjectIds, id],
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-imprimir flex flex-col gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Informe
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {VISTAS.map((candidata) => (
              <button
                key={candidata.id}
                type="button"
                aria-pressed={vista === candidata.id}
                onClick={() => {
                  setVista(candidata.id);
                }}
                className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                  vista === candidata.id
                    ? 'border-laton-500 bg-laton-500/10 text-laton-400'
                    : 'border-borde-500 text-tinta-300 hover:border-tinta-100'
                }`}
              >
                {candidata.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-tinta-500">
            {VISTAS.find((v) => v.id === vista)?.explicacion}
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
            Materias del informe
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {snapshot.subjects.map((materia) => {
              const activa = visible(materia.id);
              return (
                <button
                  key={materia.id}
                  type="button"
                  aria-pressed={subjectIds.includes(materia.id)}
                  onClick={() => {
                    alternar(materia.id);
                  }}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                    activa
                      ? 'border-borde-500 text-tinta-100'
                      : 'border-cielo-600 text-tinta-500 line-through'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: activa ? materia.color : '#3a4160' }}
                  />
                  {materia.shortName}
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

        <div className="flex flex-wrap items-end gap-4">
          {vista === 'semanas' && semanas.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-tinta-300">
              <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
                Semana
              </span>
              <select
                value={semanaActual ?? ''}
                onChange={(evento) => {
                  setSemanaElegida(evento.target.value === '' ? null : Number(evento.target.value));
                }}
                className="rounded border border-borde-500 bg-cielo-800 px-2 py-1 text-tinta-100"
              >
                <option value="">Todas</option>
                {semanas.map((semana) => (
                  <option key={semana.indice} value={semana.indice}>
                    Semana {semana.indice + 1} · {fechaCorta(semana.desde)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {cursos.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-tinta-300">
              <span className="font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase">
                Currículo del curso
              </span>
              <select
                value={grade ?? ''}
                onChange={(evento) => {
                  onGrade(evento.target.value === '' ? null : Number(evento.target.value));
                }}
                className="rounded border border-borde-500 bg-cielo-800 px-2 py-1 text-tinta-100"
              >
                {cursos.map((curso) => (
                  <option key={curso} value={curso}>
                    {curso}.º ESO
                  </option>
                ))}
                <option value="">Todos los cursos</option>
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => {
              window.print();
            }}
            className={BOTON}
          >
            Exportar a PDF
          </button>
          <p className="text-[11px] text-tinta-500">
            Se abre el diálogo de impresión: elige «Guardar como PDF» como destino.
          </p>
        </div>
      </div>

      <article className="documento flex flex-col gap-6 text-sm text-tinta-100">
        <header className="border-b border-cielo-600 pb-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-laton-500 uppercase">
            {VISTAS.find((v) => v.id === vista)?.rotulo}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{programa.titulo}</h2>
          <p className="mt-1 text-xs text-tinta-300">
            {programa.curso}
            {programa.grupo ? ` · ${programa.grupo}` : ''} · del{' '}
            {fechaCorta(programa.periodo.desde)} al {fechaCorta(programa.periodo.hasta)} ·{' '}
            {seleccion}
          </p>
        </header>

        {vista === 'programa' && (
          <>
            {programa.descripcion && <p className="text-tinta-300">{programa.descripcion}</p>}
            {programa.situaciones.map((bloque) => (
              <section key={bloque.situacion.id} className="bloque flex flex-col gap-3">
                <h3 className="text-base font-semibold text-laton-400">{bloque.situacion.title}</h3>
                <p className="text-xs text-tinta-300">{bloque.situacion.description}</p>
                <p className="font-mono text-[11px] text-tinta-500">
                  Materias: {bloque.materias.join(' · ')} · {bloque.actividades.length} actividades
                </p>
                <ol className="flex flex-col gap-2">
                  {bloque.actividades
                    .filter((a) => !a.materia || visible(a.materia.id))
                    .map((actividad) => (
                      <li
                        key={actividad.id}
                        className="ficha rounded border border-cielo-700 px-3 py-2"
                      >
                        <p className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold">{actividad.titulo}</span>
                          <Etiqueta ficha={actividad} />
                        </p>
                        <p className="mt-1 text-xs text-tinta-300">{actividad.descripcion}</p>
                        <Criterios ficha={actividad} />
                      </li>
                    ))}
                </ol>
              </section>
            ))}
          </>
        )}

        {vista === 'materias' &&
          materias.map((bloque) => (
            <section key={bloque.materia.id} className="bloque flex flex-col gap-3">
              <h3
                className="border-l-4 pl-3 text-base font-semibold"
                style={{ borderColor: bloque.materia.color }}
              >
                {bloque.materia.name}
              </h3>
              <p className="font-mono text-[11px] text-tinta-500">
                {bloque.actividades.length} actividades · {bloque.sesiones} sesiones ·{' '}
                {bloque.criterios.length} criterios evaluables
              </p>

              {bloque.actividades.map((actividad) => (
                <div key={actividad.id} className="ficha rounded border border-cielo-700 px-3 py-2">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{actividad.titulo}</span>
                    <Etiqueta ficha={actividad} />
                  </p>
                  <p className="mt-1 text-xs text-tinta-300">{actividad.descripcion}</p>
                  {actividad.producto && (
                    <p className="mt-1 text-xs">
                      <span className="text-tinta-500">Producto: </span>
                      {actividad.producto}
                    </p>
                  )}
                  {actividad.materiales && (
                    <p className="text-xs">
                      <span className="text-tinta-500">Materiales: </span>
                      {actividad.materiales}
                    </p>
                  )}
                  <Criterios ficha={actividad} conSaberes />
                  <Dependencias ficha={actividad} />
                </div>
              ))}

              {bloque.criteriosSinTrabajar.length > 0 && (
                <Cobertura criterios={bloque.criteriosSinTrabajar} curso={programa.gradoAcotado} />
              )}
            </section>
          ))}

        {vista === 'semanas' &&
          semanasVisibles.map((semana) => (
            <SemanaImpresa key={semana.indice} semana={semana} visible={visible} />
          ))}
      </article>
    </div>
  );
}

/**
 * Los criterios del curso que el proyecto no toca.
 *
 * Se repliega en pantalla porque suelen ser muchos y no es lo que se viene a
 * mirar, pero en papel se despliega siempre: un PDF con un bloque plegado es un
 * PDF al que le falta información y que no avisa de que le falta. Por eso no es
 * un `<details>` —que el navegador cierra también al imprimir— sino una clase
 * que la hoja de impresión desactiva.
 */
function Cobertura({
  criterios,
  curso,
}: {
  criterios: readonly LineaCriterio[];
  curso: number | null;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section className="ficha rounded border border-cielo-700 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          setAbierto((previo) => !previo);
        }}
        aria-expanded={abierto}
        className="no-imprimir text-left text-xs text-tinta-300 underline underline-offset-2 hover:text-laton-400"
      >
        {criterios.length} criterios de {curso === null ? 'esta materia' : `${curso}.º ESO`} que
        este proyecto no toca
      </button>
      <p className="solo-impresion text-xs font-semibold">
        Criterios de {curso === null ? 'esta materia' : `${curso}.º ESO`} que este proyecto no toca
      </p>
      <ul className={`mt-2 flex-col gap-1 ${abierto ? 'flex' : 'solo-impresion'}`}>
        {criterios.map((criterio) => (
          <li key={criterio.id} className="text-xs text-tinta-500">
            <span className="font-mono text-tinta-300">{criterio.codigo}</span>{' '}
            {criterio.texto.slice(0, 160)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Etiqueta({ ficha }: { ficha: FichaActividad }) {
  return (
    <span className="font-mono text-[11px] text-tinta-500">
      {ficha.materia?.shortName ?? '—'}
      {ficha.desde && ` · ${fechaCorta(ficha.desde)}`}
      {ficha.hasta &&
        ficha.hasta.slice(0, 10) !== ficha.desde?.slice(0, 10) &&
        ` a ${fechaCorta(ficha.hasta)}`}
      {` · ${ficha.sesiones.length} sesiones`}
    </span>
  );
}

function Criterios({ ficha, conSaberes = false }: { ficha: FichaActividad; conSaberes?: boolean }) {
  if (ficha.criterios.length === 0) return null;
  return (
    <>
      <ul className="mt-2 flex flex-col gap-1">
        {ficha.criterios.map((criterio) => (
          <li key={criterio.id} className="text-xs text-tinta-300">
            <span className="font-mono text-laton-400">{criterio.codigo || 'sin código'}</span>{' '}
            {criterio.texto}
          </li>
        ))}
      </ul>
      {conSaberes && ficha.saberes.length > 0 && (
        <p className="mt-1 text-xs text-tinta-500">
          <span className="text-tinta-300">Saberes: </span>
          {ficha.saberes.map((saber) => saber.codigo || saber.texto.slice(0, 40)).join(' · ')}
        </p>
      )}
    </>
  );
}

/**
 * Qué necesita esta actividad y qué deja parado.
 *
 * Se imprime dentro de la ficha de cada actividad porque es donde se consulta:
 * quien lee su propia programación tiene que ver ahí mismo que su clase del
 * martes depende de que otro haya terminado el lunes.
 */
function Dependencias({ ficha }: { ficha: FichaActividad }) {
  if (ficha.requiere.length === 0 && ficha.habilita.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-tinta-500">
      {ficha.requiere.length > 0 && (
        <>
          <span className="text-tinta-300">Necesita antes: </span>
          {ficha.requiere.map((e) => `${e.titulo} (${e.materia})`).join('; ')}.{' '}
        </>
      )}
      {ficha.habilita.length > 0 && (
        <>
          <span className="text-tinta-300">Deja en marcha: </span>
          {ficha.habilita.map((e) => `${e.titulo} (${e.materia})`).join('; ')}.
        </>
      )}
    </p>
  );
}

function SemanaImpresa({ semana, visible }: { semana: Semana; visible: (id: Uuid) => boolean }) {
  const materias = semana.materias.filter((m) => visible(m.materia.id));
  if (materias.length === 0) return null;

  return (
    <section className="bloque flex flex-col gap-3">
      <h3 className="text-base font-semibold text-laton-400">
        Semana {semana.indice + 1} · {fechaCorta(semana.desde)} a {fechaCorta(semana.hasta)}
      </h3>

      {semana.hitos.map((hito) => (
        <p key={hito.titulo} className="text-xs text-amber-200">
          Hito el {fechaCorta(hito.fecha)}: {hito.titulo}
        </p>
      ))}
      {semana.entregas.map((entrega) => (
        <p key={entrega.titulo} className="text-xs text-amber-200">
          Entrega el {fechaCorta(entrega.fecha)}: {entrega.titulo}
        </p>
      ))}
      {semana.avisos.map((aviso) => (
        <p key={aviso} className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-300">
          {aviso}
        </p>
      ))}

      {materias.map((bloque) => (
        <BloqueSemanal key={bloque.materia.id} bloque={bloque} />
      ))}
    </section>
  );
}

function BloqueSemanal({ bloque }: { bloque: SemanaMateria }) {
  return (
    <div className="ficha rounded border border-cielo-700 px-3 py-2">
      <p className="flex flex-wrap items-baseline gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: bloque.materia.color }}
        />
        <span className="font-semibold">{bloque.materia.name}</span>
        <span className="font-mono text-[11px] text-tinta-500">
          {bloque.sesiones.map((s) => `${fechaCorta(s.fecha)} ${s.hora}`).join(' · ')}
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {bloque.actividades.map((actividad) => (
          <li key={actividad.id} className="text-xs">
            <span className="font-semibold text-tinta-100">{actividad.titulo}</span>
            <span className="text-tinta-300"> — {actividad.descripcion}</span>
            <Criterios ficha={actividad} />
            <Dependencias ficha={actividad} />
          </li>
        ))}
      </ul>
      {bloque.materiales.length > 0 && (
        <p className="mt-2 text-xs text-tinta-500">
          <span className="text-tinta-300">Hay que llevar: </span>
          {bloque.materiales.join(', ')}
        </p>
      )}
    </div>
  );
}
