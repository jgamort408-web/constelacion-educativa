import type { RefObject } from 'react';

/**
 * Controles de navegación del mapa.
 *
 * La rueda del ratón sola es un mal instrumento para recorrer un grafo: obliga a
 * muchos gestos pequeños para cruzar el rango útil de zoom, y en un portátil con
 * panel táctil se vuelve impreciso. Aquí van los tres controles que un docente
 * espera y que la rueda no da:
 *
 *   · una barra para saltar a cualquier nivel de zoom de un tirón;
 *   · botones de acercar y alejar, que son lo que se usa al proyectar en clase
 *     con un mando o un ratón sin rueda cómoda;
 *   · encuadrar, que devuelve al mapa completo cuando uno se pierde, y que es la
 *     salida de emergencia más pedida en cualquier lienzo navegable.
 *
 * Todos animan el cambio en lugar de saltar: un salto instantáneo obliga a
 * reconstruir mentalmente dónde estaba cada cosa.
 */

interface Props {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoom: (nivel: number) => void;
  onFit: () => void;
  onCenterSelection: () => void;
  haySeleccion: boolean;
  barraRef?: RefObject<HTMLInputElement | null>;
}

/**
 * La barra trabaja en escala logarítmica.
 *
 * El zoom se percibe de forma multiplicativa: ir de 0,2 a 0,4 se siente igual que
 * ir de 2 a 4. En escala lineal, la mitad del recorrido de la barra se gastaría
 * en los niveles más alejados y el rango útil quedaría apelotonado al final.
 */
function aPosicion(zoom: number, min: number, max: number): number {
  return (Math.log(zoom) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

function aZoom(posicion: number, min: number, max: number): number {
  return Math.exp(Math.log(min) + posicion * (Math.log(max) - Math.log(min)));
}

export function MapNavigation({
  zoom,
  minZoom,
  maxZoom,
  onZoom,
  onFit,
  onCenterSelection,
  haySeleccion,
  barraRef,
}: Props) {
  const posicion = aPosicion(zoom, minZoom, maxZoom);
  const porcentaje = Math.round(zoom * 100);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-cielo-700 bg-cielo-800/60 px-3 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            onZoom(Math.max(minZoom, zoom / 1.5));
          }}
          aria-label="Alejar"
          className="h-7 w-7 rounded border border-borde-500 text-tinta-300 transition-colors hover:border-laton-500 hover:text-laton-400"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            onZoom(Math.min(maxZoom, zoom * 1.5));
          }}
          aria-label="Acercar"
          className="h-7 w-7 rounded border border-borde-500 text-tinta-300 transition-colors hover:border-laton-500 hover:text-laton-400"
        >
          +
        </button>
      </div>

      <label className="flex flex-1 items-center gap-2 text-xs text-tinta-500">
        <span className="sr-only">Nivel de zoom</span>
        <input
          ref={barraRef}
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={posicion}
          onChange={(evento) => {
            onZoom(aZoom(Number(evento.target.value), minZoom, maxZoom));
          }}
          aria-valuetext={`${porcentaje} por ciento`}
          className="min-w-[140px] flex-1 accent-laton-500"
        />
        <span className="w-12 text-right font-mono tabular-nums">{porcentaje} %</span>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onFit}
          className="rounded border border-borde-500 px-2.5 py-1 text-xs text-tinta-300 transition-colors hover:border-laton-500 hover:text-laton-400"
        >
          Encuadrar
        </button>
        <button
          type="button"
          onClick={onCenterSelection}
          disabled={!haySeleccion}
          className="rounded border border-borde-500 px-2.5 py-1 text-xs text-tinta-300 transition-colors hover:border-laton-500 hover:text-laton-400 disabled:opacity-40"
        >
          Ir a la selección
        </button>
      </div>

      <p className="w-full text-[11px] text-tinta-500">
        Arrastra el fondo para desplazarte · doble clic en un nodo para centrarlo ·{' '}
        <kbd className="rounded bg-cielo-700 px-1">+</kbd>{' '}
        <kbd className="rounded bg-cielo-700 px-1">−</kbd> con el mapa enfocado ·{' '}
        <kbd className="rounded bg-cielo-700 px-1">0</kbd> para encuadrar
      </p>
    </div>
  );
}
