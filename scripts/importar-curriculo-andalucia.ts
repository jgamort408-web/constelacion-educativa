import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  basicKnowledgeSchema,
  competencySchema,
  curriculumVersionSchema,
  evaluationCriterionSchema,
  pendingCurriculumReferenceSchema,
} from '../src/domain/curriculum.ts';
import { stableId } from '../src/utils/ids.ts';

/**
 * Importador del currículo de Andalucía (Orden de 30 de mayo de 2023).
 *
 * Toma el JSON crudo que produce `scripts/boja/extraer.py` desde el PDF del
 * BOJA, lo valida contra los esquemas del dominio y escribe el catálogo que
 * consume la aplicación.
 *
 * ── Lo que este importador NO hace ──
 * No finge que la extracción es perfecta. El Anexo II está maquetado en tablas
 * de cinco columnas partidas entre páginas, y hay un puñado de elementos que el
 * analizador no alcanza. En vez de callarlos, los registra como
 * `pendingCurriculumReference`: la entidad que la §7 creó exactamente para esto,
 * «referencias curriculares desconocidas marcadas como pendientes de
 * validación». Un currículo con cuatro huecos señalados es útil; uno con cuatro
 * huecos ocultos es una trampa.
 *
 *     python scripts/boja/extraer.py
 *     npm run importar:andalucia
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRUDO = join(RAIZ, 'scripts', 'boja', 'anexo2-crudo.json');
const SALIDA = join(RAIZ, 'public', 'curriculo');

const NORMATIVA =
  'Orden de 30 de mayo de 2023, por la que se desarrolla el currículo correspondiente a la ' +
  'etapa de Educación Secundaria Obligatoria en la Comunidad Autónoma de Andalucía ' +
  '(BOJA n.º 104, de 2 de junio de 2023). Anexo II.';

/** Cursos que nos interesan. La Orden cubre también 4.º, que queda fuera. */
const CURSOS = [1, 2, 3];

const crudoSchema = z.object({
  fuente: z.string(),
  urls: z.array(z.string()),
  anexo: z.string(),
  materias: z.array(
    z.object({
      prefijo: z.string(),
      nombre: z.string(),
      competencias: z.array(z.object({ numero: z.number(), texto: z.string() })),
      saberes: z.array(
        z.object({
          codigo: z.string(),
          curso: z.number(),
          bloque: z.string(),
          orden: z.number(),
          texto: z.string(),
        }),
      ),
      criterios: z.array(
        z.object({
          codigo: z.string(),
          competencia: z.number(),
          curso: z.number(),
          texto: z.string(),
          saberes: z.array(z.string()),
        }),
      ),
    }),
  ),
});

/** Materias que no se imparten en 1.º-3.º: la Orden las trae, nosotros no. */
const SOLO_CUARTO = new Set(['ECE', 'LAT', 'DIG', 'TEC', 'EAR', 'FOP', 'MAA', 'MAB']);

