# Fuente curricular: educagob (1.º a 3.º de ESO)

Mapa de <https://educagob.educacionfpydeportes.gob.es/curriculo.html> levantado el
1 de septiembre de 2026, verificado descargando y analizando las 15 páginas relevantes.

Es la especificación de los dos importadores: qué hay, dónde está, con qué estructura
y qué trampas tiene. Ambos están implementados y verificados; los resultados están en
§2 (Estado) y §6.2 (Andalucía).

---

## 1. Qué es esta fuente y qué NO es

educagob publica el **currículo básico del Estado**: las enseñanzas mínimas del Real
Decreto 217/2022. Es una fuente oficial, estable y citable.

**No es el currículo de Andalucía.** El propio Ministerio enlaza al andaluz desde
[su página de comunidades autónomas](https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-secundaria-obligatoria/curriculo-comunidades-autonomas.html),
y ese enlace apunta a <https://www.juntadeandalucia.es/boja/2023/90/3> — BOJA n.º 90 de
2023, la Orden de 30 de mayo de 2023.

Consecuencia práctica para una programación en un centro andaluz:

- Las **competencias específicas** y los **criterios de evaluación** del Estado se
  recogen en el currículo andaluz, normalmente con la misma numeración.
- Los **saberes básicos** andaluces **añaden y reordenan** respecto a los estatales.
- Andalucía incorpora además elementos propios que aquí no aparecen.

Por eso el importador registra la fuente en cada elemento (`CurriculumVersion`) y **no
debe presentar lo estatal como si fuera lo andaluz**. Cargar educagob es un punto de
partida honesto y verificable; sustituir el BOJA, no.

---

## 2. Alcance: 11 materias con presencia en 1.º-3.º

Las demás materias de ESO (Latín, Digitalización, Economía y Emprendimiento, Expresión
Artística, Formación y Orientación Personal y Profesional, Tecnología) **solo tienen
currículo de 4.º** y quedan fuera. Segunda Lengua Extranjera no tiene páginas de
criterios en educagob.

Base de todas las URL:

```
https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/
  menu-curriculos-basicos/ed-secundaria-obligatoria/materias/<materia>/<pagina>
```

| Materia                            | slug                      | Página de criterios                              | Cursos |  CE | Criterios | Saberes |
| ---------------------------------- | ------------------------- | ------------------------------------------------ | ------ | --: | --------: | ------: |
| Biología y Geología                | `biologia-geologia`       | `criterios-evaluacion-primer-tercer-curso.html`  | 1-2-3  |   6 |        18 |      43 |
| Educación Física                   | `educacion-fisica`        | `criterios-evaluacion-primer-segundo-curso.html` | 1-2    |   5 |        17 |      32 |
| Educación Física                   | `educacion-fisica`        | `criterios-evaluacion-tercer-cuarto-curso.html`  | 3-4    |   5 |        17 |      33 |
| Ed. Plástica, Visual y Audiovisual | `educacion-plastica-visu` | `criterios-evaluacion-primer-tercer-curso.html`  | 1-2-3  |   8 |        16 |      18 |
| Física y Química                   | `fisica-quimica`          | `criterios-eval-primer-tercer-curso.html`        | 1-2-3  |   6 |        15 |      26 |
| Geografía e Historia               | `geografia-historia`      | `criterios-eval-primer-segundo-curso.html`       | 1-2    |   9 |        30 |      43 |
| Geografía e Historia               | `geografia-historia`      | `criterios-eval-cuarto-curso.html` ⚠️            | 3-4    |   9 |        20 |      43 |
| Lengua Castellana y Literatura     | `lengua-castellana`       | `criterios-eval-primer-segundo-curso.html`       | 1-2    |  10 |        23 |      47 |
| Lengua Castellana y Literatura     | `lengua-castellana`       | `criterios-eval-tercer-cuarto-curso.html`        | 3-4    |  10 |        23 |      53 |
| Lengua Extranjera                  | `lengua-extranjera`       | `criterios-eval-primer-segundo-curso.html`       | 1-2    |   6 |        15 |      24 |
| Lengua Extranjera                  | `lengua-extranjera`       | `criterios-eval-tercer-cuarto-curso.html`        | 3-4    |   6 |        16 |      25 |
| Matemáticas                        | `matematicas`             | `criterios-evaluacion-primer-tercer-curso.html`  | 1-2-3  |  10 |        23 |      70 |
| Música                             | `musica`                  | `criterios-eval-primer-tercer-curso.html`        | 1-2-3  |   4 |        10 |      25 |
| Tecnología y Digitalización        | `tecno-digitali`          | `criterios-evaluacion-primer-tercer-curso.html`  | 1-2-3  |   7 |        15 |      27 |
| Ed. en Valores Cívicos y Éticos    | `ed-valores-civic-et`     | `criterios-evaluacion-etapa.html`                | toda   |   4 |        13 |      25 |

