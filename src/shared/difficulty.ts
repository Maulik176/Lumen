/**
 * Difficulty model. A weighted sum of factors, each reported on its own so the weights in
 * config.ts can be tuned against real solve data.
 */
import { DIFFICULTY } from './config';
import type { SolveResult } from './solve';
import { trace } from './trace';
import type { Placement, Puzzle } from './types';

export type DifficultyFactors = {
  /** Fewest pieces that light every lantern. */
  par: number;
  /** Different first moves on offer from the empty island. */
  firstMoves: number;
  /** Distinct minimum solutions found (counting stops at the solver's cap). */
  minimumSolutions: number;
  /** 1 if the par solution contains a prism that a mirror could not replace, else 0. */
  prismNeeded: number;
  /** Lanterns that need two colours at once. */
  mixedLanterns: number;
  /** Misleading paths built into the island. */
  decoys: number;
  /** Prisms in the par solution that only bend light: a mirror in the same spot also solves it. */
  prismsAsTurns: number;
  lanterns: number;
  fixedMirrors: number;
};

export type Difficulty = {
  score: number;
  factors: DifficultyFactors;
  /** Points each factor contributed, in the same order as the weights in config. */
  points: Record<keyof DifficultyFactors, number>;
};

/**
 * How many prisms in a solution are only being used to bend light. A prism counts when swapping
 * it for a mirror, in either orientation, still lights every lantern.
 */
export function countPrismsAsTurns(
  puzzle: Puzzle,
  solution: readonly Placement[]
): number {
  let count = 0;
  solution.forEach((placement, index) => {
    if (placement.piece.kind !== 'prism') return;
    const worksAsMirror = (['slash', 'backslash'] as const).some(
      (orientation) => {
        const swapped = solution.slice();
        swapped[index] = {
          x: placement.x,
          y: placement.y,
          piece: { kind: 'mirror', orientation },
        };
        return trace(puzzle, swapped).solved;
      }
    );
    if (worksAsMirror) count++;
  });
  return count;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Score a solved island. `decoys` comes from the generator (0 for hand-made islands). */
export function rateDifficulty(
  puzzle: Puzzle,
  solved: Extract<SolveResult, { status: 'solved' }>,
  decoys: number
): Difficulty {
  const prisms = solved.solution.filter(
    (placement) => placement.piece.kind === 'prism'
  ).length;
  const prismsAsTurns = countPrismsAsTurns(puzzle, solved.solution);
  const factors: DifficultyFactors = {
    par: solved.par,
    firstMoves: solved.rootBranching,
    minimumSolutions: solved.solutionCount,
    prismNeeded: prisms - prismsAsTurns > 0 ? 1 : 0,
    mixedLanterns: puzzle.lanterns.filter(
      (lantern) =>
        lantern.colour === 'magenta' ||
        lantern.colour === 'cyan' ||
        lantern.colour === 'yellow'
    ).length,
    decoys,
    prismsAsTurns,
    lanterns: puzzle.lanterns.length,
    fixedMirrors: puzzle.fixedMirrors.length,
  };

  const fade = Math.max(1, DIFFICULTY.uniqueFadeAt - 1);
  const uniqueness = Math.max(
    0,
    1 - (Math.min(factors.minimumSolutions, DIFFICULTY.uniqueFadeAt) - 1) / fade
  );
  const points: Record<keyof DifficultyFactors, number> = {
    par: round1(factors.par * DIFFICULTY.parWeight),
    firstMoves: round1(
      Math.log2(Math.max(1, factors.firstMoves)) * DIFFICULTY.branchingWeight
    ),
    minimumSolutions: round1(uniqueness * DIFFICULTY.uniquenessWeight),
    prismNeeded: round1(factors.prismNeeded * DIFFICULTY.prismWeight),
    mixedLanterns: round1(
      factors.mixedLanterns * DIFFICULTY.mixedLanternWeight
    ),
    decoys: round1(factors.decoys * DIFFICULTY.decoyWeight),
    prismsAsTurns: round1(factors.prismsAsTurns * DIFFICULTY.prismAsTurnWeight),
    lanterns: round1(
      Math.max(0, factors.lanterns - 1) * DIFFICULTY.lanternWeight
    ),
    fixedMirrors: round1(factors.fixedMirrors * DIFFICULTY.fixedMirrorWeight),
  };
  const score = round1(
    Object.values(points).reduce((sum, value) => sum + value, 0)
  );
  return { score, factors, points };
}
