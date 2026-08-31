# Plan de producción — Constelación Educativa

> Documento de trabajo. Traduce el `PROMPT MAESTRO` a un plan ejecutable por fases.
> Última revisión: 2026-08-31.

## 0. Decisiones tomadas (marco del plan)

| Decisión          | Valor                                           | Consecuencia arquitectónica                              |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Usuarios de la v1 | Solo el autor; equipo docente en fase posterior | Sin backend, sin cuentas. Persistencia local.            |
| Plazo             | Sprint intenso (~6 días de trabajo efectivo)    | Alcance recortado a "explorar", no "editar".             |
| IA                | Fuera de la v1, con la costura preparada        | Existe `AIProvider` y JSON Schema; ninguna llamada real. |
| Currículo         | Solo DEMO + importador documentado              | Ningún código curricular oficial inventado.              |
| Primer entregable | Mapa + panel + filtros + matriz + dashboard     | La edición entra por importar/exportar JSON validado.    |
| Nombre            | `constelacion-educativa`                        | Repo `jgamort408/constelacion-educativa`.                |
| Licencia          | MIT, repositorio público                        | Sin datos personales en el repo.                         |
| Caso de uso       | Proyecto DEMO "Transformamos nuestro barrio"    | Sin presión de calendario escolar sobre la v0.1.         |

---

## 1. Interpretación funcional: qué es realmente este producto

El prompt maestro describe **tres productos distintos** bajo un mismo nombre:

1. **Un editor de grafos curriculares** — modelar un proyecto interdisciplinar como nodos y relaciones con metadatos, y explorarlo visualmente (§2, §3, §4, §31).
2. **Un planificador temporal** — horarios, sesiones, dependencias, motor de propuesta de calendario y detección de conflictos (§5, §11, §21).
3. **Una plataforma colaborativa con IA** — varios docentes, roles, historial, copiloto generativo (§7, §17, §30).

El valor diferencial —lo que no existe hoy en el mercado— está en el **producto 1**. Los productos 2 y 3 son commodities que ya resuelven Séneca, Additio, iDoceo o un calendario compartido. Por eso el plan invierte primero, y bien, en el grafo y su trazabilidad, y deja el resto para fases posteriores sobre un dominio ya sólido.

**La pregunta que la v0.1 debe responder visualmente:** _"¿Por qué estamos haciendo esta actividad, y quién más depende de ella?"_ (§31). Todo lo demás es secundario.

---

## 2. Arquitectura

### 2.1 Principio rector: el dominio es puro

```
src/
  domain/       ← entidades, esquemas Zod, funciones puras. CERO React, CERO Dexie, CERO DOM.
  data/         ← interfaz Repository + implementación IndexedDB (Dexie)
  graph/        ← proyección dominio → Cytoscape: elementos, estilos, layouts, niveles
  features/     ← rebanadas verticales: map/, dashboard/, matrix/, io/
  components/   ← UI tonta y reutilizable
  hooks/
  services/
  ai/           ← interfaz AIProvider + stub. Nada más en v1.
  utils/
  types/
```

Regla dura: **`domain/` no importa nada de `react`, `dexie`, `cytoscape` ni `zustand`.** Un test de arquitectura en CI lo verifica. Esto es lo que permite que mañana exista una app móvil, un script de línea de comandos o un backend que reutilicen la misma lógica (§27).

### 2.2 La costura que salva la migración a Supabase

Todo acceso a datos pasa por una interfaz, nunca por Dexie directamente:

```ts
interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(id: ProjectId): Promise<ProjectSnapshot>;
  save(snapshot: ProjectSnapshot): Promise<void>;
  applyPatch(id: ProjectId, patch: DomainPatch): Promise<void>;
}
```

`IndexedDbProjectRepository` hoy, `SupabaseProjectRepository` mañana. La UI no se entera. **Esta es la única decisión que evita reescribir la aplicación en la fase de equipo docente**, y cuesta medio día ahora frente a semanas después.

### 2.3 Una sola fuente de verdad, muchas vistas

§5 exige que modificar una vista actualice las demás. Eso no se consigue sincronizando vistas: se consigue **no duplicando datos**. Hay un único store normalizado, y mapa, matriz, timeline y dashboard son _selectores derivados_, nunca copias.

```
ProjectSnapshot (normalizado)
  ├── entities: Record<EntityId, Entity>     ← atributos propios, nada más
  └── edges:    Edge[]                       ← relaciones de primera clase
        ↓ proyección pura (nivel + filtros)
  ┌─────────┬────────┬───────────┬──────────┐
  │  MAPA   │ MATRIZ │ DASHBOARD │ TIMELINE │
  └─────────┴────────┴───────────┴──────────┘
```

