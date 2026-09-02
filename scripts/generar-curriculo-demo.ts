import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Extrae del catálogo andaluz el subconjunto que usa el proyecto de ejemplo.
 *
 * El ejemplo trabaja con criterios REALES de la Orden de 30 de mayo de 2023, no
 * con inventados: así lo que se ve al abrir la aplicación es lo que un docente
 * andaluz va a manejar de verdad, con sus códigos citables.
 *
 * Se extrae un subconjunto y no el catálogo entero porque el ejemplo se empaqueta
 * con la aplicación: los 1,5 MB del catálogo completo pesarían en el primer
 * pintado de una pantalla que además ofrece cargarlo aparte.
 *
 *     npm run generar:curriculo-demo
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, 'public', 'curriculo', 'eso-andalucia-orden-2023.json');
const DESTINO = join(RAIZ, 'src', 'data', 'demo', 'curriculo-demo.json');

/**
 * Las materias del proyecto de ejemplo: **todas las de 1.º de ESO**.
 *
 * No es una selección: son las ocho que la Orden desarrolla para primer curso.
 * Física y Química, Tecnología y Digitalización y Educación en Valores Cívicos y
 * Éticos no aparecen porque en Andalucía no se cursan en 1.º, y el propio
 * catálogo lo confirma: no tienen ni una competencia con tramo de primer curso.
 */
const MATERIAS = ['BYG', 'EFI', 'EPV', 'GEH', 'LCL', 'LEX', 'MAT', 'MUS'];
const CURSO = 1;

interface Elemento {
  id: string;
  officialCode: string | null;
  subjectId: string;
  curriculumVersionId: string;
  gradeSpan?: { from: number; to: number } | null;
  [clave: string]: unknown;
}

interface Catalogo {
  normativa: string;
  subjects: { id: string; nombre: string; corto: string }[];
  curriculumVersions: { id: string; [clave: string]: unknown }[];
  competencies: Elemento[];
  evaluationCriteria: Elemento[];
  basicKnowledge: Elemento[];
}

const catalogo = JSON.parse(readFileSync(ORIGEN, 'utf8')) as Catalogo;

const materias = catalogo.subjects.filter((m) => MATERIAS.includes(m.corto));
const idsMateria = new Set(materias.map((m) => m.id));

const competencies = catalogo.competencies.filter(
  (c) => idsMateria.has(c.subjectId) && c.gradeSpan?.from === CURSO,
);

// El criterio no declara curso: lo hereda de su competencia. Filtrarlo por su
// propio código funcionaría en Andalucía, donde el código lo lleva dentro, pero
// se rompería con cualquier otra fuente. Se filtra por la competencia, que es
// donde el curso está afirmado de verdad.
const idsCompetencia = new Set(competencies.map((c) => c.id));
const evaluationCriteria = catalogo.evaluationCriteria.filter(
  (c) => idsMateria.has(c.subjectId) && idsCompetencia.has(c.competencyId as string),
);
const basicKnowledge = catalogo.basicKnowledge.filter(
  (c) => idsMateria.has(c.subjectId) && c.gradeSpan?.from === CURSO,
);

const versiones = new Set([
  ...competencies.map((c) => c.curriculumVersionId),
  ...evaluationCriteria.map((c) => c.curriculumVersionId),
]);

writeFileSync(
  DESTINO,
  `${JSON.stringify(
    {
      _aviso:
        'Generado por scripts/generar-curriculo-demo.ts. No editar a mano. ' +
        'Son criterios REALES de la Orden de 30 de mayo de 2023, no de demostración.',
      normativa: catalogo.normativa,
      subjects: materias,
      curriculumVersions: catalogo.curriculumVersions.filter((v) => versiones.has(v.id)),
      competencies,
      evaluationCriteria,
      basicKnowledge,
    },
    null,
    1,
  )}\n`,
  'utf8',
);

process.stdout.write(
  `Currículo del ejemplo: ${materias.length} materias · ${competencies.length} competencias · ` +
    `${evaluationCriteria.length} criterios · ${basicKnowledge.length} saberes\n` +
    `Escrito en src/data/demo/curriculo-demo.json\n`,
);
