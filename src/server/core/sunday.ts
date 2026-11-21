/**
 * The Sunday pick (PHASE3_PLAN.md). Every Saturday at SUNDAY.pickHourUtc the best community
 * island of the week becomes Sunday's ranked island, credited to its maker: highest post score,
 * then par hits, then plays, then the earliest, among live islands that fit Sunday and pass a
 * fresh check with today's engine. The winner is copied whole into `sun:{day}`, so nothing done
 * to its post or record later can change Sunday; the daily numbering and every other day stay
 * as generated. When nothing qualifies, Sunday keeps its generated island and the reasons are
 * logged.
 *
 * Safe to call any number of times (cron is not exactly-once, PLATFORM.md 5): a lock lets one run
 * at a time, a written pick is final, and each effect (the comment, the flair) is done once.
 * No Reddit or Devvit calls in here: Reddit comes in through `PickReddit`, so every rule is tested.
 */
import { draftProblem, readDraft } from '../../shared/builder';
import { dateOfDay, dayAt, dayStartMs } from '../../shared/calendar';
import { communityNumber } from '../../shared/community';
import { COMMUNITY, COPY, SUNDAY } from '../../shared/config';
import type { PlayableIsland } from '../../shared/daily';
import { flairFor, medalName } from '../../shared/streak';
import type { Medal } from '../../shared/types';
import { checkIsland } from './check';
import {
  creatorRow,
  creditOf,
  readCommunity,
  toPlayable,
  type CommunityRecord,
} from './community';
import { skyCount } from './game';
import { isSunday, readPick, type SundayPick } from './sunday-store';
import { KEYS, type Store } from './store';

export {
  isSunday,
  islandOfDay,
  readPick,
  type SundayPick,
} from './sunday-store';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** When the pick for Sunday `day` runs: the Saturday before, at the pick hour (UTC). */
export function pickTime(day: number): number {
  return dayStartMs(day - 1) + SUNDAY.pickHourUtc * HOUR_MS;
}

/** Publish times in the running for Sunday `day`: the week before its pick (E1). */
export function pickWindow(day: number): { from: number; to: number } {
  const to = pickTime(day);
  return { from: to - SUNDAY.windowDays * DAY_MS, to };
}

/** The first Sunday on or after a day. */
function sundayFrom(day: number): number {
  let sunday = Math.max(1, day);
  while (!isSunday(sunday)) sunday++;
  return sunday;
}

/**
 * The Sunday whose pick should exist by now, or null: from Saturday's pick hour, and all of
 * Sunday itself (the last chance, before its post is made).
 */
export function dueSunday(nowMs: number): number | null {
  const today = dayAt(nowMs);
  if (isSunday(today)) return today;
  if (isSunday(today + 1) && nowMs >= pickTime(today + 1)) return today + 1;
  return null;
}

/** The Sunday this week's new islands are running for: the next pick still to come. */
export function runningFor(nowMs: number): number {
  const sunday = sundayFrom(dayAt(nowMs));
  return pickTime(sunday) > nowMs ? sunday : sunday + 7;
}

/** The Sunday a developer's "run the pick now" is for: the next one, today if it is Sunday. */
export function devSunday(nowMs: number): number {
  return sundayFrom(dayAt(nowMs));
}

