import type { EdgeType, NodeType, ProjectSnapshot } from '@/domain';
import { projectSnapshotSchema, SCHEMA_VERSION } from '@/domain';
import { stableId } from '@/utils/ids.ts';

/**
 * Proyecto de demostración: «Transformamos nuestro barrio» (§26).
 *
 * ---------------------------------------------------------------------------
 * ADVERTENCIA SOBRE LOS CÓDIGOS CURRICULARES
 *
 * Todos los códigos de este archivo empiezan por `DEMO.` y su versión curricular
 * lleva `isDemo: true`. **No proceden de ninguna norma** y no deben citarse en una
 * programación real. La redacción de los criterios es una paráfrasis inventada
 * para que el ejemplo se entienda, no el texto de la Orden.
 *
 * Es deliberado que resulte imposible confundirlos con referencias oficiales: un
 * código de ejemplo colado en una programación entregada a inspección es un
 * problema real, y evitarlo cuesta un prefijo.
 * ---------------------------------------------------------------------------
 *
 * El proyecto se declara aquí de forma compacta y se expande al snapshot
 * normalizado en `buildDemoSnapshot`. Escribir las 14 actividades ya normalizadas,
 * con sus aristas a mano, sería ilegible e imposible de mantener.
 */

const NS = 'demo:barrio';
const id = (key: string): string => stableId(NS, key);

/** Lunes de la semana 1. El proyecto ocupa seis semanas lectivas. */
const START = '2026-10-05';
const END = '2026-11-13';

interface SubjectSpec {
  key: string;
  name: string;
  short: string;
  color: string;
  weekly: number;
}

const SUBJECTS: readonly SubjectSpec[] = [
  { key: 'MAT', name: 'Matemáticas', short: 'MAT', color: '#4c7ef3', weekly: 4 },
  { key: 'LEN', name: 'Lengua Castellana y Literatura', short: 'LEN', color: '#e0715c', weekly: 4 },
  { key: 'GEH', name: 'Geografía e Historia', short: 'GEH', color: '#5fb98a', weekly: 3 },
  { key: 'ING', name: 'Inglés', short: 'ING', color: '#b47ad4', weekly: 4 },
  { key: 'TEC', name: 'Tecnología y Digitalización', short: 'TEC', color: '#e0a94b', weekly: 2 },
];

interface SituationSpec {
  key: string;
  title: string;
  description: string;
  order: number;
  sessions: number;
}

const SITUATIONS: readonly SituationSpec[] = [
  {
    key: 'SDA01',
    title: 'Conocemos nuestro barrio',
    description:
      'El alumnado recoge información de primera mano sobre el barrio: datos, espacios, servicios y la voz de quienes viven en él. El objetivo es sustituir las impresiones por evidencias.',
    order: 0,
    sessions: 8,
  },
  {
    key: 'SDA02',
    title: 'Analizamos lo que hemos encontrado',
    description:
      'Los datos brutos se convierten en información: se tratan estadísticamente, se interpretan en su contexto geográfico y social, y se redacta un informe diagnóstico compartido.',
    order: 1,
    sessions: 9,
  },
  {
    key: 'SDA03',
    title: 'Imaginamos mejoras posibles',
    description:
      'A partir del diagnóstico, el alumnado propone intervenciones concretas y comprueba si son viables: cuánto costarían, cuánto espacio ocupan, a quién benefician.',
    order: 2,
    sessions: 10,
  },
  {
    key: 'SDA04',
    title: 'Lo presentamos al barrio',
    description:
      'La propuesta se convierte en un producto público y defendible ante una audiencia real, en castellano y en inglés.',
    order: 3,
    sessions: 7,
  },
];

interface ActivitySpec {
  key: string;
  situation: string;
  title: string;
  description: string;
  sessions: number;
  /** Materias que participan. La primera es la que lidera. */
  subjects: readonly string[];
  criteria: readonly string[];
  knowledge: readonly string[];
  /** Actividades que deben haberse hecho antes. */
  dependsOn: readonly string[];
  product: string;
  materials: string;
}

