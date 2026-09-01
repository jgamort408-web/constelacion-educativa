import type { EdgeType, NodeType, ProjectSnapshot } from '@/domain';
import { projectSnapshotSchema, SCHEMA_VERSION } from '@/domain';
import { stableId } from '@/utils/ids.ts';
import curriculo from './curriculo-demo.json';

/**
 * Proyecto de demostración: «Cartografía sonora de nuestro barrio».
 *
 * Una sola situación de aprendizaje, tres materias y **criterios de evaluación
 * reales** de la Orden de 30 de mayo de 2023 para 1.º de ESO. Ya no hay códigos
 * inventados: lo que se ve al abrir la aplicación es lo que un docente andaluz
 * maneja de verdad, con códigos que puede citar en su programación.
 *
 * Se dejó atrás el ejemplo anterior —cuatro situaciones y catorce actividades con
 * códigos DEMO— porque servía para probar el motor pero no para entender el
 * producto: con doscientos nodos en pantalla, el mapa no enseñaba nada. Una
 * situación bien trabada, con sus criterios y saberes reales colgando, se lee.
 */

const NS = 'demo:sonora';
const id = (clave: string): string => stableId(NS, clave);

const START = '2026-10-05';
const END = '2026-11-13';

/** Las tres materias, con el código que usa el catálogo andaluz. */
const MATERIAS = [
  { corto: 'GEH', nombre: 'Geografía e Historia', color: '#5fb98a', semanales: 3 },
  { corto: 'LCL', nombre: 'Lengua Castellana y Literatura', color: '#e0715c', semanales: 4 },
  { corto: 'MAT', nombre: 'Matemáticas', color: '#4c7ef3', semanales: 4 },
] as const;

interface ActividadSpec {
  clave: string;
  titulo: string;
  descripcion: string;
  materia: string;
  sesiones: number;
  /** Códigos oficiales de los criterios que desarrolla. */
  criterios: readonly string[];
  dependeDe: readonly string[];
  producto: string;
  materiales: string;
  semana: number;
  dia: number;
  hora: number;
}

/**
 * Seis actividades encadenadas.
 *
 * La cadena cruza las tres materias a propósito: Geografía levanta el mapa,
 * Matemáticas lo cuantifica, Lengua lo convierte en discurso público. Es lo que
 * hace interdisciplinar al proyecto y lo que el mapa estelar tiene que mostrar.
 */
