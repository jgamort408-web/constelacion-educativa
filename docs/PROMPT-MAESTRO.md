# PROMPT MAESTRO — PLATAFORMA INTERDISCIPLINAR “MAPA ESTELAR EDUCATIVO”

Actúa simultáneamente como:

- arquitecto de software senior;
- desarrollador full-stack experto en React, TypeScript, JavaScript, HTML y CSS;
- especialista en UX/UI para aplicaciones educativas;
- experto en visualización de grafos y redes;
- especialista en bases de datos relacionales y modelos de grafos;
- experto en inteligencia artificial generativa y structured outputs JSON;
- especialista en planificación educativa y metodologías de Aprendizaje Basado en Proyectos;
- conocedor del currículo LOMLOE y de su aplicación en Andalucía.

Tu misión es diseñar y desarrollar una aplicación web denominada provisionalmente **“Constelación Educativa”**, destinada a equipos docentes de Educación Secundaria de Andalucía para diseñar, coordinar, visualizar y ejecutar proyectos interdisciplinares y situaciones de aprendizaje.

La aplicación NO debe ser únicamente una herramienta para almacenar programaciones. Su característica diferencial debe ser convertir el currículo, las situaciones de aprendizaje, las actividades, las sesiones, las materias y sus relaciones en un **mapa estelar interactivo basado en nodos y conexiones**.

## 1. OBJETIVO PEDAGÓGICO

La aplicación debe ayudar a varios profesores de un mismo equipo educativo a coordinar un proyecto interdisciplinar.

Debe permitir saber en todo momento:

- qué materias participan;
- qué profesor es responsable de cada actuación;
- qué situación de aprendizaje se está desarrollando;
- qué competencias específicas están implicadas;
- qué criterios de evaluación se están trabajando;
- qué saberes básicos se movilizan;
- mediante qué actividades;
- durante qué sesiones;
- en qué fechas;
- con qué intensidad participa cada materia;
- qué materias trabajan simultáneamente sobre un mismo objetivo;
- qué aprendizajes sirven de prerrequisito para otros;
- qué actividades dependen de actividades realizadas previamente en otra asignatura;
- qué partes del proyecto quedan todavía pendientes.

La herramienta está especialmente orientada a contextos educativos donde se pretende aumentar la motivación, implicación y resultados académicos mediante proyectos contextualizados, aprendizaje integrado, metodologías activas, productos finales significativos y una coordinación docente muy clara.

## 2. PRINCIPIO FUNDAMENTAL: EL PROYECTO COMO GRAFO

No representar la información únicamente mediante tablas.

Internamente y visualmente debe existir un grafo.

Los posibles tipos de nodos serán:

PROYECTO  
SITUACIÓN_DE_APRENDIZAJE  
MATERIA  
COMPETENCIA_ESPECÍFICA  
CRITERIO_EVALUACIÓN  
SABER_BÁSICO  
ACTIVIDAD  
SESIÓN  
PRODUCTO_FINAL  
HITO  
DOCENTE

Las relaciones deben ser también entidades explícitas.

Ejemplos:

MATERIA → participa_en → SITUACIÓN

ACTIVIDAD → desarrolla → CRITERIO

ACTIVIDAD → moviliza → SABER

CRITERIO → pertenece_a → MATERIA

ACTIVIDAD → forma_parte_de → SITUACIÓN

SESIÓN → ejecuta → ACTIVIDAD

ACTIVIDAD → depende_de → ACTIVIDAD

DOCENTE → responsable_de → ACTIVIDAD

ACTIVIDAD → contribuye_a → PRODUCTO_FINAL

MATERIA → contribuye_a → PROYECTO

Toda relación deberá admitir metadatos cuando corresponda.

Ejemplo:

{
"source": "matematicas",
"target": "actividad_07",
"type": "contribuye_a",
"weight": 0.8,
"sessions": 3,
"criteria": ["MAT.3.2.1", "MAT.3.2.2"]
}

El campo `weight` representará inicialmente una intensidad entre 0 y 1, aunque la interfaz mostrará opcionalmente el equivalente porcentual.

## 3. VISUALIZACIÓN PRINCIPAL: MAPA ESTELAR

