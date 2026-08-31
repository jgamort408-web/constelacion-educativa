/**
 * `cytoscape-fcose` no publica tipos propios.
 *
 * Se declara el mínimo que usamos: la extensión es una función que Cytoscape
 * registra. Escribir aquí una firma inventada más rica daría una falsa sensación
 * de seguridad sobre unas opciones que nadie ha verificado.
 */
declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape';
  const extension: Ext;
  export default extension;
}
