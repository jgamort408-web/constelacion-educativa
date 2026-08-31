# `src/features/`

Rebanadas verticales de producto: `map/`, `dashboard/`, `matrix/`, `editor/`, `io/`. Cada una agrupa sus componentes, hooks y estado.

## Puede vivir aquí

- Componentes contenedores que orquestan una pantalla.
- Hooks y selectores específicos de esa funcionalidad.

## No puede vivir aquí

- Lógica reutilizable por varias funcionalidades: eso sube a `domain/`, `services/` o `hooks/`.
- Cálculos de negocio embebidos en el JSX.
