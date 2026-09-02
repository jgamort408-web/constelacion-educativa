import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@/data/demo/ejemplo.ts';
import { project } from './projection.ts';
import { radialPositions } from './radial.ts';

/**
 * El reparto del mapa de currículo.
 *
 * Esta prueba existe por un fallo concreto: el radio del anillo de materias
 * estaba fijado a un número escrito a mano, y cualquier materia con muchos
 * criterios desbordaba sobre su vecina. En pantalla se veía enseguida; en el
 * código no se veía en absoluto, porque no había nada que lo comprobara.
 *
 * Se mide sobre las posiciones reales de los nodos, no sobre los radios que el
 * algoritmo cree tener. Es la diferencia entre comprobar el cálculo y comprobar
 * el resultado.
 */

const snapshot = buildDemoSnapshot();
const proyeccion = project(snapshot, 'CURRICULO', { grade: 1 });
const posiciones = radialPositions(proyeccion);

/** Distancia mínima admisible entre dos nodos de materias distintas. */
const SEPARACION_MINIMA = 45;

/** Agrupa las posiciones por la materia a la que pertenece cada nodo. */
function porMateria(): Map<string, { x: number; y: number }[]> {
  const padreDe = new Map(proyeccion.nodes.map((n) => [n.id, n.parent]));
  const esMateria = new Set(proyeccion.nodes.filter((n) => n.type === 'MATERIA').map((n) => n.id));

  const grupos = new Map<string, { x: number; y: number }[]>();
  for (const nodo of proyeccion.nodes) {
    const punto = posiciones[nodo.id];
    if (!punto || esMateria.has(nodo.id)) continue;

    // Se sube por los contenedores hasta dar con la materia: un criterio cuelga
    // de su competencia, y esta de la materia.
    let actual = padreDe.get(nodo.id);
    let saltos = 0;
    while (actual !== undefined && !esMateria.has(actual) && saltos < 6) {
      actual = padreDe.get(actual);
      saltos += 1;
    }
    if (actual === undefined || !esMateria.has(actual)) continue;

    const lista = grupos.get(actual);
    if (lista) lista.push(punto);
    else grupos.set(actual, [punto]);
  }
  return grupos;
}

describe('disposición del nivel de currículo', () => {
  it('coloca todos los criterios y saberes del curso', () => {
    const hojas = proyeccion.nodes.filter(
      (n) => n.type === 'CRITERIO_EVALUACION' || n.type === 'SABER_BASICO',
    );
    expect(hojas.length).toBeGreaterThan(100);
    const sinColocar = hojas.filter((n) => posiciones[n.id] === undefined);
    expect(sinColocar.map((n) => n.label)).toEqual([]);
  });

  it('cada materia ocupa un territorio propio', () => {
    const grupos = porMateria();
    expect(grupos.size).toBe(snapshot.subjects.length);
  });

  /**
   * La comprobación que motivó todo: ningún nodo de una materia puede caer
   * encima de otro de una materia distinta.
   */
  it('ningún territorio se solapa con otro', () => {
    const grupos = [...porMateria().entries()];
    const nombre = new Map(snapshot.subjects.map((s) => [s.id, s.shortName]));
    const choques: string[] = [];

    for (let i = 0; i < grupos.length; i += 1) {
      for (let j = i + 1; j < grupos.length; j += 1) {
        const [idA, puntosA] = grupos[i] ?? ['', []];
        const [idB, puntosB] = grupos[j] ?? ['', []];
        let minimo = Infinity;
        for (const a of puntosA) {
          for (const b of puntosB) {
            minimo = Math.min(minimo, Math.hypot(a.x - b.x, a.y - b.y));
          }
        }
        if (minimo < SEPARACION_MINIMA) {
          choques.push(
            `${nombre.get(idA) ?? idA} y ${nombre.get(idB) ?? idB} se acercan a ${minimo.toFixed(0)}`,
          );
        }
      }
    }

    expect(choques, `\n${choques.join('\n')}\n`).toEqual([]);
  });

  /**
   * Las actividades ocupan el centro y el currículo lo rodea a distancia.
   *
   * Sin esta separación, las aristas de una actividad a sus criterios nacen y
   * mueren en la misma maraña y el mapa deja de contar nada.
   */
  it('el currículo no invade el grupo central de actividades', () => {
    const actividades = proyeccion.nodes
      .filter((n) => n.type === 'ACTIVIDAD')
      .map((n) => posiciones[n.id])
      .filter((p): p is { x: number; y: number } => p !== undefined);
    expect(actividades.length).toBe(snapshot.activities.length);

    const radioCentro = Math.max(...actividades.map((p) => Math.hypot(p.x, p.y)));

    const curriculares = proyeccion.nodes
      .filter((n) => n.type === 'CRITERIO_EVALUACION' || n.type === 'SABER_BASICO')
      .map((n) => posiciones[n.id])
      .filter((p): p is { x: number; y: number } => p !== undefined);

    const invasores = curriculares.filter((p) => Math.hypot(p.x, p.y) <= radioCentro);
    expect(invasores.length, `${invasores.length} elementos curriculares en el centro`).toBe(0);
  });

  /**
   * Dentro de una competencia, los criterios van en orden alrededor del anillo.
   *
   * Es lo que permite encontrar el 1.3 mirando entre el 1.2 y el 1.4 en vez de
   * leer etiquetas una por una. Se comprueba que el orden angular coincide con el
   * orden natural del código.
   */
  it('los criterios de una competencia van en orden alrededor de ella', () => {
    const criterios = proyeccion.nodes.filter((n) => n.type === 'CRITERIO_EVALUACION');
    const porCompetencia = new Map<string, typeof criterios>();
    for (const criterio of criterios) {
      if (criterio.parent === undefined) continue;
      const lista = porCompetencia.get(criterio.parent);
      if (lista) lista.push(criterio);
      else porCompetencia.set(criterio.parent, [criterio]);
    }

    const grupo = [...porCompetencia.values()].find((lista) => lista.length >= 3);
    expect(grupo).toBeDefined();
    if (!grupo) return;

    const puntos = grupo
      .map((n) => posiciones[n.id])
      .filter((p): p is { x: number; y: number } => p !== undefined);

    let sumaX = 0;
    let sumaY = 0;
    for (const punto of puntos) {
      sumaX += punto.x;
      sumaY += punto.y;
    }
    const centro = { x: sumaX / puntos.length, y: sumaY / puntos.length };
    const angulos = puntos.map((p) => Math.atan2(p.y - centro.y, p.x - centro.x));

    // Los ángulos crecen monótonamente salvo una vuelta: es un anillo, no una
    // recta, así que se admite exactamente un salto hacia atrás.
    const retrocesos = angulos.filter((a, i) => i > 0 && a < (angulos[i - 1] ?? 0)).length;
    expect(retrocesos).toBeLessThanOrEqual(1);
  });
});
