import { describe, expect, it } from 'vitest';
import { OTHERS, SCORING, SKY } from '../../shared/config';
import { puzzleOfDaily, type DailyIsland } from '../../shared/daily';
import { trace } from '../../shared/trace';
import { communityNumber } from '../../shared/community';
import type { Placement } from '../../shared/types';
import { islandForDay, lastDay } from './content';
import {
  claimShare,
  type Effects,
  lockIn,
  type LockInInput,
  markRuleSeen,
  pastIslands,
  type Player,
  playerState,
  rankedOpen,
  readAllTime,
  readOthers,
  readLeaderboard,
  readSky,
  recordShare,
  recordStart,
  releaseShare,
  resetPlayer,
  saveProgress,
  sharedCommentOf,
  skyCount,
} from './game';
import { KEYS, type Store } from './store';
import { memoryStore } from './memory-store';

const DAY_ONE = Date.UTC(2026, 10, 24);
const HOUR = 3_600_000;
const ana: Player = { userId: 't2_ana', username: 'ana' };
const ben: Player = { userId: 't2_ben', username: 'ben' };

function island(day: number): DailyIsland {
  const found = islandForDay(day);
  if (found === undefined) throw new Error(`no island ${day}`);
  return found;
}

/**
 * Different boards that all light a day: its solution plus one spare mirror on a tile the light
 * never needs, a different tile or turn each time.
 */
function variants(day: number, count: number): Placement[][] {
  const found = island(day);
  const puzzle = puzzleOfDaily(found);
  const boards: Placement[][] = [];
  found.rows.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      if (tile !== '.' || found.solution.some((p) => p.x === x && p.y === y))
        return;
      for (const orientation of ['slash', 'backslash'] as const) {
        const board: Placement[] = [
          ...found.solution,
          { x, y, piece: { kind: 'mirror', orientation } },
        ];
        if (boards.length < count && trace(puzzle, board).solved)
          boards.push(board);
      }
    })
  );
  if (boards.length < count) throw new Error('not enough spare tiles');
  return boards;
}

function setup() {
  const store = memoryStore();
  const ranked: string[] = [];
  const effects: Effects = {
    onRanked: async ({ player }) => {
      ranked.push(player.username);
    },
  };
  const input = (
    day: number,
    nowMs: number,
    extra: Partial<LockInInput> = {}
  ): LockInInput => ({
    island: island(day),
    placements: island(day).solution,
    snoovatar: undefined,
    wantsRanked: true,
    postDay: day,
    lastDay: lastDay(),
    nowMs,
    ...extra,
  });
  return { store, effects, ranked, input };
}

