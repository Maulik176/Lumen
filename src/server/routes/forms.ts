import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { islandForDay } from '../core/content';
import { createIslandPost } from '../core/post';
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
