import type {
  Activity,
  BasicKnowledge,
  EvaluationCriterion,
  LearningSituation,
  ProjectSnapshot,
  Subject,
  Uuid,
} from '@/domain';
import { scopeCurriculum } from '@/domain';

/**
 * Los informes en texto: el proyecto contado, no dibujado (§13).
 *
 * ── Por qué esto existe ──
 * El mapa estelar responde a «¿cómo se relaciona todo?». No responde a la
 * pregunta que un docente se hace el domingo por la noche, que es «¿qué me toca a
 * mí el lunes?». Para eso hace falta texto: ordenado, imprimible y acotado a su
 * materia. Un grafo proyectado en una reunión de departamento impresiona; lo que
 * cada cual se lleva al aula es una hoja.
 *
 * ── Qué garantiza este módulo ──
 * Es puro y no conoce React. Recibe el snapshot y devuelve estructuras de datos
 * listas para pintar, de modo que el informe y el mapa **no pueden discrepar**:
 * ambos leen del mismo proyecto y las mismas aristas (§5). Y se prueba sin
 * navegador, que es lo que permite afirmar que la semana 3 contiene lo que dice
 * contener.
 */

/** Un criterio tal como se cita en un informe. */
export interface LineaCriterio {
  readonly id: Uuid;
  /** Código oficial, o cadena vacía si la fuente no lo da. Nunca inventado. */
  readonly codigo: string;
  readonly texto: string;
}

/** Un saber básico tal como se cita en un informe. */
export interface LineaSaber {
  readonly id: Uuid;
  readonly codigo: string;
  readonly texto: string;
  readonly bloque: string;
}

/** El enlace a otra actividad de la que se depende o que depende de esta. */
export interface Enlace {
  readonly id: Uuid;
  readonly titulo: string;
  readonly materia: string;
  /** Primera y última sesión de esa actividad, o null si aún no está fechada. */
  readonly desde: string | null;
  readonly hasta: string | null;
}

/** Todo lo que hay que saber de una actividad para poder darla. */
export interface FichaActividad {
  readonly id: Uuid;
  readonly titulo: string;
  readonly descripcion: string;
  readonly producto: string;
  readonly materiales: string;
  readonly situacion: string;
  readonly materia: Subject | null;
  readonly sesiones: readonly { readonly fecha: string; readonly hora: string }[];
  readonly desde: string | null;
  readonly hasta: string | null;
  readonly criterios: readonly LineaCriterio[];
  readonly saberes: readonly LineaSaber[];
  /** Lo que tiene que estar hecho antes. */
  readonly requiere: readonly Enlace[];
  /** Lo que se queda parado si esta se retrasa. */
  readonly habilita: readonly Enlace[];
}

/** Lo que le toca impartir a una materia en todo el proyecto. */
export interface ProgramaMateria {
  readonly materia: Subject;
  readonly actividades: readonly FichaActividad[];
  readonly sesiones: number;
  readonly criterios: readonly LineaCriterio[];
  readonly saberes: readonly LineaSaber[];
  /** Criterios del curso que esta materia tiene sin tocar todavía. */
  readonly criteriosSinTrabajar: readonly LineaCriterio[];
}

export interface Programa {
  readonly titulo: string;
  readonly curso: string;
  readonly grupo: string;
  readonly periodo: { readonly desde: string; readonly hasta: string };
  readonly descripcion: string;
  readonly situaciones: readonly {
    readonly situacion: LearningSituation;
    readonly actividades: readonly FichaActividad[];
    readonly materias: readonly string[];
  }[];
  readonly materias: readonly ProgramaMateria[];
  /** Curso al que está acotado el currículo del informe, si lo está. */
  readonly gradoAcotado: number | null;
}

/** Lo que le toca a una materia en una semana concreta. */
export interface SemanaMateria {
  readonly materia: Subject;
  readonly actividades: readonly FichaActividad[];
  readonly sesiones: readonly { readonly fecha: string; readonly hora: string }[];
  /** Materiales de todas sus actividades de esa semana, sin repetir. */
  readonly materiales: readonly string[];
}

