# `src/ai/`

La costura para el futuro copiloto pedagógico. En la v0.1 solo existe el contrato; no se hace ninguna llamada a ningún modelo.

## Puede vivir aquí

- La interfaz `AIProvider`.
- Tipos de propuesta y su validación contra el esquema del dominio.
- Implementaciones inertes o de pegado manual de JSON.

## No puede vivir aquí

- Claves de API. Nunca, bajo ninguna circunstancia, en el cliente.
- Escrituras directas en la base de datos: toda propuesta pasa por validación y aprobación humana.
