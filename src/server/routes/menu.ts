import { Hono } from 'hono';
import { nowMs } from '../core/clock';
import type { UiResponse } from '@devvit/web/shared';
import { context, media, reddit } from '@devvit/web/server';
import { toPostData } from '../../shared/api';
import { TEST_PICTURE } from '../core/test-picture';
import { islandForDay } from '../core/content';
import { COPY, DEV, LAUNCH, TRAILER } from '../../shared/config';
import { currentDay, resetPlayer, sharedCommentOf } from '../core/game';
import { KEYS, redisStore } from '../core/store';
import { lastDay } from '../core/content';
import { ensureDailyPost } from '../core/post';
import { devToolsRefusal } from '../core/devtools';
import {
  cleanUpCommunity,
  islandOfPost,
  resetCommunityPlayer,
  setIslandExcluded,
} from '../core/community';
import { pickOptions, pickReddit } from '../core/pick-reddit';
import {
  chooseWinner,
  cleanUpSundays,
  devSunday,
  previewLine,
  runPick,
  withdrawIfPicked,
} from '../core/sunday';

export const menu = new Hono();

/** A post's page address. The id comes with a "t3_" prefix that the address must not carry. */
export function postAddress(postId: string): string {
  return `https://www.reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;
}

/**
 * Where to send the moderator after posting: the post itself, as Reddit describes it (its own
 * url and permalink), which opens it directly in the app and on the web. The hand-built address
 * is the fallback.
 */
export async function openPost(
  postId: string
): Promise<string | { url: string; permalink: string }> {
  try {
    const post = await reddit.getPostById(`t3_${postId.replace(/^t3_/, '')}`);
    return { url: post.url, permalink: post.permalink };
  } catch {
    return postAddress(postId);
  }
}

/** Manual fallback for the scheduler: makes today's post, or opens it if it already exists. */
menu.post('/post-today', async (c) => {
  try {
    const { postId } = await ensureDailyPost(currentDay(nowMs(), lastDay()));
    return c.json<UiResponse>({ navigateTo: await openPost(postId) }, 200);
  } catch (error) {
    console.error(`Error creating today's post: ${String(error)}`);
    return c.json<UiResponse>(
      { showToast: "Could not post today's Lumen" },
      200
    );
  }
});

/** Opens a small form asking which day to post. For testing any island; such posts are unranked
 * unless the day is today. Off after launch: a post for a later day would give it away. */
