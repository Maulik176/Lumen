/**
 * The Sunday pick's Reddit calls, for real (sunday.ts gets them through `PickReddit`, so its
 * rules are tested with fakes). Every call is fallible; the pick logs and carries on.
 */
import { context, reddit } from '@devvit/web/server';
import { DEV } from '../../shared/config';
import { dailyHashes } from './check';
import type { PickOptions, PickReddit } from './sunday';

const postId = (id: string): `t3_${string}` => `t3_${id.replace(/^t3_/, '')}`;
const commentId = (id: string): `t1_${string}` =>
  `t1_${id.replace(/^t1_/, '')}`;

export function pickReddit(): PickReddit {
  return {
    async readPost(id) {
      try {
        const post = await reddit.getPostById(postId(id));
        return {
          score: post.score,
          live: !post.removed && !post.spam && post.authorName !== '[deleted]',
        };
      } catch (error) {
        console.error(`Sunday pick: could not read ${id}: ${String(error)}`);
        return null;
      }
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