export interface Semana {
  readonly indice: number;
  readonly desde: string;
  readonly hasta: string;
  readonly materias: readonly SemanaMateria[];
  readonly hitos: readonly { readonly titulo: string; readonly fecha: string }[];
  readonly entregas: readonly { readonly titulo: string; readonly fecha: string }[];
  /**
   * Avisos de coordinación: qué espera esta semana de otra materia.
   *
   * Es la única parte del informe que no se podría escribir a mano sin
   * equivocarse. Cruza las dependencias con el calendario para decir, por
   * ejemplo, que Lengua no puede empezar el martes si Matemáticas no ha
   * terminado el lunes.
   */
  readonly avisos: readonly string[];
}

const SIN_FECHA = { desde: null, hasta: null };

/** Índice de las sesiones de cada actividad, ordenadas en el tiempo. */
function sesionesPorActividad(
  snapshot: ProjectSnapshot,
): Map<Uuid, { fecha: string; hora: string; semana: number; materiaId: Uuid }[]> {
  const sesionPorId = new Map(snapshot.sessions.map((sesion) => [sesion.id, sesion]));
  const mapa = new Map<Uuid, { fecha: string; hora: string; semana: number; materiaId: Uuid }[]>();

  for (const arista of snapshot.edges) {
    if (arista.type !== 'ejecuta') continue;
    const sesion = sesionPorId.get(arista.sourceId);
    if (!sesion) continue;
    const lista = mapa.get(arista.targetId) ?? [];
    lista.push({
      fecha: sesion.date,
      hora: sesion.startTime,
      semana: sesion.weekIndex,
      materiaId: sesion.subjectId,
    });
    mapa.set(arista.targetId, lista);
  }

  for (const lista of mapa.values()) {
    lista.sort((a, b) => `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`));
  }
  return mapa;
}

/** De qué materia es cada actividad, según quién la tiene a su cargo. */
function materiaPorActividad(snapshot: ProjectSnapshot): Map<Uuid, Uuid> {
  const materiaDelDocente = new Map(
    snapshot.teachers.map((docente) => [docente.id, docente.initials]),
  );
  const porAbreviatura = new Map(
    snapshot.subjects.map((materia) => [materia.shortName, materia.id]),
  );
  const mapa = new Map<Uuid, Uuid>();

  for (const arista of snapshot.edges) {
    if (arista.type !== 'responsable_de') continue;
    const abreviatura = materiaDelDocente.get(arista.sourceId);
    const materiaId = abreviatura === undefined ? undefined : porAbreviatura.get(abreviatura);
    if (materiaId !== undefined) mapa.set(arista.targetId, materiaId);
  }

  // Respaldo: si nadie figura como responsable, se deduce de los criterios que
  // desarrolla. Es menos fiable —una actividad puede desarrollar criterios de dos
  // materias— y por eso solo se usa cuando no hay responsable declarado.
  const materiaDelCriterio = new Map(
    snapshot.evaluationCriteria.map((criterio) => [criterio.id, criterio.subjectId]),
  );
  for (const arista of snapshot.edges) {
    if (arista.type !== 'desarrolla' || mapa.has(arista.sourceId)) continue;
    const materiaId = materiaDelCriterio.get(arista.targetId);
    if (materiaId !== undefined) mapa.set(arista.sourceId, materiaId);
  }

  return mapa;
}

interface Contexto {
  readonly snapshot: ProjectSnapshot;
  readonly sesiones: ReturnType<typeof sesionesPorActividad>;
  readonly materiaDe: Map<Uuid, Uuid>;
  readonly materiaPorId: Map<Uuid, Subject>;
  readonly situacionPorId: Map<Uuid, LearningSituation>;
  readonly criterioPorId: Map<Uuid, EvaluationCriterion>;
  readonly saberPorId: Map<Uuid, BasicKnowledge>;
  readonly desarrolla: Map<Uuid, Uuid[]>;
  readonly moviliza: Map<Uuid, Uuid[]>;
  readonly requiere: Map<Uuid, Uuid[]>;
  readonly habilita: Map<Uuid, Uuid[]>;
}