Crear una vista gráfica visualmente impactante, pero funcional y legible.

Debe tener fondo oscuro inspirado en un mapa astronómico.

Los nodos aparecerán como estrellas o cuerpos celestes.

Cada materia tendrá un color identificativo configurable.

Las Situaciones de Aprendizaje serán nodos de mayor tamaño.

Las actividades serán nodos secundarios.

Las sesiones podrán mostrarse u ocultarse para evitar saturación visual.

Los criterios de evaluación y saberes básicos aparecerán como capas activables mediante filtros.

Las conexiones entre nodos permanecerán discretas mientras no estén seleccionadas.

Cuando el usuario pulse un nodo:

- el nodo debe iluminarse;
- deben iluminarse sus conexiones relevantes;
- debe reducirse visualmente la importancia de los nodos no relacionados;
- debe mostrarse el grado de participación de cada asignatura;
- debe aparecer un panel lateral con información detallada;
- debe poder navegar hacia nodos relacionados.

Ejemplo:

Al pulsar una Situación de Aprendizaje llamada “Recuperemos nuestro barrio” podría observarse:

Lengua → 80 %  
Matemáticas → 60 %  
Geografía e Historia → 90 %  
Tecnología → 70 %  
Inglés → 30 %

El grosor, luminosidad u opacidad de las conexiones deberá representar visualmente esta intensidad.

Al seleccionar Matemáticas, deberán iluminarse todas las situaciones, actividades, sesiones y criterios en los que participa Matemáticas.

Al seleccionar un criterio de evaluación deberán aparecer todas las actividades y situaciones donde dicho criterio se trabaja.

## 4. NIVELES DE ZOOM SEMÁNTICO

La aplicación debe disponer de varios niveles conceptuales.

Nivel 1 — GALAXIA DEL PROYECTO

Proyecto central rodeado de las materias participantes.

Nivel 2 — CONSTELACIONES

Situaciones de aprendizaje conectadas con las diferentes materias.

Nivel 3 — ACTIVIDADES

Cada situación se descompone en las actividades necesarias.

Nivel 4 — CURRÍCULO

Visualización de criterios de evaluación, competencias específicas y saberes básicos relacionados.

Nivel 5 — SESIONES

Distribución real de las actividades en sesiones y calendario.

El zoom no debe limitarse a ampliar gráficamente elementos: debe modificar el nivel de detalle mostrado.

## 5. PLANIFICADOR TEMPORAL

Crear además del mapa estelar una vista de planificación.

Debe permitir definir:

- fecha de inicio y fin del proyecto;
- número total de sesiones;
- duración de cada sesión;
- horario semanal de cada materia;
- días no lectivos;
- actividades;
- duración estimada;
- materias participantes;
- dependencias entre actividades;
- actividades simultáneas;
- productos intermedios;
- fecha objetivo del producto final.

Ejemplo:

Lunes  
08:00 Matemáticas  
10:00 Lengua

Martes  
09:00 Geografía e Historia  
12:00 Tecnología

La aplicación deberá poder utilizar dichos horarios para proponer automáticamente una temporalización realista.

Ejemplo de dependencia:

Matemáticas — analizar datos del barrio  
↓  
Geografía — interpretar indicadores  
↓  
Lengua — redactar conclusiones  
↓  
Tecnología — construir presentación interactiva

Si una actividad depende de otra que todavía no se ha realizado, el sistema deberá advertirlo.

Crear vistas:

MAPA ESTELAR  
LÍNEA TEMPORAL  
CALENDARIO  
TABLERO DEL PROYECTO  
MATRIZ CURRICULAR

Todas representan exactamente los mismos datos.

Modificar una vista debe actualizar las demás.

## 6. MATRIZ DE CONTRIBUCIÓN INTERDISCIPLINAR

Crear automáticamente una matriz:

                  SdA1   SdA2   SdA3

Matemáticas 80% 20% 70%
Lengua 60% 90% 40%
Geografía 90% 70% 60%
Tecnología 50% 60% 90%

Debe poder calcularse también por:

situación de aprendizaje;
actividad;
criterio de evaluación;
saber básico;
competencia específica;
sesión;
producto final.

