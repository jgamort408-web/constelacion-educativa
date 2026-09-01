import type { Css, LayoutOptions, StylesheetJson } from 'cytoscape';
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
        // La forma y el icono vienen del dato: son el segundo y tercer portador
        // de información después del color, que la §16 prohíbe usar en solitario.
        // Los tipos de Cytoscape no contemplan un mapeo de datos en `shape`,
        // aunque la biblioteca sí lo admite y está verificado en el navegador.
        shape: 'data(shape)' as unknown as Css.Node['shape'],
        'background-color': 'data(color)',
        'background-opacity': 0.92,
        'background-image': 'data(icono)',
        'background-image-opacity': 0.95,
        // El icono se recorta a la silueta del nodo: con `none` se salía por las
        // esquinas de un rombo o una estrella y quedaba un trazo suelto flotando
        // fuera de la forma.
        'background-clip': 'node',
        'background-fit': 'contain',
        // En porcentaje, no en píxeles: así el icono crece y mengua con el nodo,
        // y como Cytoscape transforma el lienzo entero, también con el zoom.
        'background-width': '54%',
        'background-height': '54%',
        'background-width-relative-to': 'inner',
        'background-height-relative-to': 'inner',
        'background-position-x': '50%',
        'background-position-y': '50%',
        'background-offset-x': 0,
        'background-offset-y': 0,
        width: 'data(size)',
        height: 'data(size)',
        label: 'data(label)',
        color: TINTA,
        'font-size': 13,
        'font-weight': 500,
        'font-family': 'IBM Plex Sans, system-ui, sans-serif',
        'text-valign': 'bottom',
        'text-margin-y': 7,
        'text-wrap': 'wrap',
        'text-max-width': '150px',
        // Fondo sólido tras la etiqueta. Sobre un mapa denso el contorno solo no
        // basta: las letras se pierden entre las aristas que pasan por detrás.
        'text-background-color': CIELO,
        'text-background-opacity': 0.85,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        'text-outline-color': CIELO,
        'text-outline-width': 1,
        // Por debajo de este tamaño la etiqueta se oculta en vez de quedar
        // ilegible: un texto de dos píxeles no informa, solo ensucia.
        'min-zoomed-font-size': 8,
        'border-width': 0,
        'transition-property': 'opacity, border-width, background-opacity',
        'transition-duration': 220,
      },
    },

    // ── Contenedores: la materia agrupa a sus competencias, y estas a sus
    // criterios. Sin esta jerarquía los criterios de tres materias salían
    // mezclados y encontrar uno era imposible.
    {
      // Los contenedores no se atenúan del todo: son el mapa de referencia que
      // permite situar lo resaltado.
      selector: ':parent.atenuado',
      style: { opacity: 0.45 },
    },
    {
      /**
       * Contenedor de algo resaltado.
       *
       * Ni encendido como lo seleccionado ni apagado como el resto: la caja tiene
       * que verse lo justo para situar lo que hay dentro. Sin este estado, un
       * criterio seleccionado quedaba encerrado en una caja atenuada y parecía
       * que no se había encendido, aunque sus conexiones sí lo estuvieran.
       */
      selector: ':parent.contenedor-activo',
      style: {
        opacity: 1,
        'background-opacity': 0.14,
        'border-width': 1.5,
        'border-opacity': 0.9,
        'border-color': LATON,
        'border-style': 'solid',
        color: LATON,
        'z-index': 5,
      },
    },
    {
      selector: ':parent',
      style: {
        shape: 'round-rectangle',
        'background-opacity': 0.06,
        'background-image': 'none',
        'border-width': 1,
        'border-opacity': 0.5,
        'border-color': 'data(color)',
        padding: '20px',
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -6,
        'font-size': 15,
        'font-weight': 600,
        'min-zoomed-font-size': 5,
      },
    },
    {
      selector: 'node[type = "COMPETENCIA_ESPECIFICA"]:parent',
      style: {
        'background-opacity': 0.12,
        'border-style': 'dashed',
        padding: '13px',
        'font-size': 12,
      },
    },

    // El proyecto es el centro del sistema: anillo de latón y etiqueta mayor.
    {
      selector: 'node[type = "PROYECTO"]',
      style: {
        'background-color': palette.superficie,
        'border-width': 2,
        'border-color': LATON,
        'font-size': 17,
        'font-weight': 600,
        'text-valign': 'bottom',
        'text-margin-y': 10,
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
        'font-size': 15,
        'font-weight': 600,
        'text-valign': 'bottom',
        'text-margin-y': 9,
      },
    },
    {
      selector: 'node[type = "PRODUCTO_FINAL"]',
      style: {
        'background-color': LATON,
        'background-opacity': 0.22,
        'border-width': 2,
        'border-color': LATON,
        'font-size': 13,
      },
    },
    {
      selector: 'node[type = "CRITERIO_EVALUACION"]',
      style: { 'font-size': 11 },
    },
    {
      selector: 'node[type = "SABER_BASICO"]',
      style: { 'font-size': 10 },
    },
    {
      selector: 'node[type = "SESION"]',
      style: { 'font-size': 10 },
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
        // Sin esto, un nodo dentro de un contenedor se dibuja por debajo de él y
        // el resaltado no se ve: los compuestos pintan al padre encima del hijo.
        'z-compound-depth': 'top',
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
      style: {
        // 0.12 dejaba el resto del mapa prácticamente invisible: al seleccionar
        // un nodo entre ciento setenta, se perdía todo el contexto y no se sabía
        // dónde estaba lo resaltado. Atenuar es bajar el volumen, no apagar.
        opacity: 0.3,
      },
    },
    {
      selector: 'node.seleccionado',
      style: {
        'border-width': 4,
        'border-color': LATON,
        'background-opacity': 1,
        color: LATON,
        'font-weight': 600,
        'font-size': 15,
        'text-background-opacity': 0.95,
        'z-index': 30,
        'z-compound-depth': 'top',
        // Un halo, para encontrarlo entre ciento setenta nodos sin buscarlo.
        'overlay-color': LATON,
        'overlay-opacity': 0.16,
        'overlay-padding': 10,
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
export function layoutFor(
  level: SemanticLevel,
  reducedMotion: boolean,
  posiciones?: Record<string, { x: number; y: number }>,
): LayoutOptions {
  const base = {
    animate: !reducedMotion,
    animationDuration: 460,
    animationEasing: 'ease-out-cubic',
    fit: true,
    padding: 60,
  };

  if (level === 'GALAXIA') {
    return { ...base, name: 'concentric', concentric: () => 1, minNodeSpacing: 90 };
  }

  // El nivel de currículo usa posiciones calculadas: ver src/graph/radial.ts.
  // Un algoritmo de fuerzas no puede ordenar lo que no está conectado, y aquí la
  // mayoría de los criterios aún no se ha asignado a ninguna actividad.
  if (level === 'CURRICULO' && posiciones) {
    return {
      ...base,
      name: 'preset',
      positions: (nodo: { id(): string }) => posiciones[nodo.id()] ?? { x: 0, y: 0 },
    } as unknown as LayoutOptions;
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
    // El nivel de currículo trae más de cien nodos, la mayoría sin aristas:
    // son criterios que aún no se han asignado. Se compactan dentro de su
    // materia en vez de esparcirse por el lienzo.
    nodeSeparation: level === 'CURRICULO' ? 55 : 130,
    idealEdgeLength: level === 'SESIONES' ? 70 : level === 'CURRICULO' ? 70 : 130,
    nodeRepulsion: level === 'CURRICULO' ? 4500 : 14000,
    // `tile` empaqueta los nodos sueltos en rejilla dentro de su contenedor, en
    // lugar de dejarlos flotando alrededor.
    tile: true,
    tilingPaddingVertical: 8,
    tilingPaddingHorizontal: 8,
    packComponents: true,
    gravity: 0.28,
    // Los contenedores (materia, competencia) necesitan su propia gravedad, o
    // sus hijos se dispersan y el grupo deja de leerse como grupo.
    gravityCompound: 1.4,
    gravityRangeCompound: 1.5,
    nestingFactor: 0.2,
    numIter: 3000,
    // Una entrada suave: los nodos aparecen desde su posición previa en vez de
    // saltar. Con muchos nodos, un salto seco desorienta.
    animationDuration: 520,
    // Sin esto, fCoSE aplica su propia animación además de la del layout y el
    // resultado tiembla en equipos lentos.
    animationEasing: 'ease-out',
  } as unknown as LayoutOptions;
}