const ACTIVIDADES: readonly ActividadSpec[] = [
  {
    clave: 'A1',
    titulo: 'Deriva sonora por el barrio',
    descripcion:
      'Recorrido por seis puntos del barrio grabando dos minutos de sonido ambiente en cada uno, a distintas horas. El alumnado anota qué oye y qué cree que lo produce.',
    materia: 'GEH',
    sesiones: 2,
    criterios: ['GEH.1.1.1'],
    dependeDe: [],
    producto: 'Seis grabaciones georreferenciadas con su ficha',
    materiales: 'Móvil con grabadora, plano del barrio, ficha de campo',
    semana: 0,
    dia: 2,
    hora: 1,
  },
  {
    clave: 'A2',
    titulo: 'Mapa de puntos de escucha',
    descripcion:
      'Localización de los seis puntos sobre el plano y descripción del entorno de cada uno: usos del suelo, tráfico, presencia de vegetación y de vecindario.',
    materia: 'GEH',
    sesiones: 2,
    criterios: ['GEH.1.2.1'],
    dependeDe: ['A1'],
    producto: 'Plano anotado con los seis puntos',
    materiales: 'Plano a escala, visor cartográfico, grabaciones de A1',
    semana: 1,
    dia: 2,
    hora: 1,
  },
  {
    clave: 'A3',
    titulo: 'Medimos el ruido',
    descripcion:
      'Toma de medidas de nivel sonoro en cada punto y a cada hora, tabulación de los datos y cálculo de medias y dispersión. Se discute cuándo una media engaña.',
    materia: 'MAT',
    sesiones: 3,
    criterios: ['MAT.1.1.1', 'MAT.1.2.1'],
    dependeDe: ['A2'],
    producto: 'Tabla de mediciones con sus estadísticos',
    materiales: 'Sonómetro o app medidora, hoja de cálculo',
    semana: 2,
    dia: 1,
    hora: 0,
  },
  {
    clave: 'A4',
    titulo: 'Gráficos que no mienten',
    descripcion:
      'Representación de los datos eligiendo el gráfico adecuado, y comparación con versiones deliberadamente engañosas de los mismos datos.',
    materia: 'MAT',
    sesiones: 2,
    criterios: ['MAT.1.3.1'],
    dependeDe: ['A3'],
    producto: 'Serie de gráficos con su justificación',
    materiales: 'Hoja de cálculo, datos de A3',
    semana: 3,
    dia: 1,
    hora: 0,
  },
  {
    clave: 'A5',
    titulo: 'Escribimos la crónica sonora',
    descripcion:
      'Redacción de un texto expositivo que integra el mapa, las mediciones y la experiencia del recorrido, cuidando la cita de las fuentes propias.',
    materia: 'LCL',
    sesiones: 3,
    criterios: ['LCL.1.1.1', 'LCL.1.2.1'],
    dependeDe: ['A4', 'A2'],
    producto: 'Crónica sonora del barrio',
    materiales: 'Procesador de textos, mapa de A2, gráficos de A4',
    semana: 3,
    dia: 3,
    hora: 2,
  },
  {
    clave: 'A6',
    titulo: 'Lo contamos en la biblioteca',
    descripcion:
      'Exposición oral de las conclusiones ante otro grupo y ante familias, con el mapa proyectado y una escucha guiada de las grabaciones.',
    materia: 'LCL',
    sesiones: 2,
    criterios: ['LCL.1.3.1'],
    dependeDe: ['A5'],
    producto: 'Cartografía sonora presentada públicamente',
    materiales: 'Proyector, altavoces, grabaciones, crónica',
    semana: 4,
    dia: 5,
    hora: 4,
  },
];

const HORAS = ['08:15', '09:15', '10:15', '11:45', '12:45'];

