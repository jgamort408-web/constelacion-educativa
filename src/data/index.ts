/**
 * Punto de entrada de la capa de datos.
 *
 * Fuera de esta carpeta se importa desde aquí. Nadie importa `dexie`
 * directamente: esa es la regla que hace posible cambiar de motor de persistencia
 * sin tocar la aplicación (ADR 0002), y `tests/architecture.test.ts` la vigila.
 */

export * from './repository.ts';
export { ConstelacionDatabase, getDatabase, setDatabase } from './database.ts';
export type { Backup, ProjectMeta } from './database.ts';
export { IndexedDbProjectRepository } from './indexeddb-repository.ts';
export { buildDemoSnapshot, DEMO_INFO } from './demo/barrio.ts';
export { openProject, seedIfEmpty } from './bootstrap.ts';
export { adoptForProject, loadCatalogue, matchSubjects } from './curriculum-catalogue.ts';
export type {
  AdoptedCurriculum,
  CurriculumCatalogue,
  SubjectMatch,
} from './curriculum-catalogue.ts';
