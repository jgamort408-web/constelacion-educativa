import Dexie, { type EntityTable } from 'dexie';
import type {
  Activity,
  AssessmentInstrument,
  BasicKnowledge,
  Competency,
  CurriculumVersion,
  Edge,
  EvaluationCriterion,
  Evidence,
  FinalProduct,
  LearningSituation,
  Milestone,
  PendingCurriculumReference,
  Project,
  Session,
  Subject,
  Teacher,
  TimetableSlot,
} from '@/domain';

/**
 * La base de datos local (ADR 0005).
 *
 * Una tabla por tipo de entidad, no un único registro con el proyecto entero
 * dentro. La diferencia importa por tres motivos:
 *
 *   1. Cambiar el título de una actividad reescribe una fila, no el proyecto.
 *   2. Se puede consultar por índice: «las sesiones de la semana 3» no obliga a
 *      cargar y recorrer todo en memoria.
 *   3. La estructura ya es la que tendrá en Postgres, así que la migración del día
 *      que entre el equipo docente es mecánica y no un rediseño.
 *
 * Los índices declarados abajo son exactamente las consultas que hace la
 * aplicación. Un índice de más ocupa espacio y ralentiza las escrituras; uno de
 * menos convierte una consulta en un recorrido completo de la tabla.
 */

/** Metadatos por proyecto que no forman parte del snapshot exportable. */
export interface ProjectMeta {
  projectId: string;
  /** Última modificación, para ordenar la lista y avisar de copias antiguas. */
  updatedAt: string;
  /** Versión del formato con que se guardó, para migrar si cambia. */
  schemaVersion: number;
}

/**
 * Una copia de seguridad automática.
 *
 * IndexedDB vive en el navegador: limpiar los datos del sitio borra el trabajo de
 * un trimestre. Estas copias no protegen de eso —se borran con todo lo demás—,
 * pero sí de lo mucho más frecuente: un borrado accidental, un cambio del que uno
 * se arrepiente al día siguiente. La protección real es la exportación a archivo,
 * y por eso la aplicación insiste con el aviso de «última copia».
 */
export interface Backup {
  id: string;
  projectId: string;
  createdAt: string;
  reason: 'automatica' | 'manual' | 'antes-de-importar';
  /** El snapshot serializado. Se guarda como texto para no depender del clonado estructurado. */
  payload: string;
}

export class ConstelacionDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  projectMeta!: EntityTable<ProjectMeta, 'projectId'>;

  subjects!: EntityTable<Subject, 'id'>;
  teachers!: EntityTable<Teacher, 'id'>;
  learningSituations!: EntityTable<LearningSituation, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  milestones!: EntityTable<Milestone, 'id'>;
  finalProducts!: EntityTable<FinalProduct, 'id'>;
  timetable!: EntityTable<TimetableSlot, 'id'>;

  curriculumVersions!: EntityTable<CurriculumVersion, 'id'>;
  competencies!: EntityTable<Competency, 'id'>;
  evaluationCriteria!: EntityTable<EvaluationCriterion, 'id'>;
  basicKnowledge!: EntityTable<BasicKnowledge, 'id'>;
  pendingCurriculumReferences!: EntityTable<PendingCurriculumReference, 'id'>;

  assessmentInstruments!: EntityTable<AssessmentInstrument, 'id'>;
  evidences!: EntityTable<Evidence, 'id'>;

  edges!: EntityTable<Edge, 'id'>;
  backups!: EntityTable<Backup, 'id'>;

  constructor(name = 'constelacion-educativa') {
    super(name);

    /**
     * Versión 1 del esquema.
     *
     * Cuando el modelo cambie de forma incompatible se añade `.version(2)` con su
     * `.upgrade()`, sin tocar esta declaración. Dexie aplica las migraciones en
     * orden sobre la base existente, así que un docente que ya tenga datos no los
     * pierde al actualizar la aplicación. Ese es todo el motivo de que el esquema
     * esté versionado desde el primer día, cuando todavía no hay nada que migrar.
     */
    this.version(1).stores({
      projects: 'id, title, startDate',
      projectMeta: 'projectId, updatedAt',

      subjects: 'id, projectId',
      teachers: 'id, projectId',
      learningSituations: 'id, projectId, order',
      activities: 'id, projectId, learningSituationId, status',
      // `[projectId+weekIndex]` sirve al filtro por semana de la §22, que es la
      // consulta más frecuente de la vista «Esta semana».
      sessions: 'id, projectId, subjectId, date, weekIndex, [projectId+weekIndex]',
      milestones: 'id, projectId, date',
      finalProducts: 'id, projectId',
      timetable: 'id, subjectId',

      curriculumVersions: 'id, isDemo',
      competencies: 'id, subjectId, curriculumVersionId',
      evaluationCriteria: 'id, subjectId, competencyId, curriculumVersionId, officialCode',
      basicKnowledge: 'id, subjectId, curriculumVersionId, officialCode',
      pendingCurriculumReferences: 'id, citedCode',

      assessmentInstruments: 'id, projectId, type',
      evidences: 'id, projectId, activityId, criterionId, instrumentId',

      // Origen y destino indexados por separado: el recorrido del grafo pregunta
      // en ambos sentidos, y sin ambos índices la trazabilidad inversa de la §31
      // obligaría a recorrer todas las aristas.
      edges: 'id, projectId, type, sourceId, targetId, [projectId+type]',

      backups: 'id, projectId, createdAt',
    });
  }
}

/**
 * Instancia única de la base.
 *
 * Se crea de forma perezosa para que importar este módulo desde un test o desde
 * un script de Node no intente abrir IndexedDB sin que nadie lo haya pedido.
 */
let instance: ConstelacionDatabase | null = null;

export function getDatabase(): ConstelacionDatabase {
  instance ??= new ConstelacionDatabase();
  return instance;
}

/** Sustituye la instancia. Solo lo usan las pruebas, con una base aislada. */
export function setDatabase(database: ConstelacionDatabase | null): void {
  instance = database;
}
