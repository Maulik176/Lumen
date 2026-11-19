/**
 * When the developer tools may run. They exist only on the playtest subreddit, and only until
 * launch: after that the same subreddit is the one players and judges use (CLAUDE.md, LAUNCH).
 * Pure, so the rule is tested without Reddit.
 */
import { DEV, LAUNCH } from '../../shared/config';

export function devToolsOpen(
  subreddit: string | undefined,
  launched: boolean = LAUNCH.launched
): boolean {
  return !launched && subreddit === DEV.resetSubreddit;
}

/** The toast for a refused dev tool, or null when it may run. */
export function devToolsRefusal(
  subreddit: string | undefined,
  launched: boolean = LAUNCH.launched
): string | null {
  if (launched) return DEV.launchedToast;
  return subreddit === DEV.resetSubreddit ? null : DEV.elsewhereToast;
}

/** The clock's shift for this request: a stored dev shift, only while dev tools are open. */
export function clockShift(
  subreddit: string | undefined,
  stored: string | undefined,
  launched: boolean = LAUNCH.launched
): number {
  if (!devToolsOpen(subreddit, launched) || stored === undefined) return 0;
  const shift = Number(stored);
  return Number.isFinite(shift) ? shift : 0;
}
