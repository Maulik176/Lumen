import { describe, expect, it } from 'vitest';
import type { OtherIsland } from './api';
import { COPY } from './config';
import {
  crowdLine,
  emptyLine,
  othersRows,
  sameAsLine,
  type Others,
} from './others';

const row = (
  username: string,
  rank: number | null,
  extra: Partial<OtherIsland> = {}
): OtherIsland => ({
  rank,
  username,
  snoovatar: '',
  pieces: 4,
  timeMs: 17_000,
  placements: [],
  ...extra,
});

const others = (fields: Partial<Others>): Others => ({
  ok: true,
  day: 1,
  top: [],
  me: null,
  solves: 0,
  parHits: 0,
  parSolution: null,
  creator: null,
  ...fields,
});

describe("See others' islands, as the viewer sees it", () => {
  it('names who else placed the viewer’s board, then how many more (Nov 20 report)', () => {
    expect(sameAsLine('ana', 1)).toBe('same as u/ana');
    expect(sameAsLine('ana', 2)).toBe('same as u/ana and 1 other');
    expect(sameAsLine('ana', 5)).toBe('same as u/ana and 4 others');
    expect(sameAsLine(undefined, 1)).toBe('same as 1 other');
    expect(sameAsLine(undefined, 3)).toBe('same as 3 others');
  });

  it('folds everyone with the viewer’s board into "Your island"', () => {
    const shown = othersRows(
      others({
        me: row('maulik', 1, { timeMs: 12_000, same: 2, sameAs: 'stranger' }),
        top: [row('mohak', 3, { pieces: 5 })],
        solves: 3,
      }),
      3
    );
    expect(
      shown.map((entry) => [entry.name, entry.detail, entry.players])
    ).toEqual([
      ['Your island', '4 pieces · 0:12 · same as u/stranger', 2],
      ['u/mohak', '5 pieces · 0:17', 1],
    ]);
  });

  it('lists the maker’s test and the par answer apart from the players (a past picked Sunday)', () => {
    const shown = othersRows(
      others({
        day: 6,
        creator: row('maker', null),
        me: row('ana', 2),
        parSolution: [],
        top: [row('ben', 1, { same: 3 })],
      }),
      4
    );
    expect(shown.map((entry) => [entry.name, entry.players])).toEqual([
      [COPY.makerBoard, 0],
      ['Your island', 1],
      [COPY.othersPar, 0],
      ['u/ben', 3],
    ]);
    expect(shown[3]?.detail).toContain('3 players');
  });

  it('says the list is empty only when nobody else lit it', () => {
    expect(emptyLine(others({ me: row('ana', 1) }))).toBe(COPY.othersEmpty);
    expect(emptyLine(others({ me: row('ana', 1, { same: 3 }) }))).toBe(
      COPY.othersAllSame
    );
    expect(
      emptyLine(others({ me: row('ana', 1), top: [row('ben', 2)] }))
    ).toBeNull();
    expect(emptyLine(others({ parSolution: [] }))).toBeNull();
  });

  it('never says more than everyone hit par', () => {
    expect(crowdLine(others({ solves: 6, parHits: 9 }), true)).toContain('100');
  });
});

describe('a Sunday picked from the community (Phase 3)', () => {
  it('is a daily island with a night, and its maker\'s test reads "Maker\'s board"', () => {
    const sunday = others({
      day: 6,
      creator: row('maker', null),
      me: row('ana', 1),
      solves: 8,
      parHits: 4,
    });
    expect(crowdLine(sunday, true)).toBe('50% hit par tonight');
    expect(othersRows(sunday, 4)[0]?.name).toBe(COPY.makerBoard);
    // On a community island the same row stays "Creator's board".
    const island = others({ ...sunday, day: 1_000_001 });
    expect(othersRows(island, 4)[0]?.name).toBe(COPY.creatorBoard);
    expect(crowdLine(island, true)).toBe('50% hit par');
  });
});
