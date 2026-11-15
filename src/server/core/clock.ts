/**
 * The server's clock. Everywhere it is the real time, except on the playtest subreddit, where a
 * moderator can move "today" to any day from the menu to test Saturdays, past islands, the
 * warm-up offer and the turn of the day. The shift is read once at the start of each request.
 */
import { context } from '@devvit/web/server';
import { dayAt } from '../../shared/calendar';
import { DEV } from '../../shared/config';
import { KEYS, redisStore as store } from './store';

const MS_PER_DAY = 86_400_000;
let shiftMs = 0;

/** Now, in milliseconds, with the playtest subreddit's shift applied. */
export function nowMs(): number {
  return Date.now() + shiftMs;
}

/** Read the shift for this request. Always zero outside the playtest subreddit. */
export async function refreshClock(): Promise<void> {
  shiftMs = 0;
  try {
    if (context.subredditName !== DEV.resetSubreddit) return;
    const stored = Number(await store.get(KEYS.devShift));
    if (Number.isFinite(stored)) shiftMs = stored;
  } catch {
    // Outside a request, or Redis is unavailable: real time.
  }
}

/** Make today day `day` (same time of day as now). 0 goes back to real time. */
export async function setToday(day: number): Promise<void> {
  if (day <= 0) {
    await store.del(KEYS.devShift);
    shiftMs = 0;
    return;
  }
  shiftMs = (day - dayAt(Date.now())) * MS_PER_DAY;
  await store.set(KEYS.devShift, String(shiftMs));
}