describe('lock in: the server decides', () => {
  it('a ranked solve is scored by the server and recorded everywhere', async () => {
    const { store, effects, ranked, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE + HOUR);
    const outcome = await lockIn(
      store,
      ana,
      input(1, DAY_ONE + HOUR + 90_000, {
        snoovatar: 'https://i.redd.it/snoovatar/avatars/abc-123.png',
      }),
      effects
    );
    expect(outcome).toMatchObject({
      ok: true,
      result: {
        day: 1,
        pieces: island(1).par,
        par: island(1).par,
        medal: 'lamplighter',
        elapsedMs: 90_000,
        ranked: true,
        streak: 1,
        style: 'plain',
        percentile: 100,
        skyCount: 1,
      },
    });
    expect(ranked).toEqual(['ana']);
    expect(await store.zCard(KEYS.leaderboard(1))).toBe(1);
    expect((await store.zRange(KEYS.leaderboard(1), 0, 0))[0]?.score).toBe(
      island(1).par * SCORING.leaderboardPieceWeight + 90_000
    );
    expect(await store.hGetAll(KEYS.stats(1))).toMatchObject({
      plays: '1',
      solves: '1',
      parHits: '1',
    });
    expect(
      JSON.parse((await store.hGetAll(KEYS.boards(1)))['ana'] ?? '')
    ).toEqual(island(1).solution);
    expect((await readSky(store, 1)).lanterns).toEqual([
      {
        u: 'ana',
        s: 'plain',
        a: 'https://i.redd.it/snoovatar/avatars/abc-123.png',
      },
    ]);
    expect((await playerState(store, ana, 1)).result).toMatchObject({
      pieces: island(1).par,
      streak: 1,
    });
  });

  it('rejects tampered placements: extra pieces, illegal tiles, nonsense', async () => {
    const { store, effects, input } = setup();
    const solution = island(1).solution;
    const spare: Placement = {
      x: 0,
      y: 0,
      piece: { kind: 'mirror', orientation: 'slash' },
    };
    const tooMany = Array.from({ length: 12 }, (_, i) => ({
      ...spare,
      x: i % 6,
      y: Math.floor(i / 6),
    }));
    for (const placements of [
      tooMany,
      [{ x: 99, y: 0, piece: { kind: 'prism' } }],
      'solved',
      [{ lit: true }],
      [...solution, solution[0]],
    ]) {
      const outcome = await lockIn(
        store,
        ana,
        input(1, DAY_ONE + HOUR, { placements }),
        effects
      );
      expect(outcome.ok).toBe(false);
    }
    expect(await store.zCard(KEYS.leaderboard(1))).toBe(0);
  });

  it('refuses a layout that does not light every lantern, whatever the client claims', async () => {
    const { store, effects, input } = setup();
    const outcome = await lockIn(
      store,
      ana,
      input(1, DAY_ONE + HOUR, { placements: [] }),
      effects
    );
    expect(outcome).toEqual({ ok: false, reason: 'not-solved' });
  });

  it("takes the snoovatar only from Reddit's image host", async () => {
    const { store, effects, input } = setup();
    await lockIn(
      store,
      ana,
      input(1, DAY_ONE + HOUR, { snoovatar: 'https://evil.example/x.png' }),
      effects
    );
    expect((await readSky(store, 1)).lanterns[0]?.a).toBe('');
  });

  it("with no start record the time is the slowest possible, never the client's word", async () => {
    const { store, effects, input } = setup();
    const outcome = await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    expect(outcome).toMatchObject({
      ok: true,
      result: { ranked: true, elapsedMs: SCORING.leaderboardMaxTimeMs },
    });
  });

  it('only the first Lock in of the day is ranked', async () => {
    const { store, effects, ranked, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + 60_000), effects);
    const again = await lockIn(
      store,
      ana,
      input(1, DAY_ONE + 120_000),
      effects
    );
    expect(again).toMatchObject({
      ok: true,
      result: { ranked: false, elapsedMs: 60_000 },
    });
    expect(ranked).toEqual(['ana']);
    expect(await store.hGetAll(KEYS.stats(1))).toMatchObject({ solves: '1' });
  });

  it('logged out, replay and archive solves write nothing', async () => {
    const { store, effects, ranked, input } = setup();
    const before = store.writes();
    expect(
      await lockIn(store, null, input(1, DAY_ONE + HOUR), effects)
    ).toMatchObject({ ok: true, result: { ranked: false } });
    expect(
      await lockIn(
        store,
        ana,
        input(1, DAY_ONE + HOUR, { wantsRanked: false }),
        effects
      )
    ).toMatchObject({ ok: true, result: { ranked: false } });
    // An old island opened from another post, or a post for a different day.
    expect(
      await lockIn(
        store,
        ana,
        input(2, DAY_ONE + HOUR, { postDay: 1 }),
        effects
      )
    ).toMatchObject({ ok: true, result: { ranked: false } });
    expect(store.writes()).toBe(before);
    expect(ranked).toEqual([]);
  });

  it("yesterday's island is unranked today, except just after midnight for a player who started before it", async () => {
    const { store, effects, input } = setup();
    const midnight = DAY_ONE + 24 * HOUR;
    expect(
      rankedOpen(1, midnight + 5 * 60_000, lastDay(), midnight - 60_000)
    ).toBe(true);
    expect(
      rankedOpen(1, midnight + 11 * 60_000, lastDay(), midnight - 60_000)
    ).toBe(false);
    expect(rankedOpen(1, midnight + 5 * 60_000, lastDay(), undefined)).toBe(
      false
    );
    const late = await lockIn(
      store,
      ana,
      input(1, midnight + 2 * HOUR),
      effects
    );
    expect(late).toMatchObject({ ok: true, result: { ranked: false } });
    await recordStart(store, ben, 1, midnight - 60_000);
    const grace = await lockIn(
      store,
      ben,
      input(1, midnight + 60_000),
      effects
    );
    expect(grace).toMatchObject({
      ok: true,
      result: { ranked: true, elapsedMs: 120_000 },
    });
  });

  it('streaks grow day by day and the percentile compares players', async () => {
    const { store, effects, input } = setup();
    for (const day of [1, 2, 3]) {
      await recordStart(
        store,
        ana,
        day,
        DAY_ONE + (day - 1) * 24 * HOUR + HOUR
      );
      await lockIn(
        store,
        ana,
        input(day, DAY_ONE + (day - 1) * 24 * HOUR + HOUR + 60_000),
        effects
      );
    }
    const state = await playerState(store, ana, 3);
    expect(state).toMatchObject({ loggedIn: true, streak: 3, style: 'paper' });
    // Ben solves day 3 more slowly: Ana beat him, he beat nobody.
    await recordStart(store, ben, 3, DAY_ONE + 2 * 24 * HOUR + HOUR);
    const slow = await lockIn(
      store,
      ben,
      input(3, DAY_ONE + 2 * 24 * HOUR + 2 * HOUR),
      effects
    );
    expect(slow).toMatchObject({
      ok: true,
      result: { percentile: 0, skyCount: 2, streak: 1 },
    });
  });

  it('the sky keeps only the newest lanterns but the count keeps growing', async () => {
    const { store, effects, input } = setup();
    for (let i = 0; i < SKY.maxLanterns + 5; i++) {
      await lockIn(
        store,
        { userId: `t2_${i}`, username: `p${i}` },
        input(1, DAY_ONE + HOUR + i),
        effects
      );
    }
    const sky = await readSky(store, 1);
    expect(sky.lanterns).toHaveLength(SKY.maxLanterns);
    expect(sky.count).toBe(SKY.maxLanterns + 5);
    expect(sky.lanterns[sky.lanterns.length - 1]?.u).toBe(
      `p${SKY.maxLanterns + 4}`
    );
    expect(sky.lanterns.some((lantern) => lantern.u === 'p0')).toBe(false);
  });

  it('a failing flair or broadcast never fails the solve', async () => {
    const { store, input } = setup();
    const outcome = await lockIn(store, ana, input(1, DAY_ONE + HOUR), {
      onRanked: () => Promise.reject(new Error('reddit is down')),
    });
    expect(outcome).toMatchObject({ ok: true, result: { ranked: true } });
  });
});

