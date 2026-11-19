import { Hono } from 'hono';
import { nowMs } from '../core/clock';
import type { TriggerResponse } from '@devvit/web/shared';
import { lastDay } from '../core/content';
import { currentDay } from '../core/game';
import { ensureDailyPost, refreshResultsComment } from '../core/post';
import { postActivity, setIslandActive } from '../core/community';
import { redisStore as store } from '../core/store';

export const triggers = new Hono();
export const scheduler = new Hono();

/** Make sure today's post exists. Safe to call from anywhere, any number of times. */
async function ensureToday(): Promise<TriggerResponse> {
  try {
    const day = currentDay(nowMs(), lastDay());
    const { postId, created } = await ensureDailyPost(day);
    return {
      status: 'success',
      message: `Day ${day}: ${created ? 'created' : 'already posted'} ${postId}`,
    };
  } catch (error) {
    console.error(`Daily post failed: ${String(error)}`);
    return { status: 'error', message: 'Daily post failed' };
  }
}

triggers.post('/on-app-install', async (c) =>
  c.json<TriggerResponse>(await ensureToday(), 200)
);
triggers.post('/on-app-upgrade', async (c) =>
  c.json<TriggerResponse>(await ensureToday(), 200)
);

/**
 * A community island's post was deleted, removed or marked as spam: the island goes down and is
 * never served or picked. Approved again: it comes back. Other posts are not islands; ignored.
 */
async function islandActivity(payload: unknown): Promise<TriggerResponse> {
  const change = postActivity(payload);
  if (change === null) return { status: 'success', message: 'Not an island' };
  try {
    const known = await setIslandActive(store, change.postId, change.active);
    return {
      status: 'success',
      message: known
        ? `Island post ${change.postId} ${change.active ? 'back' : 'taken down'}`
        : 'Not an island',
    };
  } catch (error) {
    console.error(`Island activity failed: ${String(error)}`);
    return { status: 'error', message: 'Island activity failed' };
  }
}

triggers.post('/on-post-delete', async (c) =>
  c.json<TriggerResponse>(
    await islandActivity(await c.req.json().catch(() => null)),
    200
  )
);
triggers.post('/on-mod-action', async (c) =>
  c.json<TriggerResponse>(
    await islandActivity(await c.req.json().catch(() => null)),
    200
  )
);

/** 00:00 UTC: the day's post. */
scheduler.post('/daily-post', async (c) => {
  await ensureToday();
  return c.json({ status: 'ok' }, 200);
});

/**
 * Every half hour: the same call again (cron ticks can be skipped; this catches a missed one),
 * and the results comment is brought up to date with the latest counts.
 */
scheduler.post('/daily-catch-up', async (c) => {
  await ensureToday();
  try {
    const day = currentDay(nowMs(), lastDay());
    const { postId } = await ensureDailyPost(day);
    if (postId.startsWith('t3_'))
      await refreshResultsComment(`t3_${postId.slice(3)}`, day, true);
  } catch (error) {
    console.error(`Results comment refresh failed: ${String(error)}`);
  }
  return c.json({ status: 'ok' }, 200);
});
