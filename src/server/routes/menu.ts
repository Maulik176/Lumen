import { Hono } from 'hono';
import { nowMs } from '../core/clock';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import { DEV, TRAILER } from '../../shared/config';
import { currentDay, resetPlayer } from '../core/game';
import { KEYS, redisStore } from '../core/store';
import { lastDay } from '../core/content';
import { ensureDailyPost } from '../core/post';

export const menu = new Hono();

/** A post's page address. The id comes with a "t3_" prefix that the address must not carry. */
export function postAddress(postId: string): string {
  return `https://reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;
}

/** Manual fallback for the scheduler: makes today's post, or opens it if it already exists. */
menu.post('/post-today', async (c) => {
  try {
    const { postId } = await ensureDailyPost(currentDay(nowMs(), lastDay()));
    return c.json<UiResponse>({ navigateTo: postAddress(postId) }, 200);
  } catch (error) {
    console.error(`Error creating today's post: ${String(error)}`);
    return c.json<UiResponse>(
      { showToast: "Could not post today's Lumen" },
      200
    );
  }
});

/** Opens a small form asking which day to post. For testing any island; such posts are unranked
 * unless the day is today. */
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

/** Developer tool, playtest subreddit only: forget my tutorial and my solve of today's island. */
menu.post('/reset-me', async (c) => {
  if (context.subredditName !== DEV.resetSubreddit)
    return c.json<UiResponse>(
      { showToast: 'Only on the playtest subreddit' },
      200
    );
  try {
    const { userId } = context;
    const username = await reddit.getCurrentUsername();
    if (userId === undefined || username === undefined)
      return c.json<UiResponse>({ showToast: 'Sign in first' }, 200);
    await resetPlayer(
      redisStore,
      { userId, username },
      currentDay(nowMs(), lastDay())
    );
    return c.json<UiResponse>(
      { showToast: 'Reset. Reload the post to play as a first-timer.' },
      200
    );
  } catch (error) {
    console.error(`Error resetting progress: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Could not reset' }, 200);
  }
});

/**
 * Trailer mode for the demo video. The menu item is for moderators only; it arms the trailer
 * for the moderator who tapped it, and the next time they open the game it plays once.
 */
menu.post('/trailer', async (c) => {
  const { userId } = context;
  if (userId === undefined)
    return c.json<UiResponse>({ showToast: 'Sign in first' }, 200);
  await redisStore.set(KEYS.trailer(userId), '1', TRAILER.armedSeconds);
  return c.json<UiResponse>(
    { showToast: 'Trailer armed. Open the game within 10 minutes.' },
    200
  );
});

/** Playtest subreddit only: asks which day "today" should be. */
menu.post('/set-today', (c) => {
  if (context.subredditName !== DEV.resetSubreddit)
    return c.json<UiResponse>(
      { showToast: 'Only on the playtest subreddit' },
      200
    );
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'setToday',
        form: {
          title: 'Dev: set today',
          description: `Today is day ${currentDay(nowMs(), lastDay())}. Enter 0 to go back to real time.`,
          acceptLabel: 'Set',
          fields: [
            {
              type: 'number',
              name: 'day',
              label: `Day number, 1 to ${lastDay()} (0 = real time)`,
              defaultValue: currentDay(nowMs(), lastDay()),
              required: true,
            },
          ],
        },
      },
    },
    200
  );
});

/**
 * Playtest subreddit only: a clean start. Deletes every post this app made here, forgets each
 * day's post, board, sky, counts and crowd, and resets the moderator's own progress on every
 * day. Other accounts' own solves are not touched (they cannot be listed).
 */
menu.post('/clean-up', async (c) => {
  if (context.subredditName !== DEV.resetSubreddit)
    return c.json<UiResponse>(
      { showToast: 'Only on the playtest subreddit' },
      200
    );
  try {
    const app = await reddit.getAppUser();
    const posts = await reddit
      .getNewPosts({ subredditName: context.subredditName, limit: 200 })
      .all();
    let deleted = 0;
    for (const post of posts) {
      if (app === undefined || post.authorId !== app.id) continue;
      await post.delete().catch(() => post.remove());
      deleted++;
    }
    const { userId } = context;
    const username = await reddit.getCurrentUsername();
    for (let day = 1; day <= lastDay(); day++) {
      // The moderator's own progress first, then the day's data: counts end at 0, never below.
      if (userId !== undefined && username !== undefined) {
        await resetPlayer(redisStore, { userId, username }, day);
        await redisStore.del(KEYS.shared(day, userId));
        await redisStore.del(KEYS.progress(day, userId));
      }
      await Promise.all([
        redisStore.del(KEYS.postForDay(day)),
        redisStore.del(KEYS.postLock(day)),
        redisStore.del(KEYS.leaderboard(day)),
        redisStore.del(KEYS.sky(day)),
        redisStore.del(KEYS.stats(day)),
        redisStore.del(KEYS.heat(day)),
      ]);
    }
    await redisStore.del(KEYS.allTime);
    return c.json<UiResponse>(
      { showToast: `Cleaned up: ${deleted} posts deleted, all days reset.` },
      200
    );
  } catch (error) {
    console.error(`Clean-up failed: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Clean-up failed' }, 200);
  }
});
