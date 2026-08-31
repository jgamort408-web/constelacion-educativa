import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptySnapshot, projectSnapshotSchema, SCHEMA_VERSION } from './snapshot.ts';
import { baseSnapshot, ids, makeEdge } from './testing.ts';

/**
 * El contrato de datos (§8, §29).
 *
 * Un archivo exportado debe poder volver a importarse sin pérdida, y una
 * importación inválida debe fallar con un mensaje que un docente pueda entender,
 * no con una excepción a mitad de la carga.
 */

describe('validación del snapshot', () => {
  it('acepta un proyecto mínimo válido', () => {
    expect(() => baseSnapshot()).not.toThrow();
  });

  it('aplica los valores por defecto de las colecciones ausentes', () => {
    const snapshot = baseSnapshot();
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.edges).toEqual([]);
    expect(snapshot.generatedBy).toBe('constelacion-educativa');
  });

  it('rechaza una versión de esquema que no reconoce', () => {
    const result = projectSnapshotSchema.safeParse({
      ...baseSnapshot(),
      schemaVersion: 99,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un identificador que no es UUID', () => {
    const result = projectSnapshotSchema.safeParse({
      ...baseSnapshot(),
      project: { ...baseSnapshot().project, id: 'PROJ001' },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    // El error debe señalar el campo concreto, para que la interfaz de importación
    // pueda decir "el identificador del proyecto no es válido" y no "algo falló".
    expect(z.treeifyError(result.error).properties?.project?.properties?.id?.errors).toBeDefined();
  });

  it('rechaza una intensidad fuera del rango 0..1', () => {
    const result = projectSnapshotSchema.safeParse({
      ...baseSnapshot(),
      edges: [
        makeEdge(
          ids.project,
          'participa_en',
          [ids.mat, 'MATERIA'],
          [ids.sda1, 'SITUACION_APRENDIZAJE'],
          {
            weight: 80, // porcentaje en vez de fracción: el error clásico
          },
        ),
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una fecha con formato incorrecto', () => {
    const result = projectSnapshotSchema.safeParse({
      ...baseSnapshot(),
      project: { ...baseSnapshot().project, startDate: '01/10/2026' },
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un título vacío', () => {
    const result = projectSnapshotSchema.safeParse({
      ...baseSnapshot(),
      project: { ...baseSnapshot().project, title: '   ' },
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un color que no es hexadecimal', () => {
    const result = projectSnapshotSchema.safeParse({
      ...baseSnapshot(),
      subjects: [
        {
          id: ids.mat,
          projectId: ids.project,
          name: 'Matemáticas',
          shortName: 'MAT',
          color: 'azul',
          weeklySessions: 4,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('acumula todos los errores en vez de parar en el primero', () => {
    const result = projectSnapshotSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 'ayer',
      project: { id: 'no-uuid', title: '', course: '', startDate: 'x', endDate: 'y' },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.length).toBeGreaterThan(2);
  });
});

describe('ida y vuelta por JSON', () => {
  it('un proyecto exportado se vuelve a importar idéntico', () => {
    const original = baseSnapshot({
      subjects: [
        {
          id: ids.mat,
          projectId: ids.project,
          name: 'Matemáticas',
          shortName: 'MAT',
          color: '#4c7ef3',
          weeklySessions: 4,
        },
      ],
      edges: [
        makeEdge(
          ids.project,
          'participa_en',
          [ids.mat, 'MATERIA'],
          [ids.sda1, 'SITUACION_APRENDIZAJE'],
          { weight: 0.8, mode: 'MANUAL' },
        ),
      ],
    });

    const reimported = projectSnapshotSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(reimported).toEqual(original);
  });

  it('conserva la procedencia manual de las intensidades al ir y volver', () => {
    const original = baseSnapshot({
      edges: [
        makeEdge(
          ids.project,
          'participa_en',
          [ids.mat, 'MATERIA'],
          [ids.sda1, 'SITUACION_APRENDIZAJE'],
          { weight: 0.8, mode: 'MANUAL' },
        ),
      ],
    });

    const reimported = projectSnapshotSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(reimported.edges[0]?.metadata.mode).toBe('MANUAL');
    expect(reimported.edges[0]?.metadata.weight).toBe(0.8);
  });
});

describe('emptySnapshot', () => {
  it('crea un proyecto vacío pero válido', () => {
    const snapshot = emptySnapshot(baseSnapshot().project);
    expect(snapshot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(snapshot.subjects).toEqual([]);
    expect(() => projectSnapshotSchema.parse(snapshot)).not.toThrow();
  });
});
