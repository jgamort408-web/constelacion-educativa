import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { projectSnapshotSchema, SCHEMA_VERSION } from '../src/domain/snapshot.ts';

/**
 * Genera el JSON Schema del proyecto a partir de los esquemas Zod (§8, ADR 0004).
 *
 * El archivo resultante NO se edita a mano y no está versionado en git: es un
 * artefacto de build. Mantener a mano un JSON Schema junto a los tipos garantiza
 * que acaben divergiendo, y una divergencia entre el validador y los tipos produce
 * el peor fallo posible: datos que TypeScript cree válidos y que en ejecución no
 * lo son.
 *
 * Este archivo es lo que consumirá el copiloto pedagógico cuando llegue, como
 * contrato de sus structured outputs, y el importador curricular.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'schema');
const OUT_FILE = join(OUT_DIR, `project.v${SCHEMA_VERSION}.json`);

const jsonSchema = z.toJSONSchema(projectSnapshotSchema, {
  target: 'draft-2020-12',
  // Los valores por defecto se representan tal cual: quien consuma el esquema
  // debe poder omitir un campo opcional y saber qué recibirá.
  io: 'input',
});

const document = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://github.com/jgamort408/constelacion-educativa/schema/project.v${SCHEMA_VERSION}.json`,
  title: 'Proyecto interdisciplinar — Constelación Educativa',
  description:
    'Formato de intercambio de un proyecto interdisciplinar completo. Generado automáticamente desde los esquemas Zod de src/domain/. No editar a mano.',
  ...jsonSchema,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

const definitionCount = Object.keys(
  (document as { $defs?: Record<string, unknown> }).$defs ?? {},
).length;

process.stdout.write(
  `JSON Schema generado en schema/project.v${SCHEMA_VERSION}.json (${definitionCount} definiciones)\n`,
);
