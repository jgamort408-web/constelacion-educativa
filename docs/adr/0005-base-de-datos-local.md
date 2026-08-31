# 0005 · IndexedDB con esquema versionado y CRUD completo

**Estado:** aceptada · 2026-08-31

## Contexto

El plan inicial contemplaba una persistencia mínima en la v0.1: cargar el proyecto DEMO y
mover datos con importación y exportación de JSON. La edición real quedaba para la v0.2.

Al revisarlo se decidió que la primera versión debe permitir **crear, modificar y borrar** de
verdad. Un docente que no puede editar sus datos no tiene una herramienta, tiene una
demostración.

## Decisión

Base de datos local sobre IndexedDB con Dexie, tratada como una base de datos real y no como
un cajón donde volcar un JSON:

- **Colecciones normalizadas**, una por tipo de entidad más una de aristas. No un único
  registro gigante con el proyecto entero dentro.
- **Índices** sobre las columnas por las que se consulta de verdad: proyecto, tipo, origen y
  destino de cada arista.
- **Esquema versionado con migraciones** de Dexie. Cambiar el modelo no obliga al docente a
  perder lo introducido.
- **Transacciones** para las operaciones que tocan varias colecciones: crear una actividad y
  sus aristas es una sola unidad, o se aplica entera o no se aplica.
- **CRUD completo** expuesto por `ProjectRepository`, con validación contra los esquemas Zod
  antes de escribir.

Se mantiene local, sin servidor: la decisión de «yo primero, equipo después» no cambia.

## Consecuencias

- La edición manual (§10) entra en el sprint, que crece de seis a unos ocho días.
- Escribir una entidad no obliga a reescribir el proyecto entero: cada operación es
  proporcional a lo que cambia.
- Al ser colecciones normalizadas con índices, la traducción a tablas de Postgres es directa.
- **Riesgo que esto NO resuelve:** IndexedDB vive en el navegador. Limpiar los datos del
  sitio borra el trabajo. Por eso la copia de seguridad automática y el aviso de «última
  copia» no son un extra: son parte de esta misma fase.

## Alternativas descartadas

- **Guardar el proyecto como un único blob JSON en IndexedDB.** Trivial de implementar;
  obliga a reescribirlo entero en cada cambio, imposibilita las consultas por índice y no se
  parece en nada a la estructura que tendrá en Postgres.
- **`localStorage`.** Límite de unos 5 MB, síncrono, sin índices ni transacciones.
- **SQLite compilado a WebAssembly.** SQL real en el navegador y muy tentador, pero añade un
  binario de cientos de kilobytes y una capa de persistencia propia para un beneficio que
  Dexie ya cubre a esta escala.
