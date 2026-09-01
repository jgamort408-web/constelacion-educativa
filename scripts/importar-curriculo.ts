import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  basicKnowledgeSchema,
  competencySchema,
  curriculumVersionSchema,
  evaluationCriterionSchema,
  type GradeSpan,
} from '../src/domain/curriculum.ts';
import { stableId } from '../src/utils/ids.ts';

/**
 * Importador del currículo del Estado desde educagob.
 *
 * Ver docs/FUENTE-CURRICULO.md para el mapa de la fuente. Este archivo implementa
 * lo que allí se documentó, incluidas las cuatro trampas verificadas:
 *
 *   1. El sitio devuelve HTTP 200 en páginas inexistentes → se valida el <h1>.
 *   2. Un slug miente sobre su contenido → los cursos se leen del subtítulo.
 *   3. Conviven dos prefijos de URL → las URL se descubren, no se generan.
 *   4. Educación Física rotula distinto → dos patrones de competencia.
 *
 * Y termina contrastando los recuentos con los esperados. Ese paso no es
 * decorativo: una fuente web cambia sin avisar, y un importador que no comprueba
 * lo que ha entendido mete currículo incompleto sin que nadie se entere.
 *
 * Uso:  npm run importar:curriculo
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RAIZ, '.cache', 'educagob');
const SALIDA = join(RAIZ, 'curriculo');

const BASE =
  'https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/' +
  'menu-curriculos-basicos/ed-secundaria-obligatoria/materias';

const NORMATIVA =
  'Real Decreto 217/2022, de 29 de marzo, por el que se establece la ordenación y las ' +
  'enseñanzas mínimas de la Educación Secundaria Obligatoria (BOE de 30 de marzo de 2022).';

/** Las 11 materias con presencia en 1.º-3.º de ESO. */
interface MateriaSpec {
  slug: string;
  nombre: string;
  corto: string;
  /** Recuentos esperados por página, del mapa de docs/FUENTE-CURRICULO.md. */
  esperado: { pagina: string; span: GradeSpan; ce: number; criterios: number }[];
}

const MATERIAS: readonly MateriaSpec[] = [
  {
    slug: 'biologia-geologia',
    nombre: 'Biología y Geología',
    corto: 'BYG',
    esperado: [{ pagina: 'primer-tercer', span: { from: 1, to: 3 }, ce: 6, criterios: 18 }],
  },
  {
    slug: 'educacion-fisica',
    nombre: 'Educación Física',
    corto: 'EF',
    esperado: [
      { pagina: 'primer-segundo', span: { from: 1, to: 2 }, ce: 5, criterios: 17 },
      { pagina: 'tercer-cuarto', span: { from: 3, to: 4 }, ce: 5, criterios: 17 },
    ],
  },
  {
    slug: 'educacion-plastica-visu',
    nombre: 'Educación Plástica, Visual y Audiovisual',
    corto: 'EPVA',
    // Son 8, no 7: la fuente escribe la competencia 2 sin el prefijo
    // «Competencia específica», y el primer recuento del mapa se la saltó.
    esperado: [{ pagina: 'primer-tercer', span: { from: 1, to: 3 }, ce: 8, criterios: 16 }],
  },
  {
    slug: 'fisica-quimica',
    nombre: 'Física y Química',
    corto: 'FQ',
    esperado: [{ pagina: 'primer-tercer', span: { from: 1, to: 3 }, ce: 6, criterios: 15 }],
  },
  {
    slug: 'geografia-historia',
    nombre: 'Geografía e Historia',
    corto: 'GEH',
    esperado: [
      { pagina: 'primer-segundo', span: { from: 1, to: 2 }, ce: 9, criterios: 30 },
      // ⚠️ El slug dice «cuarto» pero la página es de tercer y cuarto curso.
      { pagina: 'cuarto', span: { from: 3, to: 4 }, ce: 9, criterios: 20 },
    ],
  },
  {
    slug: 'lengua-castellana',
    nombre: 'Lengua Castellana y Literatura',
    corto: 'LCL',
    esperado: [
      { pagina: 'primer-segundo', span: { from: 1, to: 2 }, ce: 10, criterios: 23 },
      { pagina: 'tercer-cuarto', span: { from: 3, to: 4 }, ce: 10, criterios: 23 },
    ],
  },
  {
    slug: 'lengua-extranjera',
    nombre: 'Lengua Extranjera',
    corto: 'LE',
    esperado: [
      { pagina: 'primer-segundo', span: { from: 1, to: 2 }, ce: 6, criterios: 15 },
      { pagina: 'tercer-cuarto', span: { from: 3, to: 4 }, ce: 6, criterios: 16 },
    ],
  },
  {
    slug: 'matematicas',
    nombre: 'Matemáticas',
    corto: 'MAT',
    esperado: [{ pagina: 'primer-tercer', span: { from: 1, to: 3 }, ce: 10, criterios: 23 }],
  },
  {
    slug: 'musica',
    nombre: 'Música',
    corto: 'MUS',
    esperado: [{ pagina: 'primer-tercer', span: { from: 1, to: 3 }, ce: 4, criterios: 10 }],
  },
  {
    slug: 'tecno-digitali',
    nombre: 'Tecnología y Digitalización',
    corto: 'TEC',
    esperado: [{ pagina: 'primer-tercer', span: { from: 1, to: 3 }, ce: 7, criterios: 15 }],
  },
  {
    slug: 'ed-valores-civic-et',
    nombre: 'Educación en Valores Cívicos y Éticos',
    corto: 'EVCE',
    esperado: [{ pagina: 'etapa', span: { from: 1, to: 4 }, ce: 4, criterios: 13 }],
  },
];

