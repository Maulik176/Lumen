/**
 * What happens when a player starts an island and locks in an answer. No Reddit or Devvit calls
 * in here: storage, the clock and the outside effects (flair, realtime) are passed in, so every
 * rule can be tested.
 *
 * The client is never believed about its own result. The only things taken from it are the
 * placements, which are re-traced with the shared engine, and its snoovatar address, which is
 * accepted only from Reddit's image host.
 */
import {
  cleanSnoovatar,
  type LockInResult,
  type PastIsland,
  type PlayerState,
  type SkyLantern,
} from '../../shared/api';
import { dayAt } from '../../shared/calendar';
import { CALENDAR, KEEP, RULES, SCORING, SKY } from '../../shared/config';
import { puzzleOfDaily, type DailyIsland } from '../../shared/daily';
import {
  advanceStreak,
  NEW_STREAK,
  styleFor,
  type StreakState,
} from '../../shared/streak';
import type { Placement } from '../../shared/types';
import {
  medalFor,
  scoreSubmission,
  validatePlacements,
  type PlacementProblem,
} from '../../shared/validate';
import { KEYS, type Store } from './store';

export type Player = { userId: string; username: string } | null;

export type Effects = {
  /** Called after a ranked solve. Failures must be swallowed by the caller's implementation. */
  onRanked: (event: {
    player: { userId: string; username: string };
    result: LockInResult;
    lantern: SkyLantern;
  }) => Promise<void>;
};

const MS_PER_DAY = 86_400_000;

function dayOneMs(): number {
  const [year, month, date] = CALENDAR.dayOne.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/** The day that is "today" for ranking. Before launch every clock reads as day 1, for testing. */
export function currentDay(nowMs: number, lastDay: number): number {
  return Math.min(lastDay, Math.max(1, dayAt(nowMs)));
}

/**
 * Would a solve of `day` right now be ranked? Yes on the day itself, and for a short grace after
 * midnight UTC if the player started before midnight.
 */
export function rankedOpen(
  day: number,
  nowMs: number,
  lastDay: number,
  startedMs: number | undefined
): boolean {
  if (currentDay(nowMs, lastDay) === day) return true;
  const endOfDay = dayOneMs() + day * MS_PER_DAY;
  return (
    startedMs !== undefined &&
    startedMs < endOfDay &&
    nowMs >= endOfDay &&
    nowMs - endOfDay <= RULES.rolloverGraceMs
  );
}

function readStreak(fields: Record<string, string>): StreakState {
  const number = (key: string, fallback: number): number => {
    const value = Number(fields[key]);
    return Number.isFinite(value) && fields[key] !== undefined
      ? value
      : fallback;
  };
  return {
    streak: number('streak', NEW_STREAK.streak),
    lastDay: number('lastDay', NEW_STREAK.lastDay),
    graceWeek: number('graceWeek', NEW_STREAK.graceWeek),
    best: number('best', NEW_STREAK.best),
  };
}

function readResult(text: string | undefined): LockInResult | null {
  if (text === undefined) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const fields: Record<string, unknown> = { ...value };
    const result = fields['result'];
    if (typeof result !== 'object' || result === null) return null;
    const r: Record<string, unknown> = { ...result };
    const { day, pieces, par, medal, elapsedMs, streak, percentile, skyCount } =
      r;
    const rank = r['rank'];
    if (
      typeof day !== 'number' ||
      typeof pieces !== 'number' ||
      typeof par !== 'number'
    )
      return null;
    if (medal !== 'lamplighter' && medal !== 'glow' && medal !== 'spark')
      return null;
    if (typeof elapsedMs !== 'number' || typeof streak !== 'number')
      return null;
    return {
      day,
      pieces,
      par,
      medal,
      elapsedMs,
      ranked: true,
      streak,
      style: styleFor(streak),
      percentile: typeof percentile === 'number' ? percentile : 0,
      rank: typeof rank === 'number' ? rank : 0,
      skyCount: typeof skyCount === 'number' ? skyCount : 0,
    };
  } catch {
    return null;
  }
}

/** The pieces stored with a result, checked against the island again. */
function readPlacements(
  text: string | undefined,
  island: DailyIsland
): Placement[] | null {
  if (text === undefined) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const fields: Record<string, unknown> = { ...value };
    const check = validatePlacements(
      puzzleOfDaily(island),
      fields['placements']
    );
    return check.ok ? check.placements : null;
  } catch {
    return null;
  }
}

/** What the server knows about a player for one island. */
export async function playerState(
  store: Store,
  player: Player,
  day: number,
  /** When given, the stored pieces come back too, to show the island as it was left. */
  island?: DailyIsland
): Promise<PlayerState> {
  if (player === null) {
    return {
      loggedIn: false,
      username: null,
      streak: 0,
      style: 'plain',
      tutorialDone: false,
      result: null,
      placements: null,
    };
  }
  const [fields, stored] = await Promise.all([
    store.hGetAll(KEYS.user(player.userId)),
    store.get(KEYS.submission(day, player.userId)),
  ]);
  const streak = readStreak(fields);
  return {
    loggedIn: true,
    username: player.username,
    streak: streak.streak,
    style: styleFor(streak.streak),
    tutorialDone: fields['tutorialDone'] === '1',
    result: readResult(stored),
    placements: island === undefined ? null : readPlacements(stored, island),
  };
}

