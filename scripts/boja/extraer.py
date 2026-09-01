# -*- coding: utf-8 -*-
"""
Extractor del Anexo II de la Orden de 30 de mayo de 2023 (currículo de ESO en
Andalucía), BOJA n.º 104 de 2 de junio de 2023.

Por qué esto es Python y no TypeScript, como el resto del proyecto: la
extracción fiable de este PDF exige PyMuPDF. Se probaron las alternativas y
pypdf devuelve el texto justificado con espacios entre letras
("pr oc esos geológic os"), que es inservible para indexar con fidelidad.

Esto es una tubería de datos que se ejecuta a mano de vez en cuando, no parte de
la aplicación: quien use Constelación Educativa no necesita Python. La salida es
un JSON crudo que después valida y transforma `scripts/importar-curriculo-andalucia.ts`
con los esquemas del dominio.

    pip install pymupdf
    python scripts/boja/extraer.py

Estructura del Anexo II, verificada sobre el PDF:

  · Sección de texto corrido con las competencias específicas de la materia,
    numeradas «1. Texto…».
  · Tabla «Saberes básicos de X curso»: una columna por curso, con el código y
    el texto íntegro de cada saber (BYG.1.E.8. Valoración de…).
  · Tabla de cinco columnas: competencias | criterios 1.º | saberes 1.º |
    criterios 3.º | saberes 3.º, donde las columnas de saberes solo llevan los
    códigos, como referencias.

El curso NO se deduce de la posición de la columna sino de los códigos de saber
que hay a su derecha: el segundo componente del código ES el curso. Es la señal
más robusta que da el documento, porque no depende de la maquetación.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit('Falta PyMuPDF. Instálalo con: pip install pymupdf')

RAIZ = Path(__file__).resolve().parents[2]
PDFS = RAIZ / '.cache' / 'boja'
SALIDA = Path(__file__).resolve().parent / 'anexo2-crudo.json'

URL_1 = 'https://www.juntadeandalucia.es/boja/2023/104/BOJA23-104-00289-9727-01_00284752.pdf'
URL_2 = 'https://www.juntadeandalucia.es/boja/2023/104/BOJA23-104-00246-9727-02_00284752.pdf'

# Materias con presencia en 1.º-3.º de ESO, con el prefijo de sus códigos de
# saber y las páginas donde aparecen. Los rangos salen de localizar los códigos
# en el PDF, no de adivinarlos.
MATERIAS = [
    ('BYG', 'Biología y Geología', 1, 52, 68),
    ('ECE', 'Economía y Emprendimiento', 1, 74, 82),  # solo 4.º, se descarta luego
    ('EFI', 'Educación Física', 1, 83, 105),
    ('EPV', 'Educación Plástica, Visual y Audiovisual', 1, 106, 117),
    ('VCE', 'Educación en Valores Cívicos y Éticos', 1, 118, 124),
    ('FYQ', 'Física y Química', 1, 129, 147),
    ('GEH', 'Geografía e Historia', 1, 155, 183),
    ('LCL', 'Lengua Castellana y Literatura', 1, 193, 223),
    ('LEX', 'Lengua Extranjera', 1, 224, 246),
    ('MAT', 'Matemáticas', 1, 247, 268),
    ('MUS', 'Música', 1, 280, 289),
    ('TYD', 'Tecnología y Digitalización', 2, 7, 17),
]

CABECERA = re.compile(
    r'^(00284752|Número 104|página 9727|Boletín Oficial|BOJABOJA|Depósito Legal|'
    r'CONSEJERÍA|INTERIOR|SIMPLIFICACIÓN|Secretaría General|AANNEEXXOO|ORGANISMO:|'
    r'Hoja \d+ de|ANEXO [IVX]+$)'
)

RE_SABER = re.compile(r'^([A-Z]{2,6})\.(\d)\.([A-Z])\.(\d+)\.\s*(.*)$')
RE_SABER_REF = re.compile(r'\b([A-Z]{2,6})\.(\d)\.([A-Z])\.(\d+)\.?')
RE_CRITERIO = re.compile(r'^(\d{1,2})\.(\d{1,2})\.\s*(.*)$')
RE_COMPETENCIA = re.compile(r'^(\d{1,2})\.\s+([A-ZÁÉÍÓÚÑ].{20,})$')
# Cabecera de columna de curso: «Biología y Geología 1º», «Matemáticas 3º».
RE_CABECERA_CURSO = re.compile(r'^(.{3,60}?)\s*(\d)\s*º\s*$')
# Epígrafe que anuncia los cursos de un bloque: «Saberes básicos de primer y
# tercer curso.». Es el respaldo para las materias cuya tabla de criterios no
# numera las columnas.
RE_EPIGRAFE = re.compile(r'^Saberes básicos(?:\s+de\s+(.+?))?\s*\.?$', re.I)
RE_COLUMNA_CRITERIOS = re.compile(r'^Criterios de evaluación\s*$')
ORDINALES = {'primer': 1, 'primero': 1, 'segundo': 2, 'tercer': 3, 'tercero': 3, 'cuarto': 4}


def enunciado(texto):
    """
    Recorta el enunciado de una competencia específica.

    En LOMLOE el enunciado es UNA frase que termina en punto; después vienen
    párrafos de desarrollo pedagógico que no forman parte de la competencia. Sin
    este corte, la primera competencia de cada materia se llevaba también toda su
    explicación: textos de miles de caracteres que el esquema rechaza y que, peor
    aún, no son lo que dice la norma.
    """
    for casa in re.finditer(r'\.(?=\s|$)', texto):
        fin = casa.end()
        if fin > 80:
            return texto[:fin].strip()
    return texto[:600].strip()


def normalizar(texto):
    """El texto justificado del BOJA llega con espacios dobles y guiones de corte."""
    texto = texto.replace('­', '')
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()


def bordes_verticales(pagina):
    """Las x de las líneas verticales dibujadas: son los límites de columna."""
    xs = set()
    for dibujo in pagina.get_drawings():
        for item in dibujo['items']:
            if item[0] == 'l':
                (x0, y0), (x1, y1) = item[1], item[2]
                if abs(x0 - x1) < 1.5 and abs(y0 - y1) > 20:
                    xs.add(round(x0))
            elif item[0] == 're':
                r = item[1]
                if r.width < 2.5 and r.height > 20:
                    xs.add(round(r.x0))
    # Fusiona bordes casi coincidentes (dobles líneas del marco).
    limpio = []
    for x in sorted(xs):
        if not limpio or x - limpio[-1] > 8:
            limpio.append(x)
    return limpio


def lineas_por_columna(pagina):
    """Reparte las líneas de texto entre las columnas de la tabla."""
    cortes = bordes_verticales(pagina)
    if len(cortes) < 2:
        return []

    columnas = [[] for _ in range(len(cortes))]
    for bloque in pagina.get_text('dict')['blocks']:
        for linea in bloque.get('lines', []):
            texto = normalizar(''.join(s['text'] for s in linea['spans']))
            if len(texto) < 2 or CABECERA.match(texto):
                continue
            x0, y0 = linea['bbox'][0], linea['bbox'][1]
            indice = 0
            for i, corte in enumerate(cortes):
                if x0 >= corte - 5:
                    indice = i
            columnas[indice].append((y0, texto))

    return [sorted(c) for c in columnas]


def agrupar_con_rango(lineas, patron):
    """
    Como `agrupar`, pero devuelve también la franja vertical de cada elemento.

    Hace falta para saber qué saberes de la columna contigua pertenecen a cada
    criterio: en la tabla del Anexo II eso lo dice la FILA, y una fila es un
    rango de y. Sin esta alineación, a cada criterio se le atribuían todos los
    saberes de su página —hasta veintitrés criterios con la misma lista—, que es
    peor que no atribuir ninguno: un docente citaría saberes que la norma no
    relaciona con ese criterio.
    """
    elementos = []
    actual = None
    for y, texto in lineas:
        if patron.match(texto):
            if actual:
                elementos.append(actual)
            actual = {'y0': y, 'y1': y, 'partes': [texto]}
        elif actual is not None:
            actual['partes'].append(texto)
            actual['y1'] = y
    if actual:
        elementos.append(actual)

    for i, elemento in enumerate(elementos):
        # La fila llega hasta donde empieza la siguiente.
        elemento['hasta'] = elementos[i + 1]['y0'] if i + 1 < len(elementos) else 10_000
        elemento['texto'] = normalizar(' '.join(elemento['partes']))
    return elementos


def agrupar(lineas, patron):
    """
    Une las líneas partidas en elementos completos.

    Cada elemento empieza donde coincide `patron` y termina donde empieza el
    siguiente. El PDF corta los textos largos en muchas líneas y sin esto cada
    trozo sería un criterio distinto.
    """
    elementos = []
    actual = None
    for _, texto in lineas:
        casa = patron.match(texto)
        if casa:
            if actual:
                elementos.append(actual)
            actual = [texto]
        elif actual is not None:
            actual.append(texto)
    if actual:
        elementos.append(actual)
    return [normalizar(' '.join(partes)) for partes in elementos]


def cabeceras_de_curso(pagina, nombre):
    """
    Las cabeceras que rotulan cada columna de curso, con su posición.

    El documento las escribe explícitamente —«Biología y Geología 1º»— al
    principio de cada tabla. Es la señal más fiable que hay: deducir el curso de
    la posición de la columna falla en cuanto una página tiene un número
    distinto de bordes dibujados, y deducirlo de los saberes vecinos falla
    cuando la columna de saberes no es la contigua.
    """
    encontradas = []
    inicial = nombre.split()[0][:6].lower()
    for bloque in pagina.get_text('dict')['blocks']:
        for linea in bloque.get('lines', []):
            texto = normalizar(''.join(s['text'] for s in linea['spans']))
            casa = RE_CABECERA_CURSO.match(texto)
            if not casa or texto[0].isdigit():
                continue
            etiqueta = casa.group(1).lower()
            # Acepta el nombre de la materia o el rótulo genérico de la columna.
            if inicial in etiqueta or etiqueta.startswith('criterios'):
                encontradas.append((linea['bbox'][0], int(casa.group(2))))
    return sorted(set(encontradas))


def cursos_del_epigrafe(texto):
    """Los cursos que nombra un epígrafe: «de primer y tercer curso» → [1, 3]."""
    casa = RE_EPIGRAFE.match(texto)
    if not casa or not casa.group(1):
        return []
    return sorted({ORDINALES[p] for p in re.findall(r'[a-záéíóú]+', casa.group(1).lower()) if p in ORDINALES})


def cabeceras_sin_numerar(pagina, cursos):
    """
    Columnas «Criterios de evaluación» sin número de curso.

    Educación Plástica, Música y Valores Cívicos maquetan así su tabla. Se
    asignan de izquierda a derecha a los cursos que anunció el epígrafe de
    saberes, que es el orden en que el documento los presenta siempre.
    """
    posiciones = []
    for bloque in pagina.get_text('dict')['blocks']:
        for linea in bloque.get('lines', []):
            texto = normalizar(''.join(s['text'] for s in linea['spans']))
            if RE_COLUMNA_CRITERIOS.match(texto):
                posiciones.append(linea['bbox'][0])
    posiciones = sorted(set(posiciones))
    if not posiciones or not cursos:
        return []
    return [(x, cursos[min(i, len(cursos) - 1)]) for i, x in enumerate(posiciones)]


def indice_de_columna(x, cortes):
    """En qué columna cae una x, según los bordes dibujados."""
    indice = None
    for i, corte in enumerate(cortes):
        if x >= corte - 5:
            indice = i
    return indice


def curso_por_columna(x, cabeceras, cortes):
    """
    El curso de la cabecera que comparte columna con esta x.

    Se usa contención y no cercanía. Con «la cabecera más próxima», un criterio
    pegado al borde derecho de su columna quedaba más cerca de la cabecera de la
    columna siguiente y se le asignaba el curso equivocado: así se perdía, por
    ejemplo, el criterio 1.1 de primero de Lengua Castellana.
    """
    objetivo = indice_de_columna(x, cortes)
    if objetivo is not None:
        for cx, curso in cabeceras:
            if indice_de_columna(cx, cortes) == objetivo:
                return curso

    # Respaldo por cercanía. Hace falta para las materias cuya tabla no numera
    # las columnas (Plástica, Música, Valores): allí las cabeceras se deducen y
    # no siempre caen dentro del mismo borde dibujado que su contenido.
    mejor, distancia = None, 110
    for cx, curso in cabeceras:
        d = abs(cx - x)
        if d < distancia:
            mejor, distancia = curso, d
    return mejor


def posiciones_columna(pagina, indice, columnas):
    """Las x de las líneas asignadas a una columna, para situarla en la página."""
    cortes = bordes_verticales(pagina)
    if indice >= len(cortes):
        return []
    izquierda = cortes[indice]
    derecha = cortes[indice + 1] if indice + 1 < len(cortes) else 10_000
    salida = []
    for bloque in pagina.get_text('dict')['blocks']:
        for linea in bloque.get('lines', []):
            x0 = linea['bbox'][0]
            if izquierda - 5 <= x0 < derecha - 5:
                salida.append((x0, linea['bbox'][1]))
    return salida


def extraer_materia(documentos, prefijo, nombre, tomo, desde, hasta):
    doc = documentos[tomo]
    competencias = {}
    saberes = {}
    criterios = {}  # (curso, código) -> {texto, saberes}

    cabeceras = []  # se conserva entre páginas: la tabla continúa sin repetirlas
    cursos_bloque = []  # los que anunció el último epígrafe de saberes

    for numero in range(desde - 1, min(hasta, len(doc))):
        pagina = doc[numero]
        columnas = lineas_por_columna(pagina)

        for linea in pagina.get_text().splitlines():
            anunciados = cursos_del_epigrafe(normalizar(linea))
            if anunciados:
                cursos_bloque = anunciados

        nuevas = cabeceras_de_curso(pagina, nombre)
        if not nuevas:
            # Última red: si el epígrafe no nombra curso (Valores Cívicos dice
            # solo «Saberes básicos.»), lo dicen los códigos ya extraídos, que
            # llevan el curso dentro.
            respaldo = cursos_bloque or sorted({s['curso'] for s in saberes.values()})
            nuevas = cabeceras_sin_numerar(pagina, respaldo)
        if nuevas:
            cabeceras = nuevas

        # ── Texto corrido: competencias específicas ──────────────────────
        plano = [
            normalizar(l)
            for l in pagina.get_text().split('\n')
            if l.strip() and not CABECERA.match(l.strip())
        ]
        for elemento in agrupar([(i, t) for i, t in enumerate(plano)], RE_COMPETENCIA):
            casa = RE_COMPETENCIA.match(elemento)
            if not casa:
                continue
            n = int(casa.group(1))
            texto = enunciado(normalizar(casa.group(2)))
            # La competencia completa es la más larga que se haya visto: las
            # tablas repiten su enunciado recortado.
            if len(texto) > 60 and len(texto) > len(competencias.get(n, '')):
                competencias[n] = texto

        # ── Saberes con texto íntegro ────────────────────────────────────
        for columna in columnas:
            for elemento in agrupar(columna, RE_SABER):
                casa = RE_SABER.match(elemento)
                if not casa or casa.group(1) != prefijo:
                    continue
                codigo = f'{casa.group(1)}.{casa.group(2)}.{casa.group(3)}.{casa.group(4)}'
                texto = normalizar(casa.group(5))
                if len(texto) > len(saberes.get(codigo, {}).get('texto', '')):
                    saberes[codigo] = {
                        'codigo': codigo,
                        'curso': int(casa.group(2)),
                        'bloque': casa.group(3),
                        'orden': int(casa.group(4)),
                        'texto': texto,
                    }

        # ── Criterios, con el curso que dicta la cabecera de su columna ───
        for i, columna in enumerate(columnas):
            elementos = agrupar(columna, RE_CRITERIO)
            if not elementos:
                continue

            cortes = bordes_verticales(pagina)
            x_columna = cortes[i] + 2 if i < len(cortes) else None
            curso = curso_por_columna(x_columna, cabeceras, cortes) if x_columna is not None else None
            if curso is None:
                continue

            derecha = columnas[i + 1] if i + 1 < len(columnas) else []
            refs_derecha = [
                (y, [
                    f'{m.group(1)}.{m.group(2)}.{m.group(3)}.{m.group(4)}'
                    for m in RE_SABER_REF.finditer(t)
                    if m.group(1) == prefijo
                ])
                for y, t in derecha
            ]

            for elemento in agrupar_con_rango(columna, RE_CRITERIO):
                casa = RE_CRITERIO.match(elemento['texto'])
                if not casa:
                    continue
                codigo = f'{casa.group(1)}.{casa.group(2)}'
                texto = normalizar(casa.group(3))
                if len(texto) < 20:
                    continue

                # Solo los saberes cuya y cae dentro de la fila de este criterio.
                propios = sorted({
                    c
                    for y, cs in refs_derecha
                    if elemento['y0'] - 4 <= y < elemento['hasta'] - 4
                    for c in cs
                })

                clave = (curso, codigo)
                previo = criterios.get(clave)
                if previo is None or len(texto) > len(previo['texto']):
                    criterios[clave] = {
                        'codigo': codigo,
                        'competencia': int(casa.group(1)),
                        'curso': curso,
                        'texto': texto,
                        'saberes': propios,
                    }
                elif previo is not None and propios:
                    previo['saberes'] = sorted(set(previo['saberes']) | set(propios))

    return {
        'prefijo': prefijo,
        'nombre': nombre,
        'competencias': [
            {'numero': n, 'texto': t} for n, t in sorted(competencias.items())
        ],
        'saberes': sorted(saberes.values(), key=lambda s: (s['curso'], s['bloque'], s['orden'])),
        'criterios': sorted(criterios.values(), key=lambda c: (c['curso'], c['competencia'], c['codigo'])),
    }


def main():
    if not (PDFS / 'anexo1.pdf').exists():
        sys.exit(
            f'Faltan los PDF. Descárgalos en {PDFS}:\n'
            f'  curl -L "{URL_1}" -o "{PDFS / "anexo1.pdf"}"\n'
            f'  curl -L "{URL_2}" -o "{PDFS / "anexo2.pdf"}"'
        )

    documentos = {1: fitz.open(PDFS / 'anexo1.pdf'), 2: fitz.open(PDFS / 'anexo2.pdf')}
    resultado = []

    print(f"{'materia':<44}{'CE':>4}{'crit':>6}{'saberes':>9}   cursos")
    print('-' * 84)
    for prefijo, nombre, tomo, desde, hasta in MATERIAS:
        datos = extraer_materia(documentos, prefijo, nombre, tomo, desde, hasta)
        cursos = sorted({c['curso'] for c in datos['criterios']})
        print(
            f"{nombre:<44}{len(datos['competencias']):>4}"
            f"{len(datos['criterios']):>6}{len(datos['saberes']):>9}   "
            f"{', '.join(f'{c}.º' for c in cursos) or '—'}"
        )
        resultado.append(datos)

    SALIDA.write_text(
        json.dumps(
            {
                'fuente': 'Orden de 30 de mayo de 2023 · BOJA n.º 104 de 2 de junio de 2023',
                'urls': [URL_1, URL_2],
                'anexo': 'II · Materias comunes obligatorias y optativas',
                'materias': resultado,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding='utf-8',
    )
    print(f'\nEscrito en {SALIDA.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
