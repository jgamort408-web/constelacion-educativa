/**
 * Punto de entrada de los informes.
 *
 * Todo lo de esta carpeta es puro: recibe un snapshot y devuelve estructuras de
 * datos. No importa React, ni Cytoscape, ni Dexie. Esa restricción es lo que
 * permite probar que la semana 3 contiene lo que dice contener sin abrir un
 * navegador, y la vigila una prueba de arquitectura.
 */

export * from './informes.ts';
