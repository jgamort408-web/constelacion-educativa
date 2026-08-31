/**
 * Andamiaje de la fase 0. La aplicación real se construye a partir de la fase 4;
 * hasta entonces esta pantalla solo confirma que la cadena de herramientas
 * (Vite, React, TypeScript estricto, Tailwind) está correctamente montada.
 */
export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="font-mono text-xs tracking-[0.16em] text-laton-500 uppercase">
        Fase 0 · Fundación
      </p>
      <h1 className="text-4xl font-medium tracking-tight text-tinta-100">Constelación Educativa</h1>
      <p className="max-w-prose text-tinta-300">
        Cadena de herramientas operativa. El dominio se construye en la fase 1, antes que cualquier
        pantalla.
      </p>
    </main>
  );
}
