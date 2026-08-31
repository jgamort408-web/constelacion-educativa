# 0003 · Las relaciones son entidades, no arrays de IDs

**Estado:** aceptada · 2026-08-31

## Contexto

El modelo tiene once tipos de nodo y relaciones entre casi todos ellos (§2). La forma rápida
de representarlas es un array en cada entidad: `activity.subjectIds: string[]`.

El problema es que una relación de este dominio **tiene atributos propios**. Cuando
Matemáticas participa en una situación de aprendizaje, esa participación tiene una
intensidad, un número de sesiones, unos criterios asociados y una procedencia: la puso un
docente o la calculó el sistema. Nada de eso cabe en un array de identificadores.

El propio prompt maestro lo advierte en §19.

## Decisión

Existe una colección de aristas de primera clase:

```ts
type Edge = {
  id: Uuid;
  type: EdgeType;
  sourceId: Uuid;
  sourceType: NodeType;
  targetId: Uuid;
  targetType: NodeType;
  metadata: EdgeMetadata; // weight, sessions, criteria, mode, notes
};
```

Las entidades guardan solo sus atributos propios. Los índices de adyacencia se construyen en
memoria al cargar y se recalculan cuando cambian las aristas.

## Consecuencias

- Una participación puede llevar intensidad y procedencia sin inventar tablas paralelas.
- Las consultas del tipo «dónde se trabaja este criterio» recorren una sola colección.
- Se corresponde con una tabla de unión en SQL cuando llegue Postgres: la migración es
  mecánica.
- **Coste:** más ceremonia para crear una relación simple, y hay que mantener los índices de
  adyacencia sincronizados.

## Alternativas descartadas

- **Arrays de IDs.** Habría que migrar datos ya introducidos por docentes en cuanto la
  primera relación necesitara un atributo. Y la primera es la intensidad, que aparece ya en
  la §3.
