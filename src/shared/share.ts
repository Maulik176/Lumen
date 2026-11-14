/**
 * The comment a player may post after a ranked solve, as a reply under the post's results
 * comment. Built on the server from the server's own result, never from text the client sends.
 */
import type { LockInResult } from './api';
import { COPY } from './config';
import type { Medal } from './types';

const MEDAL_NAME: Record<Medal, string> = {
  lamplighter: COPY.medalLamplighter,
  glow: COPY.medalGlow,
  spark: COPY.medalSpark,
};

/** Minutes and seconds, as 1:42. */
export function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Two lines with a blank line between, so Reddit keeps them apart. */
export function shareText(result: LockInResult, lanterns: number): string {
  const first = COPY.shareLine
    .replace('{day}', String(result.day))
    .replace('{lanterns}', '\u{1F3EE}'.repeat(Math.max(1, lanterns)))
    .replace(
      '{pieces}',
      result.pieces === 1 ? '1 piece' : `${result.pieces} pieces`
    )
    .replace('{par}', String(result.par))
    .replace('{time}', clock(result.elapsedMs));
  const medal = MEDAL_NAME[result.medal];
  const second =
    result.streak > 1
      ? COPY.shareStreak
          .replace('{medal}', medal)
          .replace('{streak}', String(result.streak))
      : medal;
  return `${first}\n\n${second}`;
}

/** The app's stickied comment on a post: an invitation, with the night's counts so far. */
export function resultsText(
  day: number,
  island: string,
  solves: number,
  parHits: number
): string {
  if (solves <= 0)
    return COPY.resultsNone
      .replace('{day}', String(day))
      .replace('{island}', island);
  const par =
    parHits > 0
      ? COPY.resultsPar.replace('{hits}', parHits.toLocaleString('en'))
      : '';
  return (solves === 1 ? COPY.resultsOne : COPY.resultsMany)
    .replace('{solves}', solves.toLocaleString('en'))
    .replace('{island}', island)
    .replace('{par}', par);
}
