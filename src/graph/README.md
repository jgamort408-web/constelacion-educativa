# `src/graph/`

La traducción del dominio al grafo visual: proyección por nivel semántico, estilos de Cytoscape, layouts y selección.

## Puede vivir aquí

- Funciones de proyección `(snapshot, nivel, filtros) => elementos de Cytoscape`.
- Hojas de estilo de Cytoscape y configuración de layouts.
- Lógica de resaltado y atenuación.

## No puede vivir aquí

- Mutaciones del dominio. El grafo lee y proyecta; no decide.
- Estado de la aplicación: eso está en el store.
