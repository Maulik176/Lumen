/**
 * The daily post. Creating it is safe to ask for any number of times: the scheduler, the
 * catch-up task and the mod menu all call `ensureDailyPost`, and only one post is ever made
 * for a day.
 */
import { reddit } from '@devvit/web/server';
import { toPostData } from '../../shared/api';
import { weekdayLabel } from '../../shared/calendar';
import { COMMENT, COPY } from '../../shared/config';
import { isCommunity, communityIndex } from '../../shared/community';
import { communityResultsText, resultsText } from '../../shared/share';
import { readCommunity } from './community';
import { islandForDay } from './content';
import { skyCount } from './game';
import { KEYS, redisStore as store } from './store';

/** Seconds a claim on "I am creating today's post" lasts before another caller may try. */
const CLAIM_SECONDS = 120;

/** Post an island with no bookkeeping. For test posts of any day. */
export async function createIslandPost(day: number): Promise<string> {
  const island = islandForDay(day);
  if (island === undefined) throw new Error(`No island for day ${day}.`);
  const title = COPY.postTitle
    .replace('{day}', String(island.day))
    .replace('{name}', island.name)
    .replace('{weekday}', weekdayLabel(island.weekday));
  const post = await reddit.submitCustomPost({
    title,
    entry: 'default',
    postData: toPostData(island),
  });
  await store.set(KEYS.dayOfPost(post.id), String(day));
  await resultsComment(post.id, day).catch((error: unknown) =>
    console.error(`Results comment failed for day ${day}: ${String(error)}`)
  );
  return post.id;
}

/**
 * The post's one stickied comment from the app; players' shared results go under it as
 * replies. Made with the post, or now if the post is older than that. Returns its id.
 */
export async function resultsComment(
  postId: `t3_${string}`,
  day: number
): Promise<`t1_${string}`> {
  const known = await store.get(KEYS.stickyOfPost(postId));
  if (known !== undefined && isCommentId(known)) return known;
  const sticky = await reddit.submitComment({
    id: postId,
    text: await resultsNow(day),
    runAs: 'APP',
  });
  await sticky.distinguish(true);
  await store.set(KEYS.stickyOfPost(postId), sticky.id);
  return sticky.id;
}

async function resultsNow(day: number): Promise<string> {
  const [stats, solves] = await Promise.all([
    store.hGetAll(KEYS.stats(day)),
    skyCount(store, day),
  ]);
  const parHits = Math.max(0, Number(stats['parHits'] ?? 0) || 0);
  if (isCommunity(day)) {
    const record = await readCommunity(store, communityIndex(day));
    return communityResultsText(
      record?.name ?? 'the island',
      record?.maker ?? '',
      solves,
      Math.min(parHits, solves)
    );
  }
  return resultsText(
    day,
    islandForDay(day)?.name ?? 'the island',
    solves,
    Math.min(parHits, solves)
  );
}

/**
 * Rewrite the results comment with the night's counts. Called after each ranked solve, but
 * does the work at most once a minute per post; the half-hourly task calls it with `always`
 * so the last solves of a quiet spell are counted too. Decoration: callers ignore failures.
 */
export async function refreshResultsComment(
  postId: `t3_${string}`,
  day: number,
  always = false
): Promise<boolean> {
  const first =
    (await store.count(KEYS.stickyFresh(postId), COMMENT.minGapSeconds)) === 1;
  if (!first && !always) return false;
  const id = await resultsComment(postId, day);
  const comment = await reddit.getCommentById(id);
  const text = await resultsNow(day);
  if (comment.body === text) return false;
  await comment.edit({ text });
  return true;
}

function isCommentId(id: string): id is `t1_${string}` {
  return id.startsWith('t1_');
}

/** The post for a day, creating it if it does not exist yet. Returns its id. */
export async function ensureDailyPost(
  day: number
): Promise<{ postId: string; created: boolean }> {
  const existing = await store.get(KEYS.postForDay(day));
  if (existing !== undefined) return { postId: existing, created: false };

  // The first caller in a short window gets 1 and goes on; anyone else waits for its result.
  const claim = await store.count(KEYS.postLock(day), CLAIM_SECONDS);
  if (claim !== 1) {
    const soon = await store.get(KEYS.postForDay(day));
    if (soon !== undefined) return { postId: soon, created: false };
    throw new Error(`Another task is creating day ${day}'s post.`);
  }
  const postId = await createIslandPost(day);
  await store.set(KEYS.postForDay(day), postId);
  return { postId, created: true };
}
