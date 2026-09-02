# Propuesta de puesta en marcha

> Versión legible y compartible: <https://claude.ai/code/artifact/71aeb0eb-27e4-480f-a639-505087b9b31b>
> Cómo se llegó hasta aquí: [PLAN.md](PLAN.md). Revisada el 2 de septiembre de 2026.

## El diagnóstico

Siete de las dieciséis secciones clave del prompt maestro están construidas y probadas.
Las nueve que faltan no son las difíciles: son las que hacen que la herramienta se pueda
usar.

**Tenemos un motor excelente y ninguna cabina.** Se puede mirar un proyecto con enorme
detalle, pero no se puede meter el propio. No hay forma de crear un proyecto, una
situación ni una actividad; lo único editable hoy es asignar un criterio a una actividad
que ya existe.

> **Al día 2 de septiembre**, media cabina está puesta: el currículo se acota por curso,
> el mapa se lee, y los informes contestan «¿qué me toca a mí?» y «¿qué toca esta
> semana?» en texto imprimible. Sigue faltando lo esencial: **meter un proyecto propio**.
> El diagnóstico de arriba no ha cambiado en lo que importa.

## Tres hitos hasta el uso real

| Hito                            | Qué cambia                                                                                                       | Esfuerzo    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------- |
| **A · Mi proyecto está dentro** | Asistente de proyecto, formularios de edición, importar y exportar desde la pantalla, copia de seguridad visible | 3-4 días    |
| **B · Lo abro el lunes**        | ~~Informe semanal (§13)~~ ✅ · falta panel de avance (§12), calendario visual y marcar la actividad como hecha   | 2 días      |
| **C · Mi equipo lo usa**        | Supabase, cuentas, roles (§17), resolución de conflictos, historial (§30)                                        | 1-2 semanas |

A y B son los que convierten esto en algo utilizable, y B ya está a medias: el informe
semanal, la exportación a PDF y la acotación por curso están hechos y probados. C es donde
aparecen los costes reales y merece su propia decisión.

**El hito A no ha avanzado nada, y sigue siendo el que bloquea todo lo demás.** Mientras no
se pueda crear un proyecto desde la pantalla, la herramienta solo sabe enseñar el ejemplo.

## La decisión sobre el trabajo en equipo

- **Supabase, plan gratuito** _(recomendada)_: 500 MB bastan para varios equipos, la
  arquitectura ya está preparada y no guardamos datos de alumnado.
- **Seguir en local, compartir por archivo**: coste cero, pero se pierde la coordinación
  en tiempo real, que es la razón de ser del producto.
- **Alojarlo en el centro**: control total, y alguien administrando un servidor.

La aplicación **no guarda ningún dato del alumnado**, por diseño (§17). Eso mantiene el
proyecto fuera del terreno delicado mientras no se decida lo contrario, y esa decisión
debe tomarse a conciencia y no por deriva.

## Sostenibilidad

Las 195 pruebas y las reglas de arquitectura que el CI hace cumplir no son burocracia:
son lo que permite que dentro de seis meses alguien cambie algo con la seguridad de que,
si rompe otra cosa, el CI lo diga antes que un equipo docente en mitad de un proyecto.

Los importadores curriculares son scripts reejecutables. Cuando cambie la norma, se
lanzan y se contrastan los recuentos.

Falta una guía de «cómo añadir una pantalla» y decidir si el proyecto se abre a
contribuciones de otros centros.

## Riesgos

| Riesgo                               | Impacto | Qué hacer                                          |
| ------------------------------------ | ------- | -------------------------------------------------- |
| Pérdida de datos en el navegador     | Crítico | Primero del hito A                                 |
| Los 27 elementos del BOJA pendientes | Alto    | Media hora de validación manual contra el PDF      |
| La fuente curricular cambia          | Medio   | Ya cubierto: los importadores contrastan recuentos |
| **Que se quede sin estrenar**        | Crítico | Cerrar el hito A y meter un proyecto real          |

## Lo que se aplaza

- **Copiloto de IA (§7)**: lo más vistoso y lo menos urgente. El problema no es producir
  contenido sino manejar el que ya hay.
- **Planificación automática (§21)**: un mes de trabajo; el calendario manual del hito B
  cubre el 90 % del valor.
- **Vista de alumnado (§15)**: es otro producto, con otro usuario y otras implicaciones
  de privacidad.
