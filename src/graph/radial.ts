import type { GraphNode, GraphProjection } from './projection.ts';

/**
 * Disposición del nivel de currículo: un centro y un anillo de territorios.
 *
 * ── Por qué no vale un algoritmo de fuerzas ──
 * Los algoritmos de fuerzas colocan bien lo que está conectado, y en este nivel
 * casi nada lo está: la mayoría de los criterios no se ha asignado todavía a
 * ninguna actividad. fCoSE los empaquetaba en una rejilla arriba a la izquierda
 * de su caja y dejaba el resto vacío, sin ningún orden que ayudara a encontrar
 * uno concreto.
 *
 * ── Las tres reglas que impone esta disposición ──
 *  1. **Las actividades ocupan el centro.** Son lo que el equipo docente hace; el
 *     currículo es la referencia contra la que se contrasta. Poner el currículo
 *     en el centro invertiría esa relación.
 *  2. **Cada materia tiene su territorio y ninguno pisa a otro.** El radio del
 *     anillo no se elige a ojo: se calcula el que hace falta para que quepan
 *     todos sin tocarse (`radioSinSolape`). Antes se fijaba a 480 y una materia
 *     con setenta criterios ocupaba 630, así que Geografía se metía dentro de
 *     Lengua y el mapa era ilegible.
 *  3. **Cada territorio cae del lado de sus actividades.** El ángulo de una
 *     materia sale de dónde están las actividades que desarrollan sus criterios,
 *     así que las aristas salen cortas y radiales en vez de cruzar el centro.
 *     Eso es lo que evita la maraña en el medio.
 *
 * Dentro de cada territorio el orden es el del código: al ir en anillo, **el
 * criterio 1.3 está siempre entre el 1.2 y el 1.4**. Un docente que busca uno
 * concreto lo encuentra por posición, sin leer etiquetas de una en una.
 */

export interface Posicion {
  x: number;
  y: number;
}

/** Separación mínima entre dos territorios vecinos, en unidades del lienzo. */
const HOLGURA_ENTRE_MATERIAS = 90;
/** Distancia mínima entre el borde del grupo central y el borde de un territorio. */
const HOLGURA_AL_CENTRO = 150;

/** Radio que necesita un anillo para que quepan `n` elementos separados `paso`. */
function radioPara(n: number, paso: number, minimo: number): number {
  if (n <= 1) return minimo;
  return Math.max(minimo, (n * paso) / (2 * Math.PI));
}

/**
 * Reparte `n` elementos en un anillo alrededor de `centro`.
 *
 * Empieza arriba y gira en sentido horario, que es como se lee un reloj y por
 * tanto donde la vista espera encontrar el primero.
 */
function anillo(n: number, centro: Posicion, radio: number, desfase = -Math.PI / 2): Posicion[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: centro.x, y: centro.y }];
  return Array.from({ length: n }, (_, i) => {
    const angulo = desfase + (2 * Math.PI * i) / n;
    return { x: centro.x + radio * Math.cos(angulo), y: centro.y + radio * Math.sin(angulo) };
  });
}

function enAngulo(centro: Posicion, radio: number, angulo: number): Posicion {
  return { x: centro.x + radio * Math.cos(angulo), y: centro.y + radio * Math.sin(angulo) };
}

/** Agrupa los nodos por su contenedor. */
function porContenedor(nodes: readonly GraphNode[]): Map<string, GraphNode[]> {
  const mapa = new Map<string, GraphNode[]>();
  for (const nodo of nodes) {
    if (nodo.parent === undefined) continue;
    const lista = mapa.get(nodo.parent);
    if (lista) lista.push(nodo);
    else mapa.set(nodo.parent, [nodo]);
  }
  return mapa;
}

/** Lo que ocupa el territorio de una materia y dónde va cada cosa dentro. */
interface Territorio {
  readonly id: string;
  /** Distancia del centro de la materia al elemento más lejano que contiene. */
  readonly radio: number;
  /** Coloca su contenido alrededor de un centro dado. */
  colocar(centro: Posicion, destino: Record<string, Posicion>): void;
}