/** What the pick needs from Reddit. The route passes the real calls; tests pass fakes. */
export type PickReddit = {
  /**
   * Many posts' live scores, and whether each still stands, at once (the subreddit's newest
   * posts, a page of 100 per call, back to `since`). A post Reddit could not say anything about
   * is missing from the answer.
   */
  readPosts: (
    postIds: readonly string[],
    since: number
  ) => Promise<ReadonlyMap<string, { score: number; live: boolean }>>;
  /** Comment on a post as the app; answers the comment's id. */
  comment: (postId: string, text: string) => Promise<string>;
  editComment: (commentId: string, text: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  /** Set a player's flair in the game's subreddit. */
  flair: (username: string, text: string) => Promise<void>;
  /** The game's subreddit, for the comment's wording. */
  subreddit: string;
};

export type PickOptions = {
  /** Daily islands' fingerprints, for the re-check (an exact copy is refused). */
  daily: ReadonlySet<string>;
  clock: () => number;
  nodeLimit?: number;
  /** The community switch (config); tests turn it off. */
  enabled?: boolean;
  /** SUNDAY.minDifficulty unless given (tests). */
  minDifficulty?: number;
  /** SUNDAY.pageSize unless given (tests use small pages to cross page edges). */
  pageSize?: number;
  log?: (line: string) => void;
};

/** A post id as Reddit gives it: always with "t3_". */
export function fullPostId(id: string): string {
  return id.startsWith('t3_') ? id : `t3_${id}`;
}

/**
 * Every community island published in a window, newest first, read a page at a time from the
 * list of all islands (kept by publish time) until the window's start is passed. No island in
 * the window is left out for being one too many (Nov 21 audit); SUNDAY.readMax only guards the
 * request, and an island past it is counted, never silently dropped.
 */
export async function islandsInWindow(
  store: Store,
  window: { from: number; to: number },
  pageSize: number = SUNDAY.pageSize
): Promise<{ records: CommunityRecord[]; overflow: number }> {
  const records: CommunityRecord[] = [];
  let overflow = 0;
  for (let at = 0; ; at += pageSize) {
    const page = await store.zRange(
      KEYS.communityAll,
      at,
      at + pageSize - 1,
      true
    );
    if (page.length === 0) break;
    let older = false;
    for (const { member, score } of page) {
      // Publish time is the list's score: past the window's start, the rest are older still.
      if (score < window.from) {
        older = true;
        break;
      }
      if (score >= window.to) continue;
      if (records.length >= SUNDAY.readMax) {
        overflow++;
        continue;
      }
      const record = await readCommunity(store, Number(member));
      if (record !== null) records.push(record);
    }
    if (older) break;
  }
  return { records, overflow };
}

/** One island in the running, with what it is ranked by. */
export type Candidate = {
  record: CommunityRecord;
  score: number;
  parHits: number;
  plays: number;
};

/** Highest score first; then par hits, plays, the earliest published, the lowest number. */
export function rankCandidates(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) =>
      b.score - a.score ||
      b.parHits - a.parHits ||
      b.plays - a.plays ||
      a.record.created - b.record.created ||
      a.record.index - b.record.index
  );
}

/** Why islands were left out, counted, in the order a reader would want them. */
type Reasons = Map<string, number>;

function note(reasons: Reasons, reason: string): void {
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
}

function describe(reasons: Reasons): string {
  return [...reasons.entries()]
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ');
}

export type Choice = {
  winner: Candidate | null;
  /** The rest of the running, best first, after the winner (for the dev preview). */
  ranked: Candidate[];
  considered: number;
  reasons: string;
};

/** Does a published island still pass the check Publish ran, with the same par and pieces? */
function recheck(
  record: CommunityRecord,
  options: PickOptions
): 'ok' | 'changed' | 'too-easy-for-sunday' {
  const prisms = record.solution.filter((p) => p.piece.kind === 'prism').length;
  const draft = readDraft({
    size: record.rows.length,
    biome: record.biome,
    name: record.name,
    spare: Math.max(0, record.inventory.mirrors - (record.par - prisms)),
    rows: record.rows,
  });
  if (draft === null || draftProblem(draft) !== null) return 'changed';
  const fresh = checkIsland(draft, {
    daily: options.daily,
    clock: options.clock,
    nodeLimit: options.nodeLimit ?? COMMUNITY.solveNodes,
  });
  if (
    !fresh.ok ||
    fresh.par !== record.par ||
    fresh.inventory.mirrors !== record.inventory.mirrors ||
    fresh.inventory.prisms !== record.inventory.prisms
  )
    return 'changed';
  return fresh.difficulty >= (options.minDifficulty ?? SUNDAY.minDifficulty)
    ? 'ok'
    : 'too-easy-for-sunday';
}

/**
 * Who would win Sunday `day` from the islands published in `window`. Reads only: the dev
 * preview and the real pick share it.
 */
