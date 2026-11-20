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
  type AllTimeRow,
  type BoardRow,
  type LockInResult,
  type OtherIsland,
  type PastIsland,
  type PlayerState,
  type SkyLantern,
} from '../../shared/api';
import { dayAt } from '../../shared/calendar';
import { boardKey as boardOf, isCommunity } from '../../shared/community';
import {
  CALENDAR,
  KEEP,
  LEADERBOARD,
  OTHERS,
  RULES,
  SCORING,
  SKY,
} from '../../shared/config';
import { puzzleOfDaily, type PlayableIsland } from '../../shared/daily';
import {
  advanceStreak,
  NEW_STREAK,
  styleFor,
  type StreakState,
} from '../../shared/streak';
import { RULE_KINDS, type RuleKind } from '../../shared/rules';
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
    /** The player made a Sunday pick: their flair keeps "Islandwright" (E7). */
    islandwright: boolean;
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
  // A community island has no night: the first Lock in on its post counts, whenever it comes.
  if (isCommunity(day)) return true;
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
    // The maker's own Sunday (PHASE3_PLAN.md E5) is stored, but it was never ranked.
    const maker = r['maker'] === true;
    return {
      ...(maker ? { maker: true } : {}),
      day,
      pieces,
      par,
      medal,
      elapsedMs,
      ranked: !maker,
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

/** The pieces stored with a result, as stored (for counting boards, not for showing them). */
function placementsIn(text: string): Placement[] | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const fields: Record<string, unknown> = { ...value };
    const pieces = fields['placements'];
    return Array.isArray(pieces)
      ? pieces.filter(
          (entry): entry is Placement =>
            typeof entry === 'object' && entry !== null && 'piece' in entry
        )
      : null;
  } catch {
    return null;
  }
}

