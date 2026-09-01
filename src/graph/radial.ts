import type { GraphProjection } from './projection.ts';

/**
 * Disposición radial del nivel de currículo.
 *
 * Los algoritmos de fuerzas colocan bien lo que está conectado, y en este nivel
 * casi nada lo está: la mayoría de los criterios no se ha asignado todavía a
 * ninguna actividad. fCoSE los empaquetaba en una rejilla arriba a la izquierda
 * de su caja, dejando el resto vacío y sin ningún orden que ayudara a encontrar
 * uno concreto.
 *
 * Aquí las posiciones se calculan: cada materia ocupa un sector, sus competencias
 * se reparten en un anillo alrededor del centro de la materia, y los criterios de
 * cada competencia forman su propio anillo pequeño. Los saberes quedan en un
 * anillo exterior.
 *
 * La ventaja no es estética: al ir en orden alrededor del anillo, **el criterio
 * 1.3 está siempre entre el 1.2 y el 1.4**. Un docente que busca uno concreto lo
 * encuentra por posición, no leyendo etiquetas de una en una.
 */

export interface Posicion {
  x: number;
  y: number;
}

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
  if (n === 1) return [{ x: centro.x, y: centro.y }];
  return Array.from({ length: n }, (_, i) => {
    const angulo = desfase + (2 * Math.PI * i) / n;
    return { x: centro.x + radio * Math.cos(angulo), y: centro.y + radio * Math.sin(angulo) };
  });
}

/**
 * Calcula la posición de cada nodo hoja del nivel de currículo.
 *
 * Solo se posicionan las hojas: los contenedores de Cytoscape se ajustan solos
 * al contenido, así que colocarlos sería trabajo perdido y además pelearía con
 * su propio cálculo de caja.
 */
export function radialPositions(projection: GraphProjection): Record<string, Posicion> {
  const posiciones: Record<string, Posicion> = {};

  const materias = projection.nodes.filter((n) => n.type === 'MATERIA');
  if (materias.length === 0) return posiciones;

  const porPadre = new Map<string, typeof projection.nodes>();
  for (const nodo of projection.nodes) {
    if (nodo.parent === undefined) continue;
    const lista = porPadre.get(nodo.parent) ?? [];
    porPadre.set(nodo.parent, [...lista, nodo]);
  }

  // Los nodos ya vienen ordenados de forma natural desde la proyección, así que
  // el orden del anillo es el orden del código: 1.1, 1.2, … 1.9, 1.10.
  const hijos = (id: string) => porPadre.get(id) ?? [];

  const radioMateria = radioPara(materias.length, 780, 480);
  const centrosMateria = anillo(materias.length, { x: 0, y: 0 }, radioMateria);

  materias.forEach((materia, indice) => {
    const centro = centrosMateria[indice] ?? { x: 0, y: 0 };
    const contenido = hijos(materia.id);
    const competencias = contenido.filter((n) => n.type === 'COMPETENCIA_ESPECIFICA');
    const saberes = contenido.filter((n) => n.type === 'SABER_BASICO');
    const sueltos = contenido.filter(
      (n) => n.type !== 'COMPETENCIA_ESPECIFICA' && n.type !== 'SABER_BASICO',
    );

    // Anillo de competencias. El radio crece con el tamaño del mayor grupo de
    // criterios, para que dos competencias vecinas no se solapen.
    const criteriosMax = Math.max(1, ...competencias.map((c) => hijos(c.id).length));
    const radioCriterios = radioPara(criteriosMax, 62, 62);
    const radioCompetencias = radioPara(competencias.length, radioCriterios * 2.4, 190);
    const centrosCompetencia = anillo(competencias.length, centro, radioCompetencias);

    competencias.forEach((competencia, j) => {
      const centroCompetencia = centrosCompetencia[j] ?? centro;
      const criterios = hijos(competencia.id);
      const radio = radioPara(criterios.length, 62, 52);
      const puntos = anillo(criterios.length, centroCompetencia, radio);
      criterios.forEach((criterio, k) => {
        posiciones[criterio.id] = puntos[k] ?? centroCompetencia;
      });
      // Una competencia sin criterios dibujados necesita su propio hueco.
      if (criterios.length === 0) posiciones[competencia.id] = centroCompetencia;
    });

    // Los saberes van fuera de todo, en el borde del sector de la materia.
    const radioSaberes = radioCompetencias + radioCriterios + 110;
    anillo(saberes.length, centro, radioPara(saberes.length, 70, radioSaberes)).forEach(
      (punto, j) => {
        const saber = saberes[j];
        if (saber) posiciones[saber.id] = punto;
      },
    );

    anillo(sueltos.length, centro, 140).forEach((punto, j) => {
      const nodo = sueltos[j];
      if (nodo) posiciones[nodo.id] = punto;
    });
  });

  // Lo que no cuelga de ninguna materia —actividades, situación, proyecto— se
  // coloca en el centro del sistema, que es donde el docente lo busca.
  const libres = projection.nodes.filter(
    (n) => n.parent === undefined && n.type !== 'MATERIA' && posiciones[n.id] === undefined,
  );
  anillo(libres.length, { x: 0, y: 0 }, radioPara(libres.length, 170, 180)).forEach((punto, i) => {
    const nodo = libres[i];
    if (nodo) posiciones[nodo.id] = punto;
  });

  return posiciones;
}