export async function chooseWinner(
  store: Store,
  reddit: Pick<PickReddit, 'readPosts'>,
  day: number,
  window: { from: number; to: number },
  options: PickOptions
): Promise<Choice> {
  const reasons: Reasons = new Map();
  if (!(options.enabled ?? COMMUNITY.enabled))
    return {
      winner: null,
      ranked: [],
      considered: 0,
      reasons: 'community off',
    };
  const { records, overflow } = await islandsInWindow(
    store,
    window,
    options.pageSize
  );
  // More islands than one request reads: said in the log, never silently dropped.
  if (overflow > 0)
    reasons.set(`over the read limit ${SUNDAY.readMax}`, overflow);
  const fits: CommunityRecord[] = [];
  for (const record of records) {
    if (!record.active) note(reasons, 'taken down');
    else if (record.excluded !== '') note(reasons, 'excluded');
    else if (record.sunday !== 0 && record.sunday !== day)
      note(reasons, 'picked before');
    else if (record.par < SUNDAY.par[0] || record.par > SUNDAY.par[1])
      note(reasons, `par outside ${SUNDAY.par[0]}-${SUNDAY.par[1]}`);
    else fits.push(record);
  }
  const considered =
    fits.length + [...reasons.values()].reduce((a, b) => a + b, 0);
  // Every score at once: a few calls for the whole week, not one per island.
  const posts = await reddit
    .readPosts(
      fits.map((record) => fullPostId(record.postId)),
      window.from
    )
    .catch(
      (): ReadonlyMap<string, { score: number; live: boolean }> => new Map()
    );
  const read = await Promise.all(
    fits.map(async (record) => {
      const [plays, stats] = await Promise.all([
        skyCount(store, communityNumber(record.index)),
        store.hGetAll(KEYS.stats(communityNumber(record.index))),
      ]);
      return {
        record,
        post: posts.get(fullPostId(record.postId)) ?? null,
        plays,
        stats,
      };
    })
  );
  const running: Candidate[] = [];
  for (const { record, post, plays, stats } of read) {
    if (post === null) note(reasons, 'score unreadable');
    else if (!post.live) note(reasons, 'taken down');
    else if (post.score < SUNDAY.minScore)
      note(reasons, `below score ${SUNDAY.minScore}`);
    else
      running.push({
        record,
        score: post.score,
        plays,
        parHits: Math.min(plays, Number(stats['parHits'] ?? 0) || 0),
      });
  }
  const ranked = rankCandidates(running);
  let winner: Choice['winner'] = null;
  let checks = 0;
  const rest: Candidate[] = [];
  for (const candidate of ranked) {
    if (winner !== null || checks >= SUNDAY.recheckMax) {
      rest.push(candidate);
      continue;
    }
    checks++;
    const verdict = recheck(candidate.record, options);
    if (verdict === 'ok') winner = candidate;
    else
      note(
        reasons,
        verdict === 'changed' ? 'failed the re-check' : 'too easy for Sunday'
      );
  }
  return { winner, ranked: rest, considered, reasons: describe(reasons) };
}

export type PickReport = {
  day: number;
  outcome: 'community' | 'generated' | 'kept' | 'frozen' | 'busy';
  pick: SundayPick | null;
  line: string;
};

/** The one log line a pick leaves, e.g. "Sunday pick for day 6: Ember Bend by u/ana (score 7)". */
function pickLine(day: number, choice: Choice): string {
  const tail = choice.reasons === '' ? '' : `; left out: ${choice.reasons}`;
  if (choice.winner === null)
    return `Sunday pick for day ${day}: generated island (${choice.considered} islands considered${tail})`;
  const { record, score } = choice.winner;
  return `Sunday pick for day ${day}: ${record.name} by u/${record.maker} (score ${score}, par ${record.par}; ${choice.considered} islands considered${tail})`;
}

/**
 * Run the pick for Sunday `day`, once. A pick already made is kept (`force` replaces it: the dev
 * tool, or a withdrawal); a Sunday whose post exists never changes. `dev` puts every island so
 * far in the running instead of the week's.
 */
