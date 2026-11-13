import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { dayNow, lastDay } from '../core/content';
import { createDailyPost } from '../core/post';

export const menu = new Hono();

/** A post's page address. The id comes with a "t3_" prefix that the address must not carry. */
function postAddress(postId: string): string {
  return `https://reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;
}

menu.post('/post-today', async (c) => {
  try {
    const post = await createDailyPost(dayNow(Date.now()));
    return c.json<UiResponse>({ navigateTo: postAddress(post.id) }, 200);
  } catch (error) {
    console.error(`Error creating today's post: ${String(error)}`);
    return c.json<UiResponse>(
      { showToast: "Could not post today's Lumen" },
      400
    );
  }
});

/** Opens a small form asking which day to post. For testing any island before launch. */
menu.post('/post-day', (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'postDay',
        form: {
          title: 'Post a Lumen island',
          acceptLabel: 'Post',
          fields: [
            {
              type: 'number',
              name: 'day',
              label: `Day number, 1 to ${lastDay()}`,
              defaultValue: 1,
              required: true,
            },
          ],
        },
      },
    },
    200
  );
});

export { postAddress };
