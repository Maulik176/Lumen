/**
 * The Archipelago's Community view (PHASE3_PLAN.md E9): the latest Sunday picked from the
 * community, this week's islands by post score (the ones in the running for Sunday), then older
 * islands a page at a time. Removed and excluded islands are never listed. Scores come from
 * `cm:votes:{sunday}`, refreshed by the half-hourly task, so opening the view never waits on
 * Reddit. No Reddit or Devvit calls in here.
 */
import type {
  CommunityResponse,
  ShelfIsland,
  ShelfPick,
} from '../../shared/api';
import { communityNumber } from '../../shared/community';
import { COMMUNITY, SUNDAY } from '../../shared/config';
import { readCommunity, type CommunityRecord } from './community';
import { skyCount } from './game';
import { KEYS, type Store } from './store';
import { readPick } from './sunday-store';
import {
  fullPostId,
  islandsInWindow,
  pickWindow,
  runningFor,
  type PickReddit,
} from './sunday';

/** Listed at all: its post stands and no moderator kept it out. */
function listed(record: CommunityRecord): boolean {
  return record.active && record.excluded === '';
}

async function shelfIsland(
  store: Store,
  record: CommunityRecord,
  score: number | null
): Promise<ShelfIsland> {
  const number = communityNumber(record.index);
  return {
    number,
    name: record.name,
    maker: record.maker,
    makerAvatar: record.makerAvatar,
    biome: record.biome,
    rows: record.rows,
    par: record.par,
    plays: await skyCount(store, number),
    score,
    url: record.url,
    ...(record.sunday > 0 ? { chosenFor: record.sunday } : {}),
  };
}

/** The latest Sunday picked from the community, looking back from the coming one. */
async function latestPick(
  store: Store,
  nowMs: number
): Promise<ShelfPick | null> {
  const coming = runningFor(nowMs);
  for (let back = 0; back < SUNDAY.lookBackSundays; back++) {
    const day = coming - back * 7;
    if (day < 1) break;
    const pick = await readPick(store, day);
    const winner = pick?.winner;
    if (winner === undefined || winner === null) continue;
    // Its Sunday post once it exists; until then the island's own post.
    const post = await store.get(KEYS.postForDay(day));
    const source = communityNumber(winner.index);
    // Everyone who lit it: as Sunday's island, and on its own post.
    const [sunday, own] = await Promise.all([
      skyCount(store, day),
      skyCount(store, source),
    ]);
    return {
      sunday: day,
      source,
      number: day,
      name: winner.island.name,
      maker: winner.credit.maker,
      makerAvatar: winner.credit.makerAvatar,
      biome: winner.island.biome,
      rows: winner.island.rows,
      par: winner.island.par,
      plays: sunday + own,
      score: winner.score,
      url:
        post === undefined
          ? winner.url
          : `https://www.reddit.com/comments/${post.replace(/^t3_/, '')}`,
    };
  }
  return null;
}

/**
 * The Community view. `after` is where the previous page of older islands stopped (a position
 * in the list of every island, newest first).
 */
export async function communityShelf(
  store: Store,
  nowMs: number,
  after = 0,
  enabled: boolean = COMMUNITY.enabled
): Promise<CommunityResponse> {
  if (!enabled) return { ok: false, reason: 'resting' };
  const sunday = runningFor(nowMs);
  const window = pickWindow(sunday);
  // The latest pick is listed once, at the top: never again under This week or Earlier.
  const pick = await latestPick(store, nowMs);
  const shown = (record: CommunityRecord): boolean =>
    listed(record) &&
    (pick === null || communityNumber(record.index) !== pick.source);

  // This week: by the scores the half-hourly task read, best first; then any not read yet.
  const voted = await store.zRange(
    KEYS.sundayVotes(sunday),
    0,
    SUNDAY.readMax - 1,
    true
  );
  const scores = new Map(
    voted.map((entry) => [Number(entry.member), entry.score])
  );
  const { records } = await islandsInWindow(store, window);
  const running: { record: CommunityRecord; score: number | null }[] = [];
  for (const record of records)
    if (shown(record))
      running.push({ record, score: scores.get(record.index) ?? null });
  running.sort(
    (a, b) =>
      (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
      b.record.created - a.record.created
  );
  // The week's best are listed here; the rest of the week flows on below with every other
  // island, newest first (Nov 21 audit: they used to vanish from the view).
  const best = running.slice(0, SUNDAY.weekShown);
  const inWeek = new Set(best.map((entry) => entry.record.index));
  const week: ShelfIsland[] = [];
  for (const { record, score } of best)
    week.push(await shelfIsland(store, record, score));

  // Older islands, newest first.
  const older: ShelfIsland[] = [];
  let position = Math.max(0, after);
  let next: number | null = null;
  while (older.length < SUNDAY.olderPage) {
    const page = await store.zRange(
      KEYS.communityAll,
      position,
      position + SUNDAY.olderPage - 1,
      true
    );
    if (page.length === 0) break;
    for (const { member } of page) {
      position++;
      const record = await readCommunity(store, Number(member));
      if (record === null || !shown(record) || inWeek.has(record.index))
        continue;
      older.push(await shelfIsland(store, record, null));
      if (older.length >= SUNDAY.olderPage) {
        next = position;
        break;
      }
    }
  }
  if (next !== null) {
    // Only say there is more when there is.
    const more = await store.zRange(KEYS.communityAll, next, next, true);
    if (more.length === 0) next = null;
  }

  return {
    ok: true,
    pick,
    week,
    older,
    next,
  };
}

/**
 * Read the scores of the islands running for the coming Sunday, for the Community view. Called
 * by the half-hourly task; the scores come in bulk (the subreddit's newest posts).
 */
export async function refreshVotes(
  store: Store,
  reddit: Pick<PickReddit, 'readPosts'>,
  nowMs: number,
  enabled: boolean = COMMUNITY.enabled
): Promise<number> {
  if (!enabled) return 0;
  const sunday = runningFor(nowMs);
  const window = pickWindow(sunday);
  const key = KEYS.sundayVotes(sunday);
  const { records } = await islandsInWindow(store, window);
  for (const record of records)
    if (!listed(record)) await store.zRem(key, String(record.index));
  const live = records.filter(listed);
  // Every score at once: a few calls for the whole week.
  const posts = await reddit
    .readPosts(
      live.map((record) => fullPostId(record.postId)),
      window.from
    )
    .catch(
      (): ReadonlyMap<string, { score: number; live: boolean }> => new Map()
    );
  let read = 0;
  for (const record of live) {
    const post = posts.get(fullPostId(record.postId));
    if (post === undefined) continue;
    if (!post.live) {
      await store.zRem(key, String(record.index));
      continue;
    }
    await store.zAdd(key, String(record.index), post.score);
    read++;
  }
  await store.expire(key, SUNDAY.votesSeconds);
  return read;
}