### 2.4 Relaciones como entidades de primera clase

§19 lo pide explícitamente y es la decisión de modelado más importante. **No** habrá `activity.subjectIds: string[]`. Habrá una tabla de aristas:

```ts
type Edge = {
  id: Uuid;
  type: EdgeType; // participa_en | desarrolla | moviliza | depende_de | ...
  sourceId: Uuid;
  sourceType: NodeType;
  targetId: Uuid;
  targetType: NodeType;
  metadata: EdgeMetadata; // weight, sessions, criteria, mode, notes...
};
```

Motivo: una relación necesita atributos propios (`weight`, `sessions`, procedencia manual o calculada). Un array de IDs no puede llevarlos, y convertirlo después obliga a migrar datos ya introducidos por el docente.

En memoria se construyen índices de adyacencia (`Map<NodeId, Edge[]>` por dirección y por tipo) para recorridos O(1). Se recalculan solo cuando cambian las aristas.

### 2.5 El contrato de datos: Zod como fuente única

§8 pide un JSON Schema formal. Mantener a mano un JSON Schema _y_ los tipos de TypeScript _y_ los validadores es garantía de que diverjan. Por tanto:

```
Esquema Zod (única fuente)
   ├──> tipos TypeScript      (z.infer)
   ├──> validación en runtime (import/export, futura IA)
   └──> JSON Schema           (generado en build, versionado en /schema)
```

El JSON Schema publicado en `schema/project.v1.json` es un **artefacto generado**, nunca editado a mano, y es lo que consumirá el copiloto IA cuando llegue (structured outputs) y el importador curricular.

### 2.6 Zoom semántico: proyección, no CSS

§4 insiste en que el zoom cambia el nivel de detalle, no el tamaño. Se implementa como estado explícito:

```ts
type SemanticLevel = 'GALAXIA' | 'CONSTELACIONES' | 'ACTIVIDADES' | 'CURRICULO' | 'SESIONES';

project(snapshot, level, filters) => { nodes: CyNode[]; edges: CyEdge[] }
```

El zoom de cámara puede _sugerir_ un cambio de nivel al cruzar un umbral, pero nunca lo fuerza: el docente manda. Cada nivel tiene su propio layout precalculado.

---

## 3. Modelo de entidades

Nodos del grafo (§2): `PROYECTO`, `SITUACION_APRENDIZAJE`, `MATERIA`, `COMPETENCIA_ESPECIFICA`, `CRITERIO_EVALUACION`, `SABER_BASICO`, `ACTIVIDAD`, `SESION`, `PRODUCTO_FINAL`, `HITO`, `DOCENTE`.

Entidades de soporte, no representadas como nodos en la v0.1: `Evidence`, `AssessmentInstrument`, `Schedule`, `Contribution`, `CurriculumVersion`.

### 3.1 Identidad y procedencia (§8, §9)

Todo elemento curricular separa cuatro campos que suelen mezclarse:

```ts
{
  id: Uuid,                    // interno, estable, nuestro
  officialCode: string | null, // "MAT.3.2.1" — externo, de la norma
  name: string,
  description: string,
  curriculumVersionId: Uuid,   // → fuente, normativa, fecha, versión, isDemo
}
```

`CurriculumVersion` registra `{ source, normativa, publishedAt, importedAt, version, isDemo }`. **Todo lo que no proceda de una fuente oficial verificada lleva `isDemo: true`**, sus códigos van prefijados con `DEMO.` y la interfaz los marca con una insignia visible. Nunca se emitirá un código que pueda confundirse con una referencia real del BOJA.

### 3.2 Distinción que la mayoría de herramientas se salta (§14)

`Actividad` ≠ `Evidencia` ≠ `Instrumento` ≠ `Criterio`. Cuatro entidades separadas desde el primer esquema, aunque la funcionalidad de evaluación no se implemente hasta la v0.6. Modelarlas tarde obliga a migrar los datos reales del equipo docente.

---

## 4. Algoritmo de contribución (§20)

Función pura, determinista y explicable. Nunca un número opaco:

```ts
computeContribution(snapshot, subjectId, scopeId, weights) => {
  total: 0.72,
  breakdown: [
    { factor: 'sesiones',      raw: 12, normalized: 0.87, weight: 0.40, points: 0.35 },
    { factor: 'actividades',   raw: 5,  normalized: 0.50, weight: 0.40, points: 0.20 },
    { factor: 'criterios',     raw: 3,  normalized: 0.40, weight: 0.30, points: 0.12 },
    { factor: 'productoFinal', raw: 1,  normalized: 0.25, weight: 0.20, points: 0.05 },
  ],
  mode: 'CALCULADA'
}
```

Reglas:

