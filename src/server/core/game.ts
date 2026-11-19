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
import {
  puzzleOfDaily,
  type DailyIsland,
  type PlayableIsland,
} from '../../shared/daily';
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
  const [fields, stored, shared, left] = await Promise.all([
    store.hGetAll(KEYS.user(player.userId)),
    store.get(KEYS.submission(day, player.userId)),
    store.get(KEYS.shared(day, player.userId)),
    island === undefined
      ? undefined
      : store.get(KEYS.progress(day, player.userId)),
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
    rank: (rank ?? 0) + 1,
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
  if (result.rank <= OTHERS.top) await rebuildOthers(store, island);

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
  const stored = await store.get(KEYS.submission(day, player.userId));
  const had = stored !== undefined;
  // Their board leaves the count of players who placed it.
  const placed = stored === undefined ? null : placementsIn(stored);
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
  // Take the solve back out of the tally, but never below zero (the day may have been cleared).
  if (had) {
    const left = await store.hIncrBy(KEYS.stats(day), 'solves', -1);
    if (left < 0) await store.hSet(KEYS.stats(day), { solves: '0' });
  }
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
 * Work out the top of the night's board with each player's pieces, and keep it, so the list
 * opens with one read. Called after a Lock in that reaches the top, and when the kept list is
 * missing or shorter than the board. A player whose pieces were never stored is still listed,
 * with none.
 */
export async function rebuildOthers(
  store: Store,
  island: PlayableIsland
): Promise<OtherIsland[]> {
  const { top } = await readLeaderboard(store, island.day, null, OTHERS.scan);
  const pieces = await store.hMGet(
    KEYS.boards(island.day),
    top.map((row) => row.username)
  );
  // Down the board, the first player with each board stands for everyone who placed it.
  const seen = new Set<string>();
  const firsts: {
    row: BoardRow;
    placements: Placement[] | null;
    key: string;
  }[] = [];
  for (const [index, row] of top.entries()) {
    if (firsts.length >= OTHERS.top) break;
    const placements = readBoardPieces(island, pieces[index]);
    const key =
      placements === null ? `none:${row.username}` : boardOf(placements);
    if (seen.has(key)) continue;
    seen.add(key);
    firsts.push({ row, placements, key });
  }
  const counts = await store.hMGet(
    KEYS.groups(island.day),
    firsts.map((first) => first.key)
  );
  const islands: OtherIsland[] = firsts.map((first, index) => ({
    ...first.row,
    placements: first.placements,
    same: Math.max(1, Number(counts[index] ?? 1) || 1),
  }));
  await store.set(
    KEYS.othersTop(island.day),
    JSON.stringify(islands),
    KEEP.submissionSeconds
  );
  return islands;
}

function readOthersTop(
  island: PlayableIsland,
  text: string | undefined
): OtherIsland[] | null {
  if (text === undefined) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return null;
    const islands: OtherIsland[] = [];
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
      islands.push({
        rank,
        username,
        snoovatar,
        pieces,
        timeMs,
        placements,
        same: typeof same === 'number' ? same : 1,
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
  // A kept list shorter than the board is out of date (an older version kept it, or two Lock
  // ins crossed): work it out again.
  const keptTop = readOthersTop(island, kept);
  // Rows stand for every player with the same board, so a full or complete list is current.
  const covered =
    keptTop?.reduce((sum, row) => sum + Math.max(1, row.same ?? 1), 0) ?? 0;
  const top =
    keptTop !== null && (keptTop.length >= OTHERS.top || covered >= total)
      ? keptTop
      : await rebuildOthers(store, island);

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
