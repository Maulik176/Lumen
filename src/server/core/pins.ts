/**
 * Pinning the daily post (PHASE3_PLAN.md E8). Reddit gives a subreddit two pin slots: today's
 * post takes one, "How to play" keeps the other. The app unpins only the daily post it pinned
 * last (remembered by id), so it never touches a post it did not pin. Fallible like every Reddit
 * decoration: a failed pin is logged, not remembered, and the half-hourly task tries again.
 */
import { PINS } from '../../shared/config';
import { KEYS, type Store } from './store';

/** What pinning needs from Reddit; the route passes the real calls, tests pass fakes. */
export type PinReddit = {
  /** Pin a post: into the top slot, or the free one Reddit gives. */
  sticky: (postId: string, top: boolean) => Promise<void>;
  unsticky: (postId: string) => Promise<void>;
};

export type PinOutcome = 'pinned' | 'already' | 'no-post' | 'failed' | 'off';

/** Pin day `day`'s post and unpin the daily post pinned before it. Safe to call again. */
export async function pinDaily(
  store: Store,
  reddit: PinReddit,
  day: number,
  options: { enabled: boolean; top: boolean } = PINS,
  log: (line: string) => void = () => undefined
): Promise<PinOutcome> {
  if (!options.enabled) return 'off';
  if ((await store.get(KEYS.pinned(day))) !== undefined) return 'already';
  const today = await store.get(KEYS.postForDay(day));
  if (today === undefined) return 'no-post';
  const last = await store.get(KEYS.pinnedLast);
  if (last !== undefined && last !== today)
    await reddit
      .unsticky(last)
      .catch((error: unknown) =>
        log(`Could not unpin the last daily post ${last}: ${String(error)}`)
      );
  try {
    await reddit.sticky(today, options.top);
  } catch (error) {
    log(`Could not pin day ${day}'s post ${today}: ${String(error)}`);
    return 'failed';
  }
  await store.set(KEYS.pinnedLast, today);
  await store.set(KEYS.pinned(day), '1', PINS.keepSeconds);
  return 'pinned';
}
