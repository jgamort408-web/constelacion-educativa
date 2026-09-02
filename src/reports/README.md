# `src/reports/`

La representación **en texto** del proyecto: el programa completo, lo que le toca a cada materia y lo que toca cada semana. Es lo que se imprime, se exporta a PDF y se lleva a una reunión de departamento.

Es una capa hermana de `graph/`, no una parte de ella: ambas traducen el mismo snapshot, una a nodos y otra a párrafos. Que lean el mismo origen es lo que impide que el mapa y el informe cuenten cosas distintas (§5).

## Puede vivir aquí

- Funciones puras `(snapshot, filtros) => estructura de informe`.
- Cálculos de calendario: en qué semana cae algo, qué termina antes de qué.
- Detección de avisos de coordinación entre materias.

## No puede vivir aquí

- JSX, estilos ni nada de React. La presentación está en `features/reports/`.
- Acceso a la base de datos o al store.
- Mutaciones: un informe describe el proyecto, nunca lo cambia.

La prueba de arquitectura obliga a que esto se cumpla: si alguien importa React, Dexie o Cytoscape aquí, el build falla.