const ACTIVITIES: readonly ActivitySpec[] = [
  {
    key: 'ACT01',
    situation: 'SDA01',
    title: 'Radiografía estadística del barrio',
    description:
      'Diseño y aplicación de una encuesta al vecindario sobre transporte, zonas verdes, limpieza y seguridad. El alumnado decide qué preguntar y cómo muestrear.',
    sessions: 2,
    subjects: ['MAT', 'GEH'],
    criteria: ['MAT.1', 'GEH.1'],
    knowledge: ['MAT.S1', 'GEH.S1'],
    dependsOn: [],
    product: 'Cuestionario aplicado y datos brutos',
    materials: 'Tablets o móviles, formulario digital, cuaderno de campo',
  },
  {
    key: 'ACT02',
    situation: 'SDA01',
    title: 'Cartografía de servicios del barrio',
    description:
      'Localización sobre plano de los equipamientos existentes: sanidad, educación, deporte, zonas verdes y paradas de transporte. Se identifican las áreas peor atendidas.',
    sessions: 2,
    subjects: ['GEH'],
    criteria: ['GEH.1', 'GEH.2'],
    knowledge: ['GEH.S1', 'GEH.S2'],
    dependsOn: [],
    product: 'Mapa de servicios anotado',
    materials: 'Plano del barrio, visor cartográfico, rotuladores',
  },
  {
    key: 'ACT03',
    situation: 'SDA01',
    title: 'Entrevistas al vecindario',
    description:
      'Preparación del guion, realización de entrevistas y transcripción. Se trabaja la escucha, la repregunta y el registro fiel de lo dicho.',
    sessions: 2,
    subjects: ['LEN'],
    criteria: ['LEN.1'],
    knowledge: ['LEN.S1'],
    dependsOn: [],
    product: 'Entrevistas transcritas',
    materials: 'Grabadora o móvil, guion de entrevista, autorizaciones',
  },
  {
    key: 'ACT04',
    situation: 'SDA01',
    title: 'Glosario urbano en inglés',
    description:
      'Construcción de un vocabulario específico sobre urbanismo y sostenibilidad que se usará después en la presentación final.',
    sessions: 2,
    subjects: ['ING'],
    criteria: ['ING.1'],
    knowledge: ['ING.S1'],
    dependsOn: [],
    product: 'Glosario bilingüe ilustrado',
    materials: 'Diccionario en línea, plantilla de glosario',
  },
  {
    key: 'ACT05',
    situation: 'SDA02',
    title: 'Tratamiento estadístico de la encuesta',
    description:
      'Cálculo de frecuencias, medidas de centralización y dispersión. Representación gráfica y discusión de qué gráfico engaña y cuál informa.',
    sessions: 3,
    subjects: ['MAT'],
    criteria: ['MAT.1', 'MAT.2'],
    knowledge: ['MAT.S1', 'MAT.S2'],
    dependsOn: ['ACT01'],
    product: 'Informe estadístico con gráficos',
    materials: 'Hoja de cálculo, datos de ACT01',
  },
  {
    key: 'ACT06',
    situation: 'SDA02',
    title: 'Interpretación de indicadores sociales',
    description:
      'Los resultados estadísticos se leen en clave territorial: qué explica que una zona tenga peores indicadores y qué factores históricos intervienen.',
    sessions: 3,
    subjects: ['GEH'],
    criteria: ['GEH.2'],
    knowledge: ['GEH.S2'],
    dependsOn: ['ACT05', 'ACT02'],
    product: 'Análisis territorial de los resultados',
    materials: 'Informe estadístico, mapa de servicios',
  },
  {
    key: 'ACT07',
    situation: 'SDA02',
    title: 'Redacción del informe diagnóstico',
    description:
      'Escritura colaborativa de un texto expositivo que integra datos, mapa y voces del vecindario. Se trabaja la cita, la estructura y la adecuación al registro.',
    sessions: 3,
    subjects: ['LEN'],
    criteria: ['LEN.1', 'LEN.2'],
    knowledge: ['LEN.S1', 'LEN.S2'],
    dependsOn: ['ACT06', 'ACT03'],
    product: 'Informe diagnóstico del barrio',
    materials: 'Procesador de textos, guía de estilo, fuentes anteriores',
  },
  {
    key: 'ACT08',
    situation: 'SDA03',
    title: 'Taller de propuestas de mejora',
    description:
      'Generación estructurada de ideas a partir del diagnóstico y priorización razonada según impacto y viabilidad.',
    sessions: 2,
    subjects: ['LEN', 'GEH'],
    criteria: ['LEN.2', 'GEH.2'],
    knowledge: ['LEN.S2', 'GEH.S2'],
    dependsOn: ['ACT07'],
    product: 'Tres propuestas priorizadas',
    materials: 'Informe diagnóstico, notas adhesivas, matriz de priorización',
  },
  {
    key: 'ACT09',
    situation: 'SDA03',
    title: 'Presupuesto y escala de la propuesta',
    description:
      'Estimación de superficies, materiales y coste. Trabajo con escalas, proporcionalidad y aproximación razonada de cantidades.',
    sessions: 3,
    subjects: ['MAT'],
    criteria: ['MAT.2', 'MAT.3'],
    knowledge: ['MAT.S2', 'MAT.S3'],
    dependsOn: ['ACT08'],
    product: 'Presupuesto justificado',
    materials: 'Hoja de cálculo, catálogos de precios, plano a escala',
  },
  {
    key: 'ACT10',
    situation: 'SDA03',
    title: 'Maqueta digital de la intervención',
    description:
      'Modelado en tres dimensiones de la propuesta priorizada, respetando las medidas reales calculadas en Matemáticas.',
    sessions: 3,
    subjects: ['TEC'],
    criteria: ['TEC.1'],
    knowledge: ['TEC.S1'],
    dependsOn: ['ACT09'],
    product: 'Maqueta digital navegable',
    materials: 'Editor 3D en línea, presupuesto y medidas',
  },
  {
    key: 'ACT11',
    situation: 'SDA03',
    title: 'Pitch de la propuesta en inglés',
    description:
      'Preparación de una exposición breve y persuasiva en inglés usando el glosario construido al principio del proyecto.',
    sessions: 2,
    subjects: ['ING'],
    criteria: ['ING.1', 'ING.2'],
    knowledge: ['ING.S1'],
    dependsOn: ['ACT08', 'ACT04'],
    product: 'Pitch de dos minutos',
    materials: 'Glosario, guion, temporizador',
  },
  {
    key: 'ACT12',
    situation: 'SDA04',
    title: 'Presentación interactiva',
    description:
      'Construcción del soporte digital que integra mapa, datos, maqueta y conclusiones, cuidando la accesibilidad de lo que se muestra.',
    sessions: 3,
    subjects: ['TEC'],
    criteria: ['TEC.1', 'TEC.2'],
    knowledge: ['TEC.S1', 'TEC.S2'],
    dependsOn: ['ACT10'],
    product: 'Presentación interactiva publicada',
    materials: 'Herramienta de presentación, maqueta, informe',
  },
  {
    key: 'ACT13',
    situation: 'SDA04',
    title: 'Ensayo de la exposición pública',
    description:
      'Ensayo con retroalimentación entre iguales de la intervención oral en castellano e inglés: postura, ritmo, claridad y respuesta a preguntas.',
    sessions: 2,
    subjects: ['LEN', 'ING'],
    criteria: ['LEN.2', 'ING.2'],
    knowledge: ['LEN.S2', 'ING.S1'],
    dependsOn: ['ACT12', 'ACT11'],
    product: 'Exposición ensayada y ajustada',
    materials: 'Presentación, rúbrica de oralidad, grabadora',
  },
  {
    key: 'ACT14',
    situation: 'SDA04',
    title: 'Exposición pública de la propuesta',
    description:
      'Defensa de la propuesta ante familias y representantes de la asociación vecinal, con turno de preguntas.',
    sessions: 2,
    subjects: ['LEN', 'TEC', 'GEH', 'MAT', 'ING'],
    criteria: ['LEN.2', 'TEC.2', 'GEH.2'],
    knowledge: ['LEN.S2', 'TEC.S2'],
    dependsOn: ['ACT13'],
    product: 'Propuesta pública de mejora del barrio',
    materials: 'Salón de actos, proyector, presentación, invitaciones',
  },
];