describe('resetPlayer (developer tool)', () => {
  it('forgets the tutorial and the day, so the next solve is ranked again', async () => {
    const { store, effects } = setup();
    const today = island(1);
    const input: LockInInput = {
      island: today,
      placements: today.solution,
      snoovatar: '',
      wantsRanked: true,
      postDay: 1,
      lastDay: lastDay(),
      nowMs: DAY_ONE + HOUR,
    };
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input, effects);
    await resetPlayer(store, ana, 1);
    const state = await playerState(store, ana, 1);
    expect(state.result).toBeNull();
    expect(state.tutorialDone).toBe(false);
    expect((await readSky(store, 1)).lanterns).toHaveLength(0);
    const again = await lockIn(store, ana, input, effects);
    expect(again.ok && again.result.ranked).toBe(true);
    expect(again.ok && again.result.rank).toBe(1);
  });
});

describe('a solved island, reopened', () => {
  it('comes back with its pieces, and past islands carry their medals', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    const state = await playerState(store, ana, 1, island(1));
    expect(state.placements).toEqual(island(1).solution);
    expect((await playerState(store, ana, 1)).placements).toBeNull();
    const past = await pastIslands(store, ana, [island(2), island(1)]);
    expect(past.map((entry) => entry.day)).toEqual([2, 1]);
    expect(past[0]?.medal).toBeNull();
    expect(past[1]?.medal).toBe('lamplighter');
    expect(past[1]?.solves).toBe(1);
    expect(past[0]?.rows).toEqual(island(2).rows);
    expect((await pastIslands(store, null, [island(1)]))[0]?.medal).toBeNull();
  });
});

