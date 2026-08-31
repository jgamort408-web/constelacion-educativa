# 0001 · El dominio no depende de ningún framework

**Estado:** aceptada · 2026-08-31

## Contexto

El prompt maestro (§27) pide un dominio reutilizable para que en el futuro sea posible
construir aplicaciones móviles o de tablet sobre la misma lógica. La tentación habitual es
escribir las reglas de negocio dentro de los componentes de React, donde son cómodas de
usar e imposibles de reutilizar o probar.

## Decisión

`src/domain/` no importa `react`, `react-dom`, `dexie`, `cytoscape` ni `zustand`, ni usa
`window`, `document`, `localStorage` o `indexedDB`.

La regla no es una convención: `tests/architecture.test.ts` la comprueba en cada push y el
CI falla si se incumple.

## Consecuencias

- El cálculo de contribuciones, la detección de ciclos y la validación pedagógica se pueden
  ejecutar en Node, en un script de línea de comandos o en un backend sin cambiar una línea.
- Las pruebas del dominio no necesitan montar componentes ni simular un navegador: son
  funciones puras con entradas y salidas.
- **Coste:** hay que pasar datos explícitamente en lugar de leerlos de un contexto o un
  store. Es más verboso, y es exactamente lo que lo hace reutilizable.

## Alternativas descartadas

- **Lógica en los componentes.** Más rápido al principio; imposible de reutilizar y costoso
  de probar.
- **La regla como convención documentada.** Sin verificación automática se incumple en
  cuestión de semanas.
