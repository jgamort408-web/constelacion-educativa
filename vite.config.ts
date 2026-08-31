import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// El `base` se ajusta en el despliegue a GitHub Pages, donde la app cuelga de
// /constelacion-educativa/ y no de la raíz del dominio.
const base = process.env.GITHUB_PAGES === 'true' ? '/constelacion-educativa/' : '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