interface CriterionSpec {
  key: string;
  subject: string;
  text: string;
}

/** Criterios de DEMOSTRACIÓN. No son oficiales. Ver la advertencia de cabecera. */
const CRITERIA: readonly CriterionSpec[] = [
  {
    key: 'MAT.1',
    subject: 'MAT',
    text: 'Recoger y organizar datos de un contexto real, eligiendo la muestra y el instrumento adecuados.',
  },
  {
    key: 'MAT.2',
    subject: 'MAT',
    text: 'Interpretar y representar información estadística, valorando si la representación elegida informa o distorsiona.',
  },
  {
    key: 'MAT.3',
    subject: 'MAT',
    text: 'Resolver problemas de proporcionalidad y escala en situaciones de la vida cotidiana.',
  },
  {
    key: 'LEN.1',
    subject: 'LEN',
    text: 'Producir textos orales y escritos de carácter expositivo con adecuación, coherencia y cohesión.',
  },
  {
    key: 'LEN.2',
    subject: 'LEN',
    text: 'Participar en interacciones orales formales defendiendo una postura con argumentos y escuchando la ajena.',
  },
  {
    key: 'GEH.1',
    subject: 'GEH',
    text: 'Interpretar el espacio urbano mediante representaciones cartográficas y fuentes geográficas diversas.',
  },
  {
    key: 'GEH.2',
    subject: 'GEH',
    text: 'Analizar desigualdades territoriales del entorno próximo relacionándolas con factores sociales e históricos.',
  },
  {
    key: 'ING.1',
    subject: 'ING',
    text: 'Comprender y emplear vocabulario específico de un ámbito temático en situaciones de comunicación.',
  },
  {
    key: 'ING.2',
    subject: 'ING',
    text: 'Producir textos orales breves y estructurados con una intención comunicativa clara.',
  },
  {
    key: 'TEC.1',
    subject: 'TEC',
    text: 'Diseñar y modelar digitalmente una solución técnica respetando condiciones y medidas dadas.',
  },
  {
    key: 'TEC.2',
    subject: 'TEC',
    text: 'Elaborar productos digitales accesibles seleccionando la herramienta adecuada a la finalidad.',
  },
];