function fecha(semana: number, dia: number): string {
  const inicio = new Date(`${START}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() + semana * 7 + (dia - 1));
  return inicio.toISOString().slice(0, 10);
}

interface Arista {
  id: string;
  projectId: string;
  type: EdgeType;
  sourceId: string;
  sourceType: NodeType;
  targetId: string;
  targetType: NodeType;
  metadata: {
    weight: number | null;
    mode: 'MANUAL' | 'CALCULADA' | 'PROPUESTA_IA';
    sessions: number | null;
    criteriaIds: string[];
    note: string;
  };
}

export function buildDemoSnapshot(): ProjectSnapshot {
  const projectId = id('proyecto');
  const situacionId = id('sda');
  const productoId = id('producto');

  const materiaCatalogo = new Map(curriculo.subjects.map((m) => [m.corto, m.id]));
  const criterioPorCodigo = new Map(curriculo.evaluationCriteria.map((c) => [c.officialCode, c]));

  const materiaId = (corto: string): string => id(`materia:${corto}`);
  const docenteId = (corto: string): string => id(`docente:${corto}`);
  const actividadId = (clave: string): string => id(`actividad:${clave}`);

  /**
   * Las aristas se indexan por identificador.
   *
   * El identificador se deriva de tipo y extremos, así que declarar dos veces la
   * misma relación produce la misma arista: la segunda debe sustituir a la
   * primera, no duplicarla. Es lo que permite declarar la participación de una
   * materia en el bucle y refinarla después con una ponderación manual.
   */
  const porId = new Map<string, Arista>();
  const arista = (
    type: EdgeType,
    origen: [string, NodeType],
    destino: [string, NodeType],
    metadata: Partial<Arista['metadata']> = {},
  ): void => {
    const aristaId = id(`arista:${type}:${origen[0]}:${destino[0]}`);
    porId.set(aristaId, {
      id: aristaId,
      projectId,
      type,
      sourceId: origen[0],
      sourceType: origen[1],
      targetId: destino[0],
      targetType: destino[1],
      metadata: {
        weight: null,
        mode: 'MANUAL',
        sessions: null,
        criteriaIds: [],
        note: '',
        ...metadata,
      },
    });
  };
  const edges = (): Arista[] => [...porId.values()];

  // Materias y situación
  for (const materia of MATERIAS) {
    arista('participa_en', [materiaId(materia.corto), 'MATERIA'], [projectId, 'PROYECTO']);
    arista(
      'participa_en',
      [materiaId(materia.corto), 'MATERIA'],
      [situacionId, 'SITUACION_APRENDIZAJE'],
      { mode: 'CALCULADA', note: 'Participa en la situación de aprendizaje' },
    );
  }
  arista('forma_parte_de', [situacionId, 'SITUACION_APRENDIZAJE'], [projectId, 'PROYECTO']);

  // Una ponderación fijada a mano por el equipo, para que el ejemplo enseñe la
  // regla de la §6: el criterio del docente manda sobre el cálculo, y cuando
  // discrepan la aplicación muestra ambos en vez de corregir en silencio.
  arista('participa_en', [materiaId('GEH'), 'MATERIA'], [situacionId, 'SITUACION_APRENDIZAJE'], {
    weight: 0.85,
    mode: 'MANUAL',
    note: 'El equipo acordó que Geografía vertebra la situación, aunque comparta sesiones.',
  });

  // Actividades, criterios, saberes y dependencias
  const sesiones: {
    id: string;
    projectId: string;
    subjectId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    weekIndex: number;
    notes: string;
  }[] = [];

  ACTIVIDADES.forEach((actividad, indice) => {
    const from = actividadId(actividad.clave);
    arista('forma_parte_de', [from, 'ACTIVIDAD'], [situacionId, 'SITUACION_APRENDIZAJE']);
    arista('responsable_de', [docenteId(actividad.materia), 'DOCENTE'], [from, 'ACTIVIDAD'], {
      note: 'Responsable de la actividad',
    });

    for (const codigo of actividad.criterios) {
      const criterio = criterioPorCodigo.get(codigo);
      if (!criterio) continue;
      arista('desarrolla', [from, 'ACTIVIDAD'], [criterio.id, 'CRITERIO_EVALUACION']);

      // Los saberes que la propia Orden relaciona con ese criterio.
      for (const codigoSaber of criterio.relatedKnowledgeCodes) {
        const saber = curriculo.basicKnowledge.find((s) => s.officialCode === codigoSaber);
        if (!saber) continue;
        arista('moviliza', [from, 'ACTIVIDAD'], [saber.id, 'SABER_BASICO'], {
          criteriaIds: [criterio.id],
          note: `La norma lo relaciona con ${codigo}`,
        });
      }
    }

    for (const dependencia of actividad.dependeDe) {
      arista('depende_de', [from, 'ACTIVIDAD'], [actividadId(dependencia), 'ACTIVIDAD'], {
        note: 'No puede empezar sin el resultado de la anterior',
      });
    }

    // Una sesión por cada sesión estimada, en días lectivos consecutivos. Al
    // pasar del viernes salta a la semana siguiente: sin esto, una actividad de
    // tres sesiones que empieza en jueves colocaba clase en sábado.
    for (let n = 0; n < actividad.sesiones; n += 1) {
      const desplazamiento = actividad.dia - 1 + n;
      const semana = actividad.semana + Math.floor(desplazamiento / 5);
      const dia = (desplazamiento % 5) + 1;
      const sesionId = id(`sesion:${actividad.clave}:${n}`);
      arista('ejecuta', [sesionId, 'SESION'], [from, 'ACTIVIDAD']);
      sesiones.push({
        id: sesionId,
        projectId,
        subjectId: materiaId(actividad.materia),
        date: fecha(semana, dia),
        startTime: HORAS[actividad.hora] ?? '08:15',
        durationMinutes: 60,
        weekIndex: semana,
        notes: '',
      });
    }

    if (indice >= ACTIVIDADES.length - 2) {
      arista('contribuye_a', [from, 'ACTIVIDAD'], [productoId, 'PRODUCTO_FINAL'], {
        weight: indice === ACTIVIDADES.length - 1 ? 1 : 0.6,
        note: 'Aporta al producto final',
      });
    }
  });

  // El currículo real, con los identificadores de materia del proyecto.
  const traducir = <T extends { subjectId: string }>(elemento: T): T => {
    const corto = [...materiaCatalogo.entries()].find(([, v]) => v === elemento.subjectId)?.[0];
    return corto ? { ...elemento, subjectId: materiaId(corto) } : elemento;
  };

  for (const criterio of curriculo.evaluationCriteria) {
    arista(
      'pertenece_a',
      [criterio.id, 'CRITERIO_EVALUACION'],
      [traducir(criterio).subjectId, 'MATERIA'],
    );
  }

  return projectSnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-09-01T10:00:00.000Z',
    generatedBy: 'constelacion-educativa · ejemplo con currículo real',

    project: {
      id: projectId,
      title: 'Cartografía sonora de nuestro barrio',
      description:
        'El alumnado recorre su barrio grabando cómo suena, mide el ruido, lo cartografía y lo cuenta públicamente. Cinco semanas, tres materias y un producto que se escucha.',
      course: '1.º ESO',
      group: '1.º ESO B',
      startDate: START,
      endDate: END,
      nonSchoolDays: ['2026-10-12'],
      contributionWeights: {
        sessions: 0.35,
        activities: 0.25,
        criteria: 0.2,
        finalProduct: 0.1,
        assessment: 0.1,
      },
    },

    subjects: MATERIAS.map((materia) => ({
      id: materiaId(materia.corto),
      projectId,
      name: materia.nombre,
      shortName: materia.corto,
      color: materia.color,
      weeklySessions: materia.semanales,
    })),

    teachers: MATERIAS.map((materia) => ({
      id: docenteId(materia.corto),
      projectId,
      displayName: `Docente de ${materia.nombre}`,
      initials: materia.corto,
    })),

    learningSituations: [
      {
        id: situacionId,
        projectId,
        title: 'Cómo suena mi barrio',
        description:
          'Una situación que parte de una pregunta que el alumnado puede responder saliendo a la calle: ¿de qué está hecho el ruido de mi barrio, y quién lo sufre más? Geografía levanta el mapa, Matemáticas lo mide, Lengua lo convierte en discurso público.',
        order: 0,
        estimatedSessions: 14,
      },
    ],

    activities: ACTIVIDADES.map((actividad, posicion) => ({
      id: actividadId(actividad.clave),
      projectId,
      learningSituationId: situacionId,
      title: actividad.titulo,
      description: actividad.descripcion,
      order: posicion,
      estimatedSessions: actividad.sesiones,
      status: 'PENDIENTE',
      product: actividad.producto,
      materials: actividad.materiales,
    })),

    sessions: sesiones,

    milestones: [
      {
        id: id('hito:datos'),
        projectId,
        title: 'Datos recogidos y medidos',
        description: 'Sin mediciones no hay gráficos ni crónica: es el punto sin retorno.',
        date: fecha(2, 5),
      },
    ],

    finalProducts: [
      {
        id: productoId,
        projectId,
        title: 'Cartografía sonora del barrio',
        description:
          'Mapa del barrio con sus puntos de escucha, las mediciones de cada uno, la crónica escrita y una audición guiada, presentados en la biblioteca del centro.',
        dueDate: END,
      },
    ],

    curriculumVersions: curriculo.curriculumVersions,
    competencies: curriculo.competencies.map(traducir),
    evaluationCriteria: curriculo.evaluationCriteria.map(traducir),
    basicKnowledge: curriculo.basicKnowledge.map(traducir),

    edges: edges(),
  });
}

export const DEMO_INFO = {
  title: 'Cartografía sonora de nuestro barrio',
  course: '1.º ESO',
  weeks: 5,
  subjects: MATERIAS.length,
  situations: 1,
  activities: ACTIVIDADES.length,
} as const;
