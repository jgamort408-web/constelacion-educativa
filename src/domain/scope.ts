import type { BasicKnowledge, Competency, EvaluationCriterion, GradeSpan } from './curriculum.ts';
import { spanIncludes } from './curriculum.ts';
import type { Uuid } from './primitives.ts';
import type { ProjectSnapshot } from './snapshot.ts';

/**
 * Acotación del currículo por curso.
 *
 * Un catálogo completo de la ESO tiene casi quinientos criterios. Un docente de
 * 1.º no necesita ver ni uno solo de los otros cursos: para él son ruido con
 * apariencia de norma, y peor aún, ruido citable. Este módulo responde a una sola
 * pregunta —¿de qué curso es este elemento?— y la responde igual para el mapa,
 * para el panel de currículo y para los informes, que es lo que impide que tres
 * vistas acoten de tres maneras distintas.
 *
 * ── Dónde vive el curso, y por qué no está donde parecería ──
 * La `Competency` lleva `gradeSpan` porque ambas fuentes lo afirman. El criterio
 * NO lo lleva: cuelga de una competencia y hereda el suyo. Duplicarlo permitiría
 * que un criterio dijera 2.º mientras su competencia dice 1.º, y no hay ninguna
 * lectura sensata de esa contradicción.
 */

/**
 * Si un elemento con este tramo debe verse al mirar un curso.
 *
 * Un tramo desconocido pasa el filtro. Esa asimetría es deliberada: esconder algo
 * porque no consta a qué curso pertenece es afirmar que pertenece a otro, y eso
 * no lo dice ninguna norma (§9).
 */
export function inGrade(span: GradeSpan | null, grade: number | null): boolean {
  if (grade === null) return true;
  if (span === null) return true;
  return spanIncludes(span, grade);
}

/** El tramo de cursos de un criterio: el de su competencia. */
export function criterionSpan(
  snapshot: ProjectSnapshot,
  criterion: EvaluationCriterion,
): GradeSpan | null {
  const competency = snapshot.competencies.find(
    (candidate) => candidate.id === criterion.competencyId,
  );
  return competency?.gradeSpan ?? null;
}

/** Índice criterio → tramo, para no recorrer las competencias en cada consulta. */
export function criterionSpans(snapshot: ProjectSnapshot): Map<Uuid, GradeSpan | null> {
  const byCompetency = new Map(snapshot.competencies.map((c) => [c.id, c.gradeSpan]));
  return new Map(
    snapshot.evaluationCriteria.map((criterion) => [
      criterion.id,
      byCompetency.get(criterion.competencyId) ?? null,
    ]),
  );
}

/**
 * Los cursos que el currículo cargado cubre, en orden.
 *
 * Sale de las competencias, que son las que lo afirman. Sirve para construir el
 * selector de curso sin cablearlo a «1, 2, 3»: si algún día se importa 4.º, el
 * selector lo ofrece solo.
 */
export function gradesPresent(snapshot: ProjectSnapshot): number[] {
  const grades = new Set<number>();
  for (const competency of snapshot.competencies) {
    for (let grade = competency.gradeSpan.from; grade <= competency.gradeSpan.to; grade += 1) {
      grades.add(grade);
    }
  }
  return [...grades].sort((a, b) => a - b);
}

export interface CurriculumScope {
  readonly grade: number | null;
  readonly competencies: readonly Competency[];
  readonly criteria: readonly EvaluationCriterion[];
  readonly knowledge: readonly BasicKnowledge[];
  /** Saberes que pasaron el filtro por no constar su curso. Se avisa, no se esconde. */
  readonly knowledgeWithoutGrade: number;
}

/**
 * El currículo de un curso, ya recortado.
 *
 * Devuelve las tres colecciones a la vez porque se necesitan juntas y filtrarlas
 * por separado invita a que una vista use el criterio recortado y otra el saber
 * sin recortar.
 */
export function scopeCurriculum(
  snapshot: ProjectSnapshot,
  grade: number | null,
  subjectIds?: readonly Uuid[],
): CurriculumScope {
  const visible =
    subjectIds && subjectIds.length > 0
      ? new Set(subjectIds)
      : new Set(snapshot.subjects.map((subject) => subject.id));

  const competencies = snapshot.competencies.filter(
    (competency) => visible.has(competency.subjectId) && inGrade(competency.gradeSpan, grade),
  );
  const competencyIds = new Set(competencies.map((competency) => competency.id));

  // El criterio se acota por su competencia, no por su propio campo: no lo tiene.
  // Uno cuya competencia no esté en el curso queda fuera aunque su materia sí lo esté.
  const criteria = snapshot.evaluationCriteria.filter(
    (criterion) => visible.has(criterion.subjectId) && competencyIds.has(criterion.competencyId),
  );

  const knowledge = snapshot.basicKnowledge.filter(
    (saber) => visible.has(saber.subjectId) && inGrade(saber.gradeSpan, grade),
  );

  return {
    grade,
    competencies,
    criteria,
    knowledge,
    knowledgeWithoutGrade:
      grade === null ? 0 : knowledge.filter((saber) => saber.gradeSpan === null).length,
  };
}