export async function runPick(
  store: Store,
  reddit: PickReddit,
  day: number,
  nowMs: number,
  options: PickOptions & { force?: boolean; dev?: boolean }
): Promise<PickReport> {
  const log = options.log ?? (() => undefined);
  const existing = await readPick(store, day);
  if (existing?.posted === true) {
    const line = `Sunday pick for day ${day}: its post exists, the pick stays as it is`;
    log(line);
    return { day, outcome: 'frozen', pick: existing, line };
  }
  if (existing !== null && options.force !== true) {
    await finishEffects(store, reddit, existing, log);
    return {
      day,
      outcome: 'kept',
      pick: await readPick(store, day),
      line: `Sunday pick for day ${day}: already made`,
    };
  }
  if ((await store.count(KEYS.sundayLock(day), SUNDAY.lockSeconds)) !== 1)
    return {
      day,
      outcome: 'busy',
      pick: existing,
      line: `Sunday pick for day ${day}: another run is picking`,
    };
  try {
    if (existing !== null) await undoPick(store, reddit, existing, log);
    const dev = options.dev === true || existing?.dev === true;
    const window = dev ? { from: 0, to: nowMs + 1 } : pickWindow(day);
    const choice = await chooseWinner(store, reddit, day, window, options);
    const line = pickLine(day, choice);
    log(line);
    const base = {
      why: line,
      pickedAt: String(nowMs),
      dev: dev ? '1' : '0',
      posted: '0',
      comment: '',
      flaired: '0',
    };
    if (choice.winner === null) {
      await store.del(KEYS.sundayPick(day));
      await store.hSet(KEYS.sundayPick(day), { state: 'generated', ...base });
    } else {
      const { record, score } = choice.winner;
      const island: PlayableIsland = {
        ...toPlayable(record),
        day,
        date: dateOfDay(day),
        weekday: 'sunday',
      };
      const creator = creatorRow(record);
      await store.del(KEYS.sundayPick(day));
      await store.hSet(KEYS.sundayPick(day), {
        state: 'community',
        ...base,
        index: String(record.index),
        postId: record.postId,
        url: record.url,
        score: String(score),
        island: JSON.stringify(island),
        credit: JSON.stringify({
          ...creditOf(record),
          makerId: record.makerId,
        }),
        creator: JSON.stringify({
          pieces: creator.pieces,
          timeMs: creator.timeMs,
          placements: creator.placements,
        }),
      });
      await store.hSet(KEYS.community(record.index), { sunday: String(day) });
    }
    const pick = await readPick(store, day);
    if (pick !== null) await finishEffects(store, reddit, pick, log);
    return {
      day,
      outcome: choice.winner === null ? 'generated' : 'community',
      pick: await readPick(store, day),
      line,
    };
  } finally {
    await store.del(KEYS.sundayLock(day));
  }
}

/** The maker's flair as it should read now, from what the game knows about them. */
async function makerFlair(store: Store, makerId: string): Promise<string> {
  const fields = await store.hGetAll(KEYS.user(makerId));
  const medal = fields['lastMedal'];
  const known: Medal | null =
    medal === 'lamplighter' || medal === 'glow' || medal === 'spark'
      ? medal
      : null;
  return flairFor(
    known === null ? null : medalName(known),
    Number(fields['streak'] ?? 0) || 0,
    Number(fields['islandwright'] ?? 0) > 0
  );
}

/**
 * The pick's effects, each once: the comment on the winning post (E11) and "Islandwright" for its
 * maker (E7). Fallible: a failure is logged and tried again by the next run.
 */
export async function finishEffects(
  store: Store,
  reddit: PickReddit,
  pick: SundayPick,
  log: (line: string) => void
): Promise<void> {
  const winner = pick.winner;
  if (pick.state !== 'community' || winner === null) return;
  const key = KEYS.sundayPick(pick.day);
  if (pick.comment === '') {
    try {
      const id = await reddit.comment(
        winner.postId,
        COPY.sundayComment
          .replace('{sub}', reddit.subreddit)
          .replace('{maker}', winner.credit.maker)
      );
      await store.hSet(key, { comment: id });
    } catch (error) {
      log(`Sunday pick comment failed: ${String(error)}`);
    }
  }
  if (!pick.flaired) {
    try {
      // The title is counted first, so the flair written reads with it.
      await store.hSet(key, { flaired: '1' });
      await store.hIncrBy(KEYS.user(winner.credit.makerId), 'islandwright', 1);
      await reddit.flair(
        winner.credit.maker,
        await makerFlair(store, winner.credit.makerId)
      );
    } catch (error) {
      log(`Sunday pick flair failed: ${String(error)}`);
    }
  }
}