**Totales:** 75 competencias específicas distintas, 271 criterios de evaluación y unas
534 líneas de saberes básicos, repartidas en 15 páginas.

Cada materia tiene además `competencias-especificas.html` (el texto completo de sus
competencias, sin criterios) y `desarrollo.html` (la introducción pedagógica).
Excepción: Educación Física usa `desarrollo-edfisica.html`.

---

## 3. Estructura de una página de criterios

Todas siguen el mismo esqueleto, en HTML plano sin tablas y **sin JavaScript**: el
contenido está en el HTML servido, así que basta con descargar y analizar.

```
<h1>                    Matemáticas
                        De primer a tercer curso
<h2>                    Competencias específicas, criterios de evaluación
                        y saberes básicos: de primer a tercer curso

  Competencias específicas
    Competencia específica 1: <texto largo>
    Criterios de evaluación
      1.1. <texto>
      1.2. <texto>
    Competencia específica 2: <texto largo>
    Criterios de evaluación
      2.1. <texto>
      ...

  Saberes básicos
    A. <Bloque>
      1. <Subbloque>
        <línea de saber>
        <línea de saber>
      2. <Subbloque>
        ...
    B. <Bloque>
      ...
```

- Los **criterios** se numeran `<competencia>.<orden>` y ese código es estable: es el
  mismo que usan las programaciones.
- Los **bloques de saberes** van con letra (`A.`, `B.`…) y sus subbloques con número
  (`1.`, `2.`…). Las líneas de saber no llevan código propio: si se necesita uno para
  referenciarlas, hay que derivarlo de su posición y dejar constancia de que es
  nuestro, no de la norma.
- La codificación es UTF-8 y está declarada en el `<meta charset>`.

---

## 4. Trampas verificadas

Cada una se descubrió al comprobar el contenido real, no al leer las URL.

### 4.1 El sitio devuelve 200 en páginas que no existen

Una URL inventada como `.../geografia-historia/criterios-evaluacion-primer-tercer-curso.html`
responde **HTTP 200** con una página cuyo `<h1>` dice «Página no encontrada».

Un sondeo por código de estado da 18 de 18 correctas y **14 de ellas son falsas**. El
importador debe validar el contenido, no el código HTTP: si el `<h1>` no coincide con
el nombre de la materia esperada, la descarga ha fallado.

### 4.2 Un slug miente sobre su contenido

`geografia-historia/criterios-eval-cuarto-curso.html` se titula **«Tercer y cuarto
curso»** y contiene los criterios de ambos. Un importador que dedujera el curso del
nombre del archivo etiquetaría todo 3.º de Geografía e Historia como 4.º, o lo
descartaría por estar fuera de alcance.

**Los cursos se leen del subtítulo de la página, nunca de la URL.**

### 4.3 Dos prefijos distintos para lo mismo

Conviven `criterios-evaluacion-…` y `criterios-eval-…` sin ningún patrón. No se pueden
generar las URL: hay que descubrirlas leyendo los enlaces de la página de cada materia.

### 4.4 Una competencia sin su rótulo

Educación Plástica, Visual y Audiovisual tiene **8 competencias específicas**, pero la
segunda aparece escrita como `2. Explicar las producciones…`, sin el prefijo
«Competencia específica». Es una inconsistencia de la propia fuente.

El primer recuento manual de este mapa decía 7 porque solo buscaba el prefijo. Lo
detectó el contraste de recuentos del importador, que es exactamente para lo que está.

