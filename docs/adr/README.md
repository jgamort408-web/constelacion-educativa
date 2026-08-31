# Registros de decisión de arquitectura

Cada archivo documenta **una** decisión estructural: qué se decidió, por qué, y qué se
descartó. Son cortos a propósito.

Se escribe un ADR cuando una decisión es cara de revertir. No para elegir el nombre de una
variable.

| #                                         | Decisión                                         | Estado   |
| ----------------------------------------- | ------------------------------------------------ | -------- |
| [0001](0001-dominio-puro.md)              | El dominio no depende de ningún framework        | Aceptada |
| [0002](0002-repositorio-de-datos.md)      | Todo acceso a datos pasa por una interfaz        | Aceptada |
| [0003](0003-relaciones-como-entidades.md) | Las relaciones son entidades, no arrays de IDs   | Aceptada |
| [0004](0004-zod-fuente-unica.md)          | Zod es la única fuente del contrato de datos     | Aceptada |
| [0005](0005-base-de-datos-local.md)       | IndexedDB con esquema versionado y CRUD completo | Aceptada |
