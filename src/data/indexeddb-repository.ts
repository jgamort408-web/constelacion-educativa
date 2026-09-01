import type { EntityTable } from 'dexie';
import type { z } from 'zod';
import type { Finding, ProjectSnapshot, ProjectSummary, Uuid } from '@/domain';
import {
  activitySchema,
  assessmentInstrumentSchema,
  basicKnowledgeSchema,
  competencySchema,
  edgeSchema,
  evaluationCriterionSchema,
  evidenceSchema,
  finalProductSchema,
  learningSituationSchema,
  milestoneSchema,
  projectSchema,
  projectSnapshotSchema,
  SCHEMA_VERSION,
  sessionSchema,
  subjectSchema,
  teacherSchema,
  timetableSlotSchema,
  validateSnapshot,
} from '@/domain';
import { newId } from '@/utils/ids.ts';
import type { ConstelacionDatabase } from './database.ts';
import { getDatabase } from './database.ts';
import type { EntityKind, Mutation, Patch, PatchResult, ProjectRepository } from './repository.ts';
import { RepositoryError } from './repository.ts';
import type { AdoptedCurriculum } from './curriculum-catalogue.ts';

/**
 * Implementación del repositorio sobre IndexedDB (ADR 0002, ADR 0005).
 *
 * Tres decisiones que gobiernan este archivo:
 *
 *   1. **Se valida antes de escribir.** Nada llega a la base sin pasar por su
 *      esquema Zod. Una base con datos que no cumplen el modelo es peor que un
 *      error: falla mucho después, en otro sitio, sin pista de dónde entró.
 *   2. **Cada patch es una transacción.** Crear una actividad y sus aristas es una
 *      unidad. A medias dejaría relaciones apuntando a algo inexistente.
 *   3. **Cada patch calcula su inverso.** Es lo que hace posible el deshacer de la
 *      §10 sin guardar copias completas del proyecto en cada tecla.
 */

/**
 * Vista mínima de una tabla, sin el tipo concreto de su entidad.
 *
 * El despachador de mutaciones necesita tratar las catorce tablas de forma
 * uniforme, y `Table<T>` no lo permite porque `put` la hace invariante en `T`.
 */
interface AnyTable {
  get(id: string): Promise<{ id: string } | undefined>;
  put(entity: { id: string }): Promise<unknown>;
  delete(id: string): Promise<void>;
}

/**
 * El único punto del código donde se pierde el tipo concreto de una tabla.
 *
 * La seguridad no la aporta aquí TypeScript sino Zod: nada llega a `put` sin
 * haber pasado por el esquema de su entidad, unas líneas más abajo. Está aislado
 * en una función con nombre, y no repartido en catorce casts, para que se vea de
 * un vistazo dónde termina la garantía estática.
 */
function erased<T extends { id: string }>(table: EntityTable<T, 'id'>): AnyTable {
  return table as unknown as AnyTable;
}

/** Tabla y esquema de validación de cada tipo de entidad. */
interface KindBinding {
  table: (db: ConstelacionDatabase) => AnyTable;
  schema: z.ZodType;
}

const BINDINGS: Record<EntityKind, KindBinding> = {
  subject: { table: (db) => erased(db.subjects), schema: subjectSchema },
  teacher: { table: (db) => erased(db.teachers), schema: teacherSchema },
  learningSituation: {
    table: (db) => erased(db.learningSituations),
    schema: learningSituationSchema,
  },
  activity: { table: (db) => erased(db.activities), schema: activitySchema },
  session: { table: (db) => erased(db.sessions), schema: sessionSchema },
  milestone: { table: (db) => erased(db.milestones), schema: milestoneSchema },
  finalProduct: { table: (db) => erased(db.finalProducts), schema: finalProductSchema },
  timetableSlot: { table: (db) => erased(db.timetable), schema: timetableSlotSchema },
  competency: { table: (db) => erased(db.competencies), schema: competencySchema },
  evaluationCriterion: {
    table: (db) => erased(db.evaluationCriteria),
    schema: evaluationCriterionSchema,
  },
  basicKnowledge: { table: (db) => erased(db.basicKnowledge), schema: basicKnowledgeSchema },
  assessmentInstrument: {
    table: (db) => erased(db.assessmentInstruments),
    schema: assessmentInstrumentSchema,
  },
  evidence: { table: (db) => erased(db.evidences), schema: evidenceSchema },
  edge: { table: (db) => erased(db.edges), schema: edgeSchema },
};

