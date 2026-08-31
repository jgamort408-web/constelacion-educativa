import { describe, expect, it } from 'vitest';
import { buildAdjacency, detectCycles, neighbours, topologicalOrder, traverse } from './graph.ts';
import { ids, makeEdge } from './testing.ts';

/**
 * El recorrido del grafo es lo que sostiene la trazabilidad de la §31. Si estas
 * pruebas fallan, la aplicación deja de poder responder «por qué hacemos esto».
 */

const P = ids.project;

describe('buildAdjacency', () => {
  it('indexa cada arista en ambos sentidos', () => {
    const edges = [
      makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
      makeEdge(P, 'desarrolla', [ids.act2, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
    ];

    const index = buildAdjacency(edges);

    expect(index.outgoing.get(ids.act1)).toHaveLength(1);
    expect(index.incoming.get(ids.crit1)).toHaveLength(2);
    expect(index.byType.get('desarrolla')).toHaveLength(2);
  });

  it('recuerda el tipo de cada nodo que aparece en una arista', () => {
    const index = buildAdjacency([
      makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD']),
    ]);

    expect(index.nodeTypes.get(ids.ses1)).toBe('SESION');
    expect(index.nodeTypes.get(ids.act1)).toBe('ACTIVIDAD');
  });

  it('no falla con un grafo vacío', () => {
    const index = buildAdjacency([]);
    expect(index.outgoing.size).toBe(0);
    expect(neighbours(index, ids.act1)).toEqual([]);
  });
});

describe('neighbours', () => {
  const edges = [
    makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
    makeEdge(P, 'moviliza', [ids.act1, 'ACTIVIDAD'], [ids.crit2, 'SABER_BASICO']),
    makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD']),
  ];
  const index = buildAdjacency(edges);

  it('devuelve entrantes y salientes por defecto', () => {
    expect(neighbours(index, ids.act1)).toHaveLength(3);
  });

  it('filtra por sentido', () => {
    expect(neighbours(index, ids.act1, { direction: 'incoming' })).toHaveLength(1);
    expect(neighbours(index, ids.act1, { direction: 'outgoing' })).toHaveLength(2);
  });

  it('filtra por tipo de arista', () => {
    const found = neighbours(index, ids.act1, { edgeTypes: ['desarrolla'] });
    expect(found).toHaveLength(1);
    expect(found[0]?.node.id).toBe(ids.crit1);
  });

  it('filtra por tipo de nodo vecino', () => {
    const found = neighbours(index, ids.act1, { nodeTypes: ['SABER_BASICO'] });
    expect(found).toHaveLength(1);
    expect(found[0]?.node.type).toBe('SABER_BASICO');
  });

  it('devuelve la arista que justifica la relación, no solo el nodo', () => {
    const found = neighbours(index, ids.act1, { edgeTypes: ['desarrolla'] });
    expect(found[0]?.edge.type).toBe('desarrolla');
  });
});

describe('traverse', () => {
  // SESION → ejecuta → ACTIVIDAD → desarrolla → CRITERIO → pertenece_a → MATERIA
  const edges = [
    makeEdge(P, 'ejecuta', [ids.ses1, 'SESION'], [ids.act1, 'ACTIVIDAD']),
    makeEdge(P, 'desarrolla', [ids.act1, 'ACTIVIDAD'], [ids.crit1, 'CRITERIO_EVALUACION']),
    makeEdge(P, 'pertenece_a', [ids.crit1, 'CRITERIO_EVALUACION'], [ids.mat, 'MATERIA']),
  ];
  const index = buildAdjacency(edges);

  it('alcanza los nodos transitivamente', () => {
    const reached = traverse(index, ids.ses1, { direction: 'outgoing' });
    expect(reached.map((r) => r.node.id)).toEqual([ids.act1, ids.crit1, ids.mat]);
  });

  it('anota la profundidad de cada nodo alcanzado', () => {
    const reached = traverse(index, ids.ses1, { direction: 'outgoing' });
    expect(reached.map((r) => r.depth)).toEqual([1, 2, 3]);
  });

  it('devuelve el camino completo, que es lo que explica el porqué', () => {
    const reached = traverse(index, ids.ses1, { direction: 'outgoing' });
    const toSubject = reached.find((r) => r.node.id === ids.mat);
    expect(toSubject?.path.map((e) => e.type)).toEqual(['ejecuta', 'desarrolla', 'pertenece_a']);
  });

  it('respeta la profundidad máxima', () => {
    const reached = traverse(index, ids.ses1, { direction: 'outgoing', maxDepth: 2 });
    expect(reached.map((r) => r.node.id)).toEqual([ids.act1, ids.crit1]);
  });

  it('no se queda colgado con un ciclo', () => {
    const cyclic = buildAdjacency([
      makeEdge(P, 'depende_de', [ids.act1, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
    ]);
    expect(traverse(cyclic, ids.act1, { direction: 'outgoing' })).toHaveLength(1);
  });
});

describe('detectCycles', () => {
  it('no encuentra ciclos donde no los hay', () => {
    const edges = [
      makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act3, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
    ];
    expect(detectCycles(edges)).toEqual([]);
  });

  it('detecta un ciclo de dos actividades', () => {
    const edges = [
      makeEdge(P, 'depende_de', [ids.act1, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
    ];
    const cycles = detectCycles(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(2);
  });

  it('detecta un ciclo de tres actividades', () => {
    const edges = [
      makeEdge(P, 'depende_de', [ids.act1, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act3, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act3, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
    ];
    expect(detectCycles(edges)[0]).toHaveLength(3);
  });

  it('ignora las aristas que no son de dependencia', () => {
    const edges = [
      makeEdge(P, 'forma_parte_de', [ids.act1, 'ACTIVIDAD'], [ids.sda1, 'SITUACION_APRENDIZAJE']),
      makeEdge(P, 'forma_parte_de', [ids.sda1, 'SITUACION_APRENDIZAJE'], [ids.act1, 'ACTIVIDAD']),
    ];
    expect(detectCycles(edges)).toEqual([]);
  });
});

describe('topologicalOrder', () => {
  it('ordena las actividades respetando sus prerrequisitos', () => {
    // act2 depende de act1; act3 depende de act2.
    const edges = [
      makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act3, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
    ];
    expect(topologicalOrder(edges, [ids.act1, ids.act2, ids.act3])).toEqual([
      ids.act1,
      ids.act2,
      ids.act3,
    ]);
  });

  it('devuelve null si hay un ciclo, en vez de inventar un orden', () => {
    const edges = [
      makeEdge(P, 'depende_de', [ids.act1, 'ACTIVIDAD'], [ids.act2, 'ACTIVIDAD']),
      makeEdge(P, 'depende_de', [ids.act2, 'ACTIVIDAD'], [ids.act1, 'ACTIVIDAD']),
    ];
    expect(topologicalOrder(edges, [ids.act1, ids.act2])).toBeNull();
  });

  it('incluye las actividades sin ninguna dependencia', () => {
    const order = topologicalOrder([], [ids.act1, ids.act2]);
    expect(order).toHaveLength(2);
  });
});
