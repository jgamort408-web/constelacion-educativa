import type { Edge, EdgeMetadata } from './edge.ts';
import type { EdgeType, NodeType } from './enums.ts';
import type { Uuid } from './primitives.ts';
import type { ProjectSnapshot } from './snapshot.ts';
import { projectSnapshotSchema, SCHEMA_VERSION } from './snapshot.ts';

/**
 * Utilidades para construir snapshots en las pruebas.
 *
 * Solo lo usan los archivos `.test.ts`, así que no llega al paquete de producción.
 * Vive aquí y no en `tests/` porque las pruebas del dominio están junto al código
 * que prueban, y porque estos constructores son la mejor documentación de cómo se
 * ensambla un proyecto válido.
 *
 * Los identificadores son deterministas a propósito: un fallo de test debe poder
 * reproducirse, y un UUID aleatorio distinto en cada ejecución lo impide.
 */

/** UUID estable derivado de una etiqueta legible. */
export function testId(label: string): Uuid {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i += 1) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}0000`;
}

const DEFAULT_METADATA: EdgeMetadata = {
  weight: null,
  mode: 'MANUAL',
  sessions: null,
  criteriaIds: [],
  note: '',
};

export function makeEdge(
  projectId: Uuid,
  type: EdgeType,
  source: [Uuid, NodeType],
  target: [Uuid, NodeType],
  metadata: Partial<EdgeMetadata> = {},
): Edge {
  return {
    id: testId(`edge:${type}:${source[0]}:${target[0]}`),
    projectId,
    type,
    sourceId: source[0],
    sourceType: source[1],
    targetId: target[0],
    targetType: target[1],
    metadata: { ...DEFAULT_METADATA, ...metadata },
  };
}

/**
 * Un snapshot mínimo pero coherente, sobre el que las pruebas añaden lo suyo.
 *
 * Pasa por `parse` para que los valores por defecto se apliquen igual que en
 * producción: una prueba que construye el objeto a mano acaba probando una forma
 * de los datos que nunca existe en la aplicación real.
 */
export function baseSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return projectSnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-09-01T08:00:00.000Z',
    project: {
      id: testId('project'),
      title: 'Proyecto de prueba',
      description: '',
      course: '3.º ESO',
      group: '',
      startDate: '2026-10-01',
      endDate: '2026-11-15',
      nonSchoolDays: [],
      contributionWeights: {
        sessions: 0.35,
        activities: 0.25,
        criteria: 0.2,
        finalProduct: 0.1,
        assessment: 0.1,
      },
    },
    ...overrides,
  });
}

export const ids = {
  project: testId('project'),
  mat: testId('mat'),
  len: testId('len'),
  geh: testId('geh'),
  sda1: testId('sda1'),
  act1: testId('act1'),
  act2: testId('act2'),
  act3: testId('act3'),
  crit1: testId('crit1'),
  crit2: testId('crit2'),
  ses1: testId('ses1'),
  ses2: testId('ses2'),
  producto: testId('producto'),
  docente: testId('docente'),
  version: testId('version'),
  instrumento: testId('instrumento'),
} as const;
