import { z } from 'zod';
import {
  countSchema,
  isoDateSchema,
  isoDateTimeSchema,
  nonEmptyString,
  officialCodeSchema,
  richText,
  uuidSchema,
} from './primitives.ts';

/**
 * Currículo y su procedencia (§9).
 *
 * La regla que gobierna este archivo entero: **nada se muestra como oficial si no
 * tiene detrás una `CurriculumVersion` que diga de dónde salió.** Los datos de
 * demostración existen, pero se identifican como tales y sus códigos llevan el
 * prefijo DEMO. Un docente jamás debe poder confundir un ejemplo con la norma.
 */

/**
 * Origen de un conjunto de datos curriculares.
 *
 * Se registra la fuente, la normativa y la versión para que el currículo pueda
 * actualizarse cuando cambie la ley sin perder la trazabilidad de qué estaba
 * vigente cuando se programó un proyecto.
 */
export const curriculumVersionSchema = z.object({
  id: uuidSchema,
  /** Nombre legible de la fuente: "Orden de 30 de mayo de 2023", "Datos de ejemplo". */
  source: nonEmptyString(200),
  /** Referencia normativa completa, o cadena vacía si no procede de una norma. */
  normativa: richText(500),
  /** Fecha de publicación en el boletín oficial. Null para datos no normativos. */
  publishedAt: isoDateSchema.nullable(),
  /** Cuándo se cargó en esta aplicación. */
  importedAt: isoDateTimeSchema,
  /** Versión del conjunto de datos, para poder comparar cargas sucesivas. */
  version: nonEmptyString(40),
  /**
   * Si es `true`, estos datos son ficticios y la interfaz debe marcarlos.
   *
   * No es un detalle cosmético: es lo que impide que un ejemplo acabe citado en
   * una programación entregada a inspección.
   */
  isDemo: z.boolean(),
});
export type CurriculumVersion = z.infer<typeof curriculumVersionSchema>;

/**
 * Campos comunes a todo elemento curricular.
 *
 * Separa deliberadamente cuatro cosas que suelen mezclarse (§8): el identificador
 * interno, el código de la norma, el nombre y la descripción. Mezclarlas obliga a
 * migrar datos en cuanto cambia un código oficial.
 */
const curricularBase = {
  id: uuidSchema,
  officialCode: officialCodeSchema,
  name: nonEmptyString(300),
  description: richText(),
  curriculumVersionId: uuidSchema,
};

/** Competencia específica de una materia. */
export const competencySchema = z.object({
  ...curricularBase,
  subjectId: uuidSchema,
  /** Etapa educativa: "ESO", "Bachillerato". */
  stage: nonEmptyString(40),
  /** Curso dentro de la etapa: "3", "4". */
  grade: nonEmptyString(10),
  /** Descriptores operativos del perfil de salida asociados, si se conocen. */
  operativeDescriptors: z.array(nonEmptyString(40)).default([]),
});
export type Competency = z.infer<typeof competencySchema>;

/**
 * Criterio de evaluación.
 *
 * Cuelga de una competencia específica y, a través de ella, de una materia. Es la
 * unidad con la que se evalúa: las actividades no se evalúan solas, se evalúan
 * por los criterios que desarrollan (§14).
 */
export const evaluationCriterionSchema = z.object({
  ...curricularBase,
  competencyId: uuidSchema,
  subjectId: uuidSchema,
  /**
   * Peso relativo del criterio dentro de su materia, si el equipo lo ha
   * establecido. Alimenta el factor "criterios" del cálculo de contribución.
   */
  weight: z.number().min(0).max(1).nullable(),
});
export type EvaluationCriterion = z.infer<typeof evaluationCriterionSchema>;

/** Saber básico: el contenido que una actividad moviliza. */
export const basicKnowledgeSchema = z.object({
  ...curricularBase,
  subjectId: uuidSchema,
  /** Bloque de saberes al que pertenece, tal como lo agrupa la norma. */
  block: richText(200),
});
export type BasicKnowledge = z.infer<typeof basicKnowledgeSchema>;

/**
 * Referencia curricular citada pero no encontrada en el currículo cargado (§7).
 *
 * Cuando una importación o una propuesta menciona un código que no existe, no se
 * inventa ni se descarta en silencio: se registra aquí y se marca como pendiente
 * de validación humana.
 */
export const pendingCurriculumReferenceSchema = z.object({
  id: uuidSchema,
  /** El código tal cual venía escrito en el origen. */
  citedCode: nonEmptyString(40),
  /** Qué se esperaba que fuera: criterio, saber, competencia. */
  expectedType: z.enum(['CRITERIO_EVALUACION', 'SABER_BASICO', 'COMPETENCIA_ESPECIFICA']),
  /** De dónde vino la cita: importación de JSON, propuesta de IA, entrada manual. */
  origin: nonEmptyString(120),
  /** Cuántas veces aparece; ayuda a priorizar la revisión. */
  occurrences: countSchema.default(1),
  detectedAt: isoDateTimeSchema,
});
export type PendingCurriculumReference = z.infer<typeof pendingCurriculumReferenceSchema>;