function construirContexto(snapshot: ProjectSnapshot): Contexto {
  const desarrolla = new Map<Uuid, Uuid[]>();
  const moviliza = new Map<Uuid, Uuid[]>();
  const requiere = new Map<Uuid, Uuid[]>();
  const habilita = new Map<Uuid, Uuid[]>();

  const empujar = (mapa: Map<Uuid, Uuid[]>, clave: Uuid, valor: Uuid): void => {
    const lista = mapa.get(clave);
    if (lista) lista.push(valor);
    else mapa.set(clave, [valor]);
  };

  for (const arista of snapshot.edges) {
    if (arista.type === 'desarrolla') empujar(desarrolla, arista.sourceId, arista.targetId);
    else if (arista.type === 'moviliza') empujar(moviliza, arista.sourceId, arista.targetId);
    else if (arista.type === 'depende_de') {
      empujar(requiere, arista.sourceId, arista.targetId);
      empujar(habilita, arista.targetId, arista.sourceId);
    }
  }

  return {
    snapshot,
    sesiones: sesionesPorActividad(snapshot),
    materiaDe: materiaPorActividad(snapshot),
    materiaPorId: new Map(snapshot.subjects.map((m) => [m.id, m])),
    situacionPorId: new Map(snapshot.learningSituations.map((s) => [s.id, s])),
    criterioPorId: new Map(snapshot.evaluationCriteria.map((c) => [c.id, c])),
    saberPorId: new Map(snapshot.basicKnowledge.map((s) => [s.id, s])),
    desarrolla,
    moviliza,
    requiere,
    habilita,
  };
}

function rangoDe(
  contexto: Contexto,
  actividadId: Uuid,
): { desde: string | null; hasta: string | null } {
  const lista = contexto.sesiones.get(actividadId) ?? [];
  const primera = lista[0];
  const ultima = lista.at(-1);
  if (!primera || !ultima) return SIN_FECHA;
  return { desde: `${primera.fecha}T${primera.hora}`, hasta: `${ultima.fecha}T${ultima.hora}` };
}

function enlaceA(contexto: Contexto, actividadId: Uuid): Enlace | null {
  const actividad = contexto.snapshot.activities.find((a) => a.id === actividadId);
  if (!actividad) return null;
  const materiaId = contexto.materiaDe.get(actividadId);
  const rango = rangoDe(contexto, actividadId);
  return {
    id: actividad.id,
    titulo: actividad.title,
    materia:
      (materiaId === undefined ? undefined : contexto.materiaPorId.get(materiaId)?.shortName) ??
      '—',
    desde: rango.desde,
    hasta: rango.hasta,
  };
}

/** Construye la ficha completa de una actividad. */
function ficha(contexto: Contexto, actividad: Activity): FichaActividad {
  const materiaId = contexto.materiaDe.get(actividad.id);
  const rango = rangoDe(contexto, actividad.id);

  const criterios = (contexto.desarrolla.get(actividad.id) ?? [])
    .map((id) => contexto.criterioPorId.get(id))
    .filter((c): c is EvaluationCriterion => c !== undefined)
    .map((c) => ({ id: c.id, codigo: c.officialCode ?? '', texto: c.description }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));

  const saberes = (contexto.moviliza.get(actividad.id) ?? [])
    .map((id) => contexto.saberPorId.get(id))
    .filter((s): s is BasicKnowledge => s !== undefined)
    .map((s) => ({ id: s.id, codigo: s.officialCode ?? '', texto: s.description, bloque: s.block }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));

  const enlaces = (ids: readonly Uuid[]): Enlace[] =>
    ids.map((id) => enlaceA(contexto, id)).filter((e): e is Enlace => e !== null);

  return {
    id: actividad.id,
    titulo: actividad.title,
    descripcion: actividad.description,
    producto: actividad.product,
    materiales: actividad.materials,
    situacion: contexto.situacionPorId.get(actividad.learningSituationId)?.title ?? '',
    materia: (materiaId === undefined ? undefined : contexto.materiaPorId.get(materiaId)) ?? null,
    sesiones: (contexto.sesiones.get(actividad.id) ?? []).map((s) => ({
      fecha: s.fecha,
      hora: s.hora,
    })),
    desde: rango.desde,
    hasta: rango.hasta,
    criterios,
    saberes,
    requiere: enlaces(contexto.requiere.get(actividad.id) ?? []),
    habilita: enlaces(contexto.habilita.get(actividad.id) ?? []),
  };
}

