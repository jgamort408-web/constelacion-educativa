import { z } from 'zod';
import { activityStatusSchema } from './enums.ts';
import {
  countSchema,
  hexColorSchema,
  isoDateSchema,
  nonEmptyString,
  richText,
  timeOfDaySchema,
  uuidSchema,
  weightSchema,
} from './primitives.ts';

/**
 * Entidades del proyecto: lo que el equipo docente diseña y ejecuta.
 *
 * Ninguna guarda arrays de identificadores hacia otras entidades. Las relaciones
 * viven en la colección de aristas (ADR 0003). La única excepción es la
 * pertenencia estructural rígida —una actividad siempre pertenece a una y solo
 * una situación de aprendizaje—, donde una clave foránea es más honesta que una
 * arista y más barata de consultar.
 */

/**
 * Pesos del algoritmo de contribución (§20).
 *
 * Son configurables por proyecto porque no hay una respuesta universal: un equipo
 * puede considerar que lo que mide la implicación de una materia son las sesiones,
 * y otro que son los criterios evaluados. La aplicación no impone el criterio,
 * pero sí obliga a hacerlo explícito.
 */
export const contributionWeightsSchema = z.object({
  sessions: weightSchema.default(0.35),
  activities: weightSchema.default(0.25),
  criteria: weightSchema.default(0.2),
  finalProduct: weightSchema.default(0.1),
  assessment: weightSchema.default(0.1),
});
export type ContributionWeights = z.infer<typeof contributionWeightsSchema>;

/** Un día de la semana lectivo, con 1 = lunes. */
export const weekdaySchema = z.number().int().min(1).max(7);

/** Una franja del horario semanal de una materia (§5). */
export const timetableSlotSchema = z.object({
  id: uuidSchema,
  subjectId: uuidSchema,
  weekday: weekdaySchema,
  startTime: timeOfDaySchema,
  durationMinutes: z.number().int().min(5).max(300),
});
export type TimetableSlot = z.infer<typeof timetableSlotSchema>;

export const projectSchema = z.object({
  id: uuidSchema,
  title: nonEmptyString(200),
  description: richText(),
  /** Curso al que se dirige, tal como se escribe: "3.º ESO". */
  course: nonEmptyString(40),
  /**
   * El mismo curso, como número, para poder acotar el currículo.
   *
   * `course` es un rótulo y no se puede consultar: «1.º ESO», «1 ESO» y «Primero
   * de ESO» son el mismo curso y tres cadenas distintas. Deducir el número
   * leyendo el rótulo funcionaría casi siempre, y «casi siempre» aplicado a qué
   * criterios ve un docente significa enseñarle los de otro curso sin avisar.
   *
   * Es nulo cuando el proyecto abarca varios cursos o cuando se creó antes de que
   * existiera este campo. Con nulo, la aplicación no acota por su cuenta: pide
   * elegir el curso.
   */
  grade: z.number().int().min(1).max(6).nullable().default(null),
  /** Grupo o grupos concretos, si el proyecto se acota a alguno. */
  group: richText(120),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  /** Días sin clase dentro del periodo, para que la planificación sea realista. */
  nonSchoolDays: z.array(isoDateSchema).default([]),
  contributionWeights: contributionWeightsSchema,
});
export type Project = z.infer<typeof projectSchema>;

export const subjectSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  name: nonEmptyString(120),
  /** Abreviatura para las etiquetas del grafo, donde no cabe el nombre completo. */
  shortName: nonEmptyString(12),
  /** Color identificativo, configurable (§3). Nunca es el único portador de información (§16). */
  color: hexColorSchema,
  /** Sesiones semanales de la materia en el horario del grupo. */
  weeklySessions: countSchema,
});
export type Subject = z.infer<typeof subjectSchema>;

/**
 * Docente del equipo.
 *
 * Solo un nombre para mostrar y unas iniciales. Nada de correos, teléfonos ni
 * identificadores de personal: la aplicación no los necesita para coordinar un
 * proyecto, y lo que no se guarda no se puede filtrar (§17).
 */
export const teacherSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  displayName: nonEmptyString(120),
  initials: nonEmptyString(4),
});
export type Teacher = z.infer<typeof teacherSchema>;

export const learningSituationSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  title: nonEmptyString(200),
  description: richText(),
  /** Posición en la secuencia del proyecto; determina el orden de lectura. */
  order: countSchema,
  estimatedSessions: countSchema,
});
export type LearningSituation = z.infer<typeof learningSituationSchema>;

export const activitySchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  /** Pertenencia estructural: una actividad vive dentro de una situación. */
  learningSituationId: uuidSchema,
  title: nonEmptyString(200),
  description: richText(),
  /**
   * Posición dentro de su situación de aprendizaje.
   *
   * Sin este campo, el orden de las actividades sería el que devolviera la base
   * de datos, que es arbitrario y distinto en cada carga. Un docente que ve sus
   * actividades barajadas cada vez que abre la aplicación deja de fiarse de ella.
   */
  order: countSchema.default(0),
  estimatedSessions: countSchema,
  status: activityStatusSchema.default('PENDIENTE'),
  /** Producto intermedio que deja la actividad, si deja alguno. */
  product: richText(300),
  /** Materiales necesarios, para la vista "Esta semana" (§13). */
  materials: richText(600),
});
export type Activity = z.infer<typeof activitySchema>;

/**
 * Una sesión concreta: una hora de clase de una materia en una fecha.
 *
 * Es la unidad que convierte la planificación en algo real. Una sesión puede no
 * tener actividad asignada todavía: es hueco disponible, y el planificador lo
 * necesita para proponer temporalizaciones.
 */
export const sessionSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  subjectId: uuidSchema,
  date: isoDateSchema,
  startTime: timeOfDaySchema,
  durationMinutes: z.number().int().min(5).max(300),
  /** Índice de la semana del proyecto, calculado al planificar. Facilita filtrar (§22). */
  weekIndex: countSchema,
  notes: richText(600),
});
export type Session = z.infer<typeof sessionSchema>;

export const milestoneSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  title: nonEmptyString(200),
  description: richText(),
  date: isoDateSchema,
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const finalProductSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  title: nonEmptyString(200),
  description: richText(),
  dueDate: isoDateSchema,
});
export type FinalProduct = z.infer<typeof finalProductSchema>;