describe('the boards', () => {
  const avatar = 'https://i.redd.it/snoovatar/avatars/ana.png';
  const solveAs = async (
    player: Player,
    seconds: number,
    extra: Partial<LockInInput> = {}
  ) => {
    const { store, effects, input } = shared;
    if (player === null) return;
    await recordStart(store, player, 1, DAY_ONE);
    await lockIn(
      store,
      player,
      input(1, DAY_ONE + seconds * 1000, extra),
      effects
    );
  };
  let shared = setup();

  it('orders by pieces, then time, with snoovatars and an own row below the top', async () => {
    shared = setup();
    await solveAs(ana, 90, { snoovatar: avatar });
    await solveAs(ben, 40);
    for (let i = 0; i < 11; i++)
      await solveAs({ userId: `t2_p${i}`, username: `p${i}` }, 100 + i);
    const board = await readLeaderboard(shared.store, 1, 'p10');
    expect(board.total).toBe(13);
    expect(board.top).toHaveLength(10);
    expect(board.top[0]?.username).toBe('ben');
    expect(board.top[0]?.timeMs).toBe(40_000);
    expect(board.top[0]?.pieces).toBe(island(1).solution.length);
    expect(board.top[1]).toMatchObject({
      rank: 2,
      username: 'ana',
      snoovatar: avatar,
    });
    expect(board.me).toMatchObject({ rank: 13, username: 'p10' });
    expect((await readLeaderboard(shared.store, 1, 'ben')).me).toBeNull();
    expect((await readLeaderboard(shared.store, 1, null)).me).toBeNull();
  });

  it('gives no place to a time too fast to believe', async () => {
    shared = setup();
    await solveAs(ana, 1);
    const board = await readLeaderboard(shared.store, 1, null);
    expect(board.top[0]?.rank).toBeNull();
  });

  it('counts nights at par, most first', async () => {
    shared = setup();
    await solveAs(ana, 60);
    await solveAs(ben, 60);
    await shared.store.zIncrBy(KEYS.allTime, 'ben', 2);
    const board = await readAllTime(shared.store, 'ana');
    expect(board.top.map((row) => [row.username, row.medals])).toEqual([
      ['ben', 3],
      ['ana', 1],
    ]);
    expect(board.me).toBeNull();
  });
});