Las ponderaciones podrán ser introducidas manualmente o propuestas por IA.

La IA nunca deberá modificar silenciosamente una ponderación establecida por el docente.

## 7. INTELIGENCIA ARTIFICIAL

Integrar un asistente denominado provisionalmente **“Copiloto pedagógico”**.

Debe aceptar instrucciones naturales como:

“Diseña un proyecto interdisciplinar de 6 semanas para 3.º ESO sobre la mejora del barrio en el que participen Matemáticas, Lengua, Inglés, Geografía e Historia y Tecnología.”

La IA deberá generar primero un JSON estructurado.

NO modificar directamente la base de datos a partir de texto generado libremente por el modelo.

Flujo obligatorio:

PROMPT DOCENTE
↓
MODELO IA
↓
JSON ESTRUCTURADO
↓
VALIDACIÓN CONTRA JSON SCHEMA
↓
PREVISUALIZACIÓN
↓
APROBACIÓN DOCENTE
↓
BASE DE DATOS
↓
GRAFO

La aplicación debe detectar referencias curriculares desconocidas o inexistentes y marcarlas como pendientes de validación.

Nunca inventar silenciosamente criterios de evaluación oficiales.

## 8. ESTRUCTURA JSON

Diseñar un JSON Schema formal.

Ejemplo simplificado:

{
"project": {
"id": "PROJ001",
"title": "Transformamos nuestro barrio",
"course": "3ESO",
"startDate": "2026-10-01",
"endDate": "2026-11-15",
"description": "...",
"finalProduct": "Propuesta pública de mejora del barrio"
},

"subjects": [
{
"id": "MAT",
"name": "Matemáticas",
"teacher": "Profesor/a",
"weeklySessions": 4
}
],

"learningSituations": [
{
"id": "SDA01",
"title": "Conocemos nuestro entorno",
"description": "...",
"sessions": 8,
"subjects": [
{
"subjectId": "MAT",
"contribution": 0.8
}
]
}
],

"activities": [
{
"id": "ACT01",
"learningSituationId": "SDA01",
"title": "Radiografía estadística del barrio",
"description": "...",
"estimatedSessions": 2,
"subjectIds": ["MAT", "GEH"],
"criteriaIds": [],
"knowledgeIds": [],
"dependencies": [],
"product": "Informe estadístico"
}
],

"sessions": [],

"competencies": [],

"evaluationCriteria": [],

"basicKnowledge": [],

"relationships": []
}

Mejorar considerablemente este esquema antes de implementarlo.

Utilizar UUID internamente y códigos curriculares como identificadores externos.

Separar claramente:

ID interno;
código oficial;
nombre;
descripción;
fuente normativa.

## 9. CURRÍCULO ANDALUZ

La arquitectura debe permitir almacenar el currículo oficial organizado por:

etapa;
curso;
materia;
competencia específica;
criterio de evaluación;
saber básico;
descriptor operativo cuando corresponda;
relaciones existentes entre estos elementos.

No introducir información curricular inventada.

Preparar un sistema de importación curricular independiente de la aplicación para que el currículo pueda actualizarse sin modificar el código fuente.

Registrar para cada elemento curricular:

fuente;
normativa;
fecha de incorporación;
versión.

## 10. DISEÑADOR VISUAL

Además del modo IA debe existir edición manual completa.

Permitir:

crear nodos;
arrastrarlos;
conectarlos;
editar conexiones;
cambiar ponderaciones;
duplicar actividades;
eliminar relaciones;
crear situaciones;
asignar criterios;
asignar saberes;
asignar profesores;
reordenar sesiones.

Debe existir Undo/Redo.

Toda acción importante debe poder deshacerse.

## 11. DETECCIÓN AUTOMÁTICA DE PROBLEMAS

Crear un sistema de alertas pedagógicas.

Ejemplos:

“Esta actividad utiliza el criterio X pero no tiene instrumento de evaluación asociado.”

“El criterio X aparece en 9 actividades mientras el criterio Y todavía no ha sido trabajado.”

“Tecnología necesita el resultado de la actividad ACT05 antes de la sesión prevista.”