/** The pieces stored with a result, checked against the island again. */
function readPlacements(
  text: string | undefined,
  island: PlayableIsland
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

/**
 * A ranked player's place as the board shows it: their position, or 0 (no place shown) for a
 * time too fast to be believed, which the board keeps without a number.
 */
function placeOf(position: number, elapsedMs: number): number {
  return elapsedMs < SCORING.minPlausibleMs ? 0 : position + 1;
}

/** What the server knows about a player for one island. */
export async function playerState(
  store: Store,
  player: Player,
  day: number,
  /** When given, the stored pieces come back too, to show the island as it was left. */
  island?: PlayableIsland
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
      shared: false,
      sharedComment: null,
      skyNoteSeen: false,
      rulesSeen: [],
      progress: null,
    };
  }
  const [fields, stored, shared, left, position] = await Promise.all([
    store.hGetAll(KEYS.user(player.userId)),
    store.get(KEYS.submission(day, player.userId)),
    store.get(KEYS.shared(day, player.userId)),
    island === undefined
      ? undefined
      : store.get(KEYS.progress(day, player.userId)),
    store.zRank(KEYS.leaderboard(day), player.username),
  ]);
  const streak = readStreak(fields);
  const result = readResult(stored);
  return {
    loggedIn: true,
    username: player.username,
    streak: streak.streak,
    style: styleFor(streak.streak),
    tutorialDone: fields['tutorialDone'] === '1',
    // The place is the board's now, not the one at Lock in: faster players may have come since.
    result:
      result === null || !result.ranked || position === undefined
        ? result
        : { ...result, rank: placeOf(position, result.elapsedMs) },
    placements: island === undefined ? null : readPlacements(stored, island),
    shared: shared !== undefined,
    // Older shares stored only "1"; a reply id starts t1_.
    sharedComment: shared?.startsWith('t1_') === true ? shared : null,
    skyNoteSeen: fields['rule:sky'] === '1',
    rulesSeen: RULE_KINDS.filter((kind) => fields[`rule:${kind}`] === '1'),
    progress:
      island === undefined || stored !== undefined || left === undefined
        ? null
        : readPlacements(`{"placements":${left}}`, island),
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

/**
 * How many players lit a day: the real board itself (one entry per ranked player), never a
 * running tally that a reset or clean-up could drive below zero.
 */
export async function skyCount(store: Store, day: number): Promise<number> {
  return Math.max(0, await store.zCard(KEYS.leaderboard(day)));
}

/** A tally from a stats hash, read safely: a missing, damaged or negative value is 0. */
function tally(fields: Record<string, string>, field: string): number {
  const value = Number(fields[field] ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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
  island: PlayableIsland;
  placements: unknown;
  snoovatar: unknown;
  /** The client's own wish: false for archive and replay. */
  wantsRanked: boolean;
  /** The day of the post this request came from, if it is a daily post. */
  postDay: number | undefined;
  lastDay: number;
  nowMs: number;
  /**
   * On a Sunday picked from the community: its maker's user id. Their own Lock in is not ranked
   * (they know the answer) but keeps their streak (PHASE3_PLAN.md E5).
   */
  makerId?: string;
};

/**
 * Lock in. Re-traces the placements, and if the solve is ranked, records it everywhere:
 * submission, leaderboard, the pieces for "See others' islands", all-time medals, stats, streak,
 * sky.
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
  const userFields = await store.hGetAll(userKey);
  const before = readStreak(userFields);
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

  // The maker of a Sunday pick knows its answer: their Lock in is kept (they see their island
  // lit when they come back) but not ranked: no board, sky, medal, par count or flair. It does
  // keep their streak going: building the winning island must never break one (E5).
  if (input.makerId !== undefined && input.makerId === player.userId) {
    const after = advanceStreak(before, island.day);
    const result: LockInResult = {
      maker: true,
      day: island.day,
      pieces: score.pieces,
      par: island.par,
      medal,
      elapsedMs,
      ranked: false,
      streak: after.streak,
      style: styleFor(after.streak),
      percentile: 0,
      rank: 0,
      skyCount: 0,
    };
    await Promise.all([
      store.set(
        KEYS.submission(island.day, player.userId),
        JSON.stringify({ placements: score.placements, result }),
        KEEP.submissionSeconds
      ),
      store.hSet(userKey, {
        streak: String(after.streak),
        lastDay: String(after.lastDay),
        graceWeek: String(after.graceWeek),
        best: String(after.best),
        style: styleFor(after.streak),
        username: player.username,
      }),
      store.del(KEYS.progress(island.day, player.userId)),
    ]);
    return { ok: true, result };
  }

  // A community island is outside the daily run: no streak, flair, medal count or all-time
  // board. The player's lantern keeps the style their streak has already earned.
  const community = isCommunity(island.day);
  const after = community ? before : advanceStreak(before, island.day);
  const style = styleFor(after.streak);
  const boardScore = score.pieces * SCORING.leaderboardPieceWeight + elapsedMs;
  const boardKey = KEYS.leaderboard(island.day);
  const statsKey = KEYS.stats(island.day);

  // The pieces go in before the board entry, so whoever rebuilds the top of the board next
  // always finds them.
  await store.hSet(KEYS.boards(island.day), {
    [player.username]: JSON.stringify(score.placements),
  });
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
    rank: placeOf(rank ?? 0, elapsedMs),
    // The real board's size, not the running tally (which a dev reset can disturb).
    skyCount: Math.max(solves, total),
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
    store.hSet(
      userKey,
      community
        ? { username: player.username }
        : {
            streak: String(after.streak),
            lastDay: String(after.lastDay),
            graceWeek: String(after.graceWeek),
            best: String(after.best),
            style,
            username: player.username,
            // The flair's medal, so a Sunday pick can write the maker's full flair (E7).
            lastMedal: medal,
          }
    ),
    store.zAdd(KEYS.sky(island.day), JSON.stringify(lantern), nowMs),
    // How many players placed exactly this board: identical boards are listed once.
    store.hIncrBy(KEYS.groups(island.day), boardOf(clean), 1),
    // The island is finished: there is no unfinished board to come back to.
    store.del(KEYS.progress(island.day, player.userId)),
  ];
  if (lantern.a !== '')
    writes.push(store.hSet(KEYS.avatars, { [player.username]: lantern.a }));
  if (medal === 'lamplighter') {
    writes.push(store.hIncrBy(statsKey, 'parHits', 1));
    if (!community)
      writes.push(store.zIncrBy(KEYS.allTime, player.username, 1));
  }
  writes.push(
    store.expire(KEYS.boards(island.day), KEEP.submissionSeconds),
    store.expire(KEYS.groups(island.day), KEEP.submissionSeconds)
  );
  await Promise.all(writes);
  // A Lock in that reaches the top of the board rebuilds the cached list once, here, so opening
  // "See others' islands" is a single read.
  if (result.rank <= OTHERS.top + 1) await rebuildOthers(store, island);

  // Keep only the newest lanterns; the count lives in stats.
  const kept = await store.zCard(KEYS.sky(island.day));
  if (kept > SKY.maxLanterns)
    await store.zRemRangeByRank(
      KEYS.sky(island.day),
      0,
      kept - SKY.maxLanterns - 1
    );
  if (kept === 1) await store.expire(KEYS.sky(island.day), KEEP.skySeconds);

  await effects
    .onRanked({
      player,
      result,
      lantern,
      islandwright: Number(userFields['islandwright'] ?? 0) > 0,
    })
    .catch(() => undefined);
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
  const stored = await store.get(KEYS.submission(day, player.userId));
  // Only a ranked result was counted (the maker's own Sunday is kept but never ranked, E5).
  const had = readResult(stored)?.ranked === true;
  // Their board leaves the count of players who placed it.
  const placed = stored === undefined || !had ? null : placementsIn(stored);
  if (placed !== null) {
    const key = boardOf(placed);
    const left = await store.hIncrBy(KEYS.groups(day), key, -1);
    if (left < 0) await store.hSet(KEYS.groups(day), { [key]: '0' });
  }
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
    store.del(KEYS.shared(day, player.userId)),
    store.del(KEYS.shareLock(day, player.userId)),
    // The Island Builder starts over too: no draft, no check or test, the tutorial again.
    store.del(KEYS.draft(player.userId)),
    store.del(KEYS.builderCheck(player.userId)),
    store.del(KEYS.builderTurn(player.userId)),
    store.zRem(KEYS.leaderboard(day), player.username),
    store.del(KEYS.othersTop(day)),
    ...mine.map((entry) => store.zRem(KEYS.sky(day), entry.member)),
    store.hSet(KEYS.user(player.userId), {
      tutorialDone: '0',
      ...Object.fromEntries(RULE_KINDS.map((kind) => [`rule:${kind}`, '0'])),
      'rule:sky': '0',
      builderTutorial: '0',
      streak: String(NEW_STREAK.streak),
      lastDay: String(NEW_STREAK.lastDay),
      graceWeek: String(NEW_STREAK.graceWeek),
    }),
  ]);
  // Take the solve, and its par hit, back out of the tallies, never below zero (the day may have
  // been cleared). Left in, a replay would count the same par hit twice.
  if (had) {
    const left = await store.hIncrBy(KEYS.stats(day), 'solves', -1);
    if (left < 0) await store.hSet(KEYS.stats(day), { solves: '0' });
    if (readResult(stored)?.medal === 'lamplighter') {
      const hits = await store.hIncrBy(KEYS.stats(day), 'parHits', -1);
      if (hits < 0) await store.hSet(KEYS.stats(day), { parHits: '0' });
    }
  }
}

/** Earlier islands, newest first, with the player's medal on each night they played. */
export async function pastIslands(
  store: Store,
  player: Player,
  islands: readonly PlayableIsland[],
  /** Sundays picked from the community: their makers, for the map's badge (Phase 3). */
  makers: ReadonlyMap<
    number,
    { maker: string; makerAvatar: string }
  > = new Map()
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
  const solves = await Promise.all(
    islands.map((island) => skyCount(store, island.day))
  );
  return islands.map((island, index) => ({
    day: island.day,
    name: island.name,
    weekday: island.weekday,
    biome: island.biome,
    par: island.par,
    medal: medals[index] ?? null,
    rows: island.rows,
    solves: solves[index] ?? 0,
    ...(makers.get(island.day) ?? {}),
  }));
}

/** Snoovatar addresses for a list of usernames, '' where there is none. */
async function avatarsOf(store: Store, names: string[]): Promise<string[]> {
  const found = await store.hMGet(KEYS.avatars, names);
  return names.map((_name, index) => cleanSnoovatar(found[index]));
}

function boardRow(
  username: string,
  score: number,
  place: number,
  snoovatar: string
): BoardRow {
  const pieces = Math.floor(score / SCORING.leaderboardPieceWeight);
  const timeMs = score - pieces * SCORING.leaderboardPieceWeight;
  return {
    // A time too fast to be believed is kept, but never given a place.
    rank: timeMs < SCORING.minPlausibleMs ? null : place,
    username,
    snoovatar,
    pieces,
    timeMs,
  };
}

/** Tonight's board: fewest pieces first, then fastest; and the player's own row if lower. */
export async function readLeaderboard(
  store: Store,
  day: number,
  username: string | null,
  /** Rows read from the top. */
  rows: number = LEADERBOARD.top
): Promise<{ top: BoardRow[]; me: BoardRow | null; total: number }> {
  const key = KEYS.leaderboard(day);
  const [entries, total, position] = await Promise.all([
    store.zRange(key, 0, rows - 1),
    store.zCard(key),
    username === null ? undefined : store.zRank(key, username),
  ]);
  const inTop = entries.some((entry) => entry.member === username);
  const own =
    username !== null && position !== undefined && !inTop
      ? (await store.zRange(key, position, position))[0]
      : undefined;
  const names = entries.map((entry) => entry.member);
  if (own !== undefined) names.push(own.member);
  const avatars = await avatarsOf(store, names);
  const top = entries.map((entry, index) =>
    boardRow(entry.member, entry.score, index + 1, avatars[index] ?? '')
  );
  const me =
    own === undefined || position === undefined
      ? null
      : boardRow(own.member, own.score, position + 1, avatars.at(-1) ?? '');
  return { top, me, total };
}

/** The all-time board: most nights at par first. */
export async function readAllTime(
  store: Store,
  username: string | null
): Promise<{ top: AllTimeRow[]; me: AllTimeRow | null; total: number }> {
  const [entries, total, position] = await Promise.all([
    store.zRange(KEYS.allTime, 0, LEADERBOARD.top - 1, true),
    store.zCard(KEYS.allTime),
    username === null ? undefined : store.zRank(KEYS.allTime, username),
  ]);
  const inTop = entries.some((entry) => entry.member === username);
  // zRank counts from the lowest score; this board counts from the highest.
  const fromTop =
    position === undefined || inTop ? undefined : total - 1 - position;
  const own =
    fromTop === undefined
      ? undefined
      : (await store.zRange(KEYS.allTime, fromTop, fromTop, true))[0];
  const names = entries.map((entry) => entry.member);
  if (own !== undefined) names.push(own.member);
  const avatars = await avatarsOf(store, names);
  const top = entries.map((entry, index) => ({
    rank: index + 1,
    username: entry.member,
    snoovatar: avatars[index] ?? '',
    medals: entry.score,
  }));
  const me =
    own === undefined || fromTop === undefined
      ? null
      : {
          rank: fromTop + 1,
          username: own.member,
          snoovatar: avatars.at(-1) ?? '',
          medals: own.score,
        };
  return { top, me, total };
}

/** Pieces stored as JSON, checked again against the island: anything odd reads as none. */
function readBoardPieces(
  island: PlayableIsland,
  text: string | null | undefined
): Placement[] | null {
  if (text === null || text === undefined) return null;
  try {
    const check = validatePlacements(puzzleOfDaily(island), JSON.parse(text));
    return check.ok ? check.placements : null;
  } catch {
    return null;
  }
}

/**
 * One kept row of "See others' islands": one board, shown as the first player down the board
 * who placed it, plus the next one (so a viewer who is that first player can still be told who
 * else placed it).
 */
type KeptRow = OtherIsland & { next?: string };

/** Which board a row stands for. Pieces never stored: a board of the player's own. */
function keyOfRow(row: {
  username: string;
  placements: Placement[] | null;
}): string {
  return row.placements === null
    ? `none:${row.username}`
    : boardOf(row.placements);
}

/** A tally of players from the groups hash, read safely: at least 1, the row's own player. */
function groupCount(value: string | null | undefined): number {
  return Math.max(1, Number(value ?? 1) || 1);
}

/**
 * Work out the top of the night's board, one row per board with each board's pieces, and keep
 * it, so the list opens with one read. One row more than OTHERS.top is kept, so the list is still
 * full once the viewer's own board is taken out. Called after a Lock in that reaches the top, and
 * when the kept list no longer covers the board. A player whose pieces were never stored is
 * still listed, with none.
 */
export async function rebuildOthers(
  store: Store,
  island: PlayableIsland
): Promise<KeptRow[]> {
  const { top } = await readLeaderboard(store, island.day, null, OTHERS.scan);
  const pieces = await store.hMGet(
    KEYS.boards(island.day),
    top.map((row) => row.username)
  );
  // Down the board, the first player with each board stands for everyone who placed it.
  const groups = new Map<string, KeptRow>();
  for (const [index, row] of top.entries()) {
    const placements = readBoardPieces(island, pieces[index]);
    const key = keyOfRow({ username: row.username, placements });
    const group = groups.get(key);
    if (group !== undefined) {
      if (group.next === undefined) group.next = row.username;
      continue;
    }
    if (groups.size < OTHERS.top + 1)
      groups.set(key, { ...row, placements, same: 1 });
  }
  const kept = [...groups.values()];
  const counts = await store.hMGet(KEYS.groups(island.day), [...groups.keys()]);
  kept.forEach((row, index) => {
    row.same = groupCount(counts[index]);
  });
  await store.set(
    KEYS.othersTop(island.day),
    JSON.stringify(kept),
    KEEP.submissionSeconds
  );
  return kept;
}

/** A kept row as the client sees it: without the server's own bookkeeping. */
function shownRow(row: KeptRow): OtherIsland {
  return {
    rank: row.rank,
    username: row.username,
    snoovatar: row.snoovatar,
    pieces: row.pieces,
    timeMs: row.timeMs,
    placements: row.placements,
    same: row.same ?? 1,
  };
}

function readOthersTop(
  island: PlayableIsland,
  text: string | undefined
): KeptRow[] | null {
  if (text === undefined) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return null;
    const islands: KeptRow[] = [];
    for (const entry of value) {
      if (typeof entry !== 'object' || entry === null) return null;
      const fields: Record<string, unknown> = { ...entry };
      const { rank, username, snoovatar, pieces, timeMs } = fields;
      if (
        (rank !== null && typeof rank !== 'number') ||
        typeof username !== 'string' ||
        typeof snoovatar !== 'string' ||
        typeof pieces !== 'number' ||
        typeof timeMs !== 'number'
      )
        return null;
      const stored = fields['placements'];
      const placements =
        stored === null
          ? null
          : readBoardPieces(island, JSON.stringify(stored));
      if (stored !== null && placements === null) return null;
      const same = fields['same'];
      const next = fields['next'];
      islands.push({
        rank,
        username,
        snoovatar,
        pieces,
        timeMs,
        placements,
        same: typeof same === 'number' ? same : 1,
        ...(typeof next === 'string' ? { next } : {}),
      });
    }
    return islands;
  } catch {
    return null;
  }
}

export type OthersOutcome =
  | {
      ok: true;
      top: OtherIsland[];
      me: OtherIsland | null;
      solves: number;
      parHits: number;
      parSolution: Placement[] | null;
      creator: OtherIsland | null;
    }
  | { ok: false };

/**
 * "See others' islands". Tonight's stays closed until the player has a ranked Lock in of it; an
 * island from an earlier night is open to everyone, with its par answer. The player's own island
 * is always included when they have one, to compare.
 */
export async function readOthers(
  store: Store,
  player: Player,
  island: PlayableIsland,
  nowMs: number,
  lastDay: number,
  /** On a community island: the maker's own test solve, pinned first, never ranked. */
  creator: OtherIsland | null = null
): Promise<OthersOutcome> {
  // A community island's list never opens to all: it has no night that ends.
  const over =
    !isCommunity(island.day) && island.day < currentDay(nowMs, lastDay);
  // Its maker lit it in their test, so their list is open from the start.
  const isMaker =
    creator !== null && player !== null && creator.username === player.username;
  const [mine, kept, stats, total] = await Promise.all([
    player === null
      ? undefined
      : store.get(KEYS.submission(island.day, player.userId)),
    store.get(KEYS.othersTop(island.day)),
    store.hGetAll(KEYS.stats(island.day)),
    store.zCard(KEYS.leaderboard(island.day)),
  ]);
  if (!over && mine === undefined && !isMaker) return { ok: false };

  let me: OtherIsland | null = null;
  const result = readResult(mine);
  if (player !== null && mine !== undefined && result !== null) {
    const placements = readPlacements(mine, island);
    const [position, avatar] = await Promise.all([
      store.zRank(KEYS.leaderboard(island.day), player.username),
      store.hMGet(KEYS.avatars, [player.username]),
    ]);
    if (placements !== null)
      me = {
        // As on the board: a time too fast to be believed is kept, but never given a place.
        rank:
          position === undefined || result.elapsedMs < SCORING.minPlausibleMs
            ? null
            : position + 1,
        username: player.username,
        snoovatar: cleanSnoovatar(avatar[0]),
        pieces: result.pieces,
        timeMs: result.elapsedMs,
        placements,
      };
  }
  // The viewer's board: its whole group is folded into their own row, never listed again.
  const myKey = me === null ? null : keyOfRow(me);

  // Every count is read now, not kept: a board's count grows without the list changing.
  const counted = async (
    rows: KeptRow[]
  ): Promise<{ rows: KeptRow[]; mine: number }> => {
    const keys = rows.map(keyOfRow);
    const counts = await store.hMGet(
      KEYS.groups(island.day),
      myKey === null ? keys : [...keys, myKey]
    );
    return {
      rows: rows.map((row, index) => ({
        ...row,
        same: groupCount(counts[index]),
      })),
      // The viewer's group counts the viewer. A ranked viewer is in the board's counts already;
      // the maker of a Sunday pick (kept, never ranked, E5) is not, so they are added.
      mine:
        myKey === null
          ? 1
          : result?.ranked === false
            ? (Number(counts[keys.length] ?? 0) || 0) + 1
            : groupCount(counts[keys.length]),
    };
  };
  const keptTop = readOthersTop(island, kept);
  let list = keptTop === null ? null : await counted(keptTop);
  // The kept rows cover the board when they are full, or when their players add up to everyone
  // on it. Otherwise a board is missing (a newer Lock in, an older version kept the list, two
  // Lock ins crossed): work it out again.
  const covered =
    list?.rows.reduce((sum, row) => sum + (row.same ?? 1), 0) ?? 0;
  if (list === null || !(list.rows.length > OTHERS.top || covered >= total))
    list = await counted(await rebuildOthers(store, island));

  if (me !== null && myKey !== null) {
    me.same = list.mine;
    const group = list.rows.find((row) => keyOfRow(row) === myKey);
    const other =
      group === undefined
        ? undefined
        : group.username !== me.username
          ? group.username
          : group.next;
    if (list.mine > 1 && other !== undefined) me.sameAs = other;
  }
  const top = list.rows
    .filter((row) => keyOfRow(row) !== myKey)
    .slice(0, OTHERS.top)
    .map(shownRow);
  return {
    ok: true,
    top,
    me,
    solves: Math.max(tally(stats, 'solves'), total),
    parHits: tally(stats, 'parHits'),
    parSolution: over ? island.solution : null,
    creator,
  };
}

export type ShareClaim =
  | { ok: true; result: LockInResult }
  | { ok: false; reason: 'signed-out' | 'nothing-to-share' | 'already-shared' };

/**
 * May this player share their result for this day? Only a ranked result, and only once: the
 * first caller takes the share. If posting then fails, `releaseShare` gives it back.
 */
export async function claimShare(
  store: Store,
  player: Player,
  day: number
): Promise<ShareClaim> {
  if (player === null) return { ok: false, reason: 'signed-out' };
  const result = readResult(
    await store.get(KEYS.submission(day, player.userId))
  );
  if (result === null) return { ok: false, reason: 'nothing-to-share' };
  if ((await store.get(KEYS.shared(day, player.userId))) !== undefined)
    return { ok: false, reason: 'already-shared' };
  const first =
    (await store.count(
      KEYS.shareLock(day, player.userId),
      KEEP.submissionSeconds
    )) === 1;
  return first ? { ok: true, result } : { ok: false, reason: 'already-shared' };
}

/** The share was posted: remember the reply, so it can be opened (and removed by a dev reset). */
export async function recordShare(
  store: Store,
  player: { userId: string },
  day: number,
  commentId: string
): Promise<void> {
  await store.set(
    KEYS.shared(day, player.userId),
    commentId,
    KEEP.submissionSeconds
  );
}

/** The reply a player shared on a day, if its id is known. */
export async function sharedCommentOf(
  store: Store,
  player: { userId: string },
  day: number
): Promise<string | null> {
  const value = await store.get(KEYS.shared(day, player.userId));
  return value?.startsWith('t1_') === true ? value : null;
}

export async function releaseShare(
  store: Store,
  player: { userId: string },
  day: number
): Promise<void> {
  await store.del(KEYS.shareLock(day, player.userId));
}

/**
 * Remember an unfinished board, so reopening the post restores it. Only pieces that could
 * really be on the island are kept, and nothing is kept once the player has locked in.
 */
export async function saveProgress(
  store: Store,
  player: Player,
  island: PlayableIsland,
  placements: unknown
): Promise<boolean> {
  if (player === null) return false;
  const check = validatePlacements(puzzleOfDaily(island), placements);
  if (!check.ok) return false;
  const done = await store.get(KEYS.submission(island.day, player.userId));
  if (done !== undefined) return false;
  await store.set(
    KEYS.progress(island.day, player.userId),
    JSON.stringify(check.placements),
    KEEP.progressSeconds
  );
  return true;
}

/** A one-time rule card has been shown to this player. */
export async function markRuleSeen(
  store: Store,
  player: Player,
  kind: RuleKind | 'sky'
): Promise<void> {
  if (player === null) return;
  await store.hSet(KEYS.user(player.userId), { [`rule:${kind}`]: '1' });
}
