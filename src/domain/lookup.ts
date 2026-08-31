import type { NodeType } from './enums.ts';
import type { Uuid } from './primitives.ts';
import type { ProjectSnapshot } from './snapshot.ts';

/**
 * Resolución de un identificador a algo que se pueda enseñar en pantalla.
 *
 * El grafo trabaja con identificadores y tipos; la interfaz necesita un título, un
 * subtítulo y un color. Esta traducción vive en el dominio y no en los componentes
 * porque la necesitan tres vistas distintas —el panel lateral, la trazabilidad y
 * las etiquetas del mapa— y hacerla tres veces garantizaría que se desincronicen.
 */

export interface NodeDescriptor {
  readonly id: Uuid;
  readonly type: NodeType;
  /** Lo que se lee primero. */
  readonly label: string;
  /** Contexto: la materia, el código oficial, la fecha. */
  readonly detail: string;
  /** Color de la materia a la que pertenece, si pertenece a alguna. */
  readonly color: string | null;
}

const TYPE_LABELS: Record<NodeType, string> = {
  PROYECTO: 'Proyecto',
  SITUACION_APRENDIZAJE: 'Situación de aprendizaje',
  MATERIA: 'Materia',
  COMPETENCIA_ESPECIFICA: 'Competencia específica',
  CRITERIO_EVALUACION: 'Criterio de evaluación',
  SABER_BASICO: 'Saber básico',
  ACTIVIDAD: 'Actividad',
  SESION: 'Sesión',
  PRODUCTO_FINAL: 'Producto final',
  HITO: 'Hito',
  DOCENTE: 'Docente',
};

export function nodeTypeLabel(type: NodeType): string {
  return TYPE_LABELS[type];
}

/**
 * Construye el índice completo de nodos descriptibles.
 *
 * Se hace de una vez y se consulta muchas: buscar en once colecciones cada vez que
 * el panel de trazabilidad pinta una fila sería recorrer el proyecto entero por
 * cada vecino.
 */
export function buildNodeIndex(snapshot: ProjectSnapshot): Map<Uuid, NodeDescriptor> {
  const index = new Map<Uuid, NodeDescriptor>();
  const colorOf = new Map(snapshot.subjects.map((subject) => [subject.id, subject.color]));
  const subjectName = new Map(snapshot.subjects.map((subject) => [subject.id, subject.name]));
  const situationName = new Map(
    snapshot.learningSituations.map((situation) => [situation.id, situation.title]),
  );

  const add = (descriptor: NodeDescriptor): void => {
    index.set(descriptor.id, descriptor);
  };

  add({
    id: snapshot.project.id,
    type: 'PROYECTO',
    label: snapshot.project.title,
    detail: `${snapshot.project.course} · ${snapshot.project.startDate} a ${snapshot.project.endDate}`,
    color: null,
  });

  for (const subject of snapshot.subjects) {
    add({
      id: subject.id,
      type: 'MATERIA',
      label: subject.name,
      detail: `${subject.weeklySessions} sesiones semanales`,
      color: subject.color,
    });
  }

  for (const teacher of snapshot.teachers) {
    add({
      id: teacher.id,
      type: 'DOCENTE',
      label: teacher.displayName,
      detail: teacher.initials,
      color: null,
    });
  }

  for (const situation of snapshot.learningSituations) {
    add({
      id: situation.id,
      type: 'SITUACION_APRENDIZAJE',
      label: situation.title,
      detail: `${situation.estimatedSessions} sesiones previstas`,
      color: null,
    });
  }

  for (const activity of snapshot.activities) {
    add({
      id: activity.id,
      type: 'ACTIVIDAD',
      label: activity.title,
      detail: situationName.get(activity.learningSituationId) ?? '',
      color: null,
    });
  }

  for (const session of snapshot.sessions) {
    add({
      id: session.id,
      type: 'SESION',
      label: `${session.date} · ${session.startTime}`,
      detail: subjectName.get(session.subjectId) ?? '',
      color: colorOf.get(session.subjectId) ?? null,
    });
  }

  for (const competency of snapshot.competencies) {
    add({
      id: competency.id,
      type: 'COMPETENCIA_ESPECIFICA',
      label: competency.officialCode ?? competency.name,
      detail: subjectName.get(competency.subjectId) ?? '',
      color: colorOf.get(competency.subjectId) ?? null,
    });
  }

  for (const criterion of snapshot.evaluationCriteria) {
    add({
      id: criterion.id,
      type: 'CRITERIO_EVALUACION',
      label: criterion.officialCode ?? criterion.name,
      detail: criterion.name,
      color: colorOf.get(criterion.subjectId) ?? null,
    });
  }

  for (const knowledge of snapshot.basicKnowledge) {
    add({
      id: knowledge.id,
      type: 'SABER_BASICO',
      label: knowledge.name,
      detail: knowledge.block,
      color: colorOf.get(knowledge.subjectId) ?? null,
    });
  }

  for (const product of snapshot.finalProducts) {
    add({
      id: product.id,
      type: 'PRODUCTO_FINAL',
      label: product.title,
      detail: `Entrega el ${product.dueDate}`,
      color: null,
    });
  }

  for (const milestone of snapshot.milestones) {
    add({
      id: milestone.id,
      type: 'HITO',
      label: milestone.title,
      detail: milestone.date,
      color: null,
    });
  }

  return index;
}
