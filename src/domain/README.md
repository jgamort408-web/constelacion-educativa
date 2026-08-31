# `src/domain/`

El núcleo. Entidades, esquemas Zod y funciones puras que definen qué es un proyecto interdisciplinar y qué reglas lo gobiernan.

## Puede vivir aquí

- Esquemas Zod y los tipos derivados con `z.infer`.
- Funciones puras y deterministas: cálculo de contribución, recorrido del grafo, detección de ciclos, validación pedagógica.
- Constantes del dominio (tipos de nodo, tipos de arista, severidades).

## No puede vivir aquí

- **Nada de `react`, `react-dom`, `dexie`, `cytoscape` ni `zustand`.** Lo verifica `tests/architecture.test.ts` en cada push.
- Acceso a `window`, `document`, `localStorage` o `indexedDB`.
- Efectos secundarios, peticiones de red, relojes ni aleatoriedad sin inyectar.

Motivo: este directorio debe poder ejecutarse tal cual en Node, en un script de línea de comandos, en un backend o en una futura app de tablet. Es la única garantía de que la lógica no haya que reescribirla.
