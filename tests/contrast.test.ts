import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contraste del tema, verificado contra WCAG 2.2 AA (§16).
 *
 * Los colores se leen de `src/index.css`, no se copian aquí. Copiarlos
 * garantizaría que un día alguien cambie el CSS, la prueba siga en verde y la
 * aplicación deje de ser legible sin que nadie se entere.
 *
 * Umbrales de la norma:
 *   - Texto normal: 4.5:1
 *   - Texto grande (≥ 18.66 px en negrita o ≥ 24 px): 3:1
 *   - Componentes de interfaz y bordes con significado: 3:1
 */

const CSS = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');

/** Extrae los tokens `--color-*` del bloque `@theme`. */
function readTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  const pattern = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(CSS)) !== null) {
    if (match[1] && match[2]) tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

const TOKENS = readTokens();

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa, según la definición de WCAG. */
function luminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function token(name: string): string {
  const value = TOKENS[name];
  if (value === undefined) {
    throw new Error(`Falta el token --color-${name} en src/index.css`);
  }
  return value;
}

describe('el tema define sus colores como tokens', () => {
  it('todos los tokens que usa la aplicación existen', () => {
    for (const name of [
      'cielo-950',
      'cielo-900',
      'cielo-800',
      'cielo-700',
      'cielo-600',
      'tinta-100',
      'tinta-300',
      'tinta-500',
      'laton-400',
      'laton-500',
    ]) {
      expect(() => token(name)).not.toThrow();
    }
  });
});

describe('contraste de texto (WCAG 2.2 AA · 4.5:1)', () => {
  const fondos = [
    ['cielo-900', 'el fondo de la aplicación'],
    ['cielo-800', 'las tarjetas'],
    ['cielo-700', 'las filas resaltadas'],
  ] as const;

  for (const [fondo, donde] of fondos) {
    it(`el texto principal se lee sobre ${donde}`, () => {
      const ratio = contrast(token('tinta-100'), token(fondo));
      expect(ratio, `tinta-100 sobre ${fondo}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });

    it(`el texto secundario se lee sobre ${donde}`, () => {
      const ratio = contrast(token('tinta-300'), token(fondo));
      expect(ratio, `tinta-300 sobre ${fondo}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('el acento de latón se lee sobre el fondo', () => {
    const ratio = contrast(token('laton-400'), token('cielo-900'));
    expect(ratio, `laton-400 sobre cielo-900: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contraste de elementos no textuales (WCAG 1.4.11 · 3:1)', () => {
  it('el anillo de foco destaca sobre el fondo', () => {
    // Sin esto, la navegación por teclado existe pero no se ve dónde estás, que
    // a efectos prácticos es no tenerla.
    const ratio = contrast(token('laton-400'), token('cielo-900'));
    expect(ratio, `laton-400 sobre cielo-900: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  it('el borde de los controles interactivos llega a 3:1', () => {
    // El criterio 1.4.11 exige 3:1 para lo que delimita un componente de
    // interfaz. En un botón cuyo único límite visual es su borde, ese borde ES
    // el componente: si no se distingue del fondo, el botón no se ve.
    const ratio = contrast(token('borde-500'), token('cielo-900'));
    expect(ratio, `borde-500 sobre cielo-900: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  it('el estado activo se distingue del inactivo por algo más que el color', () => {
    // La §16 prohíbe que el color sea el único portador de información. Los
    // botones de materia desactivados llevan además tachado, y las celdas de la
    // matriz con valor manual llevan borde y punto. Esta prueba fija la regla
    // en el código para que se busque al añadir un estado nuevo.
    const marcadores = readFileSync(
      fileURLToPath(new URL('../src/features/map/MapControls.tsx', import.meta.url)),
      'utf8',
    );
    expect(marcadores).toContain('line-through');
  });
});

describe('el borde decorativo NO se usa como límite de control', () => {
  /**
   * `cielo-600` se queda en 1,47:1 y es correcto: separa zonas, no delimita
   * componentes. Esta prueba impide que se cuele en un botón o un campo, que es
   * exactamente el error que se corrigió al auditar la fase 6.
   */
  it('cielo-600 no aparece como borde de un botón o un campo', () => {
    const fuentes = ['../src/App.tsx', '../src/features/map/MapControls.tsx'].map((relative) =>
      readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'),
    );

    for (const source of fuentes) {
      const sospechosos = [...source.matchAll(/<(button|select|input)[^>]*/g)]
        .map((match) => match[0])
        .filter((tag) => tag.includes('border-cielo-600'));

      expect(
        sospechosos,
        `Estos controles usan el borde decorativo como único límite:\n${sospechosos.join('\n')}`,
      ).toEqual([]);
    }
  });
});

describe('texto atenuado', () => {
  /**
   * `tinta-500` se usa en rótulos pequeños y notas al pie. Si no llega a 4.5:1 no
   * puede llevar información necesaria: la prueba deja constancia del valor real
   * para que la decisión sea consciente y no un descuido.
   */
  it('tinta-500 alcanza al menos el umbral de texto grande (3:1)', () => {
    const ratio = contrast(token('tinta-500'), token('cielo-900'));
    expect(ratio, `tinta-500 sobre cielo-900: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });
});
