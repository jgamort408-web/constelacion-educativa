import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    // Las pruebas de interfaz declaran su propio entorno con
    // `// @vitest-environment jsdom` en la cabecera del archivo.
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/data/**'],
      reporter: ['text', 'html'],
    },
  },
});
