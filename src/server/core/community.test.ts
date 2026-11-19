import { describe, expect, it } from 'vitest';
import { emptyDraft, islandHash, type IslandDraft } from '../../shared/builder';
import { COMMUNITY } from '../../shared/config';
import type { Placement } from '../../shared/types';
import {
  checkIsland,
  checkKey,
  finishTest,
  loadDraft,
  recordCheck,
  saveDraft,
  startTest,
  takeCheckTurn,
} from './community';
import { islandForDay } from './content';
import { memoryStore } from './memory-store';
import { resetPlayer, type Player } from './game';
import { KEYS } from './store';

const ana: Player = { userId: 't2_ana', username: 'ana' };

/**
 * A sun on the left shining east, a lantern below and to the right, and a rock that stops the
 * one-mirror answer down the right-hand column. Par 2: turn down, then turn right.
 */
function twoMirrors(spare = 1): IslandDraft {
  return {
    ...emptyDraft(6, 'snow'),
    spare,
    rows: ['......', '>.....', '......', '.....#', '.....W', '......'],
  };
}

const never = new Set<string>();
const clock = () => 0;

describe('checking an island on the server', () => {
  it('sets par, gives par plus the spare mirrors, and labels the difficulty', () => {
    const result = checkIsland(twoMirrors(2), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    expect(result.par).toBe(2);
    const prisms = result.solution.filter(
      (p) => p.piece.kind === 'prism'
    ).length;
    expect(result.inventory).toEqual({ mirrors: 2 - prisms + 2, prisms });
    expect(['gentle', 'tricky', 'fiendish']).toContain(result.label);
    expect(result.hash).toBe(islandHash(twoMirrors().rows));
  });

  it('refuses an island one piece can light', () => {
    const easy = {
      ...twoMirrors(),
      rows: twoMirrors().rows.map((row) => row.replace('#', '.')),
    };
    expect(checkIsland(easy, { daily: never, clock })).toMatchObject({
      ok: false,
      problem: 'too-easy',
    });
  });

  it('refuses an island nothing can light', () => {
    const walled = {
      ...twoMirrors(),
      rows: ['......', '>.....', '......', '....##', '....#W', '....##'],
    };
    expect(checkIsland(walled, { daily: never, clock })).toMatchObject({
      ok: false,
      problem: 'unsolvable',
    });
  });

  it('says "too complex" when the solver runs out of budget', () => {
    expect(
      checkIsland(twoMirrors(), { daily: never, clock, nodeLimit: 3 })
    ).toMatchObject({ ok: false, problem: 'too-complex' });
  });

  it('refuses what the editor would have refused', () => {
    expect(
      checkIsland(emptyDraft(6, 'moss'), { daily: never, clock })
    ).toMatchObject({
      ok: false,
      problem: 'no-sun',
    });
  });

  it('refuses an exact copy of a daily island', () => {
    const daily = islandForDay(1);
    if (daily === undefined) throw new Error('no day 1');
    const copy: IslandDraft = {
      ...twoMirrors(),
      size: daily.rows.length,
      rows: daily.rows,
    };
    const known = new Set([islandHash(daily.rows)]);
    expect(checkIsland(copy, { daily: known, clock })).toMatchObject({
      ok: false,
      problem: 'duplicate',
    });
  });

  it('records how many nodes and milliseconds each check took', () => {
    let now = 1000;
    const result = checkIsland(twoMirrors(), {
      daily: never,
      clock: () => (now += 40),
    });
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.ms).toBe(40);
  });
});

describe('"Reset my Lumen progress (dev)"', () => {
  it('also forgets the Builder: draft, check, test and the first-island tutorial', async () => {
    // Nov 19: after a dev reset the old island and a finished tutorial were still there.
    const store = memoryStore();
    await saveDraft(store, ana, twoMirrors());
    const result = checkIsland(twoMirrors(), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, ana, twoMirrors(), result);
    await store.hSet(KEYS.user('t2_ana'), { builderTutorial: '1' });
    await resetPlayer(store, ana, 1);
    expect(await loadDraft(store, ana)).toBeNull();
    expect(await startTest(store, ana, twoMirrors(), 0)).toBe('not-checked');
    expect((await store.hGetAll(KEYS.user('t2_ana')))['builderTutorial']).toBe(
      '0'
    );
  });
});

describe('drafts and the check turn', () => {
  it('keeps one draft per player and gives it back', async () => {
    const store = memoryStore();
    expect(await loadDraft(store, ana)).toBeNull();
    await saveDraft(store, ana, twoMirrors());
    expect(await loadDraft(store, ana)).toEqual(twoMirrors());
    expect(await loadDraft(store, null)).toBeNull();
  });

  it('allows one check every few seconds per player', async () => {
    const store = memoryStore();
    expect(await takeCheckTurn(store, ana)).toBe(true);
    expect(await takeCheckTurn(store, ana)).toBe(false);
    expect(await takeCheckTurn(store, null)).toBe(false);
    expect(COMMUNITY.checkGapSeconds).toBeGreaterThan(0);
  });
});

describe('test your island', () => {
  const answer: Placement[] = [
    { x: 2, y: 1, piece: { kind: 'mirror', orientation: 'backslash' } },
    { x: 2, y: 4, piece: { kind: 'mirror', orientation: 'backslash' } },
  ];

  async function checked() {
    const store = memoryStore();
    const result = checkIsland(twoMirrors(), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, ana, twoMirrors(), result);
    return store;
  }

  it('can only start on the island that was just checked', async () => {
    const store = memoryStore();
    expect(await startTest(store, ana, twoMirrors(), 0)).toBe('not-checked');
    const ready = await checked();
    expect(await startTest(ready, ana, twoMirrors(), 0)).toBe('started');
    const edited = {
      ...twoMirrors(),
      rows: twoMirrors().rows.map((row, y) => (y === 0 ? '#.....' : row)),
    };
    expect(await startTest(ready, ana, edited, 0)).toBe('not-checked');
  });

  it('passes only when the maker lights every lantern, timed by the server', async () => {
    const store = await checked();
    await startTest(store, ana, twoMirrors(), 10_000);
    expect(
      await finishTest(store, ana, twoMirrors(), answer.slice(0, 1), 20_000)
    ).toEqual({
      ok: false,
      problem: 'not-lit',
    });
    expect(await finishTest(store, ana, twoMirrors(), answer, 52_000)).toEqual({
      ok: true,
      pieces: 2,
      ms: 42_000,
    });
  });

  it('a solve for an older version of the island does not count', async () => {
    const store = await checked();
    await startTest(store, ana, twoMirrors(), 0);
    const changed = { ...twoMirrors(), spare: 0 };
    expect(await finishTest(store, ana, changed, answer, 1)).toEqual({
      ok: false,
      problem: 'changed',
    });
    expect(checkKey(changed)).not.toBe(checkKey(twoMirrors()));
  });

  it('pieces must fit the island and its inventory', async () => {
    const store = await checked();
    await startTest(store, ana, twoMirrors(), 0);
    const onRock: Placement[] = [
      ...answer,
      { x: 5, y: 3, piece: { kind: 'mirror', orientation: 'slash' } },
    ];
    expect(await finishTest(store, ana, twoMirrors(), onRock, 1)).toMatchObject(
      {
        ok: false,
      }
    );
  });
});
