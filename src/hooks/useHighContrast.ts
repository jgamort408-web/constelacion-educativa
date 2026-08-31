import { useCallback, useEffect, useState } from 'react';

/**
 * Modo de alto contraste (§16).
 *
 * Marca el elemento raíz con `data-contraste="alto"`, que redefine los tokens de
 * color en `index.css`. Ningún componente necesita enterarse: siguen usando los
 * mismos nombres de color.
 *
 * La preferencia se guarda en `localStorage` porque es del navegador de quien la
 * activa, no del proyecto. Si viviera en la base de datos, exportar un proyecto
 * llevaría dentro cómo prefiere ver la pantalla una persona concreta, que no
 * tiene nada que ver con la programación didáctica.
 *
 * El acceso va en `try`: en modo privado o con las cookies de sitio bloqueadas,
 * `localStorage` no solo devuelve vacío, sino que lanza. Sin esto, un navegador
 * restrictivo dejaría la aplicación en blanco.
 */

const CLAVE = 'constelacion:contraste';

function leerPreferencia(): boolean {
  try {
    if (localStorage.getItem(CLAVE) === 'alto') return true;
  } catch {
    // Sin almacenamiento disponible: se cae a la preferencia del sistema.
  }
  try {
    return window.matchMedia('(prefers-contrast: more)').matches;
  } catch {
    return false;
  }
}

export function useHighContrast(): { activo: boolean; alternar: () => void } {
  const [activo, setActivo] = useState(leerPreferencia);

  useEffect(() => {
    const raiz = document.documentElement;
    if (activo) {
      raiz.setAttribute('data-contraste', 'alto');
    } else {
      raiz.removeAttribute('data-contraste');
    }

    try {
      localStorage.setItem(CLAVE, activo ? 'alto' : 'normal');
    } catch {
      // La preferencia no se recordará entre sesiones. No es motivo para fallar.
    }
  }, [activo]);

  const alternar = useCallback(() => {
    setActivo((anterior) => !anterior);
  }, []);

  return { activo, alternar };
}
