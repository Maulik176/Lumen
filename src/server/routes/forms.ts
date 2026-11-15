import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { islandForDay } from '../core/content';
import { setToday } from '../core/clock';
import { createIslandPost } from '../core/post';
import { DEV } from '../../shared/config';
import { context } from '@devvit/web/server';
import { postAddress } from './menu';

export const forms = new Hono();

forms.post('/post-day', async (c) => {
  const value: unknown = await c.req.json().catch(() => null);
  const fields: Record<string, unknown> =
    typeof value === 'object' && value !== null ? { ...value } : {};
  const day = Number(fields['day']);
  if (!Number.isInteger(day) || islandForDay(day) === undefined) {
    return c.json<UiResponse>({ showToast: 'No island for that day' }, 200);
  }
  try {
    return c.json<UiResponse>(
      { navigateTo: postAddress(await createIslandPost(day)) },
      200
    );
  } catch (error) {
    console.error(`Error creating post for day ${day}: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Could not create the post' }, 200);
  }
});

forms.post('/set-today', async (c) => {
  if (context.subredditName !== DEV.resetSubreddit)
    return c.json<UiResponse>(
      { showToast: 'Only on the playtest subreddit' },
      200
    );
  const value: unknown = await c.req.json().catch(() => null);
  const fields: Record<string, unknown> =
    typeof value === 'object' && value !== null ? { ...value } : {};
  const day = Number(fields['day']);
  if (
    !Number.isInteger(day) ||
    day < 0 ||
    (day > 0 && islandForDay(day) === undefined)
  )
    return c.json<UiResponse>({ showToast: 'No island for that day' }, 200);
  await setToday(day);
  return c.json<UiResponse>(
    {
      showToast:
        day === 0
          ? 'Back to real time.'
          : `Today is now day ${day}. Use "Post today's Lumen" for its post.`,
    },
    200
  );
});