/**
 * Mide y prepara el territorio de una materia.
 *
 * Se separa del reparto en el mapa porque el radio hay que conocerlo **antes** de
 * decidir dónde va: es justo el dato que faltaba cuando las materias se
 * solapaban.
 */
function medirTerritorio(materia: GraphNode, hijos: (id: string) => GraphNode[]): Territorio {
  const contenido = hijos(materia.id);
  const competencias = contenido.filter((n) => n.type === 'COMPETENCIA_ESPECIFICA');
  const saberes = contenido.filter((n) => n.type === 'SABER_BASICO');
  const sueltos = contenido.filter(
    (n) => n.type !== 'COMPETENCIA_ESPECIFICA' && n.type !== 'SABER_BASICO',
  );

  // El anillo de criterios más grande manda: si dos competencias vecinas están
  // más juntas que la suma de sus anillos, sus criterios se mezclan y deja de
  // verse a qué competencia pertenece cada uno.
  const criteriosMax = Math.max(0, ...competencias.map((c) => hijos(c.id).length));
  const radioCriterios = radioPara(criteriosMax, 64, 58);
  const radioCompetencias = radioPara(competencias.length, radioCriterios * 2.5, 200);
  const radioSaberes = radioPara(saberes.length, 74, radioCompetencias + radioCriterios + 130);

  const radio = Math.max(radioCompetencias + radioCriterios, radioSaberes, 200) + 40;

  return {
    id: materia.id,
    radio,
    colocar(centro, destino) {
      const centrosCompetencia = anillo(competencias.length, centro, radioCompetencias);
      competencias.forEach((competencia, j) => {
        const centroCompetencia = centrosCompetencia[j] ?? centro;
        const criterios = hijos(competencia.id);
        const puntos = anillo(
          criterios.length,
          centroCompetencia,
          radioPara(criterios.length, 64, 52),
        );
        criterios.forEach((criterio, k) => {
          destino[criterio.id] = puntos[k] ?? centroCompetencia;
        });
        // Una competencia sin criterios dibujados no es un contenedor: necesita
        // su propio hueco o Cytoscape la deja en el origen.
        if (criterios.length === 0) destino[competencia.id] = centroCompetencia;
      });

      // Los saberes van fuera de todo, en el borde del territorio.
      anillo(saberes.length, centro, radioSaberes).forEach((punto, j) => {
        const saber = saberes[j];
        if (saber) destino[saber.id] = punto;
      });

      anillo(sueltos.length, centro, 140).forEach((punto, j) => {
        const nodo = sueltos[j];
        if (nodo) destino[nodo.id] = punto;
      });
    },
  };
}

/**
 * El radio de anillo más pequeño en el que caben todos los territorios sin tocarse.
 *
 * Un territorio de radio `r` colocado a distancia `R` del centro ocupa un ángulo
 * de `2·asin(r/R)`. La suma de todos ellos, más la holgura, tiene que caber en
 * una vuelta completa. Como esa suma decrece al crecer `R`, basta con buscar por
 * bisección el primer `R` que cumple.
 *
 * Se resuelve así y no con una fórmula cerrada porque el arcoseno no se despeja,
 * y no a ojo porque a ojo es exactamente como se producía el solapamiento.
 */
function radioSinSolape(radios: readonly number[], minimo: number): number {
  if (radios.length <= 1) return minimo;

  const anguloTotal = (R: number): number =>
    radios.reduce((suma, r) => {
      const seno = Math.min(1, (r + HOLGURA_ENTRE_MATERIAS / 2) / R);
      return suma + 2 * Math.asin(seno);
    }, 0);

  let bajo = minimo;
  let alto = Math.max(minimo, radios.reduce((s, r) => s + r, 0) * 2 + 1);
  if (anguloTotal(bajo) <= 2 * Math.PI) return bajo;

  for (let i = 0; i < 60; i += 1) {
    const medio = (bajo + alto) / 2;
    if (anguloTotal(medio) > 2 * Math.PI) bajo = medio;
    else alto = medio;
  }
  return alto;
}

