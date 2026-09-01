import type { NodeType } from '@/domain';

/**
 * Iconos y formas de cada tipo de nodo (§3, §16).
 *
 * La forma y el icono no son decoración: son el segundo y tercer portador de
 * información después del color, que la §16 prohíbe usar en solitario. Un docente
 * daltónico distingue una sesión de un criterio por su silueta, y quien proyecta
 * el mapa en clase lo distingue de un vistazo sin leer la etiqueta.
 *
 * Los iconos van en línea como data URI porque Cytoscape pinta sobre canvas y no
 * puede cargar un sprite externo ni heredar CSS. Son trazos sencillos a propósito:
 * a 20 píxeles, un icono detallado es una mancha.
 */

export type CyShape =
  | 'ellipse'
  | 'round-rectangle'
  | 'round-diamond'
  | 'round-hexagon'
  | 'round-tag'
  | 'star'
  | 'round-triangle'
  | 'barrel'
  | 'cut-rectangle';

interface Aspecto {
  readonly shape: CyShape;
  readonly icono: string;
  readonly rotulo: string;
}

/** Un trazo SVG blanco sobre fondo transparente, listo para `background-image`. */
function svg(cuerpo: string): string {
  const documento =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="rgb(255,255,255)" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${cuerpo}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(documento)}`;
}

/**
 * Cada tipo con su silueta y su símbolo.
 *
 * Las formas se eligen por lo que el elemento ES, no por variar:
 *  · el proyecto y las materias son cuerpos redondos, son «lugares»;
 *  · la situación es un hexágono, una celda que agrupa;
 *  · la actividad es un rectángulo, algo que se hace;
 *  · el criterio es una etiqueta, algo que se adhiere a lo que se hace;
 *  · el saber es un barril, contenido;
 *  · la sesión es un rectángulo pequeño, una casilla de horario;
 *  · el producto final es una estrella y el hito un triángulo: son metas.
 */
export const ASPECTO: Record<NodeType, Aspecto> = {
  PROYECTO: {
    shape: 'ellipse',
    rotulo: 'Proyecto',
    icono: svg('<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>'),
  },
  MATERIA: {
    shape: 'ellipse',
    rotulo: 'Materia',
    icono: svg('<path d="M4 5v14l8-3 8 3V5l-8 3z"/>'),
  },
  SITUACION_APRENDIZAJE: {
    shape: 'round-hexagon',
    rotulo: 'Situación de aprendizaje',
    icono: svg('<path d="M3 12h6l2-5 3 10 2-5h5"/>'),
  },
  ACTIVIDAD: {
    shape: 'round-rectangle',
    rotulo: 'Actividad',
    icono: svg('<path d="M5 5h14v14H5z"/><path d="M9 12l2 2 4-5"/>'),
  },
  COMPETENCIA_ESPECIFICA: {
    shape: 'round-diamond',
    rotulo: 'Competencia específica',
    icono: svg('<path d="M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z"/>'),
  },
  CRITERIO_EVALUACION: {
    shape: 'round-tag',
    rotulo: 'Criterio de evaluación',
    icono: svg('<path d="M4 6h11l5 6-5 6H4z"/><path d="M8 12h5"/>'),
  },
  SABER_BASICO: {
    shape: 'barrel',
    rotulo: 'Saber básico',
    icono: svg('<path d="M4 6h16v12H4z"/><path d="M8 6v12"/>'),
  },
  SESION: {
    shape: 'cut-rectangle',
    rotulo: 'Sesión',
    icono: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  },
  PRODUCTO_FINAL: {
    shape: 'star',
    rotulo: 'Producto final',
    icono: svg(
      '<path d="M12 3l2.6 6.3 6.4.5-4.9 4.2 1.5 6.6L12 17l-5.6 3.6 1.5-6.6L3 9.8l6.4-.5z"/>',
    ),
  },
  HITO: {
    shape: 'round-triangle',
    rotulo: 'Hito',
    icono: svg('<path d="M6 3v18"/><path d="M6 4h11l-2.5 4L17 12H6z"/>'),
  },
  DOCENTE: {
    shape: 'ellipse',
    rotulo: 'Docente',
    icono: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0114 0"/>'),
  },
};

/**
 * Icono propio de un criterio, según lo que pide hacer.
 *
 * Un criterio LOMLOE empieza casi siempre por el verbo que define la tarea
 * («Analizar…», «Comunicar…»), y ese verbo dice más de la actividad que el
 * código. Dar un símbolo a cada familia permite reconocer de un vistazo si una
 * actividad está cargada de análisis o de producción, que es una pregunta
 * pedagógica real y no un adorno.
 */
const FAMILIAS: { verbos: readonly string[]; icono: string; rotulo: string }[] = [
  {
    verbos: ['analiz', 'interpret', 'compar', 'contrast', 'examin', 'estudi'],
    rotulo: 'Analizar',
    icono: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  },
  {
    verbos: ['comunic', 'expres', 'expon', 'present', 'redact', 'escrib', 'narr'],
    rotulo: 'Comunicar',
    icono: svg('<path d="M4 5h16v11H8l-4 4z"/>'),
  },
  {
    verbos: ['identific', 'reconoc', 'localiz', 'busc', 'seleccion', 'observ'],
    rotulo: 'Identificar',
    icono: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v.5M12 11v5"/>'),
  },
  {
    verbos: ['aplic', 'resolv', 'emple', 'utiliz', 'oper', 'calcul', 'model'],
    rotulo: 'Aplicar',
    icono: svg('<path d="M14 3l7 7-4 4-7-7z"/><path d="M10 10L3 17v4h4l7-7"/>'),
  },
  {
    verbos: ['elabor', 'produc', 'cre', 'dise', 'construir', 'construy', 'realiz'],
    rotulo: 'Crear',
    icono: svg('<path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="9"/>'),
  },
  {
    verbos: ['valor', 'argument', 'justific', 'evalu', 'juzg', 'reflexion'],
    rotulo: 'Valorar',
    icono: svg('<path d="M12 4v16"/><path d="M5 8h14"/><path d="M5 8l-2 6h4zM19 8l-2 6h4z"/>'),
  },
  {
    verbos: ['particip', 'colabor', 'coopera', 'compart', 'interactu'],
    rotulo: 'Participar',
    icono: svg(
      '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19a5 5 0 0110 0M11 19a5 5 0 0110 0"/>',
    ),
  },
];

const GENERICO = {
  rotulo: 'Criterio',
  icono: svg('<path d="M4 6h11l5 6-5 6H4z"/><path d="M8 12h5"/>'),
};

/**
 * Empareja un criterio con su familia de verbo.
 *
 * Devuelve el genérico si ninguna casa: inventar una familia para un criterio
 * que no la tiene sería peor que no darle símbolo propio, porque el docente
 * leería una intención que la norma no expresa.
 */
export function iconoDeCriterio(texto: string): { icono: string; rotulo: string } {
  const inicio = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 60);

  for (const familia of FAMILIAS) {
    if (familia.verbos.some((verbo) => inicio.includes(verbo))) {
      return { icono: familia.icono, rotulo: familia.rotulo };
    }
  }
  return GENERICO;
}

/** Las familias, para la leyenda del mapa. */
export const FAMILIAS_CRITERIO = FAMILIAS.map((f) => ({ rotulo: f.rotulo, icono: f.icono }));
