# `src/data/`

La persistencia. Interfaz `ProjectRepository` y su implementación sobre IndexedDB (Dexie): esquema, migraciones, transacciones y consultas.

## Puede vivir aquí

- La interfaz `ProjectRepository` y sus tipos de entrada y salida.
- `IndexedDbProjectRepository` y la definición de la base Dexie.
- Migraciones de esquema versionadas.
- Serialización, importación y exportación.

## No puede vivir aquí

- Reglas de negocio. Si hay que decidir _si_ algo es válido, eso vive en `domain/`.
- Componentes de React o cualquier referencia al DOM.

Motivo: el resto de la aplicación consume la interfaz, nunca Dexie. Sustituir IndexedDB por Postgres debe ser cambiar una implementación, no reescribir pantallas.
