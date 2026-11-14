/**
 * The four things an island can hold that the tutorial does not teach. The first time a player
 * meets each, the game shows one short line about it, once.
 */
export const RULE_KINDS = ['fixed', 'water', 'colour', 'mixed'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export function isRuleKind(value: unknown): value is RuleKind {
  return RULE_KINDS.some((kind) => kind === value);
}

/** Which of them an island has, from its rows of text (see puzzle-text.ts), in teaching order. */
export function rulesOn(rows: readonly string[]): RuleKind[] {
  const all = rows.join('');
  const found: RuleKind[] = [];
  if (/[/\\]/.test(all)) found.push('fixed');
  if (all.includes('~')) found.push('water');
  if (/[RGB]/.test(all)) found.push('colour');
  if (/[MCY]/.test(all)) found.push('mixed');
  return found;
}
