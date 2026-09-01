import { z } from 'zod';
import type { BasicKnowledge, Competency, EvaluationCriterion, ProjectSnapshot } from '@/domain';
import {
  basicKnowledgeSchema,
  competencySchema,
  curriculumVersionSchema,
  evaluationCriterionSchema,
} from '@/domain';

/**
 * Catálogo curricular oficial.
 *
 * El JSON lo genera `npm run importar:curriculo` desde educagob y se sirve como
 * recurso estático: son 670 KB que solo se descargan cuando el docente abre el
 * catálogo, no en el primer pintado.
 *
 * Se valida al cargarlo con los mismos esquemas que usa el resto de la
 * aplicación. Un archivo servido desde `public/` puede quedar desactualizado
 * respecto al modelo tras un cambio de esquema, y es mejor enterarse con un
 * mensaje claro que con una pantalla rota.
 */

const catalogueSchema = z.object({
  fuente: z.string(),
  normativa: z.string(),
  ambito: z.string(),
  importadoEl: z.string(),
  subjects: z.array(z.object({ id: z.string(), nombre: z.string(), corto: z.string() })),
  curriculumVersions: z.array(curriculumVersionSchema),
  competencies: z.array(competencySchema),
  evaluationCriteria: z.array(evaluationCriterionSchema),
  basicKnowledge: z.array(basicKnowledgeSchema),
});

export type CurriculumCatalogue = z.infer<typeof catalogueSchema>;

/** Ruta del catálogo, respetando el `base` con que se haya construido la app. */
const RUTA = `${import.meta.env.BASE_URL}curriculo/eso-estado-rd217-2022.json`;

let cache: CurriculumCatalogue | null = null;

export async function loadCatalogue(): Promise<CurriculumCatalogue> {
  if (cache) return cache;

  const respuesta = await fetch(RUTA);
  if (!respuesta.ok) {
    throw new Error(
      `No se pudo cargar el catálogo curricular (HTTP ${respuesta.status}). ` +
        'Ejecuta «npm run importar:curriculo» para generarlo.',
    );
  }

  const crudo: unknown = await respuesta.json();
  const resultado = catalogueSchema.safeParse(crudo);
  if (!resultado.success) {
    throw new Error(
      'El catálogo curricular no cumple el modelo actual. Vuelve a generarlo con ' +
        '«npm run importar:curriculo». Primer problema: ' +
        (resultado.error.issues[0]?.message ?? 'desconocido'),
    );
  }

  cache = resultado.data;
  return cache;
}

/**
 * Empareja las materias del catálogo con las del proyecto.
 *
 * El catálogo trae sus propios identificadores de materia; el proyecto tiene los
 * suyos. Se emparejan **por nombre normalizado**, que es lo único que comparten.
 *
 * Lo que no case se devuelve aparte en vez de descartarse en silencio: si un
 * equipo llama «Matemáticas Académicas» a su materia, el docente tiene que ver
 * que su currículo no se ha enlazado, no encontrarse una lista vacía sin
 * explicación.
 */
export interface SubjectMatch {
  /** Identificador del catálogo → identificador en el proyecto. */
  readonly mapping: ReadonlyMap<string, string>;
  /** Materias del proyecto sin equivalente en el catálogo. */
  readonly unmatchedProject: readonly string[];
  /** Materias del catálogo que el proyecto no usa. */
  readonly unusedCatalogue: readonly string[];
}

/**
 * Nombres con los que un equipo docente llama a una materia del currículo.
 *
 * No es una comodidad: el currículo estatal dice «Lengua Extranjera» y en un
 * claustro nadie la llama así, la llaman Inglés o Francés. Sin esta tabla, la
 * materia con más horas del proyecto se quedaría sin sus criterios y el docente
 * solo vería un aviso que no sabría cómo resolver.
 *
 * Cada alias apunta al nombre EXACTO del catálogo. Ampliarla es seguro; lo que no
 * se puede es adivinar por parecido, porque «Tecnología» y «Tecnología y
 * Digitalización» son dos materias distintas del currículo, no la misma escrita
 * de dos formas.
 */
