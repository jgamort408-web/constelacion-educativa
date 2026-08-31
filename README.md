# Constelación Educativa

Herramienta para equipos docentes de Educación Secundaria que diseñan proyectos
interdisciplinares. Convierte el proyecto —materias, situaciones de aprendizaje,
actividades, criterios de evaluación, sesiones y sus dependencias— en un **mapa estelar
navegable**, para responder de un vistazo la pregunta que ninguna programación en tabla
responde bien:

> ¿Por qué estamos haciendo esta actividad, y quién depende de ella?

> [!NOTE]
> En desarrollo. La v0.1 está en construcción; consulta [`docs/PLAN.md`](docs/PLAN.md) para
> el alcance y el estado de cada fase.

## Qué hace

- **Mapa estelar interactivo** con cinco niveles de zoom semántico: del proyecto completo a
  las sesiones concretas de cada materia.
- **Trazabilidad en ambos sentidos**: de una actividad al criterio de evaluación que
  desarrolla, y de un criterio a todas las actividades donde se trabaja.
- **Matriz de contribución interdisciplinar**: cuánto aporta cada materia a cada situación,
  con el desglose de cómo se ha calculado ese porcentaje.
- **Detección de problemas**: dependencias imposibles, criterios sin evaluar, semanas
  sobrecargadas.
- **Todo en tu navegador**: sin cuentas, sin servidor y sin que ningún dato salga de tu
  equipo.

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

## Contribuir

El proyecto nace de la práctica docente real y las aportaciones de profesorado son
bienvenidas, especialmente en currículo, metodología y accesibilidad. Antes de abrir un PR,
`npm run ci` debe pasar en verde.

## Licencia

[MIT](LICENSE)