menu.post('/post-day', (c) => {
  if (LAUNCH.launched)
    return c.json<UiResponse>({ showToast: DEV.launchedToast }, 200);
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
  const refused = devToolsRefusal(context.subredditName);
  if (refused !== null) return c.json<UiResponse>({ showToast: refused }, 200);
  try {
    const { userId } = context;
    const username = await reddit.getCurrentUsername();
    if (userId === undefined || username === undefined)
      return c.json<UiResponse>({ showToast: 'Sign in first' }, 200);
    const day = currentDay(nowMs(), lastDay());
    await removeSharedReply({ userId }, day);
    await resetPlayer(redisStore, { userId, username }, day);
    // Community islands too: Lock ins on them, today's publish count; the Builder's draft and
    // tutorial go with resetPlayer.
    await resetCommunityPlayer(redisStore, { userId, username }, nowMs());
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

/**
 * A dev reset also takes back the player's shared reply. Deleting needs its author, which the
 * app is not, so it falls back to removing it as a moderator (hidden from everyone). Fallible.
 */
async function removeSharedReply(
  player: { userId: string },
  day: number
): Promise<void> {
  const id = await sharedCommentOf(redisStore, player, day).catch(() => null);
  if (id === null || !id.startsWith('t1_')) return;
  try {
    const reply = await reddit.getCommentById(`t1_${id.slice(3)}`);
    await reply.delete().catch(() => reply.remove());
  } catch (error) {
    console.error(`Could not take back the shared reply: ${String(error)}`);
  }
}

/** Playtest subreddit only: asks which day "today" should be. */
menu.post('/set-today', (c) => {
  const refused = devToolsRefusal(context.subredditName);
  if (refused !== null) return c.json<UiResponse>({ showToast: refused }, 200);
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
 * day's post, board, sky, counts and stored pieces, and resets the moderator's own progress on every
 * day. Other accounts' own solves are not touched (they cannot be listed).
 */
menu.post('/clean-up', async (c) => {
  const refused = devToolsRefusal(context.subredditName);
  if (refused !== null) return c.json<UiResponse>({ showToast: refused }, 200);
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
        await removeSharedReply({ userId }, day);
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
        redisStore.del(KEYS.boards(day)),
        redisStore.del(KEYS.othersTop(day)),
        redisStore.del(KEYS.groups(day)),
      ]);
    }
    await redisStore.del(KEYS.allTime);
    // Sunday picks made while testing, their scores and the pin records: without this a test
    // pick would become the real Sunday after launch.
    await cleanUpSundays(redisStore, lastDay());
    // Community islands: players' posts are removed as a moderator (the app may delete only
    // its own), and every island's keys go.
    const islands = await cleanUpCommunity(
      redisStore,
      userId !== undefined && username !== undefined
        ? { userId, username }
        : null,
      nowMs(),
      async (postId) => {
        const post = await reddit.getPostById(
          `t3_${postId.replace(/^t3_/, '')}`
        );
        await post.delete().catch(() => post.remove());
      }
    );
    return c.json<UiResponse>(
      {
        showToast: `Cleaned up: ${deleted} posts deleted, ${islands} community islands taken down, all days reset.`,
      },
      200
    );
  } catch (error) {
    console.error(`Clean-up failed: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Clean-up failed' }, 200);
  }
});

/**
 * Playtest subreddit only: for the next 30 minutes, the moderator's sky also shows one lantern
 * of each streak style (plain, paper, star, koi, comet), labelled "(preview)". Tapping the item
 * again turns it off.
 */
menu.post('/style-preview', async (c) => {
  // Not a destructive tool (it changes only the moderator's own view), so it stays after launch.
  if (context.subredditName !== DEV.resetSubreddit)
    return c.json<UiResponse>({ showToast: DEV.elsewhereToast }, 200);
  const { userId } = context;
  if (userId === undefined)
    return c.json<UiResponse>({ showToast: 'Sign in first' }, 200);
  const key = KEYS.stylePreview(userId);
  if ((await redisStore.get(key)) !== undefined) {
    await redisStore.del(key);
    return c.json<UiResponse>({ showToast: 'Lantern style preview off.' }, 200);
  }
  await redisStore.set(key, '1', DEV.previewSeconds);
  return c.json<UiResponse>(
    {
      showToast:
        'Lantern style preview on for 30 minutes. Open a post you have solved to see the night sky.',
    },
    200
  );
});

/**
 * Playtest subreddit only, before launch: does Reddit's media upload take a data URL in this
 * build, how long does it take, and which host serves the result? It uploads a small render,
 * then makes a test post whose feed card shows the uploaded picture instead of the stock one
 * (PHASE 4: real pictures for community island cards). Details go to the server log.
 */
menu.post('/test-picture', async (c) => {
  const refused = devToolsRefusal(context.subredditName);
  if (refused !== null) return c.json<UiResponse>({ showToast: refused }, 200);
  const began = performance.now();
  try {
    const asset = await media.upload({ url: TEST_PICTURE, type: 'image' });
    const ms = Math.round(performance.now() - began);
    console.log(
      `Picture test: uploaded in ${ms} ms, id ${asset.mediaId}, url ${asset.mediaUrl}`
    );
    const island = islandForDay(currentDay(nowMs(), lastDay()));
    if (island === undefined)
      return c.json<UiResponse>(
        { showToast: `Uploaded in ${ms} ms: ${asset.mediaUrl}` },
        200
      );
    const post = await reddit.submitCustomPost({
      title: `Lumen picture test (${ms} ms)`,
      entry: 'default',
      postData: { ...toPostData(island), picture: asset.mediaUrl },
    });
    console.log(`Picture test: post ${post.id}`);
    return c.json<UiResponse>({ navigateTo: await openPost(post.id) }, 200);
  } catch (error) {
    const ms = Math.round(performance.now() - began);
    console.error(`Picture test failed after ${ms} ms: ${String(error)}`);
    return c.json<UiResponse>(
      { showToast: `Upload failed: ${String(error).slice(0, 90)}` },
      200
    );
  }
});

/**
 * Moderators, on any post (stays after launch): keep a community island out of the Sunday pick.
 * If it is the pick for a Sunday whose post does not exist yet, the pick runs again without it.
 */
menu.post('/exclude-island', async (c) => {
  try {
    const index =
      context.postId === undefined
        ? null
        : await islandOfPost(redisStore, context.postId);
    if (index === null)
      return c.json<UiResponse>({ showToast: COPY.sundayNotIsland }, 200);
    const by = (await reddit.getCurrentUsername()) ?? 'a moderator';
    await setIslandExcluded(redisStore, index, by);
    const report = await withdrawIfPicked(
      redisStore,
      pickReddit(),
      index,
      nowMs(),
      pickOptions()
    );
    return c.json<UiResponse>(
      {
        showToast:
          report === null ? COPY.sundayExcluded : COPY.sundayExcludedRepicked,
      },
      200
    );
  } catch (error) {
    console.error(`Exclude failed: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Could not exclude it' }, 200);
  }
});

/** Moderators, on any post: let an excluded community island back into the Sunday pick. */
menu.post('/include-island', async (c) => {
  try {
    const index =
      context.postId === undefined
        ? null
        : await islandOfPost(redisStore, context.postId);
    if (index === null)
      return c.json<UiResponse>({ showToast: COPY.sundayNotIsland }, 200);
    await setIslandExcluded(redisStore, index, '');
    return c.json<UiResponse>({ showToast: COPY.sundayIncluded }, 200);
  } catch (error) {
    console.error(`Include failed: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Could not include it' }, 200);
  }
});

/**
 * Playtest subreddit only, before launch: run the Sunday pick now for the next Sunday (on the
 * dev clock), with every island so far in the running. Replaces an earlier pick unless that
 * Sunday's post exists. The full reasoning goes to the server log.
 */
menu.post('/dev-pick', async (c) => {
  const refused = devToolsRefusal(context.subredditName);
  if (refused !== null) return c.json<UiResponse>({ showToast: refused }, 200);
  try {
    const now = nowMs();
    const report = await runPick(
      redisStore,
      pickReddit(),
      devSunday(now),
      now,
      {
        ...pickOptions(),
        dev: true,
        force: true,
      }
    );
    const toast =
      report.outcome === 'frozen'
        ? COPY.sundayFrozen
        : report.outcome === 'busy'
          ? COPY.sundayBusy
          : report.line.replace(/ \(.*$/, '');
    return c.json<UiResponse>({ showToast: toast }, 200);
  } catch (error) {
    console.error(`Dev pick failed: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'The pick failed' }, 200);
  }
});

/** Playtest subreddit only, before launch: who would win the next Sunday now. Writes nothing. */
menu.post('/dev-pick-preview', async (c) => {
  const refused = devToolsRefusal(context.subredditName);
  if (refused !== null) return c.json<UiResponse>({ showToast: refused }, 200);
  try {
    const now = nowMs();
    const day = devSunday(now);
    const choice = await chooseWinner(
      redisStore,
      pickReddit(),
      day,
      { from: 0, to: now + 1 },
      pickOptions()
    );
    const line = previewLine(choice);
    console.log(`Sunday pick preview for day ${day}: ${line}`);
    return c.json<UiResponse>({ showToast: line }, 200);
  } catch (error) {
    console.error(`Dev pick preview failed: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'The preview failed' }, 200);
  }
});
