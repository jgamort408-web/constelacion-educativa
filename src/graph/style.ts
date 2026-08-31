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

/**
 * Los colores del mapa salen de los tokens CSS, no de constantes escritas aquí.
 *
 * Escritos a fuego, el modo de alto contraste cambiaba toda la interfaz menos el
 * grafo, que se quedaba con la paleta normal: justo la parte que más necesita
 * contraste para quien lo activa. Cytoscape pinta sobre un canvas y no hereda
 * CSS, así que hay que leerlos y pasárselos.
 */
export interface Palette {
  cielo: string;
  tinta: string;
  laton: string;
  neutro: string;
  superficie: string;
  borde: string;
}

const PALETA_POR_DEFECTO: Palette = {
  cielo: '#0e1120',
  tinta: '#e5e6f0',
  laton: '#e8be66',
  neutro: '#5a6180',
  superficie: '#2c3149',
  borde: '#8891b4',
};

/** Lee la paleta viva del documento. En Node (pruebas) devuelve la de por defecto. */
export function readPalette(): Palette {
  if (typeof document === 'undefined') return PALETA_POR_DEFECTO;

  const estilo = getComputedStyle(document.documentElement);
  const leer = (token: string, respaldo: string): string =>
    estilo.getPropertyValue(token).trim() || respaldo;

  return {
    cielo: leer('--color-cielo-900', PALETA_POR_DEFECTO.cielo),
    tinta: leer('--color-tinta-100', PALETA_POR_DEFECTO.tinta),
    laton: leer('--color-laton-400', PALETA_POR_DEFECTO.laton),
    neutro: leer('--color-borde-500', PALETA_POR_DEFECTO.neutro),
    superficie: leer('--color-cielo-600', PALETA_POR_DEFECTO.superficie),
    borde: leer('--color-tinta-500', PALETA_POR_DEFECTO.borde),
  };
}

export function buildStylesheet(palette: Palette = PALETA_POR_DEFECTO): StylesheetJson {
  const CIELO = palette.cielo;
  const TINTA = palette.tinta;
  const LATON = palette.laton;
  const NEUTRO = palette.neutro;

  return [
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
        'background-color': palette.superficie,
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
        'background-color': palette.superficie,
        'border-width': 1.5,
        'border-color': palette.borde,
        'font-size': 12,
        'font-weight': 600,
      },
    },
    {
      selector: 'node[type = "MATERIA"]',
      style: {
        'border-width': 2,
        'border-color': CIELO,
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
        'target-arrow-color': palette.borde,
        'line-color': palette.borde,
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
}

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
