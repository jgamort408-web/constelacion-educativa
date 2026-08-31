# `src/components/`

Interfaz tonta y reutilizable: botones, campos, diálogos, insignias, tablas. Sin conocimiento del dominio.

## Puede vivir aquí

- Componentes de presentación que reciben todo por props.
- Primitivas accesibles (foco, roles ARIA, navegación por teclado).

## No puede vivir aquí

- Importaciones de `domain/`, `data/` ni del store.

Motivo: si un componente conoce qué es una situación de aprendizaje, pertenece a `features/`.
