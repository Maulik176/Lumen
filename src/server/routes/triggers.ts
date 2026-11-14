import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { lastDay } from '../core/content';
import { currentDay } from '../core/game';
import { ensureDailyPost } from '../core/post';

export const triggers = new Hono();
export const scheduler = new Hono();

/** Make sure today's post exists. Safe to call from anywhere, any number of times. */
async function ensureToday(): Promise<TriggerResponse> {
  try {
    const day = currentDay(Date.now(), lastDay());
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

/** 00:00 UTC: the day's post. */
scheduler.post('/daily-post', async (c) => {
  await ensureToday();
  return c.json({ status: 'ok' }, 200);
});

/** Every half hour: the same call again. Cron ticks can be skipped; this catches a missed one. */
scheduler.post('/daily-catch-up', async (c) => {
  await ensureToday();
  return c.json({ status: 'ok' }, 200);
});
