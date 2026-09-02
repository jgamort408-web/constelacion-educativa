import type { EdgeType, NodeType, ProjectSnapshot } from '@/domain';
import { projectSnapshotSchema, SCHEMA_VERSION } from '@/domain';
import { stableId } from '@/utils/ids.ts';
import curriculo from './curriculo-demo.json';

/**
 * Proyecto de demostración: «El entorno que habitamos», 1.º de ESO.
 *
 * Dos situaciones de aprendizaje y **las ocho materias que la Orden de 30 de mayo
 * de 2023 desarrolla para primer curso**. No es una selección: Física y Química,
 * Tecnología y Digitalización y Educación en Valores Cívicos y Éticos no salen
 * porque en Andalucía no se cursan en 1.º, y el catálogo importado lo confirma:
 * no tienen ni una competencia con tramo de primer curso.
 *
 * Los criterios son reales y citables. Un docente que abra la aplicación ve
 * códigos que puede pegar en su programación, no ejemplos con prefijo DEMO.
 *
 * ── Por qué dos situaciones y no una ──
 * Una sola no enseña lo que la aplicación hace. Lo interesante de un proyecto
 * interdisciplinar aparece cuando dos situaciones **se solapan en el calendario y
 * comparten materias**: Matemáticas y Lengua trabajan en las dos a la vez, y es
 * ahí donde el informe semanal y las alertas de dependencia valen para algo.
 */

const NS = 'demo:entorno';
const id = (clave: string): string => stableId(NS, clave);

const START = '2026-10-05'; // lunes
const END = '2026-11-27'; // viernes de la octava semana

/**
 * Las ocho materias de 1.º de ESO, con su franja fija en el horario.
 *
 * La hora no es decorativa: es lo que permite leer el informe semanal como un
 * horario y no como una lista. Cada materia entra siempre a la misma hora, como
 * en un centro de verdad.
 */
const MATERIAS = [
  { corto: 'GEH', nombre: 'Geografía e Historia', color: '#5fb98a', semanales: 3, hora: '09:15' },
  {
    corto: 'LCL',
    nombre: 'Lengua Castellana y Literatura',
    color: '#e0715c',
    semanales: 4,
    hora: '10:15',
  },
  { corto: 'MAT', nombre: 'Matemáticas', color: '#4c7ef3', semanales: 4, hora: '08:15' },
  { corto: 'BYG', nombre: 'Biología y Geología', color: '#57c2b4', semanales: 3, hora: '09:15' },
  { corto: 'LEX', nombre: 'Lengua Extranjera', color: '#b07ce8', semanales: 4, hora: '11:45' },
  { corto: 'EFI', nombre: 'Educación Física', color: '#e2a13f', semanales: 2, hora: '12:45' },
  {
    corto: 'EPV',
    nombre: 'Educación Plástica, Visual y Audiovisual',
    color: '#d8608f',
    semanales: 2,
    hora: '12:45',
  },
  { corto: 'MUS', nombre: 'Música', color: '#7fa8e8', semanales: 2, hora: '11:45' },
] as const;

/** Las dos situaciones. El orden es el de lectura, no el del calendario. */
const SITUACIONES = [
  {
    clave: 'barrio',
    titulo: 'Cartografía sonora de nuestro barrio',
    descripcion:
      'Una pregunta que el alumnado puede responder saliendo a la calle: ¿de qué está hecho el ruido de mi barrio, y quién lo sufre más? Geografía levanta el mapa, Matemáticas lo mide, Música lo escucha, Plástica lo dibuja y Lengua lo convierte en discurso público.',
    producto: {
      titulo: 'Cartografía sonora del barrio',
      descripcion:
        'Mapa del barrio con sus puntos de escucha, las mediciones de cada uno, el catálogo de sonidos, la crónica escrita y una audición guiada, presentados en la biblioteca del centro.',
      fecha: '2026-11-13',
    },
  },
  {
    clave: 'patio',
    titulo: 'Un patio que respira',
    descripcion:
      'El patio del centro como objeto de estudio y de decisión: qué vive en él, cuánto mide, quién lo ocupa y quién no. Biología lo inventaría, Matemáticas lo levanta a escala, Educación Física estudia sus usos, Inglés lo señaliza y Lengua lo somete a asamblea.',
    producto: {
      titulo: 'Propuesta de reparto del patio',
      descripcion:
        'Plano a escala del patio con su inventario de seres vivos, la señalización bilingüe y un acuerdo de uso redactado y votado en asamblea, entregado al equipo directivo.',
      fecha: '2026-11-27',
    },
  },
] as const;