interface KnowledgeSpec {
  key: string;
  subject: string;
  text: string;
  block: string;
}

/** Saberes de DEMOSTRACIÓN. No son oficiales. */
const KNOWLEDGE: readonly KnowledgeSpec[] = [
  { key: 'MAT.S1', subject: 'MAT', text: 'Muestreo y recogida de datos', block: 'Estadística' },
  {
    key: 'MAT.S2',
    subject: 'MAT',
    text: 'Medidas de centralización y dispersión',
    block: 'Estadística',
  },
  {
    key: 'MAT.S3',
    subject: 'MAT',
    text: 'Proporcionalidad y escalas',
    block: 'Sentido de la medida',
  },
  {
    key: 'LEN.S1',
    subject: 'LEN',
    text: 'El texto expositivo y la cita',
    block: 'Comunicación escrita',
  },
  { key: 'LEN.S2', subject: 'LEN', text: 'La exposición oral formal', block: 'Comunicación oral' },
  {
    key: 'GEH.S1',
    subject: 'GEH',
    text: 'Lectura e interpretación de mapas',
    block: 'Espacio y territorio',
  },
  {
    key: 'GEH.S2',
    subject: 'GEH',
    text: 'Desigualdad urbana y servicios',
    block: 'Sociedades actuales',
  },
  {
    key: 'ING.S1',
    subject: 'ING',
    text: 'Léxico de urbanismo y sostenibilidad',
    block: 'Comunicación',
  },
  { key: 'TEC.S1', subject: 'TEC', text: 'Modelado tridimensional', block: 'Diseño y producción' },
  {
    key: 'TEC.S2',
    subject: 'TEC',
    text: 'Accesibilidad de productos digitales',
    block: 'Digitalización',
  },
];

/**
 * Reparto de las sesiones del proyecto a lo largo de las seis semanas.
 *
 * La franja horaria se declara aquí y no se deduce del orden del array: la cadena
 * de dependencias del proyecto tiene diez actividades de profundidad, y en las dos
 * últimas semanas el orden **dentro de un mismo día** decide si el proyecto es
 * ejecutable o no. Dejarlo al azar del índice hacía que el ensayo cayera después
 * de la exposición que ensayaba.
 *
 * `hour` es el índice de la franja: 0 = 08:15 ... 4 = 12:45.
 */