describe("see others' islands", () => {
  const open = (store: Store, player: Player, nowMs = DAY_ONE + HOUR) =>
    readOthers(store, player, island(1), nowMs, lastDay());

  it('stays closed until you lock in, then lists each board once, with how many placed it, and your own', async () => {
    const { store, effects, input } = setup();
    expect((await open(store, ana)).ok).toBe(false);
    expect((await open(store, null)).ok).toBe(false);
    await recordStart(store, ben, 1, DAY_ONE);
    await lockIn(store, ben, input(1, DAY_ONE + HOUR), effects);
    expect((await open(store, ana)).ok).toBe(false);
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + 2 * HOUR), effects);
    const others = await open(store, ana, DAY_ONE + 2 * HOUR);
    if (!others.ok) throw new Error('should be open');
    // Both placed the same board: it is Ana's own, so Ben is folded into her row, by name.
    expect(others.top).toEqual([]);
    expect(others.me).toMatchObject({
      rank: 2,
      username: 'ana',
      pieces: island(1).par,
      placements: island(1).solution,
      same: 2,
      sameAs: 'ben',
    });
    // From Ben's seat, first on the board: Ana is still named (Nov 20, Maulik's report).
    const fromBen = await open(store, ben, DAY_ONE + 2 * HOUR);
    if (!fromBen.ok) throw new Error('should be open');
    expect(fromBen.top).toEqual([]);
    expect(fromBen.me).toMatchObject({ rank: 1, same: 2, sameAs: 'ana' });
    expect(others.solves).toBe(2);
    expect(others.parHits).toBe(2);
    expect(others.parSolution).toBeNull();
  });

  it('opens an earlier night to everyone, with its par answer', async () => {
    const { store } = setup();
    const others = await open(store, null, DAY_ONE + 26 * HOUR);
    if (!others.ok) throw new Error('should be open');
    expect(others.parSolution).toEqual(island(1).solution);
    expect(others.top).toEqual([]);
    expect(others.me).toBeNull();
  });

  it('works the list out at Lock in, so opening it writes nothing', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    expect(await store.get(KEYS.othersTop(1))).toBeDefined();
    const before = store.writes();
    expect((await open(store, ana)).ok).toBe(true);
    expect(store.writes()).toBe(before);
  });

  it('a list made shorter by identical boards is still up to date: opening it writes nothing', async () => {
    const { store, effects, input } = setup();
    for (const player of [ben, ana]) {
      await recordStart(store, player, 1, DAY_ONE);
      await lockIn(store, player, input(1, DAY_ONE + HOUR), effects);
    }
    const before = store.writes();
    const others = await open(store, ana);
    expect(others.ok && others.top).toEqual([]);
    expect(others.ok && others.me?.same).toBe(2);
    expect(store.writes()).toBe(before);
  });

  it('a Lock in below the top leaves the kept list alone', async () => {
    const { store, effects, input } = setup();
    // One row more than OTHERS.top is kept, so the player in place top + 2 is below it.
    const players = Array.from({ length: OTHERS.top + 2 }, (_, i) => ({
      userId: `t2_p${i}`,
      username: `p${i}`,
    }));
    const boards = variants(1, players.length);
    for (const [i, player] of players.entries()) {
      if (i === OTHERS.top + 1) await store.del(KEYS.othersTop(1));
      await recordStart(store, player, 1, DAY_ONE);
      await lockIn(
        store,
        player,
        input(1, DAY_ONE + HOUR + i * 1000, { placements: boards[i] }),
        effects
      );
    }
    // The last player came twelfth: their Lock in did not rebuild the deleted list.
    expect(await store.get(KEYS.othersTop(1))).toBeUndefined();
    const others = await open(store, players[OTHERS.top + 1] ?? null);
    if (!others.ok) throw new Error('should be open');
    expect(others.top).toHaveLength(OTHERS.top);
    expect(
      others.top.some((row) => row.username === `p${OTHERS.top + 1}`)
    ).toBe(false);
    expect(others.me?.rank).toBe(OTHERS.top + 2);
  });

  it('names every player on the board, even one whose pieces were never stored', async () => {
    // Solves locked in before pieces were stored (before v0.0.1.64) have a board entry only.
    const { store, effects, input } = setup();
    await recordStart(store, ben, 1, DAY_ONE);
    await lockIn(store, ben, input(1, DAY_ONE + HOUR), effects);
    // Those solves came before boards and their counts were stored.
    await store.del(KEYS.boards(1));
    await store.del(KEYS.groups(1));
    await store.del(KEYS.othersTop(1));
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + 2 * HOUR), effects);
    const others = await open(store, ana, DAY_ONE + 2 * HOUR);
    if (!others.ok) throw new Error('should be open');
    expect(others.top.map((row) => [row.username, row.placements])).toEqual([
      ['ben', null],
    ]);
    expect(others.me).toMatchObject({
      username: 'ana',
      placements: island(1).solution,
      same: 1,
    });
  });

  it('rebuilds a kept list that is shorter than the board', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ben, 1, DAY_ONE);
    await lockIn(store, ben, input(1, DAY_ONE + HOUR), effects);
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    const carl: Player = { userId: 't2_carl', username: 'carl' };
    await recordStart(store, carl, 1, DAY_ONE);
    await lockIn(
      store,
      carl,
      input(1, DAY_ONE + 2 * HOUR, { placements: variants(1, 1)[0] }),
      effects
    );
    // A list kept empty by an older version, before anyone's pieces were stored.
    await store.set(KEYS.othersTop(1), '[]');
    const others = await open(store, carl, DAY_ONE + 2 * HOUR);
    if (!others.ok) throw new Error('should be open');
    // Same board, same time: one row for both.
    expect(others.top.map((row) => [row.username, row.same])).toEqual([
      ['ana', 2],
    ]);
  });

  it('keeps practice solves out, and a reset takes the player off the list', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    await recordStart(store, ben, 1, DAY_ONE);
    await lockIn(
      store,
      ben,
      input(1, DAY_ONE + HOUR, { wantsRanked: false }),
      effects
    );
    expect(Object.keys(await store.hGetAll(KEYS.boards(1)))).toEqual(['ana']);
    await resetPlayer(store, ana, 1);
    await recordStart(store, ben, 1, DAY_ONE);
    await lockIn(store, ben, input(1, DAY_ONE + 2 * HOUR), effects);
    const others = await open(store, ben, DAY_ONE + 2 * HOUR);
    if (!others.ok) throw new Error('should be open');
    // Ana is gone; Ben is alone with his own island.
    expect(others.top).toEqual([]);
    expect(others.me).toMatchObject({ username: 'ben', same: 1 });
  });
});