- Tres modos por contribución: `MANUAL`, `CALCULADA`, `PROPUESTA_IA`.
- **`MANUAL` gana siempre.** Recalcular jamás sobrescribe un valor puesto por un docente (§6); si el cálculo diverge, se muestra el conflicto y se ofrece adoptarlo, no se aplica.
- Los pesos de los factores se guardan por proyecto y son editables.
- La interfaz muestra el `breakdown` completo en el panel lateral. Un porcentaje sin explicación es una caja negra, y §20 lo prohíbe.

---

## 5. Accesibilidad: el problema que un grafo en canvas plantea (§16)

Cytoscape renderiza sobre `<canvas>`. Para un lector de pantalla eso es **un rectángulo vacío**. Ninguna cantidad de `aria-label` lo arregla.

Solución adoptada: **dos representaciones sobre un mismo store.**

- El canvas queda `aria-hidden="true"`. Es la vista visual.
- En paralelo existe un **Panel de Trazabilidad**: un árbol navegable por teclado, semántico (`role="tree"`), que expone exactamente los mismos nodos y relaciones y permite recorrer `ACTIVIDAD → SdA → MATERIA → COMPETENCIA → CRITERIO → SABER → SESIÓN → EVIDENCIA → PRODUCTO` y el camino inverso.

Este panel no es una concesión a la accesibilidad: **es también la respuesta a §31**, la trazabilidad, y resulta más rápido que el grafo para responder "¿por qué hacemos esto?". Sale gratis por diseño y sirve a todo el mundo.

Además: foco visible, navegación con flechas entre nodos relacionados, tema de alto contraste, respeto a `prefers-reduced-motion` (desactiva la animación de layout), y nunca el color como único portador de información (grosor + patrón de línea + etiqueta + icono).

---

## 6. Riesgos y mitigaciones

