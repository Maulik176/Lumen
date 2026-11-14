/**
 * The trailer's script: an island's answer turned into timed taps, the same taps a player
 * would make. Pure, so it can be tested: replaying the taps must light every lantern.
 */
import { TRAILER } from './config';
import { startPlay, tapTile } from './play';
import type { Placement, Puzzle } from './types';

export type TrailerTap = { atMs: number; x: number; y: number };

function same(a: Placement | undefined, b: Placement): boolean {
  if (a === undefined || a.piece.kind !== b.piece.kind) return false;
  return (
    a.piece.kind === 'prism' ||
    (b.piece.kind === 'mirror' && a.piece.orientation === b.piece.orientation)
  );
}

/** Taps that build `solution` on `puzzle`, one piece after another, with their times. */
export function trailerSteps(
  puzzle: Puzzle,
  solution: readonly Placement[]
): TrailerTap[] {
  const taps: TrailerTap[] = [];
  let state = startPlay(puzzle);
  let atMs = TRAILER.startMs;
  for (const wanted of solution) {
    // A tile cycles mirror "/", mirror "\\", prism: tap until it shows the piece wanted.
    for (let tap = 0; tap < 3; tap++) {
      const here = state.placements.find(
        (placement) => placement.x === wanted.x && placement.y === wanted.y
      );
      if (same(here, wanted)) break;
      state = tapTile(state, wanted.x, wanted.y).state;
      taps.push({ atMs, x: wanted.x, y: wanted.y });
      atMs += TRAILER.tapGapMs;
    }
    atMs += TRAILER.stepMs - TRAILER.tapGapMs;
  }
  return taps;
}
