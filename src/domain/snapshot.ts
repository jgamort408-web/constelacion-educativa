import { z } from 'zod';
import { assessmentInstrumentSchema, evidenceSchema } from './assessment.ts';
import {
  basicKnowledgeSchema,
  competencySchema,
  curriculumVersionSchema,
  evaluationCriterionSchema,
  pendingCurriculumReferenceSchema,
} from './curriculum.ts';
import { edgeSchema } from './edge.ts';
import {
  activitySchema,
  finalProductSchema,
  learningSituationSchema,
  milestoneSchema,
  projectSchema,
  sessionSchema,
  subjectSchema,
  teacherSchema,
  timetableSlotSchema,
} from './project.ts';
import { isoDateTimeSchema, nonEmptyString } from './primitives.ts';

/**
 * El documento completo de un proyecto.
 *
 * Es a la vez el formato de exportación (§29), la unidad que se valida al importar
 * y la forma en que el store mantiene los datos en memoria. Que sean el mismo tipo
 * no es casualidad: cualquier divergencia entre "lo que se guarda" y "lo que se
 * exporta" acaba produciendo exportaciones que no se pueden volver a importar.
 *
 * En la base de datos, en cambio, cada colección es una tabla con sus índices
 * (ADR 0005). El snapshot se ensambla al cargar y se descompone al guardar.
 */

/** Versión del formato. Se incrementa solo con cambios incompatibles. */
export const SCHEMA_VERSION = 1;

export const projectSnapshotSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Cuándo se generó este documento. Útil al comparar copias de seguridad. */
  exportedAt: isoDateTimeSchema,
  /** Versión de la aplicación que lo generó, para diagnosticar importaciones raras. */
  generatedBy: nonEmptyString(80).default('constelacion-educativa'),

  project: projectSchema,

  // Entidades del proyecto
  subjects: z.array(subjectSchema).default([]),
  teachers: z.array(teacherSchema).default([]),
  learningSituations: z.array(learningSituationSchema).default([]),
  activities: z.array(activitySchema).default([]),
  sessions: z.array(sessionSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),
  finalProducts: z.array(finalProductSchema).default([]),
  timetable: z.array(timetableSlotSchema).default([]),

  // Currículo y su procedencia
  curriculumVersions: z.array(curriculumVersionSchema).default([]),
  competencies: z.array(competencySchema).default([]),
  evaluationCriteria: z.array(evaluationCriterionSchema).default([]),
  basicKnowledge: z.array(basicKnowledgeSchema).default([]),
  pendingCurriculumReferences: z.array(pendingCurriculumReferenceSchema).default([]),

  // Evaluación
  assessmentInstruments: z.array(assessmentInstrumentSchema).default([]),
  evidences: z.array(evidenceSchema).default([]),

  // Las relaciones, de primera clase
  edges: z.array(edgeSchema).default([]),
});
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

/** Vista reducida para listar proyectos sin cargarlos enteros. */
export const projectSummarySchema = z.object({
  id: projectSchema.shape.id,
  title: projectSchema.shape.title,
  course: projectSchema.shape.course,
  startDate: projectSchema.shape.startDate,
  endDate: projectSchema.shape.endDate,
  updatedAt: isoDateTimeSchema,
  subjectCount: z.number().int().min(0),
  activityCount: z.number().int().min(0),
  /** Si todo su currículo procede de datos de ejemplo. */
  isDemo: z.boolean(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/** Nombres de las colecciones de entidades que contiene un snapshot. */
export const ENTITY_COLLECTIONS = [
  'subjects',
  'teachers',
  'learningSituations',
  'activities',
  'sessions',
  'milestones',
  'finalProducts',
  'timetable',
  'curriculumVersions',
  'competencies',
  'evaluationCriteria',
  'basicKnowledge',
  'pendingCurriculumReferences',
  'assessmentInstruments',
  'evidences',
] as const satisfies readonly (keyof ProjectSnapshot)[];

export type EntityCollectionName = (typeof ENTITY_COLLECTIONS)[number];

/** Un snapshot vacío para un proyecto recién creado. */
export function emptySnapshot(project: z.infer<typeof projectSchema>): ProjectSnapshot {
  return projectSnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project,
  });
}