| Riesgo                                                                                                 | Impacto | Mitigación                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pérdida de datos en IndexedDB** — limpiar la caché del navegador borra un trimestre de planificación | Crítico | Exportación automática de instantánea JSON al cerrar sesión de trabajo; aviso persistente "última copia hace N días"; historial de versiones dentro de IndexedDB; botón de copia de seguridad siempre visible                |
| Re-render de React destruyendo el grafo                                                                | Alto    | Cytoscape se instancia **una vez** en un componente con `ref`; las actualizaciones van por `cy.batch()`, jamás recreando el componente                                                                                       |
| Selectores de Zustand devolviendo referencias nuevas                                                   | Alto    | Nunca `?? []` ni `.map()` dentro de un selector (produce bucle infinito → React #185 → pantalla en blanco). Los selectores devuelven primitivas o referencias estables; las derivaciones van en `useMemo` fuera del selector |
| Deriva de alcance (35 secciones = 3 productos)                                                         | Alto    | Cada fase termina en algo ejecutable; nada de la fase N+1 se toca hasta cerrar la N (§32)                                                                                                                                    |
| El currículo real es el verdadero cuello de botella de utilidad                                        | Medio   | Importador desacoplado y versionado desde la v0.1; los datos reales entran sin tocar código                                                                                                                                  |
| Rendimiento con 500 nodos / 1500 aristas                                                               | Medio   | Filtrado y proyección **antes** de que Cytoscape vea nada; estilos por clase, no por elemento; medición desde la fase 4, no al final                                                                                         |

---

## 7. Fases de ejecución

Cada fase termina en un estado **ejecutable y verificable** (§32). No se avanza sin cerrar la anterior.

### Sprint v0.1 — "Explorar" (~6 días efectivos)

#### Fase 0 · Fundación · ~0,5 día

- [ ] `git init`, repo público `jgamort408/constelacion-educativa`, licencia MIT
- [ ] Vite + React 19 + TypeScript en modo `strict` (+ `noUncheckedIndexedAccess`)
- [ ] Tailwind v4, ESLint, Prettier, Vitest
- [ ] Estructura de carpetas de §2.1, con un `README` por carpeta explicando qué puede y qué no puede vivir ahí
- [ ] GitHub Actions: `typecheck` + `lint` + `test` + `build` en cada push
- [ ] Test de arquitectura: falla si `domain/` importa React, Dexie, Cytoscape o Zustand
- [ ] `docs/adr/` con las decisiones de §2 en formato ADR corto

**Verificable:** `npm run ci` en verde sobre un repo sin funcionalidad todavía.

#### Fase 1 · Dominio y contrato de datos · ~1 día

- [ ] Esquemas Zod de las entidades de §3 y del tipo `Edge`
- [ ] Tipos derivados con `z.infer` — ni un solo tipo escrito a mano por duplicado
- [ ] Generación de `schema/project.v1.json` en el build
- [ ] Funciones puras: `computeContribution`, `detectCycles`, `traverse`, `buildAdjacency`
- [ ] Motor de validación pedagógica (§11) con severidad `ERROR | ADVERTENCIA | SUGERENCIA`
- [ ] Tests unitarios de todo lo anterior (§34)

**Verificable:** suite de tests del dominio en verde. Todavía no hay interfaz alguna.

#### Fase 2 · Datos DEMO · ~0,5 día

- [ ] "Transformamos nuestro barrio", 3.º ESO, 6 semanas, 5 materias
- [ ] 3-4 situaciones de aprendizaje, 12-15 actividades, sesiones, dependencias reales entre materias
- [ ] Todos los códigos con prefijo `DEMO.` y `CurriculumVersion { isDemo: true }`
- [ ] Test golden: el DEMO valida contra el esquema y no produce ningún `ERROR`

**Verificable:** `npm test` valida el conjunto DEMO completo.

#### Fase 3 · Persistencia local · ~0,5 día

- [ ] `ProjectRepository` (interfaz) + `IndexedDbProjectRepository` sobre Dexie
- [ ] Siembra del DEMO en el primer arranque
- [ ] Importar/exportar JSON con validación previa y reporte de errores legible (§29)
- [ ] Copia de seguridad automática y aviso de "última copia"

**Verificable:** exportar → borrar la base → importar → estado idéntico.

#### Fase 4 · Mapa estelar · ~1,5 días

- [ ] Cytoscape + `fcose`, instancia única, actualizaciones por lotes
- [ ] Proyección por nivel semántico (§4), color configurable por materia
- [ ] Selección: iluminar el nodo y sus aristas relevantes, atenuar el resto (§3)
- [ ] Panel lateral con detalle, desglose de contribución y navegación a nodos relacionados
- [ ] Grosor y opacidad de arista proporcionales a `weight`
- [ ] Panel de Trazabilidad accesible (§5 de este plan)

**Verificable:** al pulsar una SdA se ve el reparto por materias; al pulsar un criterio, dónde se trabaja.

#### Fase 5 · Filtros, matriz y dashboard · ~1 día

- [ ] Filtros de §22 (materia, docente, situación, semana, criterio, saber, competencia, estado, umbral de contribución)
- [ ] Matriz de contribución interdisciplinar (§6) con eje configurable
- [ ] Dashboard de §12: avance, criterios trabajados y pendientes, carga por materia, alertas
- [ ] Lista de alertas del motor de la fase 1, agrupadas por severidad

**Verificable:** "muéstrame solo conexiones por encima del 50 % en la semana 3" funciona y las tres vistas concuerdan.

#### Fase 6 · Accesibilidad y despliegue · ~0,5 día

- [ ] Auditoría de teclado completa y foco visible
- [ ] Tema de alto contraste y `prefers-reduced-motion`
- [ ] Verificación de contraste WCAG 2.2 AA sobre el tema oscuro
- [ ] Despliegue a GitHub Pages desde Actions
- [ ] `README` con capturas y guía de uso para docentes

**Verificable:** URL pública, navegable entera sin ratón.

---

### Hoja de ruta posterior

| Versión | Contenido                                                          | Secciones |
| ------- | ------------------------------------------------------------------ | --------- |
| v0.2    | Edición manual: CRUD, arrastrar, conectar, undo/redo               | §10       |
| v0.3    | Planificador: timeline, calendario, horarios, propuesta automática | §5, §21   |
| v0.4    | Modo "Esta semana" y tablero del proyecto                          | §12, §13  |
| v0.5    | Importador de currículo oficial andaluz + fuentes reales           | §9        |
| v0.6    | Evaluación: evidencias, instrumentos, rúbricas                     | §14       |
| v1.0    | Supabase, cuentas, roles, historial de cambios → equipo docente    | §17, §30  |
| v1.1    | Copiloto pedagógico sobre `AIProvider` con validación de esquema   | §7, §23   |
| v2.0    | Vista de alumnado                                                  | §15       |

---

## 8. Criterios de aceptación de la v0.1

La versión se considera terminada cuando:

1. Un docente abre la URL y ve el proyecto DEMO sin instalar ni configurar nada.
2. Pulsa una actividad y **entiende en menos de cinco segundos** por qué existe: a qué situación pertenece, qué criterios desarrolla, quién la ejecuta y qué depende de ella.
3. Puede exportar el proyecto, editarlo fuera e importarlo con validación estricta.
4. Recorre toda la aplicación con el teclado.
5. El grafo se mantiene fluido con 500 nodos y 1500 aristas.
6. Ningún código curricular mostrado puede confundirse con una referencia oficial real.
7. `npm run ci` está en verde y el dominio tiene cobertura de test en sus funciones puras.