/**
 * Coloca el grupo central: las situaciones con sus actividades alrededor.
 *
 * Devuelve el radio que ocupa, que es lo que después separa el anillo de materias
 * del centro. Sin este dato, la primera materia caería encima de las actividades.
 */
function colocarCentro(
  proyeccion: GraphProjection,
  destino: Record<string, Posicion>,
): { radio: number; anguloDe: Map<string, number> } {
  const situaciones = proyeccion.nodes.filter((n) => n.type === 'SITUACION_APRENDIZAJE');
  const actividades = proyeccion.nodes.filter((n) => n.type === 'ACTIVIDAD');
  const anguloDe = new Map<string, number>();

  // Qué situación contiene cada actividad, según la arista que ya las une.
  const situacionDe = new Map<string, string>();
  for (const arista of proyeccion.edges) {
    if (arista.type !== 'forma_parte_de') continue;
    situacionDe.set(arista.source, arista.target);
  }

  const radioSituaciones = situaciones.length <= 1 ? 0 : radioPara(situaciones.length, 340, 210);
  const centros = anillo(situaciones.length, { x: 0, y: 0 }, radioSituaciones);

  let maximo = 0;
  situaciones.forEach((situacion, i) => {
    const centro = centros[i] ?? { x: 0, y: 0 };
    destino[situacion.id] = centro;

    const suyas = actividades.filter((a) => situacionDe.get(a.id) === situacion.id);
    const radio = radioPara(suyas.length, 110, 130);
    anillo(suyas.length, centro, radio).forEach((punto, j) => {
      const actividad = suyas[j];
      if (!actividad) return;
      destino[actividad.id] = punto;
      anguloDe.set(actividad.id, Math.atan2(punto.y, punto.x));
      maximo = Math.max(maximo, Math.hypot(punto.x, punto.y));
    });
    maximo = Math.max(maximo, Math.hypot(centro.x, centro.y));
  });

  // Las actividades huérfanas —sin situación dibujada— van en su propio anillo.
  const huerfanas = actividades.filter((a) => destino[a.id] === undefined);
  anillo(huerfanas.length, { x: 0, y: 0 }, radioPara(huerfanas.length, 120, 160)).forEach(
    (punto, i) => {
      const actividad = huerfanas[i];
      if (!actividad) return;
      destino[actividad.id] = punto;
      anguloDe.set(actividad.id, Math.atan2(punto.y, punto.x));
      maximo = Math.max(maximo, Math.hypot(punto.x, punto.y));
    },
  );

  return { radio: maximo + 90, anguloDe };
}

/**
 * Ángulo preferido de cada materia: hacia dónde están sus actividades.
 *
 * Se promedia con vectores unitarios y no con la media de los ángulos, porque la
 * media de 350° y 10° son 180°, justo el lado contrario. Una materia sin ninguna
 * actividad devuelve `null` y se coloca donde quede hueco.
 */
function anguloPreferido(
  proyeccion: GraphProjection,
  anguloDeActividad: Map<string, number>,
  criterioDeMateria: Map<string, string>,
): Map<string, number | null> {
  const acumulado = new Map<string, { x: number; y: number }>();

  for (const arista of proyeccion.edges) {
    if (arista.type !== 'desarrolla' && arista.type !== 'moviliza') continue;
    const angulo = anguloDeActividad.get(arista.source);
    const materia = criterioDeMateria.get(arista.target);
    if (angulo === undefined || materia === undefined) continue;
    const suma = acumulado.get(materia) ?? { x: 0, y: 0 };
    suma.x += Math.cos(angulo);
    suma.y += Math.sin(angulo);
    acumulado.set(materia, suma);
  }

  const resultado = new Map<string, number | null>();
  for (const [materia, suma] of acumulado) {
    const magnitud = Math.hypot(suma.x, suma.y);
    resultado.set(materia, magnitud < 1e-6 ? null : Math.atan2(suma.y, suma.x));
  }
  return resultado;
}

/**
 * Calcula la posición de cada nodo hoja del nivel de currículo.
 *
 * Solo se posicionan las hojas y las materias vacías: los contenedores de
 * Cytoscape se ajustan solos al contenido, así que colocarlos sería trabajo
 * perdido y además pelearía con su propio cálculo de caja.
 */
