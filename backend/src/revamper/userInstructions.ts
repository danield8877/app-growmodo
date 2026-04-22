/** Limites séparées : la base reste prioritaire si le prompt total doit être réduit. */
export const MAX_BASE_INSTRUCTIONS = 6000;
export const MAX_SUPPLEMENTARY_INSTRUCTIONS = 2000;

export type ParsedUserInstructions = {
  baseInstructions?: string;
  supplementaryInstructions?: string;
};

/**
 * Parse les consignes utilisateur (camelCase ou snake_case).
 * `additionalInstructions` historique = consignes « principales » si `baseInstructions` est vide.
 */
export function parseUserInstructionsBody(body: Record<string, unknown>): ParsedUserInstructions {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  let base = s(body.baseInstructions) || s(body.base_instructions);
  let sup = s(body.supplementaryInstructions) || s(body.supplementary_instructions);
  const legacy = s(body.additionalInstructions) || s(body.additional_instructions);
  if (!base && legacy) base = legacy;
  if (base.length > MAX_BASE_INSTRUCTIONS) base = base.slice(0, MAX_BASE_INSTRUCTIONS);
  if (sup.length > MAX_SUPPLEMENTARY_INSTRUCTIONS) sup = sup.slice(0, MAX_SUPPLEMENTARY_INSTRUCTIONS);
  return {
    baseInstructions: base || undefined,
    supplementaryInstructions: sup || undefined,
  };
}
