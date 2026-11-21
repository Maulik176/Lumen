/**
 * The Sunday pick's Reddit calls, for real (sunday.ts gets them through `PickReddit`, so its
 * rules are tested with fakes). Every call is fallible; the pick logs and carries on.
 */
import { context, reddit } from '@devvit/web/server';
import { DEV, SUNDAY } from '../../shared/config';
import { dailyHashes } from './check';
import type { PickOptions, PickReddit } from './sunday';

const postId = (id: string): `t3_${string}` => `t3_${id.replace(/^t3_/, '')}`;
const commentId = (id: string): `t1_${string}` =>
  `t1_${id.replace(/^t1_/, '')}`;

export function pickReddit(): PickReddit {
  return {
    async readPosts(ids, since) {
      const wanted = new Set(ids.map(postId));
      const found = new Map<string, { score: number; live: boolean }>();
      if (wanted.size === 0) return found;
      const live = (post: {
        removed: boolean;
        spam: boolean;
        authorName: string;
      }): boolean =>
        !post.removed && !post.spam && post.authorName !== '[deleted]';
      // The subreddit's newest posts, 100 a call, back to the week's start: a few calls a week.
      const subredditName = context.subredditName;
      if (subredditName !== undefined)
        try {
          for await (const post of reddit.getNewPosts({
            subredditName,
            limit: SUNDAY.listingMax,
            pageSize: 100,
          })) {
            if (wanted.has(post.id))
              found.set(post.id, { score: post.score, live: live(post) });
            if (found.size === wanted.size) break;
            if (post.createdAt.getTime() < since) break;
          }
        } catch (error) {
          console.error(
            `Sunday pick: reading new posts failed: ${String(error)}`
          );
        }
      // Any not in that listing (a removed post, a very busy week): one read each, a few at most.
      const missing = [...wanted]
        .filter((id) => !found.has(id))
        .slice(0, SUNDAY.postReadMax);
      await Promise.all(
        missing.map(async (id) => {
          try {
            const post = await reddit.getPostById(postId(id));
            found.set(id, { score: post.score, live: live(post) });
          } catch (error) {
            console.error(
              `Sunday pick: could not read ${id}: ${String(error)}`
            );
          }
        })
      );
      if (wanted.size > found.size)
        console.error(
          `Sunday pick: ${wanted.size - found.size} of ${wanted.size} scores could not be read`
        );
      return found;
    },
    async comment(id, text) {
      const made = await reddit.submitComment({
        id: postId(id),
        text,
        runAs: 'APP',
      });
      // Marked as the moderators' word, but not pinned: the post's pinned comment is its results.
      await made.distinguish(false).catch(() => undefined);
      return made.id;
    },
    async editComment(id, text) {
      const comment = await reddit.getCommentById(commentId(id));
      await comment.edit({ text });
    },
    async deleteComment(id) {
      const comment = await reddit.getCommentById(commentId(id));
      await comment.delete();
    },
    async flair(username, text) {
      const subredditName = context.subredditName;
      if (subredditName === undefined) return;
      await reddit.setUserFlair({ subredditName, username, text });
    },
    subreddit: context.subredditName ?? DEV.resetSubreddit,
  };
}

/** The pick's options on the server: the real daily islands, the clock, the server log. */
export function pickOptions(): PickOptions {
  return {
    daily: dailyHashes(),
    clock: () => performance.now(),
    log: (line) => console.log(line),
  };
}
