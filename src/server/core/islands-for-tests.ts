/**
 * Test support (not a test file, never imported by the server): community islands published
 * through the real publish flow, and a fake Reddit for the Sunday pick and the Community view.
 */
import type { IslandDraft } from '../../shared/builder';
import {
  checkIsland,
  finishTest,
  publishIsland,
  recordCheck,
  startTest,
  type Poster,
} from './community';
import { islandForDay } from './content';
import type { Player } from './game';
import { KEYS, type Store } from './store';
import type { PickReddit } from './sunday';

const never = new Set<string>();
const clock = () => 0;

export function maker(name: string): Player {
  return { userId: `t2_${name}`, username: name };
}

/** A fake Reddit: scores by post, which posts are gone, and what the pick did. */
export function fakeReddit() {
  const scores = new Map<string, number>();
  const gone = new Set<string>();
  const comments = new Map<string, { post: string; text: string }>();
  const flairs: [string, string][] = [];
  const deleted: string[] = [];
  let made = 0;
  const reddit: PickReddit = {
    async readPost(postId) {
      const score = scores.get(postId);
      return score === undefined ? null : { score, live: !gone.has(postId) };
    },
    async comment(post, text) {
      made++;
      const id = `t1_c${made}`;
      comments.set(id, { post, text });
      return id;
    },
    async editComment(id, text) {
      const old = comments.get(id);
      if (old !== undefined) comments.set(id, { ...old, text });
    },
    async deleteComment(id) {
      comments.delete(id);
      deleted.push(id);
    },
    async flair(username, text) {
      flairs.push([username, text]);
    },
    subreddit: 'lumen_game_dev',
  };
  return { reddit, scores, gone, comments, flairs, deleted };
}

let posts = 0;
const poster: Poster = {
  async post() {
    posts++;
    return {
      id: `t3_post${posts}`,
      permalink: `/r/lumen_game_dev/comments/post${posts}/x/`,
      author: 'lumen-game',
    };
  },
  async results() {},
};

/** Publish a daily island's layout as a community island, through the real publish flow. */
export async function publishFrom(
  store: Store,
  day: number,
  who: Player,
  nowMs: number,
  name = `Isle ${day}`
): Promise<{ index: number; postId: string }> {
  const daily = islandForDay(day);
  if (daily === undefined || who === null) throw new Error('no island');
  const draft: IslandDraft = {
    size: daily.rows.length,
    biome: daily.biome,
    name,
    spare: 1,
    rows: daily.rows,
  };
  const checked = checkIsland(draft, { daily: never, clock });
  if (!checked.ok) throw new Error(checked.problem);
  await recordCheck(store, who, draft, checked);
  await startTest(store, who, draft, nowMs - 60_000);
  await finishTest(store, who, draft, checked.solution, nowMs);
  const answer = await publishIsland(
    store,
    who,
    { draft, token: `token${day}x${posts}`, avatar: '', nowMs },
    { poster, daily: never, clock }
  );
  if (!answer.ok) throw new Error(answer.problem);
  const index = Number(
    (await store.hMGet(KEYS.communityPosts, [answer.postId]))[0]
  );
  return { index, postId: answer.postId };
}
