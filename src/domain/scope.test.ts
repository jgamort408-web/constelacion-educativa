import { describe, expect, it } from 'vitest';
import { criterionSpans, gradesPresent, inGrade, scopeCurriculum } from './scope.ts';
import { baseSnapshot, ids } from './testing.ts';

/**
 * Acotación del currículo por curso.
 *
 * Lo que aquí se prueba no es aritmética de rangos: es la regla de la §9 llevada
 * al filtro. Un elemento se esconde solo cuando la norma dice que es de otro
 * curso, nunca porque no conste de cuál es.
 */

const CE_PRIMERO = ids.crit1;
const CE_TERCERO = ids.crit2;

function conCurriculo() {
  return baseSnapshot({
    subjects: [
      {
        id: ids.mat,
        projectId: ids.project,
        name: 'Matemáticas',
        shortName: 'MAT',
        color: '#4c7ef3',
        weeklySessions: 4,
      },
      {
        id: ids.len,
        projectId: ids.project,
        name: 'Lengua',
        shortName: 'LCL',
        color: '#e0715c',
        weeklySessions: 4,
      },
    ],
    curriculumVersions: [
      {
        id: ids.version,
        source: 'Fuente de prueba',
        normativa: '',
        publishedAt: null,
        importedAt: '2026-09-01T08:00:00.000Z',
        version: '1',
        isDemo: false,
      },
    ],
    competencies: [
      {
        id: CE_PRIMERO,
        officialCode: 'MAT.1.1',
        name: 'Competencia de primero',
        description: '',
        curriculumVersionId: ids.version,
        subjectId: ids.mat,
        stage: 'ESO',
        gradeSpan: { from: 1, to: 1 },
        operativeDescriptors: [],
      },
      {
        id: CE_TERCERO,
        officialCode: 'MAT.3.1',
        name: 'Competencia de tercero',
        description: '',
        curriculumVersionId: ids.version,
        subjectId: ids.mat,
        stage: 'ESO',
        gradeSpan: { from: 3, to: 3 },
        operativeDescriptors: [],
      },
    ],
    evaluationCriteria: [
      {
        id: ids.act1,
        officialCode: 'MAT.1.1.1',
        name: 'Criterio de primero',
        description: '',
        curriculumVersionId: ids.version,
        competencyId: CE_PRIMERO,
        subjectId: ids.mat,
        weight: null,
        relatedKnowledgeCodes: [],
      },
      {
        id: ids.act2,
        officialCode: 'MAT.3.1.1',
        name: 'Criterio de tercero',
        description: '',
        curriculumVersionId: ids.version,
        competencyId: CE_TERCERO,
        subjectId: ids.mat,
        weight: null,
        relatedKnowledgeCodes: [],
      },
    ],
    basicKnowledge: [
      {
        id: ids.ses1,
        officialCode: 'MAT.1.A.1',
        name: 'Saber de primero',
        description: '',
        curriculumVersionId: ids.version,
        subjectId: ids.mat,
        block: 'Bloque A',
        gradeSpan: { from: 1, to: 1 },
      },
      {
        id: ids.ses2,
        officialCode: null,
        name: 'Saber sin curso declarado',
        description: '',
        curriculumVersionId: ids.version,
        subjectId: ids.mat,
        block: 'Bloque A',
        // Lo que deja una importación anterior a que existiera el campo, o una
        // fuente que sencillamente no adscribe sus saberes a un curso.
        gradeSpan: null,
      },
    ],
  });
}

describe('inGrade', () => {
  it('sin curso pedido, pasa todo', () => {
    expect(inGrade({ from: 3, to: 3 }, null)).toBe(true);
  });

  it('un tramo que contiene el curso pasa; uno que no, no', () => {
    expect(inGrade({ from: 1, to: 3 }, 2)).toBe(true);
    expect(inGrade({ from: 3, to: 4 }, 2)).toBe(false);
  });

  /**
   * La asimetría deliberada: «no consta» no es «de otro curso».
   *
   * Esconder un elemento cuya adscripción nadie ha afirmado sería inventar la
   * norma en sentido contrario, y eso es peor que mostrar de más.
   */
  it('un tramo desconocido pasa siempre', () => {
    expect(inGrade(null, 1)).toBe(true);
    expect(inGrade(null, 4)).toBe(true);
  });
});

describe('scopeCurriculum', () => {
  const snapshot = conCurriculo();

  it('acotar a 1.º deja fuera la competencia y el criterio de 3.º', () => {
    const ambito = scopeCurriculum(snapshot, 1);
    expect(ambito.competencies.map((c) => c.officialCode)).toEqual(['MAT.1.1']);
    expect(ambito.criteria.map((c) => c.officialCode)).toEqual(['MAT.1.1.1']);
  });

  it('sin acotar, están los dos cursos', () => {
    expect(scopeCurriculum(snapshot, null).criteria).toHaveLength(2);
  });

  it('el saber sin curso pasa el filtro y se contabiliza aparte', () => {
    const ambito = scopeCurriculum(snapshot, 1);
    expect(ambito.knowledge.map((s) => s.name)).toContain('Saber sin curso declarado');
    expect(ambito.knowledgeWithoutGrade).toBe(1);
  });

  it('filtrar por materia no arrastra el currículo de las demás', () => {
    expect(scopeCurriculum(snapshot, null, [ids.len]).criteria).toHaveLength(0);
    expect(scopeCurriculum(snapshot, null, [ids.mat]).criteria).toHaveLength(2);
  });

  /**
   * El criterio hereda el curso de su competencia.
   *
   * Si se filtrara por la materia del criterio en vez de por su competencia, uno
   * de 3.º se colaría en el ámbito de 1.º solo porque su materia sí tiene
   * criterios de primero.
   */
  it('un criterio queda fuera si su competencia queda fuera', () => {
    const spans = criterionSpans(snapshot);
    expect(spans.get(ids.act2)).toEqual({ from: 3, to: 3 });
    expect(scopeCurriculum(snapshot, 1).criteria.map((c) => c.id)).not.toContain(ids.act2);
  });
});

describe('gradesPresent', () => {
  it('enumera los cursos que el currículo cargado cubre', () => {
    expect(gradesPresent(conCurriculo())).toEqual([1, 3]);
  });

  it('un proyecto sin currículo no ofrece ningún curso', () => {
    expect(gradesPresent(baseSnapshot())).toEqual([]);
  });
});
