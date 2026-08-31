/**
 * Punto de entrada de la capa de grafo.
 *
 * `projection.ts` es puro y no conoce Cytoscape; `style.ts` sí, porque describe
 * cómo se dibuja. Esa separación es lo que permite probar qué se muestra en cada
 * nivel sin abrir un navegador.
 */

export * from './projection.ts';
export { STYLESHEET, layoutFor } from './style.ts';