### 4.5 Educación Física rotula distinto

Donde el resto escribe `Competencia específica 1: …`, Educación Física escribe
solamente `1. …`. Además invierte el título: «Criterios de evaluación, competencias
específicas y saberes básicos» en lugar de «Competencias específicas, criterios de
evaluación y saberes básicos».

El analizador necesita los dos patrones, y el segundo hay que acotarlo para que no
confunda un subbloque de saberes (`1. Conteo`) con una competencia.

---

## 5. Lo que esto obligó a cambiar en el modelo

**El currículo no separa curso por curso.** Su unidad no es «3.º ESO», es un **bloque
de cursos** que varía según la materia:

- Matemáticas, Biología, Física y Química, Música, EPVA y Tecnología: 1.º-2.º-3.º juntos.
- Educación Física, Lengua, Inglés y Geografía e Historia: 1.º-2.º y 3.º-4.º.
- Educación en Valores: toda la etapa.

Es decir, **para las cuatro materias del segundo grupo es imposible separar los
criterios de 3.º de los de 4.º**: la norma no lo hace. Cualquier aplicación que
presente «los criterios de 3.º ESO de Lengua» como una lista cerrada está inventando
una división que no existe.

Hecho: `competencySchema` ya no tiene `grade: string`, tiene `gradeSpan`:

```ts
gradeSpan: { from: 1, to: 3 }   // Matemáticas (Estado)
gradeSpan: { from: 3, to: 4 }   // Lengua, tercer y cuarto curso (Estado)
gradeSpan: { from: 3, to: 3 }   // un curso suelto, como los da Andalucía
```

Y la interfaz, al filtrar por 3.º ESO, muestra los bloques que **contienen** 3.º y dice
tal cual el tramo de cada uno. Ocultarlo daría una falsa sensación de precisión.

El **saber básico** lleva su propio `gradeSpan` desde el 2 de septiembre de 2026, porque
sin él no se podía acotar el currículo por curso: Andalucía adscribe cada saber a un
curso y el Estado a un tramo, así que ambas fuentes lo saben decir. Es nulo solo cuando
la fuente calla, y **nulo no significa «todos los cursos»**: significa «no consta». Por
eso el filtro deja pasar los nulos en vez de esconderlos — esconder algo cuya adscripción
nadie ha afirmado sería inventar la norma en sentido contrario.

El **criterio de evaluación**, en cambio, no lleva curso propio: lo hereda de su
competencia. Duplicarlo permitiría que un criterio dijera 2.º mientras su competencia
dice 1.º, y esa contradicción no tiene ninguna lectura sensata. Lo resuelve
[`src/domain/scope.ts`](../src/domain/scope.ts).

---

## 6. La fuente andaluza: Orden de 30 de mayo de 2023