“Esta semana Matemáticas concentra un porcentaje excesivo de sesiones del proyecto.”

“La Situación de Aprendizaje 3 no contribuye claramente al producto final.”

“Hay tres actividades previstas simultáneamente para el mismo grupo.”

“Esta actividad requiere 3 sesiones, pero solo existe una sesión disponible antes del hito.”

Distinguir siempre entre:

ERROR;
ADVERTENCIA;
SUGERENCIA IA.

## 12. PANEL DE CONTROL DEL EQUIPO DOCENTE

Crear dashboard inicial mostrando:

avance global del proyecto;
situaciones iniciadas;
situaciones completadas;
actividad prevista actualmente;
próximas actividades;
criterios trabajados;
criterios pendientes;
participación acumulada de cada materia;
carga de sesiones por asignatura;
hitos;
dependencias bloqueadas;
alertas.

Debe responder rápidamente a la pregunta:

“¿Dónde estamos ahora y qué tiene que hacer cada profesor esta semana?”

## 13. MODO “ESTA SEMANA”

Crear una vista extremadamente sencilla específicamente para uso cotidiano.

Cada docente verá:

qué tiene que realizar;
con qué grupo;
durante qué sesión;
qué actividad corresponde;
qué ocurrió previamente;
qué debe conseguir;
qué profesor continúa posteriormente;
qué materiales necesita;
qué criterio está trabajando.

Esta pantalla debe ser apta para consultarse rápidamente antes de entrar al aula.

## 14. EVALUACIÓN

Preparar el sistema para incorporar instrumentos de evaluación:

rúbricas;
listas de cotejo;
observación;
producciones;
pruebas;
portafolio;
productos finales.

Una actividad puede contribuir a uno o varios criterios.

Un criterio puede evaluarse mediante distintas evidencias.

No confundir:

actividad realizada;
evidencia obtenida;
instrumento utilizado;
criterio evaluado.

Modelarlos como entidades diferentes.

## 15. DISEÑO PARA ALUMNADO

Preparar una futura vista simplificada para alumnado.

No mostrar información técnica curricular innecesaria.

Mostrar fundamentalmente:

misión actual;
progreso;
actividades realizadas;
próximo objetivo;
producto final;
aportación individual/grupal;
logros alcanzados.

Utilizar metáfora espacial de exploración:

galaxia;
constelaciones;
misiones;
planetas;
rutas.

Evitar convertirlo en un sistema infantil.

Debe resultar atractivo también para adolescentes de 14-16 años.

## 16. ACCESIBILIDAD Y USABILIDAD

Cumplir WCAG 2.2 AA siempre que sea posible.

No utilizar únicamente colores para comunicar información.

Añadir:

texto;
iconos;
grosor;
patrones;
estados visuales.

Permitir navegación mediante teclado.

Añadir modo de alto contraste.

Respetar `prefers-reduced-motion`.

Las animaciones del mapa deben poder desactivarse.

## 17. PRIVACIDAD

Aplicar privacidad desde el diseño.

No utilizar nombres ni información sensible del alumnado para funcionalidades que no los necesiten.

Separar los datos curriculares y de planificación de posibles datos personales.

Preparar roles y permisos.

Roles iniciales:

ADMINISTRADOR;
COORDINADOR;
DOCENTE;
LECTOR.

Las funcionalidades relacionadas con IA no deberán enviar datos personales de menores si no resulta estrictamente necesario.

## 18. TECNOLOGÍA PROPUESTA

Para el MVP utilizar preferentemente:

Frontend:
React
TypeScript
Vite

Visualización:
Cytoscape.js

UI:
Tailwind CSS
componentes accesibles

Estado:
Zustand o equivalente ligero

Validación:
Zod

Backend futuro:
Supabase

Base de datos:
PostgreSQL

Autenticación:
Supabase Auth

IA:
arquitectura independiente del proveedor mediante una capa `AIProvider`.

No acoplar la aplicación directamente a un proveedor concreto de inteligencia artificial.

Implementar una interfaz aproximadamente así:

