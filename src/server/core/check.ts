/**
 * Checking a Builder island: the server's authority on whether it can be published. Pure apart
 * from reading the daily islands, so the local test server can run the very same check.
 */
import {
  difficultyLabel,
  draftProblem,
  draftPuzzleText,
  islandHash,
  readDraft,
  type CheckProblem,
  type DifficultyLabel,
  type IslandDraft,
} from '../../shared/builder';
import { COMMUNITY } from '../../shared/config';
import { rateDifficulty } from '../../shared/difficulty';
import { puzzleFromText } from '../../shared/puzzle-text';
import { solve } from '../../shared/solve';
import type { Inventory, Placement } from '../../shared/types';
import { validatePuzzle } from '../../shared/validate';
import { islandForDay, lastDay } from './content';

export type CheckOutcome =
  | {
      ok: true;
      par: number;
      inventory: Inventory;
      difficulty: number;
      label: DifficultyLabel;
      /** The island's fingerprint (tiles only), for spotting copies. */
      hash: string;
      /** One minimum answer, kept on the server (the Sunday pick needs it). */
      solution: Placement[];
      nodes: number;
      ms: number;
    }
  | { ok: false; problem: CheckProblem; nodes: number; ms: number };

/** The fingerprints of every daily island, worked out once. */
let dailyCache: Set<string> | null = null;
export function dailyHashes(): Set<string> {
  if (dailyCache !== null) return dailyCache;
  const hashes = new Set<string>();
  for (let day = 1; day <= lastDay(); day++) {
    const island = islandForDay(day);
    if (island !== undefined) hashes.add(islandHash(island.rows));
  }
  dailyCache = hashes;
  return hashes;
}

/**
 * Check an island. Par is found with a generous search inventory (up to COMMUNITY.maxPar mirrors
 * and COMMUNITY.searchPrisms prisms); the island then gets par's own mirrors plus the creator's
 * spare mirrors, and exactly par's prisms.
 */
export function checkIsland(
  draft: IslandDraft,
  options: {
    daily: ReadonlySet<string>;
    /** For timing only; the engine itself never reads a clock. */
    clock: () => number;
    nodeLimit?: number;
  }
): CheckOutcome {
  const started = options.clock();
  const finish = (
    outcome:
      | { ok: false; problem: CheckProblem }
      | Omit<Extract<CheckOutcome, { ok: true }>, 'nodes' | 'ms'>,
    nodes: number
  ): CheckOutcome => ({ ...outcome, nodes, ms: options.clock() - started });

  const clean = readDraft(draft);
  if (clean === null) return finish({ ok: false, problem: 'malformed' }, 0);
  const early = draftProblem(clean);
  if (early !== null) return finish({ ok: false, problem: early }, 0);
  const hash = islandHash(clean.rows);
  if (options.daily.has(hash))
    return finish({ ok: false, problem: 'duplicate' }, 0);

  const searching = puzzleFromText(
    draftPuzzleText(clean, {
      mirrors: COMMUNITY.maxPar,
      prisms: COMMUNITY.searchPrisms,
    })
  );
  if (!validatePuzzle(searching).ok)
    return finish({ ok: false, problem: 'malformed' }, 0);
  const nodeLimit = options.nodeLimit ?? COMMUNITY.solveNodes;
  const found = solve(searching, { nodeLimit, maxPieces: COMMUNITY.maxPar });
  if (found.status === 'limit')
    return finish({ ok: false, problem: 'too-complex' }, found.nodes);
  if (found.status === 'unsolvable')
    return finish({ ok: false, problem: 'unsolvable' }, found.nodes);
  if (found.par < COMMUNITY.minPar)
    return finish({ ok: false, problem: 'too-easy' }, found.nodes);

  const prisms = found.solution.filter((p) => p.piece.kind === 'prism').length;
  const inventory: Inventory = {
    mirrors: found.par - prisms + clean.spare,
    prisms,
  };
  // One solve is enough: the final inventory holds par's own pieces (plus spares), and the first
  // search already proved nothing smaller works, so par cannot change. Rating from that search
  // keeps the worst case to one node budget, not two (measured Nov 19: 8x8 islands at 6-9 us per
  // node on a laptop on mains, so 400,000 nodes is about 3.5 s).
  const puzzle = puzzleFromText(draftPuzzleText(clean, inventory));
  const difficulty = rateDifficulty(puzzle, found, 0).score;
  return finish(
    {
      ok: true,
      par: found.par,
      inventory,
      difficulty,
      label: difficultyLabel(difficulty),
      hash,
      solution: found.solution,
    },
    found.nodes
  );
}