/** Take a pick back: its comment goes, the island may be picked again, the title goes back. */
async function undoPick(
  store: Store,
  reddit: PickReddit,
  pick: SundayPick,
  log: (line: string) => void
): Promise<void> {
  const winner = pick.winner;
  if (winner === null) return;
  if (pick.comment !== '')
    await reddit
      .deleteComment(pick.comment)
      .catch((error: unknown) =>
        log(`Could not delete the Sunday comment: ${String(error)}`)
      );
  await store.hSet(KEYS.community(winner.index), { sunday: '0' });
  if (pick.flaired) {
    const left = await store.hIncrBy(
      KEYS.user(winner.credit.makerId),
      'islandwright',
      -1
    );
    if (left < 0)
      await store.hSet(KEYS.user(winner.credit.makerId), { islandwright: '0' });
    await reddit
      .flair(
        winner.credit.maker,
        await makerFlair(store, winner.credit.makerId)
      )
      .catch((error: unknown) =>
        log(`Could not restore the maker's flair: ${String(error)}`)
      );
  }
}

/**
 * A moderator removed or excluded an island (E6). If it is the pick for a Sunday whose post
 * does not exist yet, the pick is withdrawn and runs again without it. Answers the new report,
 * or null when the island was not a waiting pick.
 */
export async function withdrawIfPicked(
  store: Store,
  reddit: PickReddit,
  index: number,
  nowMs: number,
  options: PickOptions
): Promise<PickReport | null> {
  const record = await readCommunity(store, index);
  if (record === null || record.sunday === 0) return null;
  const pick = await readPick(store, record.sunday);
  if (pick === null || pick.posted || pick.winner?.index !== index) return null;
  return runPick(store, reddit, record.sunday, nowMs, {
    ...options,
    force: true,
  });
}

/** Sunday's post was made from the pick: freeze it, and give the comment the post's address. */
export async function markPosted(
  store: Store,
  reddit: PickReddit,
  day: number,
  url: string,
  log: (line: string) => void
): Promise<void> {
  const pick = await readPick(store, day);
  if (pick === null) return;
  await store.hSet(KEYS.sundayPick(day), { posted: '1' });
  if (pick.winner === null || pick.comment === '') return;
  await reddit
    .editComment(
      pick.comment,
      COPY.sundayCommentLinked
        .replace('{sub}', reddit.subreddit)
        .replace('{maker}', pick.winner.credit.maker)
        .replace('{url}', url)
    )
    .catch((error: unknown) =>
      log(`Could not add Sunday's link to the comment: ${String(error)}`)
    );
}

/**
 * The half-hourly task's part: if a pick is due and missing, run it; if one exists, finish any
 * effect that failed. Nothing to do on other days.
 */
export async function ensurePick(
  store: Store,
  reddit: PickReddit,
  nowMs: number,
  options: PickOptions
): Promise<PickReport | null> {
  if (!(options.enabled ?? COMMUNITY.enabled)) return null;
  const day = dueSunday(nowMs);
  if (day === null) return null;
  return runPick(store, reddit, day, nowMs, options);
}

/** What the dev preview says: who would win now, or why nothing would. One short line. */
export function previewLine(choice: Choice): string {
  if (choice.winner === null)
    return choice.reasons === ''
      ? COPY.sundayPreviewNone
      : `${COPY.sundayPreviewNone} (${choice.reasons})`;
  const { record, score } = choice.winner;
  return COPY.sundayPreview
    .replace('{name}', record.name)
    .replace('{maker}', record.maker)
    .replace('{score}', String(score))
    .replace('{par}', String(record.par))
    .replace('{others}', String(choice.ranked.length));
}

/**
 * "Dev: clean up this subreddit": every Sunday's pick, lock and scores, and every pin record.
 * Without it, a pick made while testing would become the real Sunday after launch.
 */
export async function cleanUpSundays(
  store: Store,
  lastDay: number
): Promise<void> {
  const keys: string[] = [KEYS.pinnedLast];
  for (let day = 1; day <= lastDay + 7; day++) {
    keys.push(KEYS.pinned(day));
    if (!isSunday(day)) continue;
    keys.push(
      KEYS.sundayPick(day),
      KEYS.sundayLock(day),
      KEYS.sundayVotes(day)
    );
  }
  await Promise.all(keys.map((key) => store.del(key)));
}
