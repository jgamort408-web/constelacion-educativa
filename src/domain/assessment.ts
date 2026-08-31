import { z } from 'zod';
import { instrumentTypeSchema } from './enums.ts';
import { isoDateSchema, nonEmptyString, richText, uuidSchema, weightSchema } from './primitives.ts';

/**
 * Evaluación (§14).
 *
 * El prompt maestro insiste en no confundir cuatro cosas, y tiene razón porque es
 * el error más extendido en las herramientas de programación docente:
 *
 *   - la **actividad** es lo que el alumnado hace;
 *   - la **evidencia** es lo que queda de haberlo hecho;
 *   - el **instrumento** es con qué se mira esa evidencia;
 *   - el **criterio** es qué se juzga al mirarla.
 *
 * Son cuatro entidades separadas desde el primer esquema, aunque la funcionalidad
 * de evaluación no se construya hasta la v0.6: modelarlas tarde obligaría a migrar
 * datos que el equipo docente ya habría introducido.
 */

export const assessmentInstrumentSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  type: instrumentTypeSchema,
  title: nonEmptyString(200),
  description: richText(),
  /** Peso del instrumento en la calificación, si el equipo lo ha fijado. */
  weight: weightSchema.nullable(),
});
export type AssessmentInstrument = z.infer<typeof assessmentInstrumentSchema>;

/**
 * Una evidencia recogida: qué produjo el alumnado, en qué actividad, mirada con
 * qué instrumento y contra qué criterio.
 *
 * No guarda datos del alumnado. La evidencia describe el tipo de producción, no
 * quién la hizo: la aplicación coordina un equipo docente, no gestiona
 * calificaciones individuales (§17).
 */
export const evidenceSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  activityId: uuidSchema,
  instrumentId: uuidSchema,
  criterionId: uuidSchema,
  description: richText(),
  /** Cuándo se recogió. Null si está prevista pero aún no ha ocurrido. */
  collectedAt: isoDateSchema.nullable(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