export function radialPositions(projection: GraphProjection): Record<string, Posicion> {
  const posiciones: Record<string, Posicion> = {};

  const materias = projection.nodes.filter((n) => n.type === 'MATERIA');
  if (materias.length === 0) return posiciones;

  const contenedores = porContenedor(projection.nodes);
  const hijos = (id: string): GraphNode[] => contenedores.get(id) ?? [];

  const centro = colocarCentro(projection, posiciones);

  // El territorio hay que medirlo antes de repartir: su tamaño es lo que decide
  // el radio del anillo, y lo que faltaba cuando las materias se pisaban.
  const territorios = materias.map((materia) => medirTerritorio(materia, hijos));

  // De qué materia es cada criterio y cada saber, para saber a qué territorio
  // apunta cada arista que sale de una actividad.
  const padreDe = new Map(projection.nodes.map((n) => [n.id, n.parent]));
  const materiaDe = new Map<string, string>();
  for (const [padre, lista] of contenedores) {
    // El abuelo de un criterio es su materia; un saber cuelga de la materia
    // directamente y entonces su padre ya lo es.
    const materia = padreDe.get(padre) ?? padre;
    for (const nodo of lista) materiaDe.set(nodo.id, materia);
  }

  const preferidos = anguloPreferido(projection, centro.anguloDe, materiaDe);

  /**
   * Orden alrededor del anillo.
   *
   * Se ordena por el ángulo preferido para que cada materia caiga del lado de sus
   * actividades. Las que no tienen ninguna van al final, en el hueco que quede:
   * su posición no comunica nada, así que no compite por el sitio bueno.
   */
  const conAngulo = territorios
    .filter((t) => preferidos.get(t.id) != null)
    .sort((a, b) => (preferidos.get(a.id) ?? 0) - (preferidos.get(b.id) ?? 0));
  const sinAngulo = territorios.filter((t) => preferidos.get(t.id) == null);
  const ordenados = [...conAngulo, ...sinAngulo];

  const radioAnillo = radioSinSolape(
    ordenados.map((t) => t.radio),
    centro.radio + HOLGURA_AL_CENTRO + Math.max(...ordenados.map((t) => t.radio)),
  );

  /**
   * Reparto del ángulo proporcional al tamaño de cada territorio.
   *
   * Repartirlo a partes iguales dejaría a Música, con diez criterios, el mismo
   * sector que a Geografía, con veintinueve: una se quedaría con hueco de sobra y
   * la otra desbordaría sobre su vecina.
   */
  const anchuras = ordenados.map((t) => 2 * Math.asin(Math.min(1, t.radio / radioAnillo)));
  const ocupado = anchuras.reduce((suma, a) => suma + a, 0);
  const sobrante = Math.max(0, 2 * Math.PI - ocupado);
  const holgura = sobrante / ordenados.length;

  // Se empieza en el ángulo que pidió la primera materia, de modo que el orden
  // relativo alrededor del anillo sea el de sus actividades.
  const inicio = preferidos.get(ordenados[0]?.id ?? '') ?? -Math.PI / 2;
  let cursor = inicio - (anchuras[0] ?? 0) / 2 - holgura / 2;

  ordenados.forEach((territorio, i) => {
    const anchura = anchuras[i] ?? 0;
    const angulo = cursor + holgura / 2 + anchura / 2;
    territorio.colocar(enAngulo({ x: 0, y: 0 }, radioAnillo, angulo), posiciones);
    cursor += anchura + holgura;
  });

  // Cualquier nodo suelto que no haya entrado en el centro ni en un territorio
  // —un producto final, un hito— se coloca en un anillo interior, cerca de lo
  // que representa.
  const libres = projection.nodes.filter(
    (n) => n.parent === undefined && n.type !== 'MATERIA' && posiciones[n.id] === undefined,
  );
  anillo(libres.length, { x: 0, y: 0 }, radioPara(libres.length, 170, 180)).forEach((punto, i) => {
    const nodo = libres[i];
    if (nodo) posiciones[nodo.id] = punto;
  });

  return posiciones;
}