describe('a developer reset', () => {
  it('takes back the solve and the par hit, so the counts stay true after a replay', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    await resetPlayer(store, ana, 1);
    expect(await store.hGetAll(KEYS.stats(1))).toMatchObject({
      solves: '0',
      parHits: '0',
    });
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + 2 * HOUR), effects);
    expect(await store.hGetAll(KEYS.stats(1))).toMatchObject({
      solves: '1',
      parHits: '1',
    });
  });
});

describe('share to comments', () => {
  it('needs a ranked result, and takes one share per night unless posting failed', async () => {
    const { store, effects, input } = setup();
    expect((await claimShare(store, null, 1)).ok).toBe(false);
    expect(await claimShare(store, ana, 1)).toEqual({
      ok: false,
      reason: 'nothing-to-share',
    });
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    const first = await claimShare(store, ana, 1);
    expect(first.ok && first.result.ranked).toBe(true);
    expect(await claimShare(store, ana, 1)).toEqual({
      ok: false,
      reason: 'already-shared',
    });
    // Posting failed: the share is given back.
    await releaseShare(store, { userId: 't2_ana' }, 1);
    expect((await claimShare(store, ana, 1)).ok).toBe(true);
    // Posted: the reply is remembered, can be opened, and blocks a second share.
    await recordShare(store, { userId: 't2_ana' }, 1, 't1_reply');
    const state = await playerState(store, ana, 1);
    expect(state.shared).toBe(true);
    expect(state.sharedComment).toBe('t1_reply');
    await releaseShare(store, { userId: 't2_ana' }, 1);
    expect(await claimShare(store, ana, 1)).toEqual({
      ok: false,
      reason: 'already-shared',
    });
    expect(await sharedCommentOf(store, { userId: 't2_ana' }, 1)).toBe(
      't1_reply'
    );
    // The developer reset forgets it, so the night can be shared again.
    await resetPlayer(store, ana, 1);
    expect(await sharedCommentOf(store, { userId: 't2_ana' }, 1)).toBeNull();
  });
});

describe('an unfinished board', () => {
  it('comes back on reopening, and is gone after Lock in', async () => {
    const { store, effects, input } = setup();
    const today = island(1);
    const some = today.solution.slice(0, 1);
    expect(await saveProgress(store, ana, today, some)).toBe(true);
    expect((await playerState(store, ana, 1, today)).progress).toEqual(some);
    expect(await saveProgress(store, ana, today, [{ x: -1, y: 0 }])).toBe(
      false
    );
    expect(await saveProgress(store, null, today, some)).toBe(false);
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    expect((await playerState(store, ana, 1, today)).progress).toBeNull();
    expect(await saveProgress(store, ana, today, some)).toBe(false);
  });
});

describe('one-time rule cards', () => {
  it('are remembered per player, and forgotten by the developer reset', async () => {
    const { store } = setup();
    expect((await playerState(store, ana, 1)).rulesSeen).toEqual([]);
    await markRuleSeen(store, ana, 'water');
    await markRuleSeen(store, ana, 'colour');
    expect((await playerState(store, ana, 1)).rulesSeen).toEqual([
      'water',
      'colour',
    ]);
    expect((await playerState(store, ben, 1)).rulesSeen).toEqual([]);
    await resetPlayer(store, ana, 1);
    expect((await playerState(store, ana, 1)).rulesSeen).toEqual([]);
  });
});

describe('the Android sky report (Nov 16)', () => {
  it('/api/sky gives both players both lanterns, with or without a snoovatar', async () => {
    const { store, effects, input } = setup();
    const iphone: Player = { userId: 't2_dry', username: 'Dry_Promotion2506' };
    const android: Player = { userId: 't2_mohak', username: 'mohak2605' };
    await recordStart(store, iphone, 1, DAY_ONE);
    await lockIn(
      store,
      iphone,
      input(1, DAY_ONE + HOUR, {
        snoovatar: 'https://i.redd.it/snoovatar/avatars/dry.png',
      }),
      effects
    );
    await recordStart(store, android, 1, DAY_ONE);
    await lockIn(store, android, input(1, DAY_ONE + 2 * HOUR), effects);
    const sky = await readSky(store, 1);
    expect(sky.lanterns.map((lantern) => lantern.u)).toEqual([
      'Dry_Promotion2506',
      'mohak2605',
    ]);
    expect(sky.lanterns[0]?.a).toBe(
      'https://i.redd.it/snoovatar/avatars/dry.png'
    );
    expect(sky.lanterns[1]?.a).toBe('');
  });
});

