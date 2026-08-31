import { z } from 'zod';

/**
 * Tipos de nodo del grafo (§2 del prompt maestro).
 *
 * Son los once tipos que el docente reconoce como "cosas" de su proyecto. Toda
 * entidad persistida corresponde a uno de ellos, salvo las de soporte
 * (evidencias, instrumentos, versiones curriculares), que no se dibujan.
 */
export const NODE_TYPES = [
  'PROYECTO',
  'SITUACION_APRENDIZAJE',
  'MATERIA',
  'COMPETENCIA_ESPECIFICA',
  'CRITERIO_EVALUACION',
  'SABER_BASICO',
  'ACTIVIDAD',
  'SESION',
  'PRODUCTO_FINAL',
  'HITO',
  'DOCENTE',
] as const;

export const nodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof nodeTypeSchema>;

/**
 * Tipos de relación (§2).
 *
 * Cada uno tiene un significado pedagógico concreto y un par de extremos
 * permitido, declarado en `EDGE_RULES`. No son etiquetas decorativas.
 */
export const EDGE_TYPES = [
  'participa_en',
  'desarrolla',
  'moviliza',
  'pertenece_a',
  'forma_parte_de',
  'ejecuta',
  'depende_de',
  'responsable_de',
  'contribuye_a',
  'evidencia_de',
] as const;

export const edgeTypeSchema = z.enum(EDGE_TYPES);
export type EdgeType = z.infer<typeof edgeTypeSchema>;

/**
 * Procedencia de un valor de contribución (§20).
 *
 * MANUAL siempre gana: recalcular no puede sobrescribir lo que puso un docente.
 * Esa regla la aplica `resolveContribution`, no la interfaz.
 */
export const CONTRIBUTION_MODES = ['MANUAL', 'CALCULADA', 'PROPUESTA_IA'] as const;

export const contributionModeSchema = z.enum(CONTRIBUTION_MODES);
export type ContributionMode = z.infer<typeof contributionModeSchema>;

/** Severidad de un hallazgo del motor de validación (§11). */
export const SEVERITIES = ['ERROR', 'ADVERTENCIA', 'SUGERENCIA'] as const;

export const severitySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof severitySchema>;

/** Estado de ejecución de una actividad, para el avance del proyecto (§12). */
export const ACTIVITY_STATUSES = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'DESCARTADA'] as const;

export const activityStatusSchema = z.enum(ACTIVITY_STATUSES);
export type ActivityStatus = z.infer<typeof activityStatusSchema>;

/** Instrumentos de evaluación previstos (§14). */
export const INSTRUMENT_TYPES = [
  'RUBRICA',
  'LISTA_COTEJO',
  'OBSERVACION',
  'PRODUCCION',
  'PRUEBA',
  'PORTAFOLIO',
  'PRODUCTO_FINAL',
] as const;

export const instrumentTypeSchema = z.enum(INSTRUMENT_TYPES);
export type InstrumentType = z.infer<typeof instrumentTypeSchema>;

/**
 * Qué extremos admite cada tipo de relación.
 *
 * Sin esta tabla, el grafo aceptaría disparates como "una sesión pertenece a un
 * criterio de evaluación" y el docente descubriría el problema mucho después, en
 * forma de vista incoherente. `validateSnapshot` la usa para rechazarlos en el
 * momento de crear la arista.
 */
export const EDGE_RULES: Record<
  EdgeType,
  { from: readonly NodeType[]; to: readonly NodeType[]; label: string; weighted: boolean }
> = {
  participa_en: {
    from: ['MATERIA', 'DOCENTE'],
    to: ['SITUACION_APRENDIZAJE', 'PROYECTO'],
    label: 'participa en',
    weighted: true,
  },
  desarrolla: {
    from: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE'],
    to: ['CRITERIO_EVALUACION'],
    label: 'desarrolla',
    weighted: true,
  },
  moviliza: {
    from: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE'],
    to: ['SABER_BASICO'],
    label: 'moviliza',
    weighted: false,
  },
  pertenece_a: {
    from: ['CRITERIO_EVALUACION', 'SABER_BASICO', 'COMPETENCIA_ESPECIFICA'],
    to: ['MATERIA', 'COMPETENCIA_ESPECIFICA'],
    label: 'pertenece a',
    weighted: false,
  },
  forma_parte_de: {
    from: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE'],
    to: ['SITUACION_APRENDIZAJE', 'PROYECTO'],
    label: 'forma parte de',
    weighted: false,
  },
  ejecuta: {
    from: ['SESION'],
    to: ['ACTIVIDAD'],
    label: 'ejecuta',
    weighted: false,
  },
  depende_de: {
    from: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE'],
    to: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE'],
    label: 'depende de',
    weighted: false,
  },
  responsable_de: {
    from: ['DOCENTE'],
    to: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE', 'SESION', 'PRODUCTO_FINAL'],
    label: 'es responsable de',
    weighted: false,
  },
  contribuye_a: {
    from: ['ACTIVIDAD', 'SITUACION_APRENDIZAJE', 'MATERIA'],
    to: ['PRODUCTO_FINAL', 'HITO', 'PROYECTO'],
    label: 'contribuye a',
    weighted: true,
  },
  evidencia_de: {
    from: ['ACTIVIDAD'],
    to: ['CRITERIO_EVALUACION'],
    label: 'aporta evidencia de',
    weighted: false,
  },
};

/** El tipo de nodo que corresponde a cada colección del snapshot. */
export const COLLECTION_NODE_TYPE = {
  subjects: 'MATERIA',
  teachers: 'DOCENTE',
  learningSituations: 'SITUACION_APRENDIZAJE',
  activities: 'ACTIVIDAD',
  sessions: 'SESION',
  competencies: 'COMPETENCIA_ESPECIFICA',
  evaluationCriteria: 'CRITERIO_EVALUACION',
  basicKnowledge: 'SABER_BASICO',
  finalProducts: 'PRODUCTO_FINAL',
  milestones: 'HITO',
} as const satisfies Record<string, NodeType>;

export type NodeCollectionName = keyof typeof COLLECTION_NODE_TYPE;