El enlace que da el Ministerio (<https://www.juntadeandalucia.es/boja/2023/90/3>) es el
**Decreto 102/2023**, cuyo único anexo es el perfil competencial: **no contiene el
currículo por materias**.

El currículo real está en la **Orden de 30 de mayo de 2023**, BOJA n.º 104 de 2 de junio
de 2023, entrada 36: <https://www.juntadeandalucia.es/boja/2023/104/36>. Se publica en
dos PDF que suman 535 páginas:

| Archivo                                 | Páginas | Contiene                                    |
| --------------------------------------- | ------: | ------------------------------------------- |
| `BOJA23-104-00289-9727-01_00284752.pdf` |     289 | Articulado, Anexo I y comienzo del Anexo II |
| `BOJA23-104-00246-9727-02_00284752.pdf` |     246 | Fin del Anexo II y Anexos III a X           |

**El Anexo II ocupa 256 páginas** (de la 50 del primero a la 16 del segundo) y es el que
lleva competencias específicas, criterios de evaluación y saberes básicos por materia.

### 6.1 Dos diferencias de fondo con el currículo del Estado

**Andalucía SÍ separa por curso.** Su Anexo II es una tabla con una columna por curso:
para Biología y Geología, las cabeceras son literalmente «PRIMER CURSO» y «TERCER
CURSO», cada una con sus propios saberes. Donde el Estado agrupa 1.º-2.º-3.º sin
distinguir, Andalucía distingue.

**Andalucía SÍ codifica los saberes básicos**, con un esquema propio
`MATERIA.CURSO.BLOQUE.ORDEN`:

```
BYG.1.E.8.  Valoración de la contribución de las ciencias ambientales…
BYG.3.H.2.  Medidas de prevención y tratamientos de las enfermedades infecciosas…
```

Eso son códigos citables en una programación, cosa que el currículo estatal no ofrece.
Es la razón de peso para acabar importando el andaluz.

### 6.2 Resultado de la importación

Hecha. `python scripts/boja/extraer.py` seguido de `npm run importar:andalucia` produce,
para 1.º-3.º de ESO:

|                          | Andalucía (Orden 2023) | Estado (RD 217/2022) |
| ------------------------ | ---------------------: | -------------------: |
| Competencias específicas |                    184 |                  105 |
| Criterios de evaluación  |                    487 |                  271 |
| Saberes básicos          |                    590 |                  534 |
| ¿Separa por curso?       |                     Sí |                   No |
| ¿Codifica los saberes?   |       Sí (`BYG.1.E.8`) |                   No |

Andalucía tiene casi el doble de criterios porque los desglosa curso a curso donde el
Estado agrupa. Las competencias específicas coinciden en número con las estatales en
diez de las once materias, lo que es la mejor señal de que la extracción es correcta.

**Cinco elementos quedan pendientes** y se importan marcados como
`pendingCurriculumReference`, no ocultos: `GEH.3.3.1`, `LCL.1.1.1`, `LCL.1.9.2`,
`LCL.3.7.1` y el enunciado de la competencia 2 de Tecnología y Digitalización. La norma
los recoge, pero caen en cortes de tabla que el analizador no resuelve. Un currículo con
cinco huecos señalados es útil; uno con cinco huecos ocultos es una trampa.

### 6.3 Lo que hizo difícil esta importación

Verificado probando los extractores sobre el PDF real:

- **pypdf destroza el texto.** El texto justificado sale con espacios entre letras
  («pr oc esos geológic os int ernos»). Inservible para indexar con fidelidad.
- **pymupdf extrae limpio.** Es el extractor a usar.
- **El contenido está en tablas de dos columnas cuyas celdas se parten entre páginas.**
  La detección automática de tablas de pymupdf devuelve una fila por página, no las
  filas reales: no basta con extraerlas, hay que reconstruir la correspondencia entre
  competencia, criterio y saberes recorriendo posiciones en la página.
- Cada página arrastra unas trece líneas de encabezado del boletín que hay que descartar.

No es imposible, pero **no es el mismo trabajo que el importador de educagob**: aquel
analiza HTML bien estructurado; este exige reconstruir una tabla a partir de
coordenadas, y verificar el resultado materia por materia contra el PDF.

### 6.4 Cómo conviven las dos fuentes

El modelo ya lo admite: cada elemento apunta a su `CurriculumVersion`, y `gradeSpan`
representa tanto un curso suelto (Andalucía) como un agrupamiento (Estado). Se pueden
cargar las dos y la interfaz dirá de cuál viene cada criterio.

**Para una programación en un centro andaluz manda el BOJA.** Lo estatal sirve para
empezar a trabajar y para comparar, no para citar.

---

## 7. Plan de importación

1. **Descubrir** las URL reales leyendo los enlaces de cada `<materia>.html`, sin
   generarlas.
2. **Descargar** las 15 páginas y guardarlas tal cual, con su fecha y su URL.
3. **Validar** que cada página es la esperada, comprobando el `<h1>` y el subtítulo.
4. **Analizar** competencias, criterios y saberes con los dos patrones de rótulo.
5. **Generar** un JSON conforme al esquema del proyecto, con una `CurriculumVersion`
   por materia que registre fuente, normativa (RD 217/2022), URL y fecha de descarga,
   y con `isDemo: false`.
6. **Contrastar** los recuentos con la tabla de §2. Si no cuadran, la página cambió y
   hay que revisar antes de importar nada.

El paso 6 no es opcional: una fuente web puede cambiar sin avisar, y un importador que
no compruebe lo que ha entendido acaba metiendo currículo incompleto sin que nadie se
entere.