interface AIProvider {
generateProject(input): Promise<ProjectProposal>;
generateLearningSituation(input): Promise<LearningSituationProposal>;
generateActivities(input): Promise<ActivityProposal[]>;
analyzeProject(project): Promise<ProjectAnalysis>;
proposeSchedule(project): Promise<ScheduleProposal>;
}

El frontend nunca debe contener claves secretas de APIs.

## 19. MODELO DE DATOS

Diseñar correctamente las entidades antes de crear las pantallas.

Como mínimo estudiar:

Project
Subject
Teacher
LearningSituation
Activity
Session
Competency
EvaluationCriterion
BasicKnowledge
Evidence
AssessmentInstrument
Milestone
FinalProduct
Schedule
Relationship
Contribution
Dependency
CurriculumVersion

Diseñar relaciones N:M cuando corresponda.

No guardar arrays de IDs como sustitución de relaciones relacionales cuando el sistema vaya a necesitar consultar dichas asociaciones frecuentemente.

## 20. ALGORITMO DE CONTRIBUCIÓN

Diseñar un sistema transparente para determinar cuánto contribuye una materia.

No utilizar inicialmente algoritmos opacos.

Permitir tres modalidades:

MANUAL;
CALCULADA;
PROPUESTA_POR_IA.

La contribución calculada puede considerar:

número de sesiones;
número de actividades;
peso de los criterios;
responsabilidad sobre productos;
peso de la evaluación.

Mostrar siempre cómo se obtiene una puntuación.

Ejemplo:

Matemáticas: 72 %

Sesiones: 35 %
Actividades: 20 %
Criterios: 12 %
Producto final: 5 %

Los pesos del algoritmo deben ser configurables.

## 21. PLANIFICACIÓN AUTOMÁTICA

Diseñar posteriormente un motor capaz de recibir:

horarios docentes;
horario del grupo;
duración del proyecto;
sesiones disponibles;
duración de actividades;
dependencias;
fechas límite.

Y obtener una propuesta temporal válida.

Nunca sobrescribir automáticamente la planificación existente.

Mostrar:

PLAN PROPUESTO POR IA

y permitir:

ACEPTAR;
MODIFICAR;
DESCARTAR.

## 22. FILTROS DEL MAPA

Permitir filtrar por:

materia;
profesor;
situación;
actividad;
semana;
criterio;
saber;
competencia;
estado;
nivel de contribución.

Ejemplos:

“Mostrar solamente Matemáticas y Lengua.”

“Mostrar las actividades correspondientes a la semana 3.”

“Mostrar dónde aparece el criterio MAT.3.X.”

“Mostrar únicamente conexiones superiores al 50 %.”

## 23. BÚSQUEDA EN LENGUAJE NATURAL

Preparar una interfaz donde puedan escribirse preguntas como:

“¿Qué tiene que hacer Lengua la próxima semana?”

“¿Qué actividades dependen de Matemáticas?”

“¿Qué criterios todavía no hemos trabajado?”

“¿Qué materia participa menos en el proyecto?”

“¿Qué ocurriría si retrasamos esta actividad una semana?”

Cuando pueda responderse directamente mediante datos estructurados, no utilizar IA innecesariamente.

Utilizar consultas deterministas antes de recurrir al modelo generativo.

## 24. EXPERIENCIA DE USUARIO

El producto debe tener dos personalidades complementarias.

MODO PLANIFICACIÓN:
eficiente;
claro;
profesional;
orientado al profesorado.

MODO CONSTELACIÓN:
visual;
explorable;
motivador;
atractivo.

No sacrificar usabilidad para conseguir efectos visuales.

## 25. MVP

Construir inicialmente un MVP funcional.

Debe contener:

mapa estelar interactivo;
proyectos;
materias;
situaciones de aprendizaje;
actividades;
sesiones;
criterios;
saberes;
conexiones;
ponderaciones;
filtros;
panel lateral;
timeline;
dashboard;
importación/exportación JSON;
datos ficticios completos;
persistencia local.

La primera versión debe poder funcionar sin servidor mediante LocalStorage o IndexedDB.

Después se migrará la persistencia a Supabase.

## 26. DATOS DE DEMOSTRACIÓN

Crear un proyecto ficticio completo para 3.º ESO.

