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

/**
 * Tramo de cursos que cubre un elemento curricular.
 *
 * NO es un curso suelto, y esa es una decisión forzada por las fuentes:
 *
 *   - El currículo del Estado (RD 217/2022) agrupa cursos. Para Matemáticas los
 *     criterios de 1.º, 2.º y 3.º son literalmente los mismos y la norma no los
 *     separa. Para Lengua, Inglés, Geografía e Historia y Educación Física van
 *     1.º-2.º y 3.º-4.º. Presentar «los criterios de 3.º» como lista cerrada
 *     sería inventar una división que la norma no hace.
 *   - El currículo de Andalucía (Orden de 30 de mayo de 2023) SÍ separa por
 *     curso, con una columna por curso en su Anexo II.
 *
 * Un tramo cubre ambos casos: `{from: 3, to: 3}` es un curso suelto y
 * `{from: 1, to: 3}` es un agrupamiento. Ver docs/FUENTE-CURRICULO.md.
 */
export const gradeSpanSchema = z
  .object({
    from: z.number().int().min(1).max(6),
    to: z.number().int().min(1).max(6),
  })
  .refine((span) => span.from <= span.to, {
    message: 'El curso inicial no puede ser posterior al final',
  });
export type GradeSpan = z.infer<typeof gradeSpanSchema>;

/** Si un tramo incluye un curso concreto. */
export function spanIncludes(span: GradeSpan, grade: number): boolean {
  return grade >= span.from && grade <= span.to;
}

/** Rótulo legible: "3.º ESO" o "1.º a 3.º ESO". */
export function spanLabel(span: GradeSpan, stage = 'ESO'): string {
  return span.from === span.to
    ? `${span.from}.º ${stage}`
    : `${span.from}.º a ${span.to}.º ${stage}`;
}

/** Competencia específica de una materia. */
export const competencySchema = z.object({
  ...curricularBase,
  subjectId: uuidSchema,
  /** Etapa educativa: "ESO", "Bachillerato". */
  stage: nonEmptyString(40),
  /** Cursos que cubre. Puede ser uno solo o un agrupamiento. */
  gradeSpan: gradeSpanSchema,
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
  /**
   * Saberes que la propia norma relaciona con este criterio, por su código.
   *
   * Es una excepción consciente al ADR 0003, que prohíbe los arrays de
   * identificadores como sustituto de una relación. Se admite aquí porque esta
   * relación **no es del proyecto sino de la norma**: es inmutable, no tiene
   * atributos que guardar, viaja con el criterio y se consulta en un único
   * momento, al asignarlo a una actividad, para generar entonces sí las aristas
   * de verdad. Las relaciones del proyecto siguen siendo aristas.
   *
   * Solo lo trae el currículo de Andalucía, cuyo Anexo II las tabula. El
   * currículo del Estado no establece esta correspondencia.
   */
  relatedKnowledgeCodes: z.array(nonEmptyString(40)).default([]),
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
