/**
 * Punto de entrada del dominio.
 *
 * El resto de la aplicación importa desde aquí (`@/domain`) y no desde archivos
 * sueltos, para que reorganizar el interior de esta carpeta no rompa nada fuera.
 */

export * from './primitives.ts';
export * from './enums.ts';
export * from './curriculum.ts';
export * from './project.ts';
export * from './assessment.ts';
export * from './edge.ts';
export * from './snapshot.ts';
export * from './graph.ts';
export * from './contribution.ts';
export * from './validation.ts';
export * from './lookup.ts';
