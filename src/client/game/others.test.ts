import { describe, expect, it } from 'vitest';
import { othersRows, type Others } from './others';

const row = (username: string, rank: number) => ({
  rank,
  username,
  snoovatar: '',
  pieces: 4,
  timeMs: 25_000,
  placements: [],
});

describe("See others' islands", () => {
  it('lists the player once, as "Your island", never again among the top (Nov 19 and 20)', () => {
    const others: Others = {
      ok: true,
      day: 1_000_001,
      top: [row('maker', 1), row('ana', 2)],
      me: row('ana', 2),
      solves: 2,
      parHits: 1,
      parSolution: null,
      creator: { ...row('maker', 0), rank: null },
    };
    const names = othersRows(others, 4).map((shown) => shown.username);
    expect(names).toEqual(['maker', 'ana', 'maker']);
    expect(names.filter((name) => name === 'ana')).toHaveLength(1);
  });
});