function main(): void {
  const crudo = crudoSchema.parse(JSON.parse(readFileSync(CRUDO, 'utf8')));
  const ahora = new Date().toISOString();

  const materias: { id: string; nombre: string; corto: string }[] = [];
  const versiones: unknown[] = [];
  const competencias: unknown[] = [];
  const criterios: unknown[] = [];
  const saberes: unknown[] = [];
  const pendientes: unknown[] = [];

  process.stdout.write('Importando el currículo de Andalucía (Orden de 30 de mayo de 2023)\n\n');
  process.stdout.write(
    `${'materia'.padEnd(42)}${'CE'.padStart(4)}${'crit'.padStart(6)}${'saberes'.padStart(9)}   cursos\n`,
  );
  process.stdout.write(`${'-'.repeat(84)}\n`);

  for (const materia of crudo.materias) {
    if (SOLO_CUARTO.has(materia.prefijo)) continue;

    const materiaId = stableId('andalucia:materia', materia.prefijo);
    materias.push({ id: materiaId, nombre: materia.nombre, corto: materia.prefijo });

    const versionId = stableId('andalucia:version', materia.prefijo);
    versiones.push(
      curriculumVersionSchema.parse({
        id: versionId,
        source: `BOJA · Andalucía · ${materia.nombre} · Educación Secundaria Obligatoria`,
        normativa: NORMATIVA,
        publishedAt: '2023-06-02',
        importedAt: ahora,
        version: 'orden-30-mayo-2023',
        isDemo: false,
      }),
    );

    const criteriosEnRango = materia.criterios.filter((c) => CURSOS.includes(c.curso));
    const saberesEnRango = materia.saberes.filter((s) => CURSOS.includes(s.curso));
    const cursosPresentes = [...new Set(criteriosEnRango.map((c) => c.curso))].sort();

    // Las competencias se repiten en todos los cursos de la materia: la Orden las
    // enuncia una vez y las desarrolla curso a curso. Se crea una por curso para
    // que su gradeSpan sea exacto y no un rango inventado.
    const numerosUsados = new Set(criteriosEnRango.map((c) => c.competencia));
    for (const curso of cursosPresentes) {
      for (const competencia of materia.competencias) {
        if (!numerosUsados.has(competencia.numero)) continue;
        competencias.push(
          competencySchema.parse({
            id: stableId('andalucia:ce', `${materia.prefijo}:${curso}:${competencia.numero}`),
            officialCode: `${materia.prefijo}.${curso}.${competencia.numero}`,
            name: competencia.texto.slice(0, 300),
            description: competencia.texto,
            curriculumVersionId: versionId,
            subjectId: materiaId,
            stage: 'ESO',
            // Andalucía SÍ separa por curso: el tramo es un curso suelto.
            gradeSpan: { from: curso, to: curso },
            operativeDescriptors: [],
          }),
        );
      }
    }

    // Competencias citadas por un criterio que no aparecen en la lista de la
    // materia: el analizador no las alcanzó. Se registran, no se inventan.
    const declaradas = new Set(materia.competencias.map((c) => c.numero));
    for (const numero of [...numerosUsados].sort((a, b) => a - b)) {
      if (declaradas.has(numero)) continue;
      pendientes.push(
        pendingCurriculumReferenceSchema.parse({
          id: stableId('andalucia:pend', `${materia.prefijo}:ce:${numero}`),
          citedCode: `${materia.prefijo}.CE${numero}`,
          expectedType: 'COMPETENCIA_ESPECIFICA',
          origin:
            `Anexo II · ${materia.nombre}: citada por sus criterios, texto no extraíble del PDF`.slice(
              0,
              120,
            ),
          occurrences: criteriosEnRango.filter((c) => c.competencia === numero).length,
          detectedAt: ahora,
        }),
      );
    }

    for (const criterio of criteriosEnRango) {
      criterios.push(
        evaluationCriterionSchema.parse({
          id: stableId('andalucia:crit', `${materia.prefijo}:${criterio.curso}:${criterio.codigo}`),
          officialCode: `${materia.prefijo}.${criterio.curso}.${criterio.codigo}`,
          name: criterio.texto.slice(0, 300),
          description: criterio.texto,
          curriculumVersionId: versionId,
          competencyId: stableId(
            'andalucia:ce',
            `${materia.prefijo}:${criterio.curso}:${criterio.competencia}`,
          ),
          subjectId: materiaId,
          weight: null,
        }),
      );
    }

    // Huecos en la numeración: un criterio que la Orden tiene y aquí falta.
    const porCompetencia = new Map<string, number[]>();
    for (const criterio of criteriosEnRango) {
      const clave = `${criterio.curso}:${criterio.competencia}`;
      const lista = porCompetencia.get(clave) ?? [];
      lista.push(Number(criterio.codigo.split('.')[1]));
      porCompetencia.set(clave, lista);
    }
    for (const [clave, ordenes] of porCompetencia) {
      const [curso, competencia] = clave.split(':');
      const maximo = Math.max(...ordenes);
      for (let i = 1; i <= maximo; i += 1) {
        if (ordenes.includes(i)) continue;
        pendientes.push(
          pendingCurriculumReferenceSchema.parse({
            id: stableId('andalucia:pend', `${materia.prefijo}:${clave}:${i}`),
            citedCode: `${materia.prefijo}.${curso}.${competencia}.${i}`,
            expectedType: 'CRITERIO_EVALUACION',
            origin:
              `Anexo II · ${materia.nombre} ${curso}.º: hueco en la numeración, no extraíble del PDF`.slice(
                0,
                120,
              ),
            occurrences: 1,
            detectedAt: ahora,
          }),
        );
      }
    }

    for (const saber of saberesEnRango) {
      saberes.push(
        basicKnowledgeSchema.parse({
          id: stableId('andalucia:saber', `${materia.prefijo}:${saber.codigo}`),
          // Andalucía SÍ codifica sus saberes, a diferencia del Estado. Son
          // códigos citables en una programación.
          officialCode: saber.codigo,
          name: saber.texto.slice(0, 300),
          description: saber.texto,
          curriculumVersionId: versionId,
          subjectId: materiaId,
          block: `Bloque ${saber.bloque} · ${saber.curso}.º ESO`,
        }),
      );
    }

    process.stdout.write(
      materia.nombre.padEnd(42) +
        String(materia.competencias.length).padStart(4) +
        String(criteriosEnRango.length).padStart(6) +
        `${String(saberesEnRango.length).padStart(9)}   ` +
        `${cursosPresentes.map((c) => `${c}.º`).join(', ')}\n`,
    );
  }

  process.stdout.write(
    `\nTotales 1.º-3.º: ${competencias.length} competencias · ${criterios.length} criterios · ` +
      `${saberes.length} saberes\n`,
  );

  if (pendientes.length > 0) {
    process.stdout.write(`\n${pendientes.length} elementos PENDIENTES de validación manual:\n`);
    for (const p of pendientes as { citedCode: string; origin: string }[]) {
      process.stdout.write(`  ${p.citedCode.padEnd(16)} ${p.origin.slice(0, 92)}\n`);
    }
    process.stdout.write(
      '\nSe importan igual, pero marcados. La aplicación los mostrará como pendientes\n' +
        'para que nadie dé por completo un currículo que no lo está.\n',
    );
  }

  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(
    join(SALIDA, 'eso-andalucia-orden-2023.json'),
    `${JSON.stringify(
      {
        fuente: crudo.fuente,
        normativa: NORMATIVA,
        ambito: 'Comunidad Autónoma de Andalucía. Cursos 1.º a 3.º de ESO.',
        importadoEl: ahora,
        subjects: materias,
        curriculumVersions: versiones,
        competencies: competencias,
        evaluationCriteria: criterios,
        basicKnowledge: saberes,
        pendingCurriculumReferences: pendientes,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  process.stdout.write('\nEscrito en public/curriculo/eso-andalucia-orden-2023.json\n');
}

main();