/** Record when a player began an island. Only the first call for a day counts. */
export async function recordStart(
  store: Store,
  player: Player,
  day: number,
  nowMs: number
): Promise<void> {
  if (player === null) return;
  const key = KEYS.start(day, player.userId);
  if ((await store.get(key)) !== undefined) return;
  await store.set(key, String(nowMs), KEEP.startSeconds);
  await store.hIncrBy(KEYS.stats(day), 'plays', 1);
}

export async function markTutorialDone(
  store: Store,
  player: Player
): Promise<void> {
  if (player === null) return;
  await store.hSet(KEYS.user(player.userId), { tutorialDone: '1' });
}

export async function skyCount(store: Store, day: number): Promise<number> {
  const stats = await store.hGetAll(KEYS.stats(day));
  return Number(stats['solves'] ?? 0) || 0;
}

/** Tonight's lanterns, newest last, at most SKY.maxLanterns. */
export async function readSky(
  store: Store,
  day: number
): Promise<{ count: number; lanterns: SkyLantern[] }> {
  const [entries, count] = await Promise.all([
    store.zRange(KEYS.sky(day), 0, SKY.maxLanterns - 1, true),
    skyCount(store, day),
  ]);
  const lanterns: SkyLantern[] = [];
  for (const entry of entries.reverse()) {
    try {
      const value: unknown = JSON.parse(entry.member);
      if (typeof value !== 'object' || value === null) continue;
      const fields: Record<string, unknown> = { ...value };
      const { u, s, a } = fields;
      if (typeof u !== 'string') continue;
      lanterns.push({ u, s: toStyle(s), a: cleanSnoovatar(a) });
    } catch {
      // A damaged entry is skipped, never shown.
    }
  }
  return { count: Math.max(count, lanterns.length), lanterns };
}

function toStyle(value: unknown): SkyLantern['s'] {
  return value === 'paper' ||
    value === 'star' ||
    value === 'koi' ||
    value === 'comet'
    ? value
    : 'plain';
}

export type LockInOutcome =
  | { ok: true; result: LockInResult }
  | { ok: false; reason: 'not-solved' | PlacementProblem };

export type LockInInput = {
  island: DailyIsland;
  placements: unknown;
  snoovatar: unknown;
  /** The client's own wish: false for archive and replay. */
  wantsRanked: boolean;
  /** The day of the post this request came from, if it is a daily post. */
  postDay: number | undefined;
  lastDay: number;
  nowMs: number;
};

/**
 * Lock in. Re-traces the placements, and if the solve is ranked, records it everywhere:
 * submission, leaderboard, all-time medals, heatmap, stats, streak, sky.
 */
