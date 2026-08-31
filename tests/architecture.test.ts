import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

/**
 * Reglas de dependencia entre capas.
 *
 * No son documentación: si alguien las incumple, el build falla. Es lo único que
 * mantiene honesta la promesa de que el dominio se puede reutilizar fuera de
 * este navegador (ver docs/adr/0001-dominio-puro.md).
 */
const FORBIDDEN_IMPORTS: Record<string, { packages: string[]; reason: string }> = {
  domain: {
    packages: ['react', 'react-dom', 'dexie', 'cytoscape', 'zustand', 'cytoscape-fcose'],
    reason:
      'El dominio debe poder ejecutarse en Node, en un script o en un backend. Si necesita React, Dexie o Cytoscape, deja de ser reutilizable.',
  },
  data: {
    packages: ['react', 'react-dom', 'cytoscape', 'cytoscape-fcose'],
    reason: 'La capa de datos no dibuja nada. Solo persiste.',
  },
  components: {
    packages: ['dexie', 'cytoscape'],
    reason:
      'Los componentes reutilizables reciben todo por props. Si tocan la base de datos, pertenecen a features/.',
  },
};

/** Las APIs de navegador tampoco pueden aparecer en el dominio. */
const FORBIDDEN_GLOBALS = ['window.', 'document.', 'localStorage', 'sessionStorage', 'indexedDB'];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Extrae los módulos importados, ignorando los que aparecen en comentarios. */
function importedModules(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const specifiers: string[] = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s[^;]*?from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(withoutComments)) !== null) {
      if (match[1] !== undefined) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

/** `react-dom/client` cuenta como `react-dom`; `@/domain/x` no cuenta como paquete. */
function rootPackage(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('node:')) {
    return null;
  }
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? null);
}

describe('reglas de arquitectura', () => {
  for (const [layer, rule] of Object.entries(FORBIDDEN_IMPORTS)) {
    it(`src/${layer}/ no importa: ${rule.packages.join(', ')}`, () => {
      const files = collectSourceFiles(join(SRC, layer));
      const violations: string[] = [];

      for (const file of files) {
        const source = readFileSync(file, 'utf8');
        for (const specifier of importedModules(source)) {
          const pkg = rootPackage(specifier);
          if (pkg !== null && rule.packages.includes(pkg)) {
            violations.push(`${relative(ROOT, file).split(sep).join('/')} → '${specifier}'`);
          }
        }
      }

      expect(
        violations,
        `\n${rule.reason}\n\nInfracciones:\n  ${violations.join('\n  ')}\n`,
      ).toEqual([]);
    });
  }

  it('src/domain/ no usa APIs del navegador', () => {
    const files = collectSourceFiles(join(SRC, 'domain'));
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const global of FORBIDDEN_GLOBALS) {
        if (source.includes(global)) {
          violations.push(`${relative(ROOT, file).split(sep).join('/')} → '${global}'`);
        }
      }
    }

    expect(
      violations,
      `\nEl dominio no puede depender de que exista un navegador.\n\nInfracciones:\n  ${violations.join('\n  ')}\n`,
    ).toEqual([]);
  });

  it('solo src/data/ conoce Dexie', () => {
    // Es la regla del ADR 0002 y la que hace barata la migración a Supabase: si
    // una pantalla llama a Dexie directamente, cambiar de motor de persistencia
    // deja de ser escribir una implementación y pasa a ser reescribir la interfaz.
    const layers = readdirSync(SRC).filter(
      (entry) => entry !== 'data' && statSync(join(SRC, entry)).isDirectory(),
    );

    const violations: string[] = [];
    for (const layer of layers) {
      for (const file of collectSourceFiles(join(SRC, layer))) {
        const source = readFileSync(file, 'utf8');
        for (const specifier of importedModules(source)) {
          if (rootPackage(specifier) === 'dexie') {
            violations.push(relative(ROOT, file).split(sep).join('/'));
          }
        }
      }
    }

    expect(
      violations,
      `\nEstos archivos importan Dexie fuera de src/data/:\n  ${violations.join('\n  ')}\n\nUsa la interfaz ProjectRepository.\n`,
    ).toEqual([]);
  });

  it('cada carpeta de src/ documenta qué puede vivir en ella', () => {
    const dirs = readdirSync(SRC).filter((entry) => statSync(join(SRC, entry)).isDirectory());
    const undocumented = dirs.filter((dir) => {
      try {
        return !statSync(join(SRC, dir, 'README.md')).isFile();
      } catch {
        return true;
      }
    });

    expect(
      undocumented,
      `\nEstas carpetas no explican su propósito y acabarán siendo un cajón de sastre:\n  ${undocumented.join('\n  ')}\n`,
    ).toEqual([]);
  });
});