Tema:

“Transformamos nuestro barrio”

Materias:

Matemáticas;
Lengua Castellana;
Geografía e Historia;
Inglés;
Tecnología y Digitalización.

Crear varias situaciones de aprendizaje y aproximadamente 12-15 actividades distribuidas durante 6 semanas.

Los códigos curriculares del ejemplo deberán marcarse claramente como DEMO si no proceden de una fuente curricular oficial validada.

No inventar códigos que puedan confundirse con referencias oficiales reales.

## 27. ARQUITECTURA DEL SOFTWARE

Separar:

/domain
/data
/services
/ai
/graph
/components
/features
/hooks
/utils
/types

No introducir lógica de negocio importante dentro de componentes visuales.

Crear un dominio reutilizable para que en el futuro sea posible construir aplicaciones móvil o tablet sobre la misma lógica.

## 28. RENDIMIENTO

El grafo debe funcionar fluidamente con al menos:

500 nodos;
1500 conexiones.

Aplicar cuando sea necesario:

memoización;
virtualización;
lazy loading;
filtrado previo;
reducción del número de elementos representados.

Evitar renderizar simultáneamente información curricular irrelevante.

## 29. EXPORTACIÓN

Preparar:

exportar proyecto a JSON;
importar JSON;
validar JSON antes de importarlo;
generar informe imprimible;
exportar planificación;
exportar matriz curricular.

En versiones posteriores:

PDF;
Excel;
CSV;
iCalendar.

## 30. HISTORIAL

Preparar arquitectura para disponer de historial de cambios.

Ejemplo:

“María modificó ACT07.”
“Juan movió ACT04 de la semana 3 a la semana 4.”
“Se añadió el criterio X a ACT09.”

No es obligatorio implementar colaboración en tiempo real en el primer MVP, pero la arquitectura no debe impedirla.

## 31. PRINCIPIO DE TRAZABILIDAD

Este requisito es fundamental.

Desde cualquier actividad debe ser posible navegar:

ACTIVIDAD
→ SITUACIÓN DE APRENDIZAJE
→ MATERIA
→ COMPETENCIA ESPECÍFICA
→ CRITERIO DE EVALUACIÓN
→ SABER BÁSICO
→ SESIÓN
→ EVIDENCIA
→ PRODUCTO FINAL

Y también realizar el recorrido inverso.

La aplicación debe responder visualmente:

“¿Por qué estamos haciendo esta actividad?”

## 32. DESARROLLO

No intentes construir todas las funcionalidades simultáneamente.

Primero:

analiza los requisitos;
diseña el dominio;
diseña el JSON Schema;
diseña el modelo de datos;
define la arquitectura;
define componentes;
crea datos DEMO;
construye el grafo;
añade interacción;
añade planificación;
añade posteriormente IA.

Antes de escribir grandes cantidades de código, muestra la arquitectura propuesta y explica las decisiones técnicas importantes.

Después desarrolla el MVP por módulos funcionales.

Cada módulo deberá ser ejecutable antes de avanzar al siguiente.

## 33. CRITERIOS DE CALIDAD

El código debe ser:

modular;
tipado;
mantenible;
documentado únicamente cuando aporte valor;
accesible;
responsive;
testeable.

Evitar componentes monolíticos.

Evitar datos curriculares hardcodeados dentro de componentes.

Evitar dependencias innecesarias.

Utilizar nombres de variables y tipos semánticamente claros.

## 34. PRUEBAS

Crear tests prioritariamente para:

validación del modelo;
cálculo de contribuciones;
dependencias;
planificación temporal;
importación JSON;
detección de inconsistencias.

## 35. RESULTADO QUE DEBES ENTREGAR

Comienza tu respuesta con:

1. interpretación funcional del producto;
2. arquitectura propuesta;
3. modelo de entidades;
4. relaciones;
5. JSON Schema;
6. estructura del proyecto;
7. wireframe textual de las pantallas;
8. fases de implementación.

Después comienza la implementación del MVP.

No te limites a explicar cómo podría construirse.

Genera código funcional.

El objetivo final es obtener una aplicación real, extensible y utilizable por un equipo educativo de Secundaria.