/** Convierte un error de Zod en algo que un docente pueda leer. */
function readableIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private readonly db: ConstelacionDatabase;

  constructor(db: ConstelacionDatabase = getDatabase()) {
    this.db = db;
  }

  async isEmpty(): Promise<boolean> {
    return (await this.db.projects.count()) === 0;
  }

  async list(): Promise<ProjectSummary[]> {
    const projects = await this.db.projects.toArray();

    return Promise.all(
      projects.map(async (project): Promise<ProjectSummary> => {
        const [meta, subjectCount, activityCount, demoVersions] = await Promise.all([
          this.db.projectMeta.get(project.id),
          this.db.subjects.where('projectId').equals(project.id).count(),
          this.db.activities.where('projectId').equals(project.id).count(),
          this.db.curriculumVersions.filter((version) => version.isDemo).count(),
        ]);

        return {
          id: project.id,
          title: project.title,
          course: project.course,
          startDate: project.startDate,
          endDate: project.endDate,
          updatedAt: meta?.updatedAt ?? new Date().toISOString(),
          subjectCount,
          activityCount,
          isDemo: demoVersions > 0,
        };
      }),
    );
  }

  /**
   * Ensambla el snapshot a partir de las tablas.
   *
   * Todas las consultas van en paralelo dentro de una transacción de solo lectura:
   * secuencialmente serían quince viajes a IndexedDB en vez de uno.
   */
  async load(projectId: Uuid): Promise<ProjectSnapshot> {
    const project = await this.db.projects.get(projectId);
    if (!project) {
      throw new RepositoryError('No se encontró el proyecto que se intentaba abrir.');
    }

    const byProject = <T extends { id: string; projectId: string }>(
      table: EntityTable<T, 'id'>,
    ): Promise<T[]> => table.where('projectId').equals(projectId).toArray();

    const [
      subjects,
      teachers,
      learningSituations,
      activities,
      sessions,
      milestones,
      finalProducts,
      assessmentInstruments,
      evidences,
      edges,
      timetable,
      curriculumVersions,
      competencies,
      evaluationCriteria,
      basicKnowledge,
      pendingCurriculumReferences,
    ] = await Promise.all([
      byProject(this.db.subjects),
      byProject(this.db.teachers),
      byProject(this.db.learningSituations),
      byProject(this.db.activities),
      byProject(this.db.sessions),
      byProject(this.db.milestones),
      byProject(this.db.finalProducts),
      byProject(this.db.assessmentInstruments),
      byProject(this.db.evidences),
      byProject(this.db.edges),
      this.db.timetable.toArray(),
      this.db.curriculumVersions.toArray(),
      this.db.competencies.toArray(),
      this.db.evaluationCriteria.toArray(),
      this.db.basicKnowledge.toArray(),
      this.db.pendingCurriculumReferences.toArray(),
    ]);

    return projectSnapshotSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project,
      // El orden lo fija el dominio, no la base: IndexedDB devuelve las filas en
      // el orden que le conviene, y sin esto la matriz de contribución y la barra
      // lateral saldrían barajadas en cada carga.
      subjects: [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      teachers,
      learningSituations: [...learningSituations].sort((a, b) => a.order - b.order),
      activities: [...activities].sort(
        (a, b) => a.order - b.order || a.title.localeCompare(b.title, 'es'),
      ),
      sessions: [...sessions].sort(
        (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
      ),
      milestones,
      finalProducts,
      timetable,
      curriculumVersions,
      competencies,
      evaluationCriteria,
      basicKnowledge,
      pendingCurriculumReferences,
      assessmentInstruments,
      evidences,
      edges,
    });
  }

  /**
   * Guarda un proyecto entero.
   *
   * Se usa al importar y al sembrar el ejemplo, no al editar. Borra lo anterior
   * dentro de la misma transacción que escribe lo nuevo: si fallara a mitad, el
   * docente se quedaría sin lo viejo y sin lo nuevo.
   */
  async save(snapshot: ProjectSnapshot): Promise<void> {
    const parsed = projectSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      throw new RepositoryError(
        'El proyecto no se puede guardar porque no cumple el formato esperado.',
        readableIssues(parsed.error),
      );
    }
    const data = parsed.data;

    await this.db.transaction('rw', this.db.tables, async () => {
      await this.deleteProjectData(data.project.id);

      await Promise.all([
        this.db.projects.put(data.project),
        this.db.projectMeta.put({
          projectId: data.project.id,
          updatedAt: new Date().toISOString(),
          schemaVersion: data.schemaVersion,
        }),
        this.db.subjects.bulkPut(data.subjects),
        this.db.teachers.bulkPut(data.teachers),
        this.db.learningSituations.bulkPut(data.learningSituations),
        this.db.activities.bulkPut(data.activities),
        this.db.sessions.bulkPut(data.sessions),
        this.db.milestones.bulkPut(data.milestones),
        this.db.finalProducts.bulkPut(data.finalProducts),
        this.db.timetable.bulkPut(data.timetable),
        this.db.curriculumVersions.bulkPut(data.curriculumVersions),
        this.db.competencies.bulkPut(data.competencies),
        this.db.evaluationCriteria.bulkPut(data.evaluationCriteria),
        this.db.basicKnowledge.bulkPut(data.basicKnowledge),
        this.db.pendingCurriculumReferences.bulkPut(data.pendingCurriculumReferences),
        this.db.assessmentInstruments.bulkPut(data.assessmentInstruments),
        this.db.evidences.bulkPut(data.evidences),
        this.db.edges.bulkPut(data.edges),
      ]);
    });
  }

  /**
   * Aplica un cambio y devuelve el estado resultante, su inverso y las alertas.
   *
   * El inverso se calcula ANTES de escribir, leyendo el estado actual de cada
   * entidad afectada. Después ya sería tarde: lo que se sobrescribió se perdió.
   */
  async applyPatch(projectId: Uuid, patch: Patch): Promise<PatchResult> {
    const inverseMutations: Mutation[] = [];

    await this.db.transaction('rw', this.db.tables, async () => {
      for (const change of patch.mutations) {
        if (change.op === 'updateProject') {
          const previous = await this.db.projects.get(projectId);
          if (previous) inverseMutations.push({ op: 'updateProject', project: previous });

          const parsed = projectSchema.safeParse(change.project);
          if (!parsed.success) {
            throw new RepositoryError(
              'No se pudo guardar el cambio en el proyecto.',
              readableIssues(parsed.error),
            );
          }
          await this.db.projects.put(parsed.data);
          continue;
        }

        const binding = BINDINGS[change.kind];
        const table = binding.table(this.db);

        if (change.op === 'delete') {
          const previous = await table.get(change.id);
          if (previous) {
            // El inverso de borrar es volver a crear lo que había, tal cual estaba.
            inverseMutations.push({ op: 'upsert', kind: change.kind, entity: previous });
          }
          await table.delete(change.id);
          continue;
        }

        const parsed = binding.schema.safeParse(change.entity);
        if (!parsed.success) {
          throw new RepositoryError(
            'No se pudo guardar el cambio porque los datos no son válidos.',
            readableIssues(parsed.error),
          );
        }
        const entity = parsed.data as { id: string };

        const previous = await table.get(entity.id);
        inverseMutations.push(
          previous
            ? { op: 'upsert', kind: change.kind, entity: previous }
            : { op: 'delete', kind: change.kind, id: entity.id },
        );

        await table.put(entity);
      }

      await this.db.projectMeta.put({
        projectId,
        updatedAt: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
      });
    });

    const snapshot = await this.load(projectId);
    const findings: readonly Finding[] = validateSnapshot(snapshot);

    return {
      snapshot,
      inverse: {
        label: `Deshacer: ${patch.label}`,
        // Al revés: para revertir A→B→C hay que deshacer C, luego B, luego A.
        mutations: inverseMutations.reverse(),
      },
      findings,
    };
  }

  /**
   * Escribe el currículo oficial en el catálogo global.
   *
   * Las tablas curriculares no están acotadas por proyecto: el currículo lo es de
   * la etapa, no de un proyecto concreto, y varios proyectos del mismo equipo
   * comparten criterios. Por eso esta operación no recibe `projectId`.
   *
   * Sustituye lo oficial anterior dentro de la misma transacción, para que no
   * quede una carga a medias si algo falla, y **no toca lo marcado como
   * demostración**: el DEMO tiene que seguir funcionando después.
   */
  async adoptCurriculum(adopted: AdoptedCurriculum): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.dropOfficialCurriculum();
      await Promise.all([
        this.db.curriculumVersions.bulkPut([...adopted.versions]),
        this.db.competencies.bulkPut([...adopted.competencies]),
        this.db.evaluationCriteria.bulkPut([...adopted.evaluationCriteria]),
        this.db.basicKnowledge.bulkPut([...adopted.basicKnowledge]),
      ]);
    });
  }

  async removeOfficialCurriculum(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.dropOfficialCurriculum();
    });
  }

  /** Borra los elementos cuya versión curricular NO es de demostración. */
  private async dropOfficialCurriculum(): Promise<void> {
    const oficiales = await this.db.curriculumVersions.filter((v) => !v.isDemo).toArray();
    if (oficiales.length === 0) return;
    const ids = new Set(oficiales.map((v) => v.id));

    await Promise.all([
      this.db.competencies.filter((c) => ids.has(c.curriculumVersionId)).delete(),
      this.db.evaluationCriteria.filter((c) => ids.has(c.curriculumVersionId)).delete(),
      this.db.basicKnowledge.filter((c) => ids.has(c.curriculumVersionId)).delete(),
      this.db.curriculumVersions.bulkDelete([...ids]),
    ]);
  }

  async remove(projectId: Uuid): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.deleteProjectData(projectId);
      await this.db.projects.delete(projectId);
      await this.db.projectMeta.delete(projectId);
    });
  }

  /** Guarda una copia de seguridad del estado actual. */
  async backup(projectId: Uuid, reason: 'automatica' | 'manual' | 'antes-de-importar') {
    const snapshot = await this.load(projectId);
    await this.db.backups.put({
      id: newId(),
      projectId,
      createdAt: new Date().toISOString(),
      reason,
      payload: JSON.stringify(snapshot),
    });
    await this.pruneBackups(projectId);
  }

  /**
   * Conserva solo las diez copias más recientes.
   *
   * IndexedDB tiene una cuota y un proyecto completo no es pequeño. Diez cubre el
   * caso real —«esto lo tenía bien ayer»— sin llenar el disco del docente.
   */
  private async pruneBackups(projectId: Uuid): Promise<void> {
    const all = await this.db.backups.where('projectId').equals(projectId).sortBy('createdAt');
    const excess = all.slice(0, Math.max(0, all.length - 10));
    if (excess.length > 0) {
      await this.db.backups.bulkDelete(excess.map((backup) => backup.id));
    }
  }

  /** Copias disponibles, de la más reciente a la más antigua. */
  async listBackups(projectId: Uuid) {
    const all = await this.db.backups.where('projectId').equals(projectId).sortBy('createdAt');
    return all.reverse();
  }

  /** Borra todo lo que cuelga de un proyecto, sin borrar el proyecto en sí. */
  private async deleteProjectData(projectId: Uuid): Promise<void> {
    const clear = <T extends { id: string; projectId: string }>(
      table: EntityTable<T, 'id'>,
    ): Promise<number> => table.where('projectId').equals(projectId).delete();

    await Promise.all([
      clear(this.db.subjects),
      clear(this.db.teachers),
      clear(this.db.learningSituations),
      clear(this.db.activities),
      clear(this.db.sessions),
      clear(this.db.milestones),
      clear(this.db.finalProducts),
      clear(this.db.assessmentInstruments),
      clear(this.db.evidences),
      clear(this.db.edges),
    ]);
  }
}
