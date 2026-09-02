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
// El ejemplo NO se reexporta aquí. Reexportarlo lo ataría al grafo de módulos
// que carga la aplicación al arrancar, y con él sus trescientos kilobytes de
// currículo, anulando la importación diferida de `bootstrap.ts`. Quien lo
// necesite —las pruebas y los scripts— lo importa de `./demo/ejemplo.ts`.
export { openProject, seedIfEmpty } from './bootstrap.ts';
export { adoptForProject, FUENTES, loadCatalogue, matchSubjects } from './curriculum-catalogue.ts';
export type {
  AdoptedCurriculum,
  CurriculumCatalogue,
  FuenteCurricular,
  SubjectMatch,
} from './curriculum-catalogue.ts';
