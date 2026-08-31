# 0004 · Zod es la única fuente del contrato de datos

**Estado:** aceptada · 2026-08-31

## Contexto

Hacen falta tres cosas que describen la misma estructura: tipos de TypeScript para el
editor, validación en tiempo de ejecución para importar JSON, y un JSON Schema formal (§8)
para el futuro copiloto y el importador curricular.

Mantener las tres a mano garantiza que diverjan, y una divergencia entre el validador y los
tipos produce el peor tipo de fallo: datos que TypeScript cree válidos y que en ejecución no
lo son.

## Decisión

Se escribe **solo** el esquema Zod. Todo lo demás se deriva:

```
Esquema Zod  (única fuente escrita a mano)
   ├──> tipos TypeScript       (z.infer)
   ├──> validación en runtime  (import/export, futura IA)
   └──> JSON Schema            (npm run schema → schema/project.v1.json)
```

`schema/` está en `.gitignore`: es un artefacto de build, no código fuente.

## Consecuencias

- Es imposible que los tipos y el validador se contradigan.
- El JSON Schema que consumirá el copiloto está siempre al día.
- **Coste:** los tipos derivados se leen peor en el editor que una `interface` escrita a
  mano, y hay que ejecutar un paso de generación.

## Alternativas descartadas

- **Interfaces a mano más validación a mano.** Divergen.
- **JSON Schema como fuente y tipos generados.** Los tipos generados desde JSON Schema son
  peores, y se pierden las transformaciones y refinamientos de Zod.
