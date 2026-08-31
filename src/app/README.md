# `src/app/`

El estado de la aplicación y su cableado con la capa de datos.

## Puede vivir aquí

- El store de Zustand y sus selectores.
- La inyección del repositorio.
- Proveedores y contexto de nivel raíz.

## No puede vivir aquí

- Reglas de negocio: van a `domain/`.
- Acceso directo a Dexie: va por `ProjectRepository`.
- Datos derivados del snapshot. La matriz, las alertas agrupadas y los vecinos de
  un nodo se calculan con `useMemo` en cada pantalla, a partir del snapshot.
  Guardarlos aquí es lo que hace que dos vistas acaben discrepando, y la §5 exige
  justo lo contrario.

## Trampa conocida

Un selector de Zustand **nunca** debe construir un valor nuevo: ni `?? []`, ni
`.map()`, ni un objeto literal. Devolvería una referencia distinta en cada render
y provocaría un bucle infinito, el error React #185 y una pantalla en blanco.
Los selectores devuelven primitivas o la referencia que ya está en el estado.
