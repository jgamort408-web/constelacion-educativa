import { z } from 'zod';
import { contributionModeSchema, edgeTypeSchema, nodeTypeSchema } from './enums.ts';
import { countSchema, richText, uuidSchema, weightSchema } from './primitives.ts';

/**
 * La relación como entidad de primera clase (ADR 0003, §19).
 *
 * Esta es la decisión de modelado sobre la que descansa todo lo demás. Una
 * relación de este dominio tiene atributos propios: cuando Matemáticas participa
 * en una situación de aprendizaje, esa participación tiene una intensidad, un
 * número de sesiones, unos criterios asociados y una procedencia. Un array de
 * identificadores no puede llevar nada de eso.
 */

export const edgeMetadataSchema = z.object({
  /**
   * Intensidad de la relación, entre 0 y 1 (§2).
   *
   * Solo tiene sentido en los tipos de arista marcados como `weighted` en
   * `EDGE_RULES`; en el resto es `null`.
   */
  weight: weightSchema.nullable(),
  /**
   * Cómo se obtuvo esa intensidad (§20).
   *
   * `MANUAL` es intocable por el recálculo. Guardar la procedencia junto al valor,
   * y no en una tabla aparte, es lo que hace imposible perderla al actualizar.
   */
  mode: contributionModeSchema.default('MANUAL'),
  /** Sesiones que esta relación consume, cuando la relación es temporal. */
  sessions: countSchema.nullable(),
  /** Criterios de evaluación implicados en esta relación concreta. */
  criteriaIds: z.array(uuidSchema).default([]),
  /** Anotación del equipo docente sobre por qué existe esta relación. */
  note: richText(600),
});
export type EdgeMetadata = z.infer<typeof edgeMetadataSchema>;

/**
 * Una arista del grafo.
 *
 * Guarda el tipo de nodo de ambos extremos además de su identificador. Es
 * redundante —se podría deducir buscando la entidad—, y esa redundancia es
 * deliberada: permite validar la arista y proyectarla al grafo sin resolver
 * ninguna referencia, que es la diferencia entre un mapa que responde al instante
 * y uno que va a tirones con 1500 conexiones (§28).
 */
export const edgeSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  type: edgeTypeSchema,
  sourceId: uuidSchema,
  sourceType: nodeTypeSchema,
  targetId: uuidSchema,
  targetType: nodeTypeSchema,
  metadata: edgeMetadataSchema,
});
export type Edge = z.infer<typeof edgeSchema>;

/** Referencia a un nodo cualquiera del grafo, con su tipo. */
export const nodeRefSchema = z.object({
  id: uuidSchema,
  type: nodeTypeSchema,
});
export type NodeRef = z.infer<typeof nodeRefSchema>;
