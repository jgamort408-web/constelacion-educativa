import type { LayoutOptions, StylesheetJson } from 'cytoscape';
import type { SemanticLevel } from './projection.ts';

/**
 * Aspecto del mapa estelar (§3).
 *
 * Fondo oscuro de carta astronómica, nodos como cuerpos celestes y conexiones
 * discretas mientras no se seleccionan.
 *
 * Dos decisiones que no son estéticas:
 *
 *   1. **Todo el resaltado se hace con clases**, nunca modificando el estilo de
 *      cada elemento. Cambiar una clase es una operación; recorrer 1500 aristas
 *      poniéndoles color es 1500. Con el objetivo de la §28 eso es la diferencia
 *      entre responder al instante y ir a tirones.
 *   2. **El grosor y la opacidad de una arista dependen de su intensidad**, pero
 *      la intensidad también se escribe como etiqueta y las relaciones manuales
 *      llevan línea discontinua: la §16 prohíbe que el color o el grosor sean el
 *      único portador de información.
 */

const CIELO = '#0e1120';
const TINTA = '#e5e6f0';
const LATON = '#e8be66';
const NEUTRO = '#5a6180';

export const STYLESHEET: StylesheetJson = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'background-opacity': 0.9,
      width: 'data(size)',
      height: 'data(size)',
      label: 'data(label)',
      color: TINTA,
      'font-size': 12,
      'font-family': 'IBM Plex Sans, system-ui, sans-serif',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'text-outline-color': CIELO,
      'text-outline-width': 3,
      'border-width': 0,
      'transition-property': 'opacity, border-width, background-opacity',
      'transition-duration': 180,
    },
  },

  // El proyecto es el centro del sistema: anillo de latón y etiqueta mayor.
  {
    selector: 'node[type = "PROYECTO"]',
    style: {
      'background-color': '#1e2337',
      'border-width': 2,
      'border-color': LATON,
      'font-size': 14,
      'font-weight': 600,
      'text-valign': 'center',
      'text-margin-y': 0,
    },
  },
  {
    selector: 'node[type = "SITUACION_APRENDIZAJE"]',
    style: {
      'background-color': '#2c3149',
      'border-width': 1.5,
      'border-color': '#8891b4',
      'font-size': 12,
      'font-weight': 600,
    },
  },
  {
    selector: 'node[type = "MATERIA"]',
    style: {
      'border-width': 2,
      'border-color': '#161a2c',
      'font-size': 12,
      'font-weight': 600,
      'text-valign': 'center',
      'text-margin-y': 0,
      color: '#0e1120',
      'text-outline-width': 0,
    },
  },
  {
    selector: 'node[type = "PRODUCTO_FINAL"]',
    style: {
      'background-color': LATON,
      'background-opacity': 0.22,
      'border-width': 2,
      'border-color': LATON,
      shape: 'round-diamond',
      'font-size': 12,
    },
  },
  {
    selector: 'node[type = "CRITERIO_EVALUACION"]',
    style: { shape: 'round-rectangle', 'font-size': 9 },
  },
  {
    selector: 'node[type = "SABER_BASICO"]',
    style: { shape: 'round-tag', 'font-size': 9 },
  },
  {
    selector: 'node[type = "SESION"]',
    style: { shape: 'round-rectangle', 'font-size': 8 },
  },

  // Nodos sin materia propia: gris neutro, nunca un color que sugiera una materia.
  {
    selector: 'node[!color]',
    style: { 'background-color': NEUTRO },
  },

  {
    selector: 'edge',
    style: {
      width: 'mapData(weight, 0, 1, 0.6, 5)',
      'line-color': NEUTRO,
      'line-opacity': 0.28,
      'curve-style': 'bezier',
      'transition-property': 'opacity, line-opacity, line-color, width',
      'transition-duration': 180,
    },
  },
  // Las relaciones sin intensidad no pueden mapear un grosor: ancho fijo.
  {
    selector: 'edge[!weight]',
    style: { width: 1 },
  },
  {
    selector: 'edge[type = "depende_de"]',
    style: {
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#8891b4',
      'line-color': '#8891b4',
      'line-opacity': 0.45,
      width: 1.4,
    },
  },
  {
    selector: 'edge[type = "contribuye_a"]',
    style: { 'line-color': LATON, 'line-style': 'dotted' },
  },
  // La procedencia manual se ve por la forma de la línea, no solo por el color.
  {
    selector: 'edge[?manual]',
    style: { 'line-style': 'dashed' },
  },

  // ── Estados de selección (§3) ────────────────────────────────────────────
  {
    selector: '.resaltado',
    style: {
      'background-opacity': 1,
      'border-width': 3,
      'border-color': LATON,
      'z-index': 20,
    },
  },
  {
    selector: 'edge.resaltado',
    style: {
      'line-opacity': 0.95,
      'line-color': LATON,
      'target-arrow-color': LATON,
      label: 'data(label)',
      'font-size': 10,
      color: LATON,
      'text-outline-color': CIELO,
      'text-outline-width': 3,
      'z-index': 20,
    },
  },
  {
    selector: '.atenuado',
    style: { opacity: 0.12 },
  },
  {
    selector: 'node.seleccionado',
    style: {
      'border-width': 4,
      'border-color': LATON,
      'background-opacity': 1,
      color: LATON,
      'font-weight': 600,
      'z-index': 30,
    },
  },
];

/**
 * Configuración de layout por nivel.
 *
 * Los niveles con pocos nodos y un centro claro se disponen en círculos
 * concéntricos, que hacen legible «el proyecto y lo que gira a su alrededor». Los
 * niveles densos usan fCoSE, que separa los grupos sin que haya que decirle dónde
 * va cada cosa.
 */
export function layoutFor(level: SemanticLevel, reducedMotion: boolean): LayoutOptions {
  const base = {
    animate: !reducedMotion,
    animationDuration: 420,
    fit: true,
    padding: 60,
  };

  if (level === 'GALAXIA') {
    return { ...base, name: 'concentric', concentric: () => 1, minNodeSpacing: 90 };
  }

  // fCoSE se registra en tiempo de ejecución, así que sus opciones no están en
  // los tipos de Cytoscape. La aserción se limita a este objeto.
  return {
    ...base,
    name: 'fcose',
    quality: 'proof',
    // Sin posiciones de partida, todos los nodos nacen en el origen y fCoSE no
    // tiene de dónde separarlos: el grafo sale apelotonado en una diagonal.
    // Aleatorizar les da un punto de partida del que el algoritmo puede tirar.
    randomize: true,
    nodeSeparation: 130,
    idealEdgeLength: level === 'SESIONES' ? 70 : 130,
    nodeRepulsion: 14000,
    gravity: 0.28,
    numIter: 3000,
    // Sin esto, fCoSE aplica su propia animación además de la del layout y el
    // resultado tiembla en equipos lentos.
    animationEasing: 'ease-out',
  } as unknown as LayoutOptions;
}
