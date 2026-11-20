import { Hono } from 'hono';
import { nowMs } from '../core/clock';
import type { TriggerResponse } from '@devvit/web/shared';
import { lastDay } from '../core/content';
import { currentDay } from '../core/game';
import { ensureDailyPost, pinToday, refreshResultsComment } from '../core/post';
import { islandOfPost, postActivity, setIslandActive } from '../core/community';
import { pickOptions, pickReddit } from '../core/pick-reddit';
import { redisStore as store } from '../core/store';
import { refreshVotes } from '../core/shelf';
import { ensurePick, withdrawIfPicked } from '../core/sunday';

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
    // A moderator removed the island picked for a Sunday whose post does not exist yet: the pick
    // is withdrawn and runs again without it. A deletion keeps the pick (PHASE3_PLAN.md E6).
    if (known && change.change === 'removed') {
      const index = await islandOfPost(store, change.postId);
      if (index !== null)
        await withdrawIfPicked(
          store,
          pickReddit(),
          index,
          nowMs(),
          pickOptions()
        ).catch((error: unknown) =>
          console.error(`Sunday pick withdrawal failed: ${String(error)}`)
        );
    }
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

/** Saturday at the pick hour (SUNDAY.pickHourUtc): the best island of the week becomes Sunday's. */
scheduler.post('/sunday-pick', async (c) => {
  await ensurePick(store, pickReddit(), nowMs(), pickOptions()).catch(
    (error: unknown) => console.error(`Sunday pick failed: ${String(error)}`)
  );
  return c.json({ status: 'ok' }, 200);
});

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
  // A skipped Saturday tick: the pick runs here (Saturday after the pick hour, and Sunday), and
  // an effect that failed (comment, flair) is tried again.
  await ensurePick(store, pickReddit(), nowMs(), pickOptions()).catch(
    (error: unknown) =>
      console.error(`Sunday pick catch-up failed: ${String(error)}`)
  );
  // The scores of this week's islands, for the Archipelago's Community view.
  await refreshVotes(store, pickReddit(), nowMs()).catch((error: unknown) =>
    console.error(`Community scores refresh failed: ${String(error)}`)
  );
  await ensureToday();
  try {
    const day = currentDay(nowMs(), lastDay());
    const { postId } = await ensureDailyPost(day);
    // A pin that failed when the post was made is tried again.
    await pinToday(day);
    if (postId.startsWith('t3_'))
      await refreshResultsComment(`t3_${postId.slice(3)}`, day, true);
  } catch (error) {
    console.error(`Results comment refresh failed: ${String(error)}`);
  }
  return c.json({ status: 'ok' }, 200);
});
