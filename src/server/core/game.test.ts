import { describe, expect, it } from 'vitest';
import { SCORING, SKY } from '../../shared/config';
import type { DailyIsland } from '../../shared/daily';
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
  readHeat,
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
import { KEYS, type Ranked, type Store } from './store';

/** Redis, as far as Lumen uses it, in memory. */
function memoryStore(): Store & { writes: () => number } {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Map<string, number>>();
  let writes = 0;
  const hash = (key: string) =>
    hashes.get(key) ??
    hashes.set(key, new Map()).get(key) ??
    new Map<string, string>();
  const zset = (key: string) =>
    sets.get(key) ??
    sets.set(key, new Map()).get(key) ??
    new Map<string, number>();
  const ordered = (key: string): Ranked[] =>
    [...zset(key)]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
  return {
    writes: () => writes,
    get: async (key) => strings.get(key),
    async set(key, value) {
      writes++;
      strings.set(key, value);
    },
    async count(key) {
      writes++;
      const next = Number(strings.get(key) ?? 0) + 1;
      strings.set(key, String(next));
      return next;
    },
    hGetAll: async (key) => Object.fromEntries(hash(key)),
    hMGet: async (key, fields) =>
      fields.map((field) => hash(key).get(field) ?? null),
    async hSet(key, fields) {
      writes++;
      for (const [field, value] of Object.entries(fields))
        hash(key).set(field, value);
    },
    async hIncrBy(key, field, by) {
      writes++;
      const next = Number(hash(key).get(field) ?? 0) + by;
      hash(key).set(field, String(next));
      return next;
    },
    async zAdd(key, member, score) {
      writes++;
      zset(key).set(member, score);
    },
    zCard: async (key) => zset(key).size,
    zRank: async (key, member) => {
      const index = ordered(key).findIndex((entry) => entry.member === member);
      return index < 0 ? undefined : index;
    },
    zRange: async (key, start, stop, reverse) => {
      const list = reverse === true ? ordered(key).reverse() : ordered(key);
      return list.slice(start, stop + 1);
    },
    async zRemRangeByRank(key, start, stop) {
      writes++;
      for (const entry of ordered(key).slice(start, stop + 1))
        zset(key).delete(entry.member);
    },
    async zIncrBy(key, member, by) {
      writes++;
      zset(key).set(member, (zset(key).get(member) ?? 0) + by);
    },
    async expire() {},
    async del(key) {
      writes++;
      strings.delete(key);
      hashes.delete(key);
      sets.delete(key);
    },
    async zRem(key, member) {
      writes++;
      zset(key).delete(member);
    },
  };
}

const DAY_ONE = Date.UTC(2026, 10, 24);
const HOUR = 3_600_000;
const ana: Player = { userId: 't2_ana', username: 'ana' };
const ben: Player = { userId: 't2_ben', username: 'ben' };

function island(day: number): DailyIsland {
  const found = islandForDay(day);
  if (found === undefined) throw new Error(`no island ${day}`);
  return found;
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
      Object.values(await store.hGetAll(KEYS.heat(1)))
        .map(Number)
        .reduce((a, b) => a + b, 0)
    ).toBe(island(1).par);
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

describe('where everyone built', () => {
  it('stays hidden until you lock in, then counts pieces per tile', async () => {
    const { store, effects, input } = setup();
    const today = island(1);
    expect(
      (await readHeat(store, ana, today, DAY_ONE + HOUR, lastDay())).ok
    ).toBe(false);
    expect(
      (await readHeat(store, null, today, DAY_ONE + HOUR, lastDay())).ok
    ).toBe(false);
    await recordStart(store, ben, 1, DAY_ONE);
    await lockIn(store, ben, input(1, DAY_ONE + HOUR), effects);
    expect(
      (await readHeat(store, ana, today, DAY_ONE + HOUR, lastDay())).ok
    ).toBe(false);
    await recordStart(store, ana, 1, DAY_ONE);
    await lockIn(store, ana, input(1, DAY_ONE + HOUR), effects);
    const heat = await readHeat(store, ana, today, DAY_ONE + HOUR, lastDay());
    if (!heat.ok) throw new Error('should be open');
    const width = Number(today.rows[0]?.length);
    for (const placement of today.solution)
      expect(heat.tiles[placement.y * width + placement.x]).toBe(2);
    expect(heat.solves).toBe(2);
    expect(heat.parHits).toBe(2);
    expect(heat.parSolution).toBeNull();
  });

  it('opens an earlier night to everyone, with its par answer', async () => {
    const { store } = setup();
    const heat = await readHeat(
      store,
      null,
      island(1),
      DAY_ONE + 26 * HOUR,
      lastDay()
    );
    if (!heat.ok) throw new Error('should be open');
    expect(heat.parSolution).toEqual(island(1).solution);
    expect(heat.tiles.every((count) => count === 0)).toBe(true);
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
