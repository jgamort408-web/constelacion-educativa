import type { ProjectSnapshot, Uuid } from '@/domain';
import { buildDemoSnapshot } from './demo/barrio.ts';
import type { ProjectRepository } from './repository.ts';

/**
 * Arranque de la aplicación.
 *
 * Decide qué ve un docente la primera vez que abre la aplicación y qué ve la
 * segunda. La regla es que la primera vez debe haber algo con lo que trastear —el
 * proyecto de ejemplo— y que a partir de ahí manda lo que él haya guardado.
 */

/**
 * Siembra el proyecto de demostración si la base está vacía.
 *
 * Solo si está **vacía**. Volver a sembrar sobre datos existentes sería la forma
 * más rápida de destruir el trabajo de alguien: el ejemplo tiene identificadores
 * fijos, así que sobrescribiría sin avisar cualquier proyecto que los compartiera.
 *
 * Devuelve el identificador del proyecto que hay que abrir.
 */
export async function seedIfEmpty(repository: ProjectRepository): Promise<Uuid | null> {
  if (!(await repository.isEmpty())) {
    const existing = await repository.list();
    // El más recientemente modificado es el que el docente estaba usando.
    const mostRecent = [...existing].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return mostRecent?.id ?? null;
  }

  const demo = buildDemoSnapshot();
  await repository.save(demo);
  return demo.project.id;
}

/**
 * Abre el proyecto con el que trabajar, sembrando el ejemplo si hace falta.
 *
 * Devuelve `null` cuando no hay ningún proyecto y tampoco se ha podido sembrar,
 * en vez de lanzar: la aplicación debe poder mostrar una pantalla de bienvenida
 * en lugar de un error, incluso si IndexedDB no está disponible.
 */
export async function openProject(repository: ProjectRepository): Promise<ProjectSnapshot | null> {
  const projectId = await seedIfEmpty(repository);
  if (projectId === null) return null;
  return repository.load(projectId);
}
