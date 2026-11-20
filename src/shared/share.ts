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
export function shareText(
  result: LockInResult,
  lanterns: number,
  /** The player's Reddit username, without "u/". */
  username: string,
  /** On a community island: its name and maker, which stand in for the day number. */
  community?: { island: string; maker: string }
): string {
  const first = (
    community === undefined ? COPY.shareLine : COPY.shareLineCommunity
  )
    .replace('{name}', username)
    .replace('{day}', String(result.day))
    .replace('{island}', community?.island ?? '')
    .replace('{maker}', community?.maker ?? '')
    .replace('{lanterns}', '\u{1F3EE}'.repeat(Math.max(1, lanterns)))
    .replace(
      '{pieces}',
      result.pieces === 1 ? '1 piece' : `${result.pieces} pieces`
    )
    .replace('{par}', String(result.par))
    .replace('{time}', clock(result.elapsedMs));
  const medal = MEDAL_NAME[result.medal];
  const second =
    result.streak > 1 && community === undefined
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

/** The address of one comment under a post, from their ids (with or without t3_/t1_). */
export function commentUrl(postId: string, commentId: string): string {
  return `https://www.reddit.com/comments/${postId.replace(/^t3_/, '')}/comment/${commentId.replace(/^t1_/, '')}`;
}

/** The results comment on a community island's post: it credits the maker. */
export function communityResultsText(
  island: string,
  maker: string,
  solves: number,
  parHits: number
): string {
  const named = (template: string): string =>
    template.replace('{island}', island).replace('{maker}', maker);
  if (solves <= 0) return named(COPY.communityResultsNone);
  const par =
    parHits > 0
      ? COPY.resultsPar.replace('{hits}', parHits.toLocaleString('en'))
      : '';
  return named(
    solves === 1 ? COPY.communityResultsOne : COPY.communityResultsMany
  )
    .replace('{solves}', solves.toLocaleString('en'))
    .replace('{par}', par);
}

/** The results comment's credit on a Sunday picked from the community; the link while it stands. */
export function sundayCreditLine(maker: string, url: string): string {
  return (url === '' ? COPY.sundayResultsGone : COPY.sundayResults)
    .replace('{maker}', maker)
    .replace('{url}', url);
}