const WEEKLY_PLAN: readonly {
  week: number;
  day: number;
  hour: number;
  subject: string;
  activity: string;
}[] = [
  // Semana 1 · recogida de información
  { week: 0, day: 1, hour: 0, subject: 'MAT', activity: 'ACT01' },
  { week: 0, day: 2, hour: 1, subject: 'GEH', activity: 'ACT01' },
  { week: 0, day: 3, hour: 2, subject: 'LEN', activity: 'ACT03' },
  { week: 0, day: 4, hour: 1, subject: 'GEH', activity: 'ACT02' },
  { week: 0, day: 5, hour: 3, subject: 'ING', activity: 'ACT04' },

  // Semana 2 · se cierra la recogida (el lunes 12 es no lectivo)
  { week: 1, day: 2, hour: 0, subject: 'MAT', activity: 'ACT01' },
  { week: 1, day: 3, hour: 1, subject: 'GEH', activity: 'ACT02' },
  { week: 1, day: 4, hour: 2, subject: 'LEN', activity: 'ACT03' },
  { week: 1, day: 5, hour: 3, subject: 'ING', activity: 'ACT04' },

  // Semana 3 · Matemáticas trata los datos y Geografía empieza a interpretarlos
  { week: 2, day: 1, hour: 0, subject: 'MAT', activity: 'ACT05' },
  { week: 2, day: 2, hour: 0, subject: 'MAT', activity: 'ACT05' },
  { week: 2, day: 3, hour: 0, subject: 'MAT', activity: 'ACT05' },
  { week: 2, day: 4, hour: 1, subject: 'GEH', activity: 'ACT06' },
  { week: 2, day: 5, hour: 1, subject: 'GEH', activity: 'ACT06' },

  // Semana 4 · Geografía cierra el análisis y Lengua redacta el diagnóstico
  { week: 3, day: 1, hour: 1, subject: 'GEH', activity: 'ACT06' },
  { week: 3, day: 2, hour: 2, subject: 'LEN', activity: 'ACT07' },
  { week: 3, day: 3, hour: 2, subject: 'LEN', activity: 'ACT07' },
  { week: 3, day: 5, hour: 2, subject: 'LEN', activity: 'ACT07' },

  // Semana 5 · propuestas y presupuesto (el lunes 2 es no lectivo)
  { week: 4, day: 2, hour: 2, subject: 'LEN', activity: 'ACT08' },
  { week: 4, day: 3, hour: 1, subject: 'GEH', activity: 'ACT08' },
  { week: 4, day: 4, hour: 0, subject: 'MAT', activity: 'ACT09' },
  { week: 4, day: 5, hour: 0, subject: 'MAT', activity: 'ACT09' },
  { week: 4, day: 5, hour: 3, subject: 'ING', activity: 'ACT11' },

  // Semana 6 · se construye y se defiende el producto final
  { week: 5, day: 1, hour: 0, subject: 'MAT', activity: 'ACT09' },
  { week: 5, day: 1, hour: 3, subject: 'ING', activity: 'ACT11' },
  { week: 5, day: 2, hour: 4, subject: 'TEC', activity: 'ACT10' },
  { week: 5, day: 3, hour: 4, subject: 'TEC', activity: 'ACT10' },
  { week: 5, day: 4, hour: 4, subject: 'TEC', activity: 'ACT12' },
  { week: 5, day: 5, hour: 0, subject: 'LEN', activity: 'ACT13' },
  { week: 5, day: 5, hour: 1, subject: 'ING', activity: 'ACT13' },
  { week: 5, day: 5, hour: 4, subject: 'LEN', activity: 'ACT14' },
];

