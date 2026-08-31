# Constelación Educativa

Herramienta para equipos docentes de Educación Secundaria que diseñan proyectos
interdisciplinares. Convierte el proyecto —materias, situaciones de aprendizaje,
actividades, criterios de evaluación, sesiones y sus dependencias— en un **mapa estelar
navegable**, para responder de un vistazo la pregunta que ninguna programación en tabla
responde bien:

> ¿Por qué estamos haciendo esta actividad, y quién depende de ella?

> [!NOTE]
> v0.1 en desarrollo. Lo que aparece abajo ya funciona; el estado por fases está en
> [`docs/PLAN.md`](docs/PLAN.md).

## Qué hace

- **Mapa estelar interactivo** con cinco niveles de zoom semántico: del proyecto completo a
  las sesiones concretas de cada materia. Pulsar un nodo enciende sus relaciones y atenúa el
  resto.
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

## Estado del currículo

La aplicación incluye un proyecto de demostración cuyos códigos curriculares llevan el
prefijo `DEMO.` y están marcados como tales en la interfaz.

**No contiene currículo oficial andaluz.** Los datos normativos se cargan mediante el
importador documentado, con su fuente, normativa y versión registradas. Ningún código
inventado puede confundirse con una referencia real del BOJA.

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

## Arquitectura

El principio que gobierna el código: **el dominio no depende de ningún framework.**
`src/domain/` no importa React, Dexie, Cytoscape ni Zustand, y un test lo verifica en cada
push.

```
src/
  domain/     Entidades, esquemas Zod y funciones puras. El núcleo reutilizable.
  data/       Interfaz ProjectRepository e implementación sobre IndexedDB.
  graph/      Proyección del dominio a Cytoscape: niveles, estilos, layouts.
  features/   Rebanadas verticales: map/ dashboard/ matrix/ editor/ io/
  components/ Interfaz reutilizable, sin conocimiento del dominio.
  ai/         Contrato del futuro copiloto. Sin llamadas reales en la v0.1.
```

Cada carpeta lleva su propio `README.md` explicando qué puede y qué no puede vivir en ella.
Las decisiones estructurales están en [`docs/adr/`](docs/adr/).

## Un aviso sobre tus datos

El proyecto vive en el IndexedDB de tu navegador. **Limpiar los datos del sitio lo borra**,
igual que borraría cualquier otra cosa guardada por una web. Exporta a JSON con regularidad:
es la única copia que sobrevive a eso.

## Contribuir

El proyecto nace de la práctica docente real y las aportaciones de profesorado son
bienvenidas, especialmente en currículo, metodología y accesibilidad. Antes de abrir un PR,
`npm run ci` debe pasar en verde.

## Licencia

[MIT](LICENSE)