const ALIAS: Record<string, string> = {
  ingles: 'Lengua Extranjera',
  'lengua extranjera ingles': 'Lengua Extranjera',
  frances: 'Lengua Extranjera',
  aleman: 'Lengua Extranjera',
  lengua: 'Lengua Castellana y Literatura',
  'lengua castellana': 'Lengua Castellana y Literatura',
  'lengua y literatura': 'Lengua Castellana y Literatura',
  geografia: 'Geografía e Historia',
  historia: 'Geografía e Historia',
  'geografia e historia': 'Geografía e Historia',
  matematicas: 'Matemáticas',
  biologia: 'Biología y Geología',
  'biologia y geologia': 'Biología y Geología',
  'fisica y quimica': 'Física y Química',
  musica: 'Música',
  'educacion fisica': 'Educación Física',
  plastica: 'Educación Plástica, Visual y Audiovisual',
  'educacion plastica': 'Educación Plástica, Visual y Audiovisual',
  epva: 'Educación Plástica, Visual y Audiovisual',
  'tecnologia y digitalizacion': 'Tecnología y Digitalización',
  valores: 'Educación en Valores Cívicos y Éticos',
  'valores civicos y eticos': 'Educación en Valores Cívicos y Éticos',
};

function normalizar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchSubjects(
  catalogue: CurriculumCatalogue,
  snapshot: ProjectSnapshot,
): SubjectMatch {
  const porNombre = new Map(catalogue.subjects.map((m) => [normalizar(m.nombre), m]));
  const mapping = new Map<string, string>();
  const unmatchedProject: string[] = [];
  const usados = new Set<string>();

  for (const materia of snapshot.subjects) {
    const clave = normalizar(materia.name);
    const alias = ALIAS[clave];
    const candidato =
      porNombre.get(clave) ?? (alias ? porNombre.get(normalizar(alias)) : undefined);
    if (candidato) {
      mapping.set(candidato.id, materia.id);
      usados.add(candidato.id);
    } else {
      unmatchedProject.push(materia.name);
    }
  }

  return {
    mapping,
    unmatchedProject,
    unusedCatalogue: catalogue.subjects.filter((m) => !usados.has(m.id)).map((m) => m.nombre),
  };
}

/**
 * Reescribe los elementos del catálogo con los identificadores del proyecto.
 *
 * Solo se traen los de las materias emparejadas. Traer el resto llenaría el
 * proyecto de criterios de materias que no participan en él, y el cálculo de
 * contribución de la §20 los contaría como criterios «no trabajados».
 */
export interface AdoptedCurriculum {
  readonly competencies: readonly Competency[];
  readonly evaluationCriteria: readonly EvaluationCriterion[];
  readonly basicKnowledge: readonly BasicKnowledge[];
  readonly versions: CurriculumCatalogue['curriculumVersions'];
}

export function adoptForProject(
  catalogue: CurriculumCatalogue,
  match: SubjectMatch,
): AdoptedCurriculum {
  const traducir = (subjectId: string): string | null => match.mapping.get(subjectId) ?? null;

  const competencies = catalogue.competencies.flatMap((competencia) => {
    const subjectId = traducir(competencia.subjectId);
    return subjectId ? [{ ...competencia, subjectId }] : [];
  });

  const evaluationCriteria = catalogue.evaluationCriteria.flatMap((criterio) => {
    const subjectId = traducir(criterio.subjectId);
    return subjectId ? [{ ...criterio, subjectId }] : [];
  });

  const basicKnowledge = catalogue.basicKnowledge.flatMap((saber) => {
    const subjectId = traducir(saber.subjectId);
    return subjectId ? [{ ...saber, subjectId }] : [];
  });

  const versionesUsadas = new Set([
    ...competencies.map((c) => c.curriculumVersionId),
    ...evaluationCriteria.map((c) => c.curriculumVersionId),
    ...basicKnowledge.map((c) => c.curriculumVersionId),
  ]);

  return {
    competencies,
    evaluationCriteria,
    basicKnowledge,
    versions: catalogue.curriculumVersions.filter((v) => versionesUsadas.has(v.id)),
  };
}
