import { describe, expect, it } from 'vitest';
import { SCORING, SKY } from '../../shared/config';
import type { DailyIsland } from '../../shared/daily';
import type { Placement } from '../../shared/types';
import { islandForDay, lastDay } from './content';
import {
  lockIn,
  playerState,
  rankedOpen,
  readSky,
  resetPlayer,
  recordStart,
  type Effects,
  type LockInInput,
  type Player,
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