interface ActividadSpec {
  clave: string;
  situacion: string;
  titulo: string;
  descripcion: string;
  materia: string;
  sesiones: number;
  /** Códigos oficiales de los criterios que desarrolla. */
  criterios: readonly string[];
  dependeDe: readonly string[];
  producto: string;
  materiales: string;
  /** Semana del proyecto (0..7) y día lectivo (1 = lunes). */
  semana: number;
  dia: number;
  /** Índice de la situación a cuyo producto final aporta, si aporta a alguno. */
  culmina?: number;
}

/**
 * Quince actividades encadenadas.
 *
 * Las dependencias cruzan materias a propósito: es lo que convierte dos
 * secuencias paralelas en un proyecto, y lo que hace que retrasar una clase de
 * Matemáticas tenga consecuencias en Lengua. El mapa estelar y las alertas
 * existen para hacer visible exactamente eso.
 */
const ACTIVIDADES: readonly ActividadSpec[] = [
  // ── Situación 1 · Cartografía sonora del barrio ──────────────────────────
  {
    clave: 'A1',
    situacion: 'barrio',
    titulo: 'Deriva sonora por el barrio',
    descripcion:
      'Recorrido por seis puntos del barrio grabando dos minutos de sonido ambiente en cada uno, a distintas horas. El alumnado anota qué oye y qué cree que lo produce.',
    materia: 'GEH',
    sesiones: 2,
    criterios: ['GEH.1.4.1'],
    dependeDe: [],
    producto: 'Seis grabaciones georreferenciadas con su ficha de campo',
    materiales: 'Móvil con grabadora, plano del barrio, ficha de campo',
    semana: 0,
    dia: 2,
  },
  {
    clave: 'A2',
    situacion: 'barrio',
    titulo: 'Mapa de puntos de escucha',
    descripcion:
      'Localización de los seis puntos sobre el plano y descripción del entorno de cada uno: usos del suelo, tráfico, presencia de vegetación y de vecindario.',
    materia: 'GEH',
    sesiones: 2,
    criterios: ['GEH.1.3.3'],
    dependeDe: ['A1'],
    producto: 'Plano anotado con los seis puntos de escucha',
    materiales: 'Plano a escala, visor cartográfico, grabaciones de A1',
    semana: 1,
    dia: 2,
  },
  {
    clave: 'A3',
    situacion: 'barrio',
    titulo: 'Medimos el ruido',
    descripcion:
      'Toma de medidas de nivel sonoro en cada punto y a cada hora, tabulación de los datos y cálculo de medias y dispersión. Se discute cuándo una media engaña.',
    materia: 'MAT',
    sesiones: 3,
    criterios: ['MAT.1.1.1', 'MAT.1.6.2'],
    dependeDe: ['A2'],
    producto: 'Tabla de mediciones con sus estadísticos',
    materiales: 'Sonómetro o aplicación medidora, hoja de cálculo',
    semana: 2,
    dia: 1,
  },
  {
    clave: 'A4',
    situacion: 'barrio',
    titulo: 'Catálogo de escucha',
    descripcion:
      'Audición de las grabaciones en clase, clasificación de los sonidos por origen y función, y montaje de una pieza breve que resume el paisaje sonoro del barrio.',
    materia: 'MUS',
    sesiones: 2,
    criterios: ['MUS.1.1.2', 'MUS.1.2.1'],
    dependeDe: ['A1'],
    producto: 'Pieza sonora de dos minutos y su catálogo de sonidos',
    materiales: 'Altavoces, editor de audio libre, grabaciones de A1',
    semana: 2,
    dia: 4,
  },
  {
    clave: 'A5',
    situacion: 'barrio',
    titulo: 'Gráficos que no mienten',
    descripcion:
      'Representación de los datos eligiendo el gráfico adecuado, y comparación con versiones deliberadamente engañosas de los mismos datos.',
    materia: 'MAT',
    sesiones: 2,
    criterios: ['MAT.1.7.1'],
    dependeDe: ['A3'],
    producto: 'Serie de gráficos con su justificación',
    materiales: 'Hoja de cálculo, datos de A3',
    semana: 3,
    dia: 1,
  },
  {
    clave: 'A6',
    situacion: 'barrio',
    titulo: 'El mapa que se ve',
    descripcion:
      'Diseño gráfico del mapa: qué color y qué grosor recibe cada nivel de ruido, qué símbolo cada punto de escucha, y cómo se lee todo de un vistazo desde tres metros.',
    materia: 'EPV',
    sesiones: 2,
    criterios: ['EPV.1.4.1', 'EPV.1.7.2'],
    dependeDe: ['A2'],
    producto: 'Cartel del mapa sonoro, en A1, listo para exponer',
    materiales: 'Plano de A2, papel A1, rotuladores, editor gráfico libre',
    semana: 3,
    dia: 3,
    culmina: 0,
  },
  {
    clave: 'A7',
    situacion: 'barrio',
    titulo: 'Escribimos la crónica sonora',
    descripcion:
      'Redacción de un texto expositivo que integra el mapa, las mediciones y la experiencia del recorrido, cuidando la cita de las fuentes propias.',
    materia: 'LCL',
    sesiones: 2,
    criterios: ['LCL.1.5.1', 'LCL.1.6.1'],
    dependeDe: ['A5', 'A4'],
    producto: 'Crónica sonora del barrio',
    materiales: 'Procesador de textos, gráficos de A5, catálogo de A4',
    semana: 4,
    dia: 1,
  },
  {
    clave: 'A8',
    situacion: 'barrio',
    titulo: 'Lo contamos en la biblioteca',
    descripcion:
      'Exposición oral de las conclusiones ante otro grupo y ante las familias, con el mapa proyectado y una escucha guiada de las grabaciones.',
    materia: 'LCL',
    sesiones: 2,
    criterios: ['LCL.1.3.1'],
    dependeDe: ['A7', 'A6'],
    producto: 'Cartografía sonora presentada públicamente',
    materiales: 'Proyector, altavoces, cartel de A6, crónica de A7',
    semana: 5,
    dia: 1,
    culmina: 0,
  },

  // ── Situación 2 · Un patio que respira ───────────────────────────────────
  {
    clave: 'B1',
    situacion: 'patio',
    titulo: 'Inventario vivo del patio',
    descripcion:
      'Recuento y determinación de las especies vegetales y de la fauna observable del patio, con fichas de campo y fotografías, y estimación de la superficie con sombra.',
    materia: 'BYG',
    sesiones: 3,
    criterios: ['BYG.1.3.3', 'BYG.1.5.1'],
    dependeDe: [],
    producto: 'Inventario de especies del patio, con fotografías',
    materiales: 'Guía de campo, cinta métrica, cámara del móvil, fichas',
    semana: 3,
    dia: 2,
  },
  {
    clave: 'B2',
    situacion: 'patio',
    titulo: 'El patio a escala',
    descripcion:
      'Medición del patio y levantamiento del plano a escala, con el cálculo de la superficie de cada zona y de cuántos metros cuadrados toca por persona.',
    materia: 'MAT',
    sesiones: 2,
    criterios: ['MAT.1.4.2'],
    dependeDe: ['B1'],
    producto: 'Plano a escala del patio con la superficie de cada zona',
    materiales: 'Cinta métrica larga, papel milimetrado, calculadora',
    semana: 4,
    dia: 3,
  },
  {
    clave: 'B3',
    situacion: 'patio',
    titulo: '¿Quién ocupa el patio?',
    descripcion:
      'Observación de tres recreos anotando sobre el plano quién usa cada zona, en qué actividad y durante cuánto tiempo. Se cuenta, no se opina.',
    materia: 'EFI',
    sesiones: 2,
    criterios: ['EFI.1.2.1'],
    dependeDe: ['B2'],
    producto: 'Mapa de ocupación del patio en tres recreos',
    materiales: 'Copias del plano de B2, cronómetro, hoja de registro',
    semana: 5,
    dia: 1,
  },
  {
    clave: 'B4',
    situacion: 'patio',
    titulo: 'Rutinas que caben en el recreo',
    descripcion:
      'Diseño y prueba de secuencias de actividad física de quince minutos que quepan en las zonas menos usadas, pensadas para quien hoy no se mueve en el recreo.',
    materia: 'EFI',
    sesiones: 2,
    criterios: ['EFI.1.1.1', 'EFI.1.5.2'],
    dependeDe: ['B3'],
    producto: 'Tres rutinas de recreo, probadas y corregidas',
    materiales: 'Material deportivo del centro, mapa de ocupación de B3',
    semana: 6,
    dia: 1,
  },
  {
    clave: 'B5',
    situacion: 'patio',
    titulo: 'Signs for our playground',
    descripcion:
      'Redacción en inglés de la señalización de las zonas del patio y de las especies inventariadas: rótulos breves, claros y comprensibles para un visitante.',
    materia: 'LEX',
    sesiones: 2,
    criterios: ['LEX.1.2.2'],
    dependeDe: ['B2', 'B1'],
    producto: 'Juego de rótulos bilingües para el patio',
    materiales: 'Diccionario, plano de B2, inventario de B1, cartulina',
    semana: 6,
    dia: 3,
  },
  {
    clave: 'B6',
    situacion: 'patio',
    titulo: 'We show it to our partners',
    descripcion:
      'Presentación breve en inglés del patio y de la propuesta a un centro socio, con turno de preguntas y respuestas preparado.',
    materia: 'LEX',
    sesiones: 2,
    criterios: ['LEX.1.3.1'],
    dependeDe: ['B5', 'B4'],
    producto: 'Presentación en inglés, grabada y compartida',
    materiales: 'Rótulos de B5, rutinas de B4, ordenador con cámara',
    semana: 7,
    dia: 3,
    culmina: 1,
  },
  {
    clave: 'B7',
    situacion: 'patio',
    titulo: 'Asamblea: cómo repartimos el patio',
    descripcion:
      'Debate reglado con los datos delante y redacción del acuerdo de uso del patio que se entrega al equipo directivo, con sus turnos, sus enmiendas y su votación.',
    materia: 'LCL',
    sesiones: 2,
    criterios: ['LCL.1.3.2'],
    dependeDe: ['B3', 'B4'],
    producto: 'Acuerdo de uso del patio, redactado y votado',
    materiales: 'Datos de B3, rutinas de B4, plano de B2, acta en blanco',
    semana: 7,
    dia: 1,
    culmina: 1,
  },
];

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

  const materiaCatalogo = new Map(curriculo.subjects.map((m) => [m.corto, m.id]));
  const criterioPorCodigo = new Map(curriculo.evaluationCriteria.map((c) => [c.officialCode, c]));
  const saberPorCodigo = new Map(curriculo.basicKnowledge.map((s) => [s.officialCode, s]));

  const materiaId = (corto: string): string => id(`materia:${corto}`);
  const docenteId = (corto: string): string => id(`docente:${corto}`);
  const actividadId = (clave: string): string => id(`actividad:${clave}`);
  const situacionId = (clave: string): string => id(`sda:${clave}`);
  const productoId = (clave: string): string => id(`producto:${clave}`);
  const horaDe = (corto: string): string =>
    MATERIAS.find((m) => m.corto === corto)?.hora ?? '08:15';

  /**
   * Las aristas se indexan por identificador.
   *
   * El identificador se deriva de tipo y extremos, así que declarar dos veces la
   * misma relación produce la misma arista: la segunda sustituye a la primera en
   * vez de duplicarla. Es lo que permite declarar la participación de una materia
   * en el bucle y refinarla después con una ponderación manual.
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

  for (const materia of MATERIAS) {
    arista('participa_en', [materiaId(materia.corto), 'MATERIA'], [projectId, 'PROYECTO']);
  }
  for (const situacion of SITUACIONES) {
    arista(
      'forma_parte_de',
      [situacionId(situacion.clave), 'SITUACION_APRENDIZAJE'],
      [projectId, 'PROYECTO'],
    );
  }

  // Una materia participa en una situación si tiene actividades en ella. Se
  // deduce de las actividades en vez de declararse: declarada a mano, la primera
  // actividad que cambiara de situación dejaría la relación mintiendo.
  for (const actividad of ACTIVIDADES) {
    arista(
      'participa_en',
      [materiaId(actividad.materia), 'MATERIA'],
      [situacionId(actividad.situacion), 'SITUACION_APRENDIZAJE'],
      { mode: 'CALCULADA', note: 'Tiene actividades en esta situación' },
    );
  }

  // Una ponderación fijada a mano por el equipo, para que el ejemplo enseñe la
  // regla de la §6: el criterio del docente manda sobre el cálculo, y cuando
  // discrepan la aplicación muestra ambos en vez de corregir en silencio.
  arista(
    'participa_en',
    [materiaId('GEH'), 'MATERIA'],
    [situacionId('barrio'), 'SITUACION_APRENDIZAJE'],
    {
      weight: 0.85,
      mode: 'MANUAL',
      note: 'El equipo acordó que Geografía vertebra la situación, aunque comparta sesiones.',
    },
  );

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

  for (const actividad of ACTIVIDADES) {
    const from = actividadId(actividad.clave);
    arista(
      'forma_parte_de',
      [from, 'ACTIVIDAD'],
      [situacionId(actividad.situacion), 'SITUACION_APRENDIZAJE'],
    );
    arista('responsable_de', [docenteId(actividad.materia), 'DOCENTE'], [from, 'ACTIVIDAD'], {
      note: 'Responsable de la actividad',
    });

    for (const codigo of actividad.criterios) {
      const criterio = criterioPorCodigo.get(codigo);
      if (!criterio) {
        throw new Error(
          `El ejemplo cita el criterio ${codigo}, que no está en el currículo importado. ` +
            'Vuelve a generar src/data/demo/curriculo-demo.json o corrige el código.',
        );
      }
      arista('desarrolla', [from, 'ACTIVIDAD'], [criterio.id, 'CRITERIO_EVALUACION']);

      // Los saberes que la propia Orden relaciona con ese criterio.
      for (const codigoSaber of criterio.relatedKnowledgeCodes) {
        const saber = saberPorCodigo.get(codigoSaber);
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
    // tres sesiones que empieza en jueves colocaría clase en sábado.
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
        startTime: horaDe(actividad.materia),
        durationMinutes: 60,
        weekIndex: semana,
        notes: '',
      });
    }

    if (actividad.culmina !== undefined) {
      const situacion = SITUACIONES[actividad.culmina];
      if (situacion) {
        arista(
          'contribuye_a',
          [from, 'ACTIVIDAD'],
          [productoId(situacion.clave), 'PRODUCTO_FINAL'],
          { weight: 0.8, note: 'Aporta al producto final de su situación' },
        );
      }
    }
  }

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
    exportedAt: '2026-09-02T09:00:00.000Z',
    generatedBy: 'constelacion-educativa · ejemplo con currículo real',

    project: {
      id: projectId,
      title: 'El entorno que habitamos',
      description:
        'Dos situaciones de aprendizaje sobre el mismo asunto: el sitio donde el alumnado pasa el día. El barrio se escucha y se cartografía; el patio se mide, se inventaría y se reparte. Ocho semanas y las ocho materias de primero.',
      course: '1.º ESO',
      grade: 1,
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

    learningSituations: SITUACIONES.map((situacion, posicion) => ({
      id: situacionId(situacion.clave),
      projectId,
      title: situacion.titulo,
      description: situacion.descripcion,
      order: posicion,
      estimatedSessions: ACTIVIDADES.filter((a) => a.situacion === situacion.clave).reduce(
        (suma, a) => suma + a.sesiones,
        0,
      ),
    })),

    activities: ACTIVIDADES.map((actividad, posicion) => ({
      id: actividadId(actividad.clave),
      projectId,
      learningSituationId: situacionId(actividad.situacion),
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
        title: 'Ruido medido y patio inventariado',
        description: 'Sin datos no hay gráficos, ni plano, ni asamblea: es el punto sin retorno.',
        date: fecha(3, 5),
      },
    ],

    finalProducts: SITUACIONES.map((situacion) => ({
      id: productoId(situacion.clave),
      projectId,
      title: situacion.producto.titulo,
      description: situacion.producto.descripcion,
      dueDate: situacion.producto.fecha,
    })),

    curriculumVersions: curriculo.curriculumVersions,
    competencies: curriculo.competencies.map(traducir),
    evaluationCriteria: curriculo.evaluationCriteria.map(traducir),
    basicKnowledge: curriculo.basicKnowledge.map(traducir),

    edges: [...porId.values()],
  });
}

export const DEMO_INFO = {
  title: 'El entorno que habitamos',
  course: '1.º ESO',
  grade: 1,
  weeks: 8,
  subjects: MATERIAS.length,
  situations: SITUACIONES.length,
  activities: ACTIVIDADES.length,
} as const;
