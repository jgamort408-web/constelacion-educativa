import { z } from 'zod';

/**
 * Primitivas compartidas por todos los esquemas.
 *
 * Están aquí y no repetidas en cada entidad para que un cambio de criterio —por
 * ejemplo, admitir códigos oficiales con otro formato— se haga en un solo sitio.
 */

/** Identificador interno. Siempre UUID, nunca el código oficial (ADR 0003). */
export const uuidSchema = z.uuid({ message: 'Debe ser un UUID válido' });
export type Uuid = z.infer<typeof uuidSchema>;

/** Fecha sin hora, en formato ISO `AAAA-MM-DD`. */
export const isoDateSchema = z.iso.date({ message: 'Debe ser una fecha AAAA-MM-DD' });
export type IsoDate = z.infer<typeof isoDateSchema>;

/** Marca temporal completa, para auditoría e historial (§30). */
export const isoDateTimeSchema = z.iso.datetime({ message: 'Debe ser una marca ISO 8601' });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** Hora del día `HH:MM`, para los horarios de las sesiones (§5). */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Debe ser una hora HH:MM');
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

/**
 * Intensidad de participación, entre 0 y 1 (§2).
 *
 * Se guarda normalizada aunque la interfaz muestre el porcentaje: mezclar ambas
 * escalas en el modelo es una fuente clásica de errores por factor 100.
 */
export const weightSchema = z
  .number()
  .min(0, 'La intensidad no puede ser negativa')
  .max(1, 'La intensidad no puede superar 1');
export type Weight = z.infer<typeof weightSchema>;

/** Texto obligatorio y no vacío. */
export const nonEmptyString = (max = 300) =>
  z.string().trim().min(1, 'No puede estar vacío').max(max, `No puede superar ${max} caracteres`);

/** Texto libre opcional; la cadena vacía se normaliza a cadena vacía, no a null. */
export const richText = (max = 4000) => z.string().trim().max(max).default('');

/** Color en formato `#rrggbb`, para la identidad visual de cada materia (§3). */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Debe ser un color hexadecimal #rrggbb');

/**
 * Código curricular oficial, o `null` si el elemento no procede de una norma.
 *
 * Nunca se rellena por conveniencia: un código presente significa que existe una
 * fuente normativa que lo respalda, registrada en su `CurriculumVersion`.
 */
export const officialCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .nullable()
  .describe('Código de la norma oficial, o null si el elemento no procede de una');

/** Entero no negativo, para recuentos de sesiones y ordenaciones. */
export const countSchema = z.number().int().min(0);
