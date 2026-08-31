# `src/services/`

Coordinación entre capas: casos de uso que combinan dominio y persistencia.

## Puede vivir aquí

- Casos de uso como "crear actividad y sus aristas en una sola transacción".
- Copia de seguridad automática, exportación programada.

## No puede vivir aquí

- Reglas de negocio puras (van a `domain/`) ni acceso directo a Dexie (va por el repositorio).
