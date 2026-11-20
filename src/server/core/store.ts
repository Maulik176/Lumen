/**
 * The few Redis operations Lumen uses, behind one small type, so the game logic can be tested
 * against a plain in-memory copy. Devvit's Redis has strings, hashes and sorted sets only.
 */
import { redis } from '@devvit/web/server';

export type Ranked = { member: string; score: number };

export type Store = {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
  /** Add to a counter and return the new value. The first caller gets 1: used as a lock. */
  count: (key: string, ttlSeconds?: number) => Promise<number>;
  hGetAll: (key: string) => Promise<Record<string, string>>;
  /** Several fields of one hash at once, null where a field is missing. */
  hMGet: (key: string, fields: string[]) => Promise<(string | null)[]>;
  hSet: (key: string, fields: Record<string, string>) => Promise<void>;
  hIncrBy: (key: string, field: string, by: number) => Promise<number>;
  zAdd: (key: string, member: string, score: number) => Promise<void>;
  zCard: (key: string) => Promise<number>;
  /** Position from the lowest score, 0 first; undefined if absent. */
  zRank: (key: string, member: string) => Promise<number | undefined>;
  /** Members by rank, lowest score first (or highest first when `reverse`). */
  zRange: (
    key: string,
    start: number,
    stop: number,
    reverse?: boolean
  ) => Promise<Ranked[]>;
  zRemRangeByRank: (key: string, start: number, stop: number) => Promise<void>;
  zIncrBy: (key: string, member: string, by: number) => Promise<void>;
  expire: (key: string, seconds: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  zRem: (key: string, member: string) => Promise<void>;
};

const later = (seconds: number): Date => new Date(Date.now() + seconds * 1000);

export const redisStore: Store = {
  get: (key) => redis.get(key),
  async set(key, value, ttlSeconds) {
    await redis.set(
      key,
      value,
      ttlSeconds === undefined ? undefined : { expiration: later(ttlSeconds) }
    );
  },
  async count(key, ttlSeconds) {
    const value = await redis.incrBy(key, 1);
    if (value === 1 && ttlSeconds !== undefined)
      await redis.expire(key, ttlSeconds);
    return value;
  },
  hGetAll: (key) => redis.hGetAll(key),
  hMGet: (key, fields) =>
    fields.length === 0 ? Promise.resolve([]) : redis.hMGet(key, fields),
  async hSet(key, fields) {
    await redis.hSet(key, fields);
  },
  hIncrBy: (key, field, by) => redis.hIncrBy(key, field, by),
  async zAdd(key, member, score) {
    await redis.zAdd(key, { member, score });
  },
  zCard: (key) => redis.zCard(key),
  zRank: (key, member) => redis.zRank(key, member),
  zRange: (key, start, stop, reverse) =>
    redis.zRange(key, start, stop, { by: 'rank', reverse: reverse === true }),
  async zRemRangeByRank(key, start, stop) {
    await redis.zRemRangeByRank(key, start, stop);
  },
  async zIncrBy(key, member, by) {
    await redis.zIncrBy(key, member, by);
  },
  async expire(key, seconds) {
    await redis.expire(key, seconds);
  },
  async del(key) {
    await redis.del(key);
  },
  async zRem(key, member) {
    await redis.zRem(key, [member]);
  },
};

/** Every key Lumen writes, in one place. */
export const KEYS = {
  start: (day: number, userId: string) => `start:${day}:${userId}`,
  submission: (day: number, userId: string) => `sub:${day}:${userId}`,
  submitLock: (day: number, userId: string) => `sublock:${day}:${userId}`,
  leaderboard: (day: number) => `lb:${day}`,
  allTime: 'lb:alltime',
  /** Hash: username to the pieces they locked in with (ranked only), for "See others' islands". */
  boards: (day: number) => `boards:${day}`,
  /**
   * The top of the night's board, one row per board with its pieces and its first two players,
   * rebuilt when a Lock in reaches it. "v2" since Nov 20: lists kept before then lack the second
   * player, so they are never read again (they expire on their own).
   */
  othersTop: (day: number) => `others:v2:${day}`,
  stats: (day: number) => `stats:${day}`,
  sky: (day: number) => `sky:${day}`,
  user: (userId: string) => `user:${userId}`,
  /** Set once a player has shared a day's result: the counter is the one-share lock. */
  shared: (day: number, userId: string) => `shared:${day}:${userId}`,
  /** Counter: the first caller takes the one share of the night. `shared` then holds the reply id. */
  shareLock: (day: number, userId: string) => `sharelock:${day}:${userId}`,
  /** Playtest subreddit only: milliseconds added to the clock by "Dev: set today". */
  devShift: 'dev:shift',
  /** The unfinished board a player left on a day: JSON placements. */
  progress: (day: number, userId: string) => `prog:${day}:${userId}`,
  /** Set for a few minutes when a moderator arms trailer mode for themselves. */
  trailer: (userId: string) => `trailer:${userId}`,
  /** Playtest subreddit only: a moderator is previewing the lantern styles. */
  stylePreview: (userId: string) => `dev:styles:${userId}`,
  /** Hash: username -> snoovatar address, for drawing boards without one read per row. */
  avatars: 'avatars',
  postForDay: (day: number) => `post:day:${day}`,
  postLock: (day: number) => `postlock:${day}`,
  dayOfPost: (postId: string) => `post:${postId}:day`,
  stickyOfPost: (postId: string) => `post:${postId}:sticky`,
  /** Held for a minute after the results comment is rewritten, so it is not rewritten again. */
  stickyFresh: (postId: string) => `post:${postId}:stickyfresh`,
  /** The Island Builder draft a player is working on (JSON). */
  draft: (userId: string) => `draft:${userId}`,
  /** Counter: one Builder check per player every few seconds. */
  builderTurn: (userId: string) => `cm:turn:${userId}`,
  /** The player's last passing check, its test start and their own solve (JSON). */
  builderCheck: (userId: string) => `cm:check:${userId}`,
  /** Hash: one community island (COMMUNITY.numberBase + k is its island number). */
  community: (index: number) => `cm:${index}`,
  /** Counter: the next community island's k. */
  communityNext: 'cm:next',
  /** Hash: post id -> k, and island fingerprint -> k (duplicates). */
  communityPosts: 'cm:post',
  communityHashes: 'cm:hash',
  /** Sorted sets of k by creation time: every island, and each maker's own. */
  communityAll: 'cm:all',
  communityMine: (userId: string) => `cm:mine:${userId}`,
  /** Hash for one UTC date: userId -> islands published that day. */
  publishes: (date: string) => `cm:pub:${date}`,
  /** One publish attempt's answer, so a retry with the same token gets the same post. */
  publishToken: (userId: string, token: string) =>
    `cm:token:${userId}:${token}`,
  /** Counter: one publish of an island fingerprint at a time. */
  publishLock: (hash: string) => `cm:lock:${hash}`,
  /** Hash: board key -> how many ranked players placed exactly that board on an island. */
  groups: (day: number) => `groups:${day}`,
} as const;
