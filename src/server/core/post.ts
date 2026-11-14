/**
 * The daily post. Creating it is safe to ask for any number of times: the scheduler, the
 * catch-up task and the mod menu all call `ensureDailyPost`, and only one post is ever made
 * for a day.
 */
import { reddit } from '@devvit/web/server';
import { toPostData } from '../../shared/api';
import { weekdayLabel } from '../../shared/calendar';
import { COPY } from '../../shared/config';
import { islandForDay } from './content';
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

  // One stickied comment from the app; players' shared results go under it as replies.
  try {
    const sticky = await reddit.submitComment({
      id: post.id,
      text: `Lumen #${day} results`,
      runAs: 'APP',
    });
    await sticky.distinguish(true);
    await store.set(KEYS.stickyOfPost(post.id), sticky.id);
  } catch (error) {
    console.error(`Results comment failed for day ${day}: ${String(error)}`);
  }
  return post.id;
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
