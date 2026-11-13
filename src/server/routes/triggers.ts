import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { redis } from '@devvit/web/server';
import { dayNow } from '../core/content';
import { createDailyPost } from '../core/post';

export const triggers = new Hono();

/**
 * On install, and on each upgrade during development, make sure a post for the current build
 * exists so there is always something to open. Milestone 5 replaces this with the daily scheduler.
 */
async function ensurePost(marker: string): Promise<TriggerResponse> {
  try {
    const key = `dev:post:${marker}`;
    if ((await redis.get(key)) !== undefined)
      return { status: 'success', message: 'Post already exists' };
    const post = await createDailyPost(dayNow(Date.now()));
    await redis.set(key, post.id);
    return { status: 'success', message: `Post created: ${post.id}` };
  } catch (error) {
    console.error(`Error creating post: ${String(error)}`);
    return { status: 'error', message: 'Failed to create post' };
  }
}

triggers.post('/on-app-install', async (c) =>
  c.json<TriggerResponse>(await ensurePost('install'), 200)
);

/** One fresh post per milestone build; bump the marker when a new one is wanted. */
triggers.post('/on-app-upgrade', async (c) =>
  c.json<TriggerResponse>(await ensurePost('m4'), 200)
);
