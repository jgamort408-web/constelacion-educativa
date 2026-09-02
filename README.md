# Constelación Educativa

Herramienta para equipos docentes de Educación Secundaria que diseñan proyectos
interdisciplinares. Convierte el proyecto —materias, situaciones de aprendizaje,
actividades, criterios de evaluación, sesiones y sus dependencias— en un **mapa estelar
navegable**, para responder de un vistazo la pregunta que ninguna programación en tabla
responde bien:

> ¿Por qué estamos haciendo esta actividad, y quién depende de ella?

**▶ [Probarla en línea](https://jgamort408-web.github.io/constelacion-educativa/)** ·
sin instalar nada, con un proyecto de ejemplo cargado.

> [!NOTE]
> v0.1 desplegada. Lo que aparece abajo ya funciona. Cómo se llegó hasta aquí está en
> [`docs/PLAN.md`](docs/PLAN.md); qué falta para que un equipo docente la use cada
> semana, en [`docs/PROPUESTA.md`](docs/PROPUESTA.md).

## Qué hace

- **Mapa estelar interactivo** con cinco niveles de zoom semántico: del proyecto completo a
  las sesiones concretas de cada materia. Pulsar un nodo enciende sus relaciones y atenúa el
  resto. Cada materia ocupa su propio territorio alrededor de las actividades, sin pisar a
  las demás; se abre a pantalla completa y se descarga como imagen.
- **Currículo acotado al curso**: se elige el curso una vez y vale para el mapa, el
  catálogo y los informes. Un docente de 1.º no ve criterios de 3.º entre los suyos.
- **Informes en texto, listos para imprimir**: el programa completo, lo que le toca a cada
  materia y **qué toca cada semana**, con sus horas, sus materiales y los avisos de lo que
  otra materia tiene que haber terminado antes. Se exporta a PDF desde el navegador.
- **Trazabilidad en ambos sentidos**: de una actividad a los criterios que desarrolla, y de
  un criterio a todas las actividades donde se trabaja. Incluye la cadena completa de
  prerrequisitos.
- **Matriz de contribución interdisciplinar**: cuánto aporta cada materia a cada situación,
  y el desglose factor a factor de cómo sale ese porcentaje. Un valor fijado por el equipo
  docente nunca se sobrescribe.
- **Detección de problemas**: dependencias imposibles, ciclos, criterios sin instrumento de
  evaluación, semanas sobrecargadas. Separadas en errores, advertencias y sugerencias.
- **Edición con deshacer**: crear, modificar y borrar, en transacciones que se aplican
  enteras o no se aplican.
- **Todo en tu navegador**: sin cuentas, sin servidor y sin que ningún dato salga de tu
  equipo.

## Accesibilidad

No es un añadido al final: el grafo se dibuja sobre un `<canvas>`, que para un lector de
pantalla es un rectángulo vacío. Por eso el **panel de trazabilidad** expone exactamente los
mismos nodos y relaciones como un árbol navegable, leyendo del mismo estado.

- Toda la aplicación se recorre con el teclado, con enlace para saltar la navegación.
- Teclas `1` a `5` para cambiar de nivel del mapa.
- Modo de alto contraste, que también se aplica al grafo.
- Se respeta `prefers-reduced-motion`.
- El color nunca es el único portador de información: hay tachado, borde, grosor y etiqueta.
- Los contrastes se verifican en el CI contra WCAG 2.2 AA leyendo los colores del propio
  CSS, no de una copia. Ver [`tests/contrast.test.ts`](tests/contrast.test.ts).

## Currículo oficial, no inventado

La aplicación trae **dos currículos completos de 1.º a 3.º de ESO**, extraídos de sus
fuentes oficiales y verificados:

|                          | Andalucía · Orden de 30 de mayo de 2023 | Estado · Real Decreto 217/2022 |
| ------------------------ | --------------------------------------: | -----------------------------: |
| Competencias específicas |                                     184 |                            105 |
| Criterios de evaluación  |                                     487 |                            271 |
| Saberes básicos          |                                     590 |                            534 |
| ¿Separa por curso?       |                                      Sí |                     No, agrupa |
| ¿Codifica los saberes?   |                        Sí (`BYG.1.E.8`) |                             No |

Se elige la fuente al cargarlo, y cada elemento registra de dónde viene. **Para una
programación en un centro andaluz manda el BOJA**; el estatal sirve para trabajar fuera
de Andalucía o para comparar.

Veintisiete elementos del BOJA se importan **marcados como pendientes de validación**:
la norma los recoge, pero caen en cortes de tabla que el analizador no resuelve. Un
currículo con huecos señalados es útil; uno con huecos ocultos es una trampa.

El mapa de ambas fuentes, con sus trampas verificadas, está en
[`docs/FUENTE-CURRICULO.md`](docs/FUENTE-CURRICULO.md).

## El proyecto de ejemplo

**«El entorno que habitamos»** — 1.º de ESO, ocho semanas, dos situaciones de aprendizaje y
**las ocho materias que la Orden desarrolla para primer curso**. No es una selección: Física
y Química, Tecnología y Digitalización y Educación en Valores no aparecen porque en
Andalucía no se cursan en 1.º, y el propio catálogo importado lo confirma.

- **Cartografía sonora de nuestro barrio.** El alumnado recorre su barrio grabando cómo
  suena, mide el ruido, lo cartografía, lo dibuja y lo cuenta en público. Geografía,
  Matemáticas, Música, Plástica y Lengua.
- **Un patio que respira.** El patio como objeto de estudio y de decisión: qué vive en él,
  cuánto mide, quién lo ocupa y quién no. Biología, Matemáticas, Educación Física, Inglés y
  Lengua.

Las dos se solapan en el calendario y comparten materias, que es cuando el informe semanal
y las alertas de dependencia empiezan a valer para algo. Criterios reales de la Orden de 30
de mayo de 2023, con sus códigos citables.

## Empezar

Requiere Node 20.19 o superior.

```bash
npm install
npm run dev
```

| Comando             | Qué hace                                               |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo                                 |
| `npm run test`      | Pruebas con Vitest                                     |
| `npm run typecheck` | Comprobación de tipos                                  |
| `npm run lint`      | Análisis estático                                      |
| `npm run schema`    | Genera `schema/project.v1.json` desde los esquemas Zod |
| `npm run ci`        | Todo lo anterior, tal y como lo ejecuta el CI          |

Para regenerar los currículos, que no hace falta salvo que cambie la norma:

| Comando                          | Qué hace                                                  |
| -------------------------------- | --------------------------------------------------------- |
| `npm run importar:curriculo`     | Descarga y analiza el currículo del Estado desde educagob |
| `python scripts/boja/extraer.py` | Extrae el Anexo II del PDF del BOJA (necesita `pymupdf`)  |
| `npm run importar:andalucia`     | Valida y transforma lo extraído al modelo del proyecto    |
| `npm run generar:curriculo-demo` | Recorta el subconjunto que usa el ejemplo                 |

## Arquitectura

El principio que gobierna el código: **el dominio no depende de ningún framework.**
`src/domain/` no importa React, Dexie, Cytoscape ni Zustand, y un test lo verifica en cada
push.

```
src/
  domain/     Entidades, esquemas Zod y funciones puras. El núcleo reutilizable.
  data/       Interfaz ProjectRepository e implementación sobre IndexedDB.
  graph/      Proyección del dominio a Cytoscape: niveles, estilos, iconos, layouts.
  reports/    Proyección del dominio a texto: programa, reparto por materia, semanas.
  features/   Rebanadas verticales: map/ reports/ curriculum/ matrix/ alerts/ traceability/
  components/ Interfaz reutilizable, sin conocimiento del dominio.
  ai/         Contrato del futuro copiloto. Sin llamadas reales en la v0.1.
```

Cada carpeta lleva su propio `README.md` explicando qué puede y qué no puede vivir en ella.
Las decisiones estructurales están en [`docs/adr/`](docs/adr/).

## Un aviso sobre tus datos

El proyecto vive en el IndexedDB de tu navegador. **Limpiar los datos del sitio lo borra**,
igual que borraría cualquier otra cosa guardada por una web. Exporta a JSON con regularidad:
es la única copia que sobrevive a eso.

## Documentación

| Documento                                              | Qué cuenta                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`docs/PROPUESTA.md`](docs/PROPUESTA.md)               | **Qué falta y en qué orden.** Tres hitos hasta que un equipo docente la use cada semana |
| [`docs/PLAN.md`](docs/PLAN.md)                         | Cómo se llegó hasta aquí: las siete fases, con lo que se verificó en cada una           |
| [`docs/FUENTE-CURRICULO.md`](docs/FUENTE-CURRICULO.md) | El mapa de las dos fuentes curriculares y sus trampas                                   |
| [`docs/adr/`](docs/adr/)                               | Las decisiones estructurales, con lo que se descartó y por qué                          |
| [`docs/PROMPT-MAESTRO.md`](docs/PROMPT-MAESTRO.md)     | La especificación original de la que nace todo                                          |

Versiones legibles y compartibles:
[el plan](https://claude.ai/code/artifact/b1b69b20-ca19-44c9-836c-e7b5c2857a7f) ·
[la propuesta](https://claude.ai/code/artifact/71aeb0eb-27e4-480f-a639-505087b9b31b)

## Contribuir

El proyecto nace de la práctica docente real y las aportaciones de profesorado son
bienvenidas, especialmente en currículo, metodología y accesibilidad. Antes de abrir un PR,
`npm run ci` debe pasar en verde.

## Licencia

[MIT](LICENSE)
