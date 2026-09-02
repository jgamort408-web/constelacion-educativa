import { buildDemoSnapshot } from '../src/data/demo/ejemplo.ts';
import {
  buildContributionMatrix,
  summarizeFindings,
  validateSnapshot,
} from '../src/domain/index.ts';

/** Utilidad de diagnóstico: resume el proyecto DEMO por consola. No forma parte de la app. */
const s = buildDemoSnapshot();
const nodes =
  s.subjects.length +
  s.activities.length +
  s.learningSituations.length +
  s.sessions.length +
  s.evaluationCriteria.length +
  s.basicKnowledge.length +
  s.competencies.length +
  s.teachers.length +
  s.milestones.length +
  s.finalProducts.length +
  1;

console.log(`nodos: ${nodes}   aristas: ${s.edges.length}   sesiones: ${s.sessions.length}`);
console.log('alertas:', JSON.stringify(summarizeFindings(validateSnapshot(s))));

const matrix = buildContributionMatrix(
  s,
  s.learningSituations.map((x) => x.id),
);
console.log('\nMatriz de contribución (materia x situación):');
console.log(
  'materia'.padEnd(34) + s.learningSituations.map((_, i) => `SdA${i + 1}`.padStart(7)).join(''),
);
for (const subject of s.subjects) {
  const row = s.learningSituations
    .map((sit) =>
      `${Math.round((matrix.get(subject.id)?.get(sit.id)?.total ?? 0) * 100)}%`.padStart(7),
    )
    .join('');
  console.log(subject.name.padEnd(34) + row);
}

console.log('\nAlertas del ejemplo:');
for (const f of validateSnapshot(s).slice(0, 6)) console.log(`  [${f.severity}] ${f.message}`);
