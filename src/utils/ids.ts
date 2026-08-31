/**
 * Generación de identificadores.
 *
 * Dos funciones con propósitos opuestos y deliberadamente separadas: una para
 * datos nuevos que crea un docente, y otra para datos derivados de una fuente
 * conocida, donde el identificador debe salir siempre igual.
 */

/**
 * Identificador para una entidad nueva.
 *
 * `crypto.randomUUID` existe en todos los navegadores actuales y en Node desde la
 * versión 19. El respaldo cubre contextos sin origen seguro (por ejemplo, servir
 * la aplicación por HTTP en una IP local de un centro), donde `crypto.randomUUID`
 * no está disponible aunque el navegador sea moderno.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Marca de versión 4 y variante RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Identificador reproducible a partir de una clave legible.
 *
 * Lo usan los datos de demostración y el importador curricular: cargar dos veces
 * la misma fuente debe producir los mismos identificadores, o cada importación
 * duplicaría el currículo entero en vez de actualizarlo.
 *
 * No es un UUID v5 criptográfico —no hace falta, no hay ningún requisito de
 * seguridad aquí—, pero sí cumple el formato y reparte bien para las escalas de
 * esta aplicación.
 */
export function stableId(namespace: string, key: string): string {
  const digest = fnv128(`${namespace}::${key}`);
  const chars = digest.split('');
  // Versión 4 y variante, para que el resultado sea un UUID formalmente válido.
  chars[12] = '4';
  chars[16] = '8';
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Cuatro pasadas de FNV-1a con semillas distintas, para llegar a 128 bits. */
function fnv128(input: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  return seeds
    .map((seed) => {
      let hash = seed >>> 0;
      for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, '0');
    })
    .join('');
}