export async function lockIn(
  store: Store,
  player: Player,
  input: LockInInput,
  effects: Effects
): Promise<LockInOutcome> {
  const { island, nowMs } = input;
  const score = scoreSubmission(puzzleOfDaily(island), input.placements);
  if (!score.ok) return { ok: false, reason: score.problem };
  if (!score.solved) return { ok: false, reason: 'not-solved' };

  const medal = medalFor(score.pieces, island.par);
  const unranked = (elapsedMs: number, streak: number): LockInOutcome => ({
    ok: true,
    result: {
      day: island.day,
      pieces: score.pieces,
      par: island.par,
      medal,
      elapsedMs,
      ranked: false,
      streak,
      style: styleFor(streak),
      percentile: 0,
      rank: 0,
      skyCount: 0,
    },
  });

  if (player === null || !input.wantsRanked || input.postDay !== island.day)
    return unranked(0, 0);

  const startText = await store.get(KEYS.start(island.day, player.userId));
  const startedMs = startText === undefined ? undefined : Number(startText);
  // Time is the server's own: from its start record to now. With no record, the slowest time.
  const elapsedMs =
    startedMs === undefined || !Number.isFinite(startedMs)
      ? SCORING.leaderboardMaxTimeMs
      : Math.min(
          SCORING.leaderboardMaxTimeMs,
          Math.max(0, Math.round(nowMs - startedMs))
        );

  const userKey = KEYS.user(player.userId);
  const before = readStreak(await store.hGetAll(userKey));
  if (!rankedOpen(island.day, nowMs, input.lastDay, startedMs))
    return unranked(elapsedMs, before.streak);

  // Only the first Lock in of the day counts. The counter is the lock: the first caller gets 1.
  const first =
    (await store.count(
      KEYS.submitLock(island.day, player.userId),
      KEEP.submissionSeconds
    )) === 1;
  if (!first) {
    const earlier = readResult(
      await store.get(KEYS.submission(island.day, player.userId))
    );
    return earlier === null
      ? unranked(elapsedMs, before.streak)
      : { ok: true, result: { ...earlier, ranked: false } };
  }

  const after = advanceStreak(before, island.day);
  const style = styleFor(after.streak);
  const boardScore = score.pieces * SCORING.leaderboardPieceWeight + elapsedMs;
  const boardKey = KEYS.leaderboard(island.day);
  const statsKey = KEYS.stats(island.day);

  await store.zAdd(boardKey, player.username, boardScore);
  const [solves, rank, total] = await Promise.all([
    store.hIncrBy(statsKey, 'solves', 1),
    store.zRank(boardKey, player.username),
    store.zCard(boardKey),
  ]);
  const beaten = total - 1 - (rank ?? 0);
  const percentile =
    total <= 1 ? 100 : Math.round((beaten / (total - 1)) * 100);

  const result: LockInResult = {
    day: island.day,
    pieces: score.pieces,
    par: island.par,
    medal,
    elapsedMs,
    ranked: true,
    streak: after.streak,
    style,
    percentile,
    rank: (rank ?? 0) + 1,
    skyCount: solves,
  };
  const clean: Placement[] = score.placements;
  const lantern: SkyLantern = {
    u: player.username,
    s: style,
    a: cleanSnoovatar(input.snoovatar),
  };

  const writes: Promise<unknown>[] = [
    store.set(
      KEYS.submission(island.day, player.userId),
      JSON.stringify({ placements: clean, result }),
      KEEP.submissionSeconds
    ),
    store.hSet(userKey, {
      streak: String(after.streak),
      lastDay: String(after.lastDay),
      graceWeek: String(after.graceWeek),
      best: String(after.best),
      style,
      username: player.username,
    }),
    store.zAdd(KEYS.sky(island.day), JSON.stringify(lantern), nowMs),
  ];
  if (medal === 'lamplighter') {
    writes.push(
      store.hIncrBy(statsKey, 'parHits', 1),
      store.zIncrBy(KEYS.allTime, player.username, 1)
    );
  }
  for (const placement of clean) {
    writes.push(
      store.hIncrBy(
        KEYS.heat(island.day),
        String(placement.y * puzzleOfDaily(island).width + placement.x),
        1
      )
    );
  }
  await Promise.all(writes);

  // Keep only the newest lanterns; the count lives in stats.
  const kept = await store.zCard(KEYS.sky(island.day));
  if (kept > SKY.maxLanterns)
    await store.zRemRangeByRank(
      KEYS.sky(island.day),
      0,
      kept - SKY.maxLanterns - 1
    );
  if (kept === 1) await store.expire(KEYS.sky(island.day), KEEP.skySeconds);

  await effects.onRanked({ player, result, lantern }).catch(() => undefined);
  return { ok: true, result };
}

/**
 * Developer tool: forget one player's tutorial and their solve of one day, as if they had never
 * played it, so the first-time flow can be tested again. Their streak starts over too.
 */
export async function resetPlayer(
  store: Store,
  player: Player,
  day: number
): Promise<void> {
  if (player === null) return;
  const had =
    (await store.get(KEYS.submission(day, player.userId))) !== undefined;
  const sky = await store.zRange(KEYS.sky(day), 0, SKY.maxLanterns - 1);
  const mine = sky.filter((entry) => {
    try {
      const value: unknown = JSON.parse(entry.member);
      return (
        typeof value === 'object' &&
        value !== null &&
        'u' in value &&
        value.u === player.username
      );
    } catch {
      return false;
    }
  });
  await Promise.all([
    store.del(KEYS.submission(day, player.userId)),
    store.del(KEYS.submitLock(day, player.userId)),
    store.del(KEYS.start(day, player.userId)),
    store.zRem(KEYS.leaderboard(day), player.username),
    ...mine.map((entry) => store.zRem(KEYS.sky(day), entry.member)),
    store.hSet(KEYS.user(player.userId), {
      tutorialDone: '0',
      streak: String(NEW_STREAK.streak),
      lastDay: String(NEW_STREAK.lastDay),
      graceWeek: String(NEW_STREAK.graceWeek),
    }),
  ]);
  if (had) await store.hIncrBy(KEYS.stats(day), 'solves', -1);
}

/** Earlier islands, newest first, with the player's medal on each night they played. */
export async function pastIslands(
  store: Store,
  player: Player,
  islands: readonly DailyIsland[]
): Promise<PastIsland[]> {
  const medals = await Promise.all(
    islands.map(async (island) =>
      player === null
        ? null
        : (readResult(
            await store.get(KEYS.submission(island.day, player.userId))
          )?.medal ?? null)
    )
  );
  return islands.map((island, index) => ({
    day: island.day,
    name: island.name,
    weekday: island.weekday,
    biome: island.biome,
    par: island.par,
    medal: medals[index] ?? null,
  }));
}
