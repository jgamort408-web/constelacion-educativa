import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type EventObjectNode } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { Uuid } from '@/domain';
import type { GraphProjection } from '@/graph';
import { buildStylesheet, highlightFor, layoutFor, readPalette } from '@/graph';
import { MapNavigation } from './MapNavigation.tsx';

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
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** El punto de la pantalla sobre el que hay que anclar un zoom programático. */
function centroDeVista(cy: Core): { x: number; y: number } {
  return { x: cy.width() / 2, y: cy.height() / 2 };
}

export function StarMap({ projection, selectedId, onSelect, highContrast }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [zoom, setZoom] = useState(1);

  /** Anima hasta un nivel de zoom conservando el centro de la vista. */
  const irA = useCallback((nivel: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.stop();
    cy.animate(
      { zoom: { level: nivel, position: cy.pan() && centroDeVista(cy) } },
      { duration: prefersReducedMotion() ? 0 : 260, easing: 'ease-out-cubic' },
    );
  }, []);

  const encuadrar = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.stop();
    cy.animate(
      { fit: { eles: cy.elements(), padding: 60 } },
      { duration: prefersReducedMotion() ? 0 : 380, easing: 'ease-out-cubic' },
    );
  }, []);

  const centrarSeleccion = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || selectedId === null) return;
    const nodo = cy.getElementById(selectedId);
    if (nodo.empty()) return;
    cy.stop();
    cy.animate(
      { center: { eles: nodo }, zoom: Math.max(cy.zoom(), 1) },
      { duration: prefersReducedMotion() ? 0 : 340, easing: 'ease-out-cubic' },
    );
  }, [selectedId]);

  // Instancia única. El array de dependencias vacío es deliberado y esencial.
  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: buildStylesheet(readPalette()),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Se deja la sensibilidad por defecto de Cytoscape (1). Estaba en 0.2 y
      // hacían falta muchísimas vueltas para cruzar el rango útil; cualquier
      // valor personalizado, además, hace que la biblioteca avise de que el
      // zoom se comportará de forma extraña con ratones corrientes. Para los
      // saltos grandes está la barra de zoom, que es más preciso que la rueda.
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

    // Doble clic: centra y acerca ese nodo. Es el gesto que espera cualquiera
    // acostumbrado a un mapa, y evita tener que arrastrar y hacer zoom a mano.
    cy.on('dblclick', 'node', (event: EventObjectNode) => {
      cy.stop();
      cy.animate(
        { center: { eles: event.target }, zoom: Math.max(cy.zoom(), 1.4) },
        { duration: prefersReducedMotion() ? 0 : 320, easing: 'ease-out-cubic' },
      );
    });

    // La barra de zoom necesita saber el nivel real cuando cambia por la rueda.
    cy.on('zoom', () => {
      setZoom(cy.zoom());
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
          shape: node.shape,
          icono: node.icono,
          iconoRotulo: node.iconoRotulo,
          // `parent` es lo que convierte el grafo en compuesto: los criterios
          // cuelgan de su competencia y esta de su materia, así que en pantalla
          // salen agrupados en islas en vez de mezclados.
          ...(node.parent === undefined ? {} : { parent: node.parent }),
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

  /** Atajos de teclado sobre el mapa enfocado. */
  function alPulsarTecla(evento: React.KeyboardEvent<HTMLDivElement>) {
    const cy = cyRef.current;
    if (!cy) return;
    if (evento.key === '+' || evento.key === '=') {
      evento.preventDefault();
      irA(Math.min(MAX_ZOOM, cy.zoom() * 1.5));
    } else if (evento.key === '-') {
      evento.preventDefault();
      irA(Math.max(MIN_ZOOM, cy.zoom() / 1.5));
    } else if (evento.key === '0') {
      evento.preventDefault();
      encuadrar();
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
      <MapNavigation
        zoom={zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onZoom={irA}
        onFit={encuadrar}
        onCenterSelection={centrarSeleccion}
        haySeleccion={selectedId !== null}
      />
      <div
        ref={containerRef}
        role="application"
        aria-label="Mapa estelar del proyecto. El mismo contenido, navegable por teclado, está en la pestaña de Trazabilidad."
        tabIndex={0}
        onKeyDown={alPulsarTecla}
        className="h-[600px] w-full rounded border border-cielo-600 bg-cielo-950"
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
