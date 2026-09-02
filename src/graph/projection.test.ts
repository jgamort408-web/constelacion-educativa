import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@/data/demo/ejemplo.ts';
import { highlightFor, project, SEMANTIC_LEVELS } from './projection.ts';

/**
 * La proyección es pura, así que se prueba sin navegador y sin Cytoscape.
 *
 * Eso es justo lo que se buscaba al separarla del componente: los fallos de un
 * grafo —una arista a medias, un nivel que muestra de más— son invisibles a
 * simple vista en un canvas con doscientos elementos, y aquí se detectan.
 */

const snapshot = buildDemoSnapshot();

describe('niveles semánticos', () => {
  it('cada nivel produce un conjunto distinto de nodos, no el mismo ampliado', () => {
    const counts = SEMANTIC_LEVELS.map((level) => project(snapshot, level).nodes.length);
    expect(new Set(counts).size).toBeGreaterThan(3);
  });

  it('la galaxia muestra solo el proyecto y las materias', () => {
    const { nodes } = project(snapshot, 'GALAXIA');
    expect(nodes).toHaveLength(snapshot.subjects.length + 1);
    expect(new Set(nodes.map((n) => n.type))).toEqual(new Set(['PROYECTO', 'MATERIA']));
  });

  it('cada materia se une al proyecto con su contribución calculada', () => {
    const { edges } = project(snapshot, 'GALAXIA');
    expect(edges).toHaveLength(snapshot.subjects.length);
    for (const edge of edges) {
      expect(edge.weight).toBeGreaterThanOrEqual(0);
      expect(edge.weight).toBeLessThanOrEqual(1);
      expect(edge.label).toMatch(/^\d+ %$/);
    }
  });

  it('las constelaciones añaden las situaciones de aprendizaje', () => {
    const { nodes } = project(snapshot, 'CONSTELACIONES');
    const situations = nodes.filter((n) => n.type === 'SITUACION_APRENDIZAJE');
    expect(situations).toHaveLength(snapshot.learningSituations.length);
  });

  it('el nivel de actividades incluye todas y los productos finales', () => {
    const { nodes } = project(snapshot, 'ACTIVIDADES');
    expect(nodes.filter((n) => n.type === 'ACTIVIDAD')).toHaveLength(snapshot.activities.length);
    expect(nodes.filter((n) => n.type === 'PRODUCTO_FINAL')).toHaveLength(
      snapshot.finalProducts.length,
    );
  });

  it('el nivel de currículo trae criterios y saberes', () => {
    const { nodes } = project(snapshot, 'CURRICULO');
    expect(nodes.filter((n) => n.type === 'CRITERIO_EVALUACION')).toHaveLength(
      snapshot.evaluationCriteria.length,
    );
    expect(nodes.filter((n) => n.type === 'SABER_BASICO')).toHaveLength(
      snapshot.basicKnowledge.length,
    );
  });

  it('el nivel de sesiones trae todas las sesiones', () => {
    const { nodes } = project(snapshot, 'SESIONES');
    expect(nodes.filter((n) => n.type === 'SESION')).toHaveLength(snapshot.sessions.length);
  });

  it('las situaciones se dibujan más grandes que las actividades (§3)', () => {
    const { nodes } = project(snapshot, 'ACTIVIDADES');
    const situation = nodes.find((n) => n.type === 'SITUACION_APRENDIZAJE');
    const activity = nodes.find((n) => n.type === 'ACTIVIDAD');
    expect(situation?.size).toBeGreaterThan(activity?.size ?? 0);
  });
});

