# 0002 · Todo acceso a datos pasa por una interfaz

**Estado:** aceptada · 2026-08-31

## Contexto

La v0.1 persiste en el navegador porque solo la usa una persona. Cuando entre el equipo
docente (§17) hará falta un servidor: varios profesores editando el mismo proyecto no caben
en un IndexedDB local.

Si las pantallas llaman a Dexie directamente, esa migración es una reescritura.

## Decisión

Toda lectura y escritura pasa por la interfaz `ProjectRepository`, definida en `src/data/`.
Ningún archivo fuera de `src/data/` importa `dexie`.

```ts
interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(id: ProjectId): Promise<ProjectSnapshot>;
  save(snapshot: ProjectSnapshot): Promise<void>;
  applyPatch(id: ProjectId, patch: DomainPatch): Promise<void>;
}
```

## Consecuencias

- Cambiar IndexedDB por Postgres es escribir una segunda implementación, no tocar pantallas.
- Las pruebas pueden usar una implementación en memoria sin simular IndexedDB.
- **Coste:** una capa de indirección más. Media jornada ahora frente a semanas después.

## Alternativas descartadas

- **Llamar a Dexie desde los componentes.** Directo y cómodo; convierte la migración en una
  reescritura de toda la interfaz.
- **Empezar ya con Supabase.** Elimina la migración, pero añade cuentas, red y latencia a un
  producto que hoy usa una sola persona en una sola máquina.