describe('counts never go below zero (the "-1 lanterns" report)', () => {
  it('a reset after the day was already cleared leaves 0, and the count is the real board', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    expect(await skyCount(store, 1)).toBe(1);
    // What "Dev: clean up" did: clear the day's counts and board first, then reset the player.
    await store.del(KEYS.stats(1));
    await store.del(KEYS.leaderboard(1));
    await resetPlayer(store, ana, 1);
    expect(await skyCount(store, 1)).toBe(0);
    expect(
      Number((await store.hGetAll(KEYS.stats(1)))['solves'] ?? 0)
    ).toBeGreaterThanOrEqual(0);
  });
});

describe('a community island', () => {
  // Day 1's island under a community number, as a published island is served.
  const number = communityNumber(1);
  const community = { ...island(1), day: number };
  const play = (nowMs: number): LockInInput => ({
    island: community,
    placements: community.solution,
    snoovatar: undefined,
    wantsRanked: true,
    postDay: number,
    lastDay: lastDay(),
    nowMs,
  });

  it('counts the first Lock in on its post whenever it comes: it has no night', async () => {
    const { store, effects } = setup();
    expect(
      rankedOpen(number, DAY_ONE + 40 * 24 * HOUR, lastDay(), undefined)
    ).toBe(true);
    const late = DAY_ONE + 40 * 24 * HOUR;
    await recordStart(store, ana, number, late);
    const outcome = await lockIn(store, ana, play(late + 60_000), effects);
    expect(outcome).toMatchObject({
      ok: true,
      result: { ranked: true, rank: 1 },
    });
    const again = await lockIn(store, ana, play(late + 90_000), effects);
    expect(again).toMatchObject({ ok: true, result: { ranked: false } });
    expect(await store.zCard(KEYS.leaderboard(number))).toBe(1);
  });

  it('leaves streak, medals and the all-time board alone', async () => {
    const { store, effects, input } = setup();
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    const before = await store.hGetAll(KEYS.user(ana.userId));
    const allTime = await store.zCard(KEYS.allTime);
    await recordStart(store, ana, number, DAY_ONE + 2 * HOUR);
    const outcome = await lockIn(store, ana, play(DAY_ONE + 3 * HOUR), effects);
    expect(outcome).toMatchObject({
      ok: true,
      result: { ranked: true, streak: Number(before['streak']) },
    });
    const after = await store.hGetAll(KEYS.user(ana.userId));
    expect(after['streak']).toBe(before['streak']);
    expect(after['lastDay']).toBe(before['lastDay']);
    expect(await store.zCard(KEYS.allTime)).toBe(allTime);
    // Its own par count still grows, for "Your islands".
    expect((await store.hGetAll(KEYS.stats(number)))['parHits']).toBe('1');
  });

  it("its list opens for the maker from the start, with the Creator's board pinned", async () => {
    const { store, effects } = setup();
    const creator = {
      rank: null,
      username: 'maker',
      snoovatar: '',
      pieces: community.par,
      timeMs: 30_000,
      placements: community.solution,
    };
    const maker: Player = { userId: 't2_maker', username: 'maker' };
    const open = (player: Player) =>
      readOthers(store, player, community, DAY_ONE, lastDay(), creator);
    expect((await open(ana)).ok).toBe(false);
    expect(await open(maker)).toMatchObject({ ok: true, creator, top: [] });
    await recordStart(store, ana, number, DAY_ONE);
    await lockIn(store, ana, play(DAY_ONE + HOUR), effects);
    expect(await open(ana)).toMatchObject({
      ok: true,
      creator,
      top: [],
      me: { username: 'ana', rank: 1, same: 1 },
      parSolution: null,
    });
    // The maker sees Ana's island; the maker's own test is never a player.
    expect(await open(maker)).toMatchObject({
      ok: true,
      top: [{ username: 'ana', rank: 1 }],
      me: null,
    });
  });
});