describe('integridad del grafo proyectado', () => {
  it('ninguna arista apunta a un nodo que no está en el nivel', () => {
    for (const level of SEMANTIC_LEVELS) {
      const { nodes, edges } = project(snapshot, level);
      const ids = new Set(nodes.map((n) => n.id));

      for (const edge of edges) {
        expect(ids.has(edge.source), `${level}: origen fuera del nivel`).toBe(true);
        expect(ids.has(edge.target), `${level}: destino fuera del nivel`).toBe(true);
      }
    }
  });

  it('no hay identificadores de nodo repetidos', () => {
    for (const level of SEMANTIC_LEVELS) {
      const { nodes } = project(snapshot, level);
      expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    }
  });

  it('no hay identificadores de arista repetidos', () => {
    for (const level of SEMANTIC_LEVELS) {
      const { edges } = project(snapshot, level);
      expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
    }
  });

  it('las relaciones manuales se marcan como tales', () => {
    const { edges } = project(snapshot, 'CONSTELACIONES');
    expect(edges.some((edge) => edge.manual)).toBe(true);
  });
});

describe('filtros (§22)', () => {
  it('filtrar por materia reduce el grafo', () => {
    const todas = project(snapshot, 'CONSTELACIONES');
    const soloMat = project(snapshot, 'CONSTELACIONES', {
      subjectIds: [snapshot.subjects[0]?.id ?? ''],
    });
    expect(soloMat.nodes.length).toBeLessThan(todas.nodes.length);
  });

  it('sin materias seleccionadas se muestran todas', () => {
    const vacio = project(snapshot, 'GALAXIA', { subjectIds: [] });
    expect(vacio.nodes).toHaveLength(snapshot.subjects.length + 1);
  });

  it('el umbral de intensidad descarta las conexiones débiles', () => {
    const todas = project(snapshot, 'GALAXIA');
    const fuertes = project(snapshot, 'GALAXIA', { minWeight: 0.5 });
    expect(fuertes.edges.length).toBeLessThan(todas.edges.length);
  });

  it('filtrar por semana reduce las sesiones', () => {
    const todas = project(snapshot, 'SESIONES');
    const semana1 = project(snapshot, 'SESIONES', { weekIndex: 0 });
    expect(semana1.nodes.filter((n) => n.type === 'SESION').length).toBeLessThan(
      todas.nodes.filter((n) => n.type === 'SESION').length,
    );
  });

  it('filtrar por materia no deja aristas colgando', () => {
    const { nodes, edges } = project(snapshot, 'CURRICULO', {
      subjectIds: [snapshot.subjects[0]?.id ?? ''],
    });
    const ids = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
    }
  });
});

describe('resaltado al seleccionar (§3)', () => {
  const projection = project(snapshot, 'ACTIVIDADES');

  it('sin selección no resalta nada', () => {
    const { nodes, edges } = highlightFor(projection, null);
    expect(nodes.size).toBe(0);
    expect(edges.size).toBe(0);
  });

  it('resalta el nodo, sus aristas y los nodos al otro extremo', () => {
    const activity = snapshot.activities[2];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const { nodes, edges } = highlightFor(projection, activity.id);
    expect(nodes.has(activity.id)).toBe(true);
    expect(edges.size).toBeGreaterThan(0);
    expect(nodes.size).toBeGreaterThan(1);
  });

  it('no resalta NADA si el seleccionado no está en este nivel', () => {
    // La selección se conserva al cambiar de nivel. Si el nodo elegido no existe
    // en el nivel actual, la respuesta correcta es «no resaltes nada», no
    // «atenúa todo»: esto último dejaba el mapa entero apagado y parecía roto.
    const galaxia = project(snapshot, 'GALAXIA');
    const activity = snapshot.activities[0];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const { nodes, edges } = highlightFor(galaxia, activity.id);
    expect(nodes.size).toBe(0);
    expect(edges.size).toBe(0);
  });

  it('no resalta nodos que no tienen relación con el seleccionado', () => {
    const activity = snapshot.activities[0];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const { nodes } = highlightFor(projection, activity.id);
    expect(nodes.size).toBeLessThan(projection.nodes.length);
  });
});

describe('rendimiento (§28)', () => {
  it('proyecta el nivel más pesado en menos de 100 ms', () => {
    const started = performance.now();
    project(snapshot, 'CURRICULO');
    expect(performance.now() - started).toBeLessThan(100);
  });
});
