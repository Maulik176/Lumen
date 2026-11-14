import { describe, expect, it } from 'vitest';
import { isRuleKind, rulesOn } from './rules';

describe('rulesOn', () => {
  it('finds what an island holds, in teaching order', () => {
    expect(rulesOn(['>..W', '....'])).toEqual([]);
    expect(rulesOn(['>.~W', '.\\..'])).toEqual(['fixed', 'water']);
    expect(rulesOn(['>..R', '.Y~/'])).toEqual([
      'fixed',
      'water',
      'colour',
      'mixed',
    ]);
  });
  it('knows only its own words', () => {
    expect(isRuleKind('water')).toBe(true);
    expect(isRuleKind('anything')).toBe(false);
  });
});
