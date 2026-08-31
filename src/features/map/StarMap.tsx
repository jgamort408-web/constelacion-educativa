import { useEffect, useMemo, useRef } from 'react';
import cytoscape, { type Core, type EventObjectNode } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { Uuid } from '@/domain';
import type { GraphProjection } from '@/graph';
import { buildStylesheet, highlightFor, layoutFor, readPalette } from '@/graph';

/**
 * El mapa estelar (§3).
 *
 * ── La trampa que este componente evita ──
 * Cytoscape es imperativo y dueño de su propio canvas; React quiere volver a
 * renderizar. Si se instanciara dentro del cuerpo del componente, cada render
 * destruiría y recrearía el grafo: la cámara volvería al origen, la selección se
 * perdería y el rendimiento sería inaceptable.
 *
 * Por eso hay **una sola instancia**, creada una vez tras un `ref`, y los cambios
 * entran por `cy.batch()`. React no vuelve a tocar el canvas nunca más.
 *
 * ── Accesibilidad ──
 * El canvas queda `aria-hidden`: para un lector de pantalla es un rectángulo
 * vacío y ninguna cantidad de `aria-label` lo arregla. La representación
 * accesible de estos mismos datos es el panel de trazabilidad, que lee del mismo
 * store y por tanto no puede discrepar.
 */

cytoscape.use(fcose);

interface Props {
  projection: GraphProjection;
  selectedId: Uuid | null;
  onSelect: (id: Uuid | null) => void;
  /**
   * Cambia cuando el usuario activa el alto contraste.
   *
   * Cytoscape pinta sobre un canvas y no hereda el CSS, así que hay que
   * releerle la paleta y volver a aplicarle el estilo a mano.
   */
  highContrast: boolean;
}

/** Por debajo de este zoom las etiquetas de los nodos dejan de leerse. */
const MIN_LEGIBLE_ZOOM = 0.62;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function StarMap({ projection, selectedId, onSelect, highContrast }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Instancia única. El array de dependencias vacío es deliberado y esencial.
  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: buildStylesheet(readPalette()),
      minZoom: 0.15,
      maxZoom: 3,
      wheelSensitivity: 0.2,
      // El usuario mueve nodos para entender el grafo; que la posición se guarde
      // es trabajo del editor visual de la v0.2, no de aquí.
      autoungrabify: false,
    });

    cy.on('tap', 'node', (event: EventObjectNode) => {
      onSelectRef.current(event.target.id());
    });
    cy.on('tap', (event) => {
      if (event.target === cy) onSelectRef.current(null);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  const elements = useMemo(
    () => ({
      nodes: projection.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          detail: node.detail,
          color: node.color,
          size: node.size,
        },
      })),
      edges: projection.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight,
          manual: edge.manual,
          label: edge.label,
        },
      })),
    }),
    [projection],
  );

  // Al cambiar el contraste hay que releer los tokens y reaplicar el estilo: el
  // canvas no se entera de que el CSS ha cambiado.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style(buildStylesheet(readPalette()));
  }, [highContrast]);

  // Reemplazo del contenido: un solo lote, un solo recálculo de layout.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().remove();
      cy.add([...elements.nodes, ...elements.edges]);
    });

    const layout = cy.layout(layoutFor(projection.level, prefersReducedMotion()));

    // `fit` encuadra todo el grafo, y con muchos nodos eso significa alejarse
    // tanto que las etiquetas dejan de leerse. Se pone un suelo al zoom y se deja
    // que el docente desplace: prefiere ver menos y entenderlo que verlo todo y
    // no leer nada.
    layout.one('layoutstop', () => {
      if (cy.zoom() < MIN_LEGIBLE_ZOOM) {
        cy.zoom({ level: MIN_LEGIBLE_ZOOM, renderedPosition: { x: 0, y: 0 } });
        cy.center();
      }
    });

    layout.run();
  }, [elements, projection.level]);

  // El resaltado va por clases, nunca modificando el estilo de cada elemento.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const { nodes, edges } = highlightFor(projection, selectedId);

    cy.batch(() => {
      cy.elements().removeClass('resaltado atenuado seleccionado');
      // Conjunto vacío = el nodo seleccionado no está en este nivel. Atenuar todo
      // sin encender nada deja el mapa apagado y parece que la app se ha roto.
      if (nodes.size === 0) return;

      cy.elements().addClass('atenuado');
      for (const id of nodes) {
        cy.getElementById(id).removeClass('atenuado').addClass('resaltado');
      }
      for (const id of edges) {
        cy.getElementById(id).removeClass('atenuado').addClass('resaltado');
      }
      if (selectedId !== null) cy.getElementById(selectedId).addClass('seleccionado');
    });
  }, [projection, selectedId]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        aria-hidden="true"
        className="h-[560px] w-full rounded border border-cielo-600 bg-cielo-950"
      />
      <p className="mt-2 text-xs text-tinta-500">
        {projection.nodes.length} nodos y {projection.edges.length} conexiones. Rueda para acercar,
        arrastra para mover, pulsa un nodo para aislar sus relaciones.{' '}
        <span className="text-tinta-300">
          El mismo contenido, navegable por teclado, está en la pestaña de Trazabilidad.
        </span>
      </p>
    </div>
  );
}