// ── Descarga y descubrimiento ──────────────────────────────────────────────

async function descargar(url: string, nombreCache: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const ruta = join(CACHE, nombreCache);

  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    // No estaba en caché.
  }

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar ${url}: HTTP ${respuesta.status}`);
  }
  const html = await respuesta.text();
  writeFileSync(ruta, html, 'utf8');
  return html;
}

/**
 * Descubre las URL de criterios de una materia leyendo sus enlaces.
 *
 * No se generan por patrón porque no hay patrón: conviven `criterios-evaluacion-`
 * y `criterios-eval-` sin regla (trampa 3 del mapa).
 */
function descubrirPaginas(html: string, slug: string): Map<string, string> {
  const encontradas = new Map<string, string>();
  const patron = new RegExp(
    `href="[^"]*ed-secundaria-obligatoria/materias/${slug}/(criterios[^"]+\\.html)"`,
    'g',
  );

  let match: RegExpExecArray | null;
  while ((match = patron.exec(html)) !== null) {
    const archivo = match[1];
    if (archivo === undefined) continue;
    // Clave normalizada: quita el prefijo variable y el sufijo `-curso.html`.
    const clave = archivo
      .replace(/^criterios-(evaluacion|eval)-/, '')
      .replace(/-curso\.html$/, '')
      .replace(/\.html$/, '');
    encontradas.set(clave, archivo);
  }

  return encontradas;
}

// ── Análisis ───────────────────────────────────────────────────────────────

/** Convierte el HTML en líneas de texto, que es como está estructurada la página. */
function aLineas(html: string): string[] {
  const inicio = html.indexOf('<h1>');
  let texto = html.slice(inicio === -1 ? 0 : inicio);
  texto = texto.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ');
  texto = texto.replace(/<(h[1-6]|p|li|div|td|th|tr|br)[^>]*>/g, '\n');
  texto = texto.replace(/<[^>]+>/g, '');
  texto = texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&uuml;/g, 'ü')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));

  return texto
    .split('\n')
    .map((linea) => linea.replace(/\s+/g, ' ').trim())
    .filter((linea) => linea.length > 0);
}

const RE_CE_LARGO = /^Competencia específica (\d+)\s*[:.]\s*(.+)$/;
const RE_CE_CORTO = /^(\d{1,2})\.\s+([A-ZÁÉÍÓÚÑ].{25,})$/;
const RE_CRITERIO = /^(\d{1,2})\.(\d{1,2})\.\s+(.+)$/;
const RE_BLOQUE = /^([A-H])\.\s+(\S.*)$/;
const RE_SUBBLOQUE = /^(\d{1,2})\.\s+(\S.{0,80})$/;

interface Analizado {
  materia: string;
  subtitulo: string;
  competencias: { numero: number; texto: string }[];
  criterios: { codigo: string; competencia: number; texto: string }[];
  saberes: { bloque: string; subbloque: string; texto: string }[];
}

function analizar(html: string, materiaEsperada: string): Analizado {
  const lineas = aLineas(html);

  // Trampa 1: el sitio responde 200 con «Página no encontrada».
  const titulo = lineas[0] ?? '';
  if (titulo !== materiaEsperada) {
    throw new Error(
      `La página descargada no es la esperada. <h1> dice «${titulo}» y se esperaba «${materiaEsperada}». ` +
        'Recuerda que este sitio devuelve HTTP 200 en páginas que no existen.',
    );
  }

  // Trampa 2: los cursos se leen del subtítulo, nunca de la URL.
  const subtitulo = lineas[1] ?? '';

  const inicioSaberes = lineas.findIndex((l) => /^Saberes básicos$/i.test(l));
  const zonaCriterios = inicioSaberes === -1 ? lineas : lineas.slice(0, inicioSaberes);
  const zonaSaberes = inicioSaberes === -1 ? [] : lineas.slice(inicioSaberes + 1);

  const competencias: Analizado['competencias'] = [];
  const criterios: Analizado['criterios'] = [];

  for (const linea of zonaCriterios) {
    const criterio = RE_CRITERIO.exec(linea);
    if (criterio?.[1] && criterio[2] && criterio[3]) {
      criterios.push({
        codigo: `${criterio[1]}.${criterio[2]}`,
        competencia: Number(criterio[1]),
        texto: criterio[3].trim(),
      });
      continue;
    }

    const largo = RE_CE_LARGO.exec(linea);
    if (largo?.[1] && largo[2]) {
      competencias.push({ numero: Number(largo[1]), texto: largo[2].trim() });
      continue;
    }

    // Trampa 4: Educación Física rotula «1. …» en vez de «Competencia específica 1: …».
    const corto = RE_CE_CORTO.exec(linea);
    if (corto?.[1] && corto[2]) {
      competencias.push({ numero: Number(corto[1]), texto: corto[2].trim() });
    }
  }

  const saberes: Analizado['saberes'] = [];
  let bloque = '';
  let subbloque = '';

  for (const linea of zonaSaberes) {
    const b = RE_BLOQUE.exec(linea);
    if (b?.[1] && b[2]) {
      bloque = `${b[1]}. ${b[2].trim()}`;
      subbloque = '';
      continue;
    }
    const sb = RE_SUBBLOQUE.exec(linea);
    if (sb?.[1] && sb[2] && linea.length < 90) {
      subbloque = `${sb[1]}. ${sb[2].trim()}`;
      continue;
    }
    if (linea.length > 25 && bloque) {
      saberes.push({ bloque, subbloque, texto: linea });
    }
  }

  return { materia: titulo, subtitulo, competencias, criterios, saberes };
}

// ── Programa principal ─────────────────────────────────────────────────────

interface Problema {
  materia: string;
  pagina: string;
  detalle: string;
}

async function main(): Promise<void> {
  const problemas: Problema[] = [];
  const versiones: unknown[] = [];
  const competencias: unknown[] = [];
  const criterios: unknown[] = [];
  const saberes: unknown[] = [];
  const ahora = new Date().toISOString();

  process.stdout.write('Importando currículo del Estado desde educagob\n\n');

  for (const materia of MATERIAS) {
    const portada = await descargar(`${BASE}/${materia.slug}.html`, `${materia.slug}.html`);
    const paginas = descubrirPaginas(portada, materia.slug);

    const versionId = stableId('educagob:version', materia.slug);
    versiones.push(
      curriculumVersionSchema.parse({
        id: versionId,
        source: `educagob · ${materia.nombre} · Educación Secundaria Obligatoria`,
        normativa: NORMATIVA,
        publishedAt: '2022-03-30',
        importedAt: ahora,
        version: 'rd-217-2022',
        isDemo: false,
      }),
    );

    for (const esperado of materia.esperado) {
      const archivo = paginas.get(esperado.pagina);
      if (archivo === undefined) {
        problemas.push({
          materia: materia.nombre,
          pagina: esperado.pagina,
          detalle: `No se encontró el enlace. Disponibles: ${[...paginas.keys()].join(', ')}`,
        });
        continue;
      }

      const html = await descargar(
        `${BASE}/${materia.slug}/${archivo}`,
        `${materia.slug}__${archivo}`,
      );

      let datos: Analizado;
      try {
        datos = analizar(html, materia.nombre);
      } catch (causa) {
        problemas.push({
          materia: materia.nombre,
          pagina: archivo,
          detalle: causa instanceof Error ? causa.message : String(causa),
        });
        continue;
      }

      // Contraste con lo esperado. Si no cuadra, la fuente cambió.
      if (datos.competencias.length !== esperado.ce) {
        problemas.push({
          materia: materia.nombre,
          pagina: archivo,
          detalle: `Competencias: ${datos.competencias.length}, esperadas ${esperado.ce}`,
        });
      }
      if (datos.criterios.length !== esperado.criterios) {
        problemas.push({
          materia: materia.nombre,
          pagina: archivo,
          detalle: `Criterios: ${datos.criterios.length}, esperados ${esperado.criterios}`,
        });
      }

      const materiaId = stableId('educagob:materia', materia.slug);
      const tramo = `${esperado.span.from}-${esperado.span.to}`;

      for (const ce of datos.competencias) {
        competencias.push(
          competencySchema.parse({
            id: stableId('educagob:ce', `${materia.slug}:${tramo}:${ce.numero}`),
            officialCode: `${materia.corto}.${ce.numero}`,
            name: ce.texto.slice(0, 300),
            description: ce.texto,
            curriculumVersionId: versionId,
            subjectId: materiaId,
            stage: 'ESO',
            gradeSpan: esperado.span,
            operativeDescriptors: [],
          }),
        );
      }

      for (const criterio of datos.criterios) {
        criterios.push(
          evaluationCriterionSchema.parse({
            id: stableId('educagob:crit', `${materia.slug}:${tramo}:${criterio.codigo}`),
            officialCode: `${materia.corto}.${criterio.codigo}`,
            name: criterio.texto.slice(0, 300),
            description: criterio.texto,
            curriculumVersionId: versionId,
            competencyId: stableId(
              'educagob:ce',
              `${materia.slug}:${tramo}:${criterio.competencia}`,
            ),
            subjectId: materiaId,
            weight: null,
          }),
        );
      }

      datos.saberes.forEach((saber, posicion) => {
        saberes.push(
          basicKnowledgeSchema.parse({
            id: stableId('educagob:saber', `${materia.slug}:${tramo}:${posicion}`),
            // El currículo estatal NO codifica los saberes. Se deja a null en vez
            // de inventar un código que parecería oficial (§9).
            officialCode: null,
            name: saber.texto.slice(0, 300),
            description: saber.texto,
            curriculumVersionId: versionId,
            subjectId: materiaId,
            block: saber.subbloque ? `${saber.bloque} › ${saber.subbloque}` : saber.bloque,
          }),
        );
      });

      process.stdout.write(
        `  ${materia.nombre.padEnd(40)} ${datos.subtitulo.padEnd(24)} ` +
          `${String(datos.competencias.length).padStart(3)} CE  ` +
          `${String(datos.criterios.length).padStart(3)} crit  ` +
          `${String(datos.saberes.length).padStart(3)} saberes\n`,
      );
    }
  }

  process.stdout.write(
    `\nTotales: ${competencias.length} competencias · ${criterios.length} criterios · ` +
      `${saberes.length} saberes\n`,
  );

  if (problemas.length > 0) {
    process.stdout.write('\nPROBLEMAS DETECTADOS:\n');
    for (const problema of problemas) {
      process.stdout.write(`  [${problema.materia} · ${problema.pagina}] ${problema.detalle}\n`);
    }
    process.stdout.write(
      '\nNo se ha escrito nada. Los recuentos no cuadran con docs/FUENTE-CURRICULO.md:\n' +
        'o la fuente ha cambiado, o el analizador está mal. Revisa antes de importar.\n',
    );
    process.exitCode = 1;
    return;
  }

  mkdirSync(SALIDA, { recursive: true });
  const destino = join(SALIDA, 'eso-estado-rd217-2022.json');
  writeFileSync(
    destino,
    `${JSON.stringify(
      {
        fuente: 'https://educagob.educacionfpydeportes.gob.es/',
        normativa: NORMATIVA,
        ambito: 'Estado (enseñanzas mínimas). NO es el currículo de Andalucía.',
        importadoEl: ahora,
        curriculumVersions: versiones,
        competencies: competencias,
        evaluationCriteria: criterios,
        basicKnowledge: saberes,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  process.stdout.write(`\nEscrito en curriculo/eso-estado-rd217-2022.json\n`);
}

await main();
