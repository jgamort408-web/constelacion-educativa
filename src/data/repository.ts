import type { AdoptedCurriculum } from './curriculum-catalogue.ts';
import type {
  Activity,
  AssessmentInstrument,
  BasicKnowledge,
  Competency,
  Edge,
  EvaluationCriterion,
  Evidence,
  Finding,
  FinalProduct,
  LearningSituation,
  Milestone,
  Project,
  ProjectSnapshot,
  ProjectSummary,
  Session,
  Subject,
  Teacher,
  TimetableSlot,
  Uuid,
} from '@/domain';

/**
 * El contrato de persistencia (ADR 0002).
 *
 * Ningún archivo fuera de `src/data/` importa Dexie. Todo pasa por aquí, para que
 * sustituir IndexedDB por Postgres el día que entre el equipo docente sea escribir
 * una segunda implementación y no reescribir la aplicación.
 *
 * Todas las operaciones son asíncronas aunque hoy la base sea local: una interfaz
 * síncrona sería imposible de implementar sobre red, y descubrirlo después
 * obligaría a cambiar cada llamada.
 */

/** Qué colección se está tocando. Une el patch con la tabla correspondiente. */
export type EntityKind =
  | 'subject'
  | 'teacher'
  | 'learningSituation'
  | 'activity'
  | 'session'
  | 'milestone'
  | 'finalProduct'
  | 'timetableSlot'
  | 'competency'
  | 'evaluationCriterion'
  | 'basicKnowledge'
  | 'assessmentInstrument'
  | 'evidence'
  | 'edge';

/** Correspondencia entre cada tipo y su entidad. */
export interface EntityByKind {
  subject: Subject;
  teacher: Teacher;
  learningSituation: LearningSituation;
  activity: Activity;
  session: Session;
  milestone: Milestone;
  finalProduct: FinalProduct;
  timetableSlot: TimetableSlot;
  competency: Competency;
  evaluationCriterion: EvaluationCriterion;
  basicKnowledge: BasicKnowledge;
  assessmentInstrument: AssessmentInstrument;
  evidence: Evidence;
  edge: Edge;
}

/**
 * Una operación de escritura.
 *
 * Se modela como dato y no como una llamada a método por tres motivos concretos:
 * se pueden agrupar varias en una sola transacción, se pueden invertir para
 * construir el deshacer de la §10, y se pueden registrar tal cual para el
 * historial de cambios de la §30.
 */
export type Mutation =
  | { readonly op: 'upsert'; readonly kind: EntityKind; readonly entity: unknown }
  | { readonly op: 'delete'; readonly kind: EntityKind; readonly id: Uuid }
  | { readonly op: 'updateProject'; readonly project: Project };

/** Un conjunto de mutaciones que se aplican como una unidad. */
export interface Patch {
  /** Descripción legible de lo que hace, para el historial: «Movió ACT04 a la semana 4». */
  readonly label: string;
  readonly mutations: readonly Mutation[];
}

/** Resultado de aplicar un patch. */
export interface PatchResult {
  /** El estado tras aplicarlo. */
  readonly snapshot: ProjectSnapshot;
  /** El patch que lo revierte, para la pila de deshacer. */
  readonly inverse: Patch;
  /** Hallazgos del motor de validación tras el cambio. */
  readonly findings: readonly Finding[];
}

/** Error de escritura con un mensaje dirigido al docente, no al programador. */
export class RepositoryError extends Error {
  /** Detalle técnico de qué campos fallaron, para el panel de importación. */
  readonly details: readonly string[];

  constructor(message: string, details: readonly string[] = []) {
    super(message);
    this.name = 'RepositoryError';
    this.details = details;
  }
}

export interface ProjectRepository {
  /** Proyectos guardados, sin cargarlos enteros. */
  list(): Promise<ProjectSummary[]>;

  /** Carga un proyecto completo, ensamblando el snapshot desde sus tablas. */
  load(projectId: Uuid): Promise<ProjectSnapshot>;

  /**
   * Guarda un proyecto entero, sustituyendo lo que hubiera.
   *
   * Para importaciones y siembra inicial. Para editar, `applyPatch`: reescribir el
   * proyecto completo en cada cambio es lo que este diseño evita (ADR 0005).
   */
  save(snapshot: ProjectSnapshot): Promise<void>;

  /**
   * Aplica un cambio como una única transacción.
   *
   * O se aplican todas las mutaciones o no se aplica ninguna. Crear una actividad
   * y sus relaciones no puede quedarse a medias: dejaría aristas apuntando a algo
   * que no existe.
   */
  applyPatch(projectId: Uuid, patch: Patch): Promise<PatchResult>;

  /** Borra un proyecto y todo lo que cuelga de él. */
  remove(projectId: Uuid): Promise<void>;

  /** Existe algún proyecto guardado. Decide si hay que sembrar el DEMO. */
  isEmpty(): Promise<boolean>;

  /**
   * Carga un currículo oficial completo en el catálogo global.
   *
   * No pasa por `applyPatch` a propósito: son cerca de mil registros y calcular
   * el inverso de cada uno para la pila de deshacer costaría más que la propia
   * operación. Su reverso es una acción explícita, `removeOfficialCurriculum`,
   * que el docente decide, no un Ctrl+Z accidental.
   */
  adoptCurriculum(adopted: AdoptedCurriculum): Promise<void>;

  /** Retira todo el currículo no marcado como demostración. */
  removeOfficialCurriculum(): Promise<void>;
}

/** Atajos para construir mutaciones sin repetir la forma del objeto. */
export const mutation = {
  upsert<K extends EntityKind>(kind: K, entity: EntityByKind[K]): Mutation {
    return { op: 'upsert', kind, entity };
  },
  remove(kind: EntityKind, id: Uuid): Mutation {
    return { op: 'delete', kind, id };
  },
  updateProject(project: Project): Mutation {
    return { op: 'updateProject', project };
  },
};

/** Construye un patch de una sola mutación, que es el caso más común. */
export function singlePatch(label: string, single: Mutation): Patch {
  return { label, mutations: [single] };
}
