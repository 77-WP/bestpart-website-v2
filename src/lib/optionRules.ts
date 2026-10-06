/* ── Option visibility rules ──────────────────────────────────
   Pure function — no React, no Supabase, safe to test in Node.
──────────────────────────────────────────────────────────── */

export type OptionRule = {
  category_id: string;
  option_id: string;
  requires_any: string[];
};

/**
 * Returns true when an option must be hidden because none of
 * its required trigger options have been selected.
 *
 * @param optionId          The option to test.
 * @param selectedOptionIds All currently-selected option IDs (flat list).
 * @param rules             Option rules from bp_public_menu_state
 *                          (may be all rules or pre-filtered — both work).
 * @param categoryId        The category_id of the menu item being customised.
 */
export function isOptionRuleHidden(
  optionId: string,
  selectedOptionIds: string[],
  rules: OptionRule[],
  categoryId: string,
): boolean {
  for (const rule of rules) {
    if (rule.option_id !== optionId) continue;
    if (rule.category_id !== categoryId) continue;
    // A matching rule exists — condition: at least one requires_any id must be selected
    const condMet = rule.requires_any.some(reqId => selectedOptionIds.includes(reqId));
    if (!condMet) return true;
  }
  return false;
}