/** Fecha del día `day` (1 = lunes) de la semana `week` a partir del inicio. */
function dateFor(week: number, day: number): string {
  const start = new Date(`${START}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + week * 7 + (day - 1));
  return start.toISOString().slice(0, 10);
}

const START_TIMES = ['08:15', '09:15', '10:15', '11:45', '12:45'];

function edge(
  type: EdgeType,
  source: [string, NodeType],
  target: [string, NodeType],
  metadata: Partial<{
    weight: number | null;
    mode: 'MANUAL' | 'CALCULADA' | 'PROPUESTA_IA';
    sessions: number | null;
    criteriaIds: string[];
    note: string;
  }> = {},
) {
  return {
    id: id(`edge:${type}:${source[0]}:${target[0]}`),
    projectId: id('project'),
    type,
    sourceId: source[0],
    sourceType: source[1],
    targetId: target[0],
    targetType: target[1],
    metadata: {
      weight: null,
      mode: 'MANUAL' as const,
      sessions: null,
      criteriaIds: [],
      note: '',
      ...metadata,
    },
  };
}

/**
 * Expande la declaración compacta al snapshot normalizado.
 *
 * Pasa por `projectSnapshotSchema.parse`, así que si el ejemplo dejara de ser
 * válido lo sabríamos aquí y no cuando un docente abriera la aplicación.
 */
export function buildDemoSnapshot(): ProjectSnapshot {
  const projectId = id('project');
  const versionId = id('curriculum-version');
  const finalProductId = id('producto-final');

  const subjectId = (key: string) => id(`subject:${key}`);
  const teacherId = (key: string) => id(`teacher:${key}`);
  const situationId = (key: string) => id(`situation:${key}`);
  const activityId = (key: string) => id(`activity:${key}`);
  const criterionId = (key: string) => id(`criterion:${key}`);
  const knowledgeId = (key: string) => id(`knowledge:${key}`);
  const competencyId = (key: string) => id(`competency:${key}`);

  const edges: ReturnType<typeof edge>[] = [];

  // --- Materias y docentes -------------------------------------------------
  for (const subject of SUBJECTS) {
    edges.push(
      edge('participa_en', [subjectId(subject.key), 'MATERIA'], [projectId, 'PROYECTO'], {
        note: 'Materia participante en el proyecto',
      }),
    );
  }

  // --- Situaciones ---------------------------------------------------------
  for (const situation of SITUATIONS) {
    edges.push(
      edge(
        'forma_parte_de',
        [situationId(situation.key), 'SITUACION_APRENDIZAJE'],
        [projectId, 'PROYECTO'],
      ),
    );
  }

  // --- Actividades y todo lo que cuelga de ellas ---------------------------
  for (const activity of ACTIVITIES) {
    const from = activityId(activity.key);

    edges.push(
      edge(
        'forma_parte_de',
        [from, 'ACTIVIDAD'],
        [situationId(activity.situation), 'SITUACION_APRENDIZAJE'],
      ),
    );

    // Participación de cada materia en la situación.
    //
    // La intensidad se deja SIN fijar a propósito (`weight: null`), para que la
    // calcule el algoritmo a partir de sesiones, actividades y criterios. Solo dos
    // relaciones llevan valor manual, más abajo: así el ejemplo enseña las dos
    // caras de la §20 —el cálculo transparente y el criterio del docente que lo
    // sobrescribe— en lugar de mostrar una matriz de números escritos a mano.
    for (const subjectKey of activity.subjects) {
      edges.push(
        edge(
          'participa_en',
          [subjectId(subjectKey), 'MATERIA'],
          [situationId(activity.situation), 'SITUACION_APRENDIZAJE'],
          { mode: 'CALCULADA', note: 'Participa en la situación de aprendizaje' },
        ),
      );
    }

    for (const criterionKey of activity.criteria) {
      edges.push(
        edge('desarrolla', [from, 'ACTIVIDAD'], [criterionId(criterionKey), 'CRITERIO_EVALUACION']),
      );
    }

    for (const knowledgeKey of activity.knowledge) {
      edges.push(
        edge('moviliza', [from, 'ACTIVIDAD'], [knowledgeId(knowledgeKey), 'SABER_BASICO']),
      );
    }

    for (const dependency of activity.dependsOn) {
      edges.push(
        edge('depende_de', [from, 'ACTIVIDAD'], [activityId(dependency), 'ACTIVIDAD'], {
          note: 'No puede empezar hasta que la anterior haya producido su resultado',
        }),
      );
    }

    const leadSubject = activity.subjects[0];
    if (leadSubject !== undefined) {
      edges.push(
        edge('responsable_de', [teacherId(leadSubject), 'DOCENTE'], [from, 'ACTIVIDAD'], {
          note: 'Responsable de la actividad',
        }),
      );
    }
  }

  // La última actividad es la que entrega el producto final.
  edges.push(
    edge('contribuye_a', [activityId('ACT14'), 'ACTIVIDAD'], [finalProductId, 'PRODUCTO_FINAL'], {
      weight: 1,
      mode: 'MANUAL',
      note: 'Entrega el producto final',
    }),
  );
  for (const key of ['ACT07', 'ACT10', 'ACT12']) {
    edges.push(
      edge('contribuye_a', [activityId(key), 'ACTIVIDAD'], [finalProductId, 'PRODUCTO_FINAL'], {
        weight: 0.6,
        mode: 'MANUAL',
        note: 'Aporta una pieza al producto final',
      }),
    );
  }

  // --- Currículo -----------------------------------------------------------
  for (const criterion of CRITERIA) {
    edges.push(
      edge(
        'pertenece_a',
        [criterionId(criterion.key), 'CRITERIO_EVALUACION'],
        [subjectId(criterion.subject), 'MATERIA'],
      ),
    );
  }
  for (const knowledge of KNOWLEDGE) {
    edges.push(
      edge(
        'pertenece_a',
        [knowledgeId(knowledge.key), 'SABER_BASICO'],
        [subjectId(knowledge.subject), 'MATERIA'],
      ),
    );
  }

  // --- Dos ponderaciones fijadas a mano por el equipo docente ---------------
  //
  // Ilustran la regla de la §6: el equipo consideró que la implicación real de
  // estas materias no era la que salía del cálculo, y su criterio manda. La
  // aplicación mostrará ambos valores y no tocará el manual.
  edges.push(
    edge(
      'participa_en',
      [subjectId('GEH'), 'MATERIA'],
      [situationId('SDA01'), 'SITUACION_APRENDIZAJE'],
      {
        weight: 0.9,
        mode: 'MANUAL',
        note: 'El equipo acordó que Geografía lidera toda la fase de diagnóstico, aunque comparta sesiones.',
      },
    ),
  );
  edges.push(
    edge(
      'participa_en',
      [subjectId('ING'), 'MATERIA'],
      [situationId('SDA04'), 'SITUACION_APRENDIZAJE'],
      {
        weight: 0.3,
        mode: 'MANUAL',
        note: 'Inglés solo interviene en el pitch, menos de lo que sugieren las sesiones compartidas.',
      },
    ),
  );

  // --- Evaluación ----------------------------------------------------------
  //
  // Solo unas pocas actividades tienen instrumento asociado. Es deliberado: el
  // panel de alertas debe tener algo real que señalar, y «este criterio se
  // trabaja pero no se evalúa» es la advertencia más útil de la §11.
  const instruments = [
    {
      key: 'rubrica-informe',
      type: 'RUBRICA' as const,
      title: 'Rúbrica del informe diagnóstico',
      description: 'Estructura, uso de datos, citación de fuentes y adecuación del registro.',
      activities: ['ACT07'],
      criteria: ['LEN.1', 'LEN.2'],
    },
    {
      key: 'rubrica-oral',
      type: 'RUBRICA' as const,
      title: 'Rúbrica de exposición oral',
      description: 'Claridad, estructura, contacto con la audiencia y respuesta a preguntas.',
      activities: ['ACT13', 'ACT14'],
      criteria: ['LEN.2', 'ING.2'],
    },
    {
      key: 'lista-estadistica',
      type: 'LISTA_COTEJO' as const,
      title: 'Lista de cotejo del tratamiento estadístico',
      description: 'Comprueba muestreo, cálculo de medidas y honestidad de los gráficos.',
      activities: ['ACT05'],
      criteria: ['MAT.1', 'MAT.2'],
    },
    {
      key: 'producto-maqueta',
      type: 'PRODUCCION' as const,
      title: 'Valoración de la maqueta digital',
      description: 'Respeto de las medidas calculadas y calidad del modelado.',
      activities: ['ACT10', 'ACT12'],
      criteria: ['TEC.1', 'TEC.2'],
    },
  ];

  const assessmentInstruments = instruments.map((instrument) => ({
    id: id(`instrument:${instrument.key}`),
    projectId,
    type: instrument.type,
    title: instrument.title,
    description: instrument.description,
    weight: null,
  }));

  const evidences = instruments.flatMap((instrument) =>
    instrument.activities.flatMap((activityKey) =>
      instrument.criteria
        // Solo se registra la evidencia si la actividad desarrolla de verdad ese
        // criterio: inventar la relación falsearía la trazabilidad del ejemplo.
        .filter((criterionKey) =>
          ACTIVITIES.find((a) => a.key === activityKey)?.criteria.includes(criterionKey),
        )
        .map((criterionKey) => ({
          id: id(`evidence:${instrument.key}:${activityKey}:${criterionKey}`),
          projectId,
          activityId: activityId(activityKey),
          instrumentId: id(`instrument:${instrument.key}`),
          criterionId: criterionId(criterionKey),
          description: `Evidencia recogida en «${
            ACTIVITIES.find((a) => a.key === activityKey)?.title ?? activityKey
          }».`,
          collectedAt: null,
        })),
    ),
  );

  // --- Sesiones ------------------------------------------------------------
  const sessions = WEEKLY_PLAN.map((slot, index) => {
    const sessionId = id(`session:${index}`);
    edges.push(edge('ejecuta', [sessionId, 'SESION'], [activityId(slot.activity), 'ACTIVIDAD']));
    return {
      id: sessionId,
      projectId,
      subjectId: subjectId(slot.subject),
      date: dateFor(slot.week, slot.day),
      startTime: START_TIMES[slot.hour] ?? '08:15',
      durationMinutes: 60,
      weekIndex: slot.week,
      notes: '',
    };
  });

  return projectSnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-08-31T10:00:00.000Z',
    generatedBy: 'constelacion-educativa · datos de demostración',

    project: {
      id: projectId,
      title: 'Transformamos nuestro barrio',
      description:
        'Proyecto interdisciplinar de seis semanas en el que el alumnado diagnostica su barrio con datos propios, propone una mejora viable y la defiende públicamente ante el vecindario.',
      course: '3.º ESO',
      group: '3.º ESO A',
      startDate: START,
      endDate: END,
      nonSchoolDays: ['2026-10-12', '2026-11-02'],
      contributionWeights: {
        sessions: 0.35,
        activities: 0.25,
        criteria: 0.2,
        finalProduct: 0.1,
        assessment: 0.1,
      },
    },

    subjects: SUBJECTS.map((subject) => ({
      id: subjectId(subject.key),
      projectId,
      name: subject.name,
      shortName: subject.short,
      color: subject.color,
      weeklySessions: subject.weekly,
    })),

    teachers: SUBJECTS.map((subject) => ({
      id: teacherId(subject.key),
      projectId,
      displayName: `Docente de ${subject.name}`,
      initials: subject.short.slice(0, 3),
    })),

    learningSituations: SITUATIONS.map((situation) => ({
      id: situationId(situation.key),
      projectId,
      title: situation.title,
      description: situation.description,
      order: situation.order,
      estimatedSessions: situation.sessions,
    })),

    activities: ACTIVITIES.map((activity, position) => ({
      id: activityId(activity.key),
      projectId,
      learningSituationId: situationId(activity.situation),
      title: activity.title,
      description: activity.description,
      order: position,
      estimatedSessions: activity.sessions,
      status: 'PENDIENTE',
      product: activity.product,
      materials: activity.materials,
    })),

    sessions,

    milestones: [
      {
        id: id('milestone:diagnostico'),
        projectId,
        title: 'Informe diagnóstico entregado',
        description: 'Cierre de la fase de análisis. Sin informe no se puede proponer nada.',
        date: dateFor(3, 5),
      },
      {
        id: id('milestone:exposicion'),
        projectId,
        title: 'Exposición pública ante el vecindario',
        description: 'Fecha comprometida con la asociación vecinal. No es movible.',
        date: dateFor(5, 5),
      },
    ],

    finalProducts: [
      {
        id: finalProductId,
        projectId,
        title: 'Propuesta pública de mejora del barrio',
        description:
          'Documento y presentación interactiva con el diagnóstico, la propuesta priorizada, su presupuesto y su maqueta, defendidos ante familias y asociación vecinal.',
        dueDate: END,
      },
    ],

    curriculumVersions: [
      {
        id: versionId,
        source: 'Datos de demostración de Constelación Educativa',
        normativa:
          'NINGUNA. Estos elementos curriculares son ficticios y no proceden de ninguna norma. No deben citarse en una programación.',
        publishedAt: null,
        importedAt: '2026-08-31T10:00:00.000Z',
        version: 'demo-1',
        isDemo: true,
      },
    ],

    competencies: SUBJECTS.map((subject) => ({
      id: competencyId(subject.key),
      officialCode: `DEMO.${subject.key}.CE1`,
      name: `Competencia específica de demostración — ${subject.name}`,
      description:
        'Competencia ficticia incluida únicamente para que el ejemplo tenga la estructura completa.',
      curriculumVersionId: versionId,
      subjectId: subjectId(subject.key),
      stage: 'ESO',
      gradeSpan: { from: 3, to: 3 },
      operativeDescriptors: [],
    })),

    evaluationCriteria: CRITERIA.map((criterion) => ({
      id: criterionId(criterion.key),
      officialCode: `DEMO.${criterion.key}`,
      name: criterion.text,
      description: 'Criterio de demostración. No procede de ninguna norma.',
      curriculumVersionId: versionId,
      competencyId: competencyId(criterion.subject),
      subjectId: subjectId(criterion.subject),
      weight: null,
      relatedKnowledgeCodes: [],
    })),

    basicKnowledge: KNOWLEDGE.map((knowledge) => ({
      id: knowledgeId(knowledge.key),
      officialCode: `DEMO.${knowledge.key}`,
      name: knowledge.text,
      description: 'Saber de demostración. No procede de ninguna norma.',
      curriculumVersionId: versionId,
      subjectId: subjectId(knowledge.subject),
      block: knowledge.block,
    })),

    assessmentInstruments,
    evidences,

    edges: dedupeEdges(edges),
  });
}

/**
 * Colapsa las aristas repetidas.
 *
 * Una misma relación se declara varias veces por construcción: si Matemáticas
 * participa en tres actividades de la misma situación, el bucle emite tres veces
 * «MAT participa_en SDA02». Como el identificador se deriva del tipo y los dos
 * extremos, las tres son literalmente la misma arista.
 *
 * Se queda la última, que es la que lleva el valor manual cuando lo hay: las
 * ponderaciones fijadas por el equipo docente se añaden después del bucle
 * precisamente para que ganen aquí.
 */
function dedupeEdges<T extends { id: string }>(edges: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const edge of edges) byId.set(edge.id, edge);
  return [...byId.values()];
}

/** Metadatos del ejemplo, para la pantalla de bienvenida. */
export const DEMO_INFO = {
  title: 'Transformamos nuestro barrio',
  course: '3.º ESO',
  weeks: 6,
  subjects: SUBJECTS.length,
  situations: SITUATIONS.length,
  activities: ACTIVITIES.length,
} as const;