/** Quita repetidos conservando el orden de la primera aparición. */
function sinRepetir<T extends { id: string }>(items: readonly T[]): T[] {
  const vistos = new Set<string>();
  const salida: T[] = [];
  for (const item of items) {
    if (vistos.has(item.id)) continue;
    vistos.add(item.id);
    salida.push(item);
  }
  return salida;
}

/**
 * El programa completo del proyecto, en texto.
 *
 * `grado` acota el currículo que se cita —los criterios sin trabajar de cada
 * materia— al curso indicado. Las actividades no se acotan: lo que el equipo ha
 * programado es lo que hay, y esconderlo por un filtro de curso sería mentir
 * sobre el proyecto.
 */
export function construirPrograma(snapshot: ProjectSnapshot, grado: number | null): Programa {
  const contexto = construirContexto(snapshot);

  const ordenActividad = (a: Activity, b: Activity): number =>
    a.order - b.order || a.title.localeCompare(b.title, 'es');

  const fichas = new Map<Uuid, FichaActividad>(
    snapshot.activities.map((actividad) => [actividad.id, ficha(contexto, actividad)]),
  );

  const situaciones = [...snapshot.learningSituations]
    .sort((a, b) => a.order - b.order)
    .map((situacion) => {
      const actividades = snapshot.activities
        .filter((a) => a.learningSituationId === situacion.id)
        .sort(ordenActividad)
        .map((a) => fichas.get(a.id))
        .filter((f): f is FichaActividad => f !== undefined);
      return {
        situacion,
        actividades,
        materias: [
          ...new Set(actividades.map((f) => f.materia?.shortName).filter((n): n is string => !!n)),
        ],
      };
    });

  const ambito = scopeCurriculum(snapshot, grado);
  const trabajados = new Set(
    snapshot.edges.filter((e) => e.type === 'desarrolla').map((e) => e.targetId),
  );

  const materias = snapshot.subjects.map((materia): ProgramaMateria => {
    const actividades = snapshot.activities
      .filter((a) => contexto.materiaDe.get(a.id) === materia.id)
      .sort(ordenActividad)
      .map((a) => fichas.get(a.id))
      .filter((f): f is FichaActividad => f !== undefined);

    return {
      materia,
      actividades,
      sesiones: snapshot.sessions.filter((s) => s.subjectId === materia.id).length,
      criterios: sinRepetir(actividades.flatMap((f) => f.criterios)),
      saberes: sinRepetir(actividades.flatMap((f) => f.saberes)),
      criteriosSinTrabajar: ambito.criteria
        .filter((c) => c.subjectId === materia.id && !trabajados.has(c.id))
        .map((c) => ({ id: c.id, codigo: c.officialCode ?? '', texto: c.description }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es')),
    };
  });

  return {
    titulo: snapshot.project.title,
    curso: snapshot.project.course,
    grupo: snapshot.project.group,
    periodo: { desde: snapshot.project.startDate, hasta: snapshot.project.endDate },
    descripcion: snapshot.project.description,
    situaciones,
    materias,
    gradoAcotado: grado,
  };
}

/**
 * La semana que contiene una fecha, o `null` si esa fecha cae fuera.
 *
 * Sirve para que el informe semanal se abra por la semana en curso en vez de
 * por la primera: la pregunta que trae a un docente a esta pantalla es «qué toca
 * ahora», no «qué tocaba en octubre».
 */
export function semanaDe(semanas: readonly Semana[], fechaISO: string): number | null {
  const dia = fechaISO.slice(0, 10);
  const encontrada = semanas.find((semana) => dia >= semana.desde && dia <= semana.hasta);
  return encontrada?.indice ?? null;
}

/**
 * El proyecto semana a semana.
 *
 * Solo aparecen las semanas con sesiones. Una semana vacía en medio del proyecto
 * —una de exámenes, unas vacaciones— no tiene nada que informar, y listarla con
 * un «nada esta semana» hace que el documento se lea peor sin decir más.
 */
export function construirSemanas(snapshot: ProjectSnapshot): Semana[] {
  const contexto = construirContexto(snapshot);

  const actividadDeSesion = new Map<Uuid, Uuid>();
  for (const arista of snapshot.edges) {
    if (arista.type === 'ejecuta') actividadDeSesion.set(arista.sourceId, arista.targetId);
  }

  const indices = [...new Set(snapshot.sessions.map((s) => s.weekIndex))].sort((a, b) => a - b);

  return indices.map((indice): Semana => {
    const sesiones = snapshot.sessions
      .filter((s) => s.weekIndex === indice)
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

    const fechas = sesiones.map((s) => s.date);
    const desde = fechas[0] ?? '';
    const hasta = fechas.at(-1) ?? '';

    const materias = snapshot.subjects
      .map((materia): SemanaMateria | null => {
        const suyas = sesiones.filter((s) => s.subjectId === materia.id);
        if (suyas.length === 0) return null;

        const actividades = sinRepetir(
          suyas
            .map((s) => actividadDeSesion.get(s.id))
            .filter((id): id is Uuid => id !== undefined)
            .map((id) => snapshot.activities.find((a) => a.id === id))
            .filter((a): a is Activity => a !== undefined),
        ).map((a) => ficha(contexto, a));

        return {
          materia,
          actividades,
          sesiones: suyas.map((s) => ({ fecha: s.date, hora: s.startTime })),
          materiales: [
            ...new Set(
              actividades
                .flatMap((f) => f.materiales.split(','))
                .map((m) => m.trim())
                .filter((m) => m.length > 0),
            ),
          ],
        };
      })
      .filter((m): m is SemanaMateria => m !== null);

    /**
     * Avisos de coordinación.
     *
     * Se emite uno cuando algo que empieza esta semana depende de una actividad
     * de otra materia que no termina antes. Es exactamente el fallo que nadie ve
     * mirando su propia programación, porque está en la de otro.
     */
    const avisos: string[] = [];
    for (const materiaSemana of materias) {
      for (const actividad of materiaSemana.actividades) {
        for (const previa of actividad.requiere) {
          if (previa.hasta === null) {
            avisos.push(
              `«${actividad.titulo}» (${materiaSemana.materia.shortName}) necesita ` +
                `«${previa.titulo}» (${previa.materia}), que todavía no tiene sesiones asignadas.`,
            );
          } else if (actividad.desde !== null && previa.hasta >= actividad.desde) {
            avisos.push(
              `«${actividad.titulo}» (${materiaSemana.materia.shortName}) empieza el ` +
                `${actividad.desde.slice(0, 10)} y necesita «${previa.titulo}» ` +
                `(${previa.materia}), que no termina hasta el ${previa.hasta.slice(0, 10)}.`,
            );
          }
        }
      }
    }

    return {
      indice,
      desde,
      hasta,
      materias,
      hitos: snapshot.milestones
        .filter((h) => h.date >= desde && h.date <= hasta)
        .map((h) => ({ titulo: h.title, fecha: h.date })),
      entregas: snapshot.finalProducts
        .filter((p) => p.dueDate >= desde && p.dueDate <= hasta)
        .map((p) => ({ titulo: p.title, fecha: p.dueDate })),
      avisos: [...new Set(avisos)],
    };
  });
}
