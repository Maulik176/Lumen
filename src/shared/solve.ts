/**
 * Minimum-piece solver. Finds par (the fewest pieces that light every lantern), one solution
 * that achieves it, and how many distinct minimum solutions exist.
 *
 * Method: iterative deepening on piece count, k = 0, 1, 2, ...
 *
 * Three ideas keep the search small, and all three are exact (they never hide a solution):
 *
 * 1. Only branch on tiles light currently crosses. In a minimum solution every piece is hit by
 *    light, so each piece can be added on a tile that light already reaches. A prism is only
 *    tried where white light crosses, since coloured light ignores prisms.
 *
 * 2. Place pieces in the order light meets them. The tracer visits tiles in a fixed sequence, and
 *    adding a piece on a tile first reached at step i leaves steps 1..i unchanged. So every
 *    solution can be built by adding its pieces in order of the step at which light first
 *    reaches them, and there is exactly one such order. The search keeps a cursor (the step of
 *    the last piece placed) and only places the next piece on a tile first reached after it.
 *    Each set of pieces is therefore visited once, with no table of visited sets, and layouts
 *    where a later piece steals the light from an earlier one are never built.
 *
 * 3. A lower bound per unlit lantern: the fewest new pieces any beam needs to reach it. This is a
 *    shortest-path search over the light that is still free to change (everything after the
 *    cursor), where flying straight is free and changing course on an empty grass tile costs one
 *    piece. To stay a true lower bound it lets a new piece send light out in any direction, which
 *    means a path never needs to pay for the same tile twice. If any unlit lantern needs more
 *    pieces than are left, the branch is dropped.
 *
 * 4. Sight sets. The last new piece on the path that lights a lantern shines straight into it
 *    through the island as it stands, so it must stand on a tile with a clear line to that
 *    lantern. Each unlit lantern therefore needs a new piece inside its "sight set". If the
 *    pieces left cannot cover every unlit lantern's sight set between them the branch is
 *    dropped, and the very last piece must stand in all of those sets at once.
 */
import {
  allLit,
  CELL_BLOCK,
  CELL_LANTERN,
  createScratch,
  DX,
  DY,
  lanternLit,
  PIECE_BACKSLASH,
  PIECE_NONE,
  PIECE_PRISM,
  PIECE_SLASH,
  reflect,
  runTrace,
  WHITE,
} from './board';
import { SOLVER } from './config';
import { boardFor } from './trace';
import type { Placement, Puzzle } from './types';

export type SolveOptions = {
  /** Search nodes allowed before giving up. Defaults to SOLVER.nodeLimit. */
  nodeLimit?: number;
  /** Stop counting minimum solutions here. Defaults to SOLVER.solutionCap. */
  solutionCap?: number;
  /** Do not look for solutions with more pieces than this. Defaults to the whole inventory. */
  maxPieces?: number;
};

export type SolveResult =
  | {
      status: 'solved';
      /** The fewest pieces that light every lantern. */
      par: number;
      /** One minimum solution, ordered by tile. */
      solution: Placement[];
      /** Distinct minimum solutions found. */
      solutionCount: number;
      /** False if counting stopped early, at the cap or at the node limit. */
      solutionCountComplete: boolean;
      nodes: number;
      /** How many different first moves the empty board offers. */
      rootBranching: number;
    }
  | { status: 'unsolvable'; nodes: number; rootBranching: number }
  | {
      /** The node budget ran out before an answer was proven. */
      status: 'limit';
      nodes: number;
      rootBranching: number;
      /** Every piece count up to and including this one was fully searched without success. */
      searchedThrough: number;
    };

const UNREACHABLE = 255;

export function solve(puzzle: Puzzle, options: SolveOptions = {}): SolveResult {
  const board = boardFor(puzzle);
  const scratch = createScratch(board);
  const {
    width,
    height,
    tiles,
    cell,
    fixed,
    placeable,
    lanternAt,
    lanternCount,
  } = board;
  const { visited, received, lastStep, firstCross } = scratch;
  const stateCount = tiles * 4;

  const nodeLimit = options.nodeLimit ?? SOLVER.nodeLimit;
  const solutionCap = options.solutionCap ?? SOLVER.solutionCap;
  const inventoryTotal = puzzle.inventory.mirrors + puzzle.inventory.prisms;
  const maxPieces = Math.max(
    0,
    Math.min(options.maxPieces ?? inventoryTotal, inventoryTotal, tiles)
  );

  const pieces = new Uint8Array(tiles);
  let mirrorsLeft = puzzle.inventory.mirrors;
  let prismsLeft = puzzle.inventory.prisms;

  // Lower-bound search memory.
  const distance = new Uint8Array(stateCount);
  let queueNow = new Int32Array(stateCount);
  let queueNext = new Int32Array(stateCount);
  const lanternDistance = new Uint8Array(lanternCount);

  // One candidate buffer per search depth, so recursion never overwrites its caller's list.
  const candidateTile: Int32Array[] = [];
  const candidateWhite: Uint8Array[] = [];
  const candidateStep: Int32Array[] = [];
  for (let depth = 0; depth <= maxPieces; depth++) {
    candidateTile.push(new Int32Array(tiles));
    candidateWhite.push(new Uint8Array(tiles));
    candidateStep.push(new Int32Array(tiles));
  }

  const lanternTiles = new Int32Array(lanternCount);
  for (let tile = 0; tile < tiles; tile++) {
    const lantern = lanternAt[tile] ?? -1;
    if (lantern >= 0) lanternTiles[lantern] = tile;
  }

  /** Placed pieces as tile x 4 + piece code, in placement order. */
  const placed: number[] = [];

  let nodes = 0;
  let outOfBudget = false;
  let countingStopped = false;
  let solutionCount = 0;
  /** The first minimum solution found, as sorted piece codes. Empty until one is found. */
  const firstSolution: number[] = [];
  let hasSolution = false;

  /**
   * Fewest extra pieces any unlit lantern still needs, given that new pieces may only go on tiles
   * first reached after step `cursor`. More than `budget` means "too many".
   */
  const lowerBound = (budget: number, cursor: number): number => {
    distance.fill(UNREACHABLE);
    let nowLength = 0;
    // Light that entered a tile after the cursor is still free to be redirected.
    for (let state = 0; state < stateCount; state++) {
      if ((lastStep[state] ?? 0) > cursor) {
        distance[state] = 0;
        queueNow[nowLength++] = state;
      }
    }
    lanternDistance.fill(UNREACHABLE);

    for (let level = 0; level <= budget && nowLength > 0; level++) {
      let nextLength = 0;
      for (let i = 0; i < nowLength; i++) {
        const state = queueNow[i] ?? 0;
        if (distance[state] !== level) continue;
        const tile = state >> 2;
        const direction = state & 3;
        const piece = (pieces[tile] ?? 0) | (fixed[tile] ?? 0);
        const x = tile % width;
        const y = (tile / width) | 0;
        const reachedAt = firstCross[tile] ?? 0;
        const canTurnHere =
          piece === PIECE_NONE &&
          placeable[tile] === 1 &&
          level < budget &&
          (reachedAt === 0 || reachedAt > cursor);

        for (let out = 0; out < 4; out++) {
          let cost: number;
          if (piece === PIECE_SLASH || piece === PIECE_BACKSLASH) {
            if (out !== reflect(piece, direction)) continue;
            cost = level;
          } else if (piece === PIECE_PRISM) {
            if (out === ((direction + 2) & 3)) continue;
            cost = level;
          } else if (out === direction) {
            cost = level;
          } else if (canTurnHere) {
            cost = level + 1;
          } else {
            continue;
          }

          const nx = x + (DX[out] ?? 0);
          const ny = y + (DY[out] ?? 0);
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          const kind = cell[next];
          if (kind === CELL_BLOCK) continue;
          if (kind === CELL_LANTERN) {
            const lantern = lanternAt[next] ?? 0;
            if (cost < (lanternDistance[lantern] ?? 0))
              lanternDistance[lantern] = cost;
            continue;
          }
          const nextState = next * 4 + out;
          if ((distance[nextState] ?? 0) > cost) {
            distance[nextState] = cost;
            if (cost === level) queueNow[nowLength++] = nextState;
            else queueNext[nextLength++] = nextState;
          }
        }
      }
      const swap = queueNow;
      queueNow = queueNext;
      queueNext = swap;
      nowLength = nextLength;
    }

    let bound = 0;
    for (let i = 0; i < lanternCount; i++) {
      if (lanternLit(board, received, i)) continue;
      // An unlit lantern needs at least one more piece, even if some beam already touches it.
      const need = Math.max(1, lanternDistance[i] ?? UNREACHABLE);
      if (need > bound) bound = need;
    }
    return bound;
  };

  // Sight sets: for each lantern, the tiles a new piece could stand on and shine straight into it.
  const sightWords = (tiles + 31) >> 5;
  const sight = new Int32Array(Math.max(1, lanternCount) * sightWords);
  const sightCommon = new Int32Array(sightWords);
  const rayTile = new Int32Array(tiles * 4 + 8);
  const rayDirection = new Uint8Array(tiles * 4 + 8);
  const rayStepCap = tiles * 8;

  /**
   * Fill lantern `index`'s sight set: every free tile from which light, leaving in some direction,
   * reaches the lantern through the island as it stands. Found by walking back along the four
   * lines into the lantern, bouncing off mirrors already there. Returns false if the set is empty.
   */
  const fillSight = (
    index: number,
    lanternTile: number,
    cursor: number
  ): boolean => {
    const offset = index * sightWords;
    for (let w = 0; w < sightWords; w++) sight[offset + w] = 0;
    let any = false;
    let top = 0;
    for (let direction = 0; direction < 4; direction++) {
      rayTile[top] = lanternTile;
      rayDirection[top] = direction;
      top++;
    }
    let budget = rayStepCap;
    while (top > 0) {
      top--;
      let tile = rayTile[top] ?? 0;
      // `direction` is the way the light is travelling; we walk against it.
      let direction = rayDirection[top] ?? 0;
      while (budget-- > 0) {
        const x = (tile % width) - (DX[direction] ?? 0);
        const y = ((tile / width) | 0) - (DY[direction] ?? 0);
        if (x < 0 || y < 0 || x >= width || y >= height) break;
        tile = y * width + x;
        const kind = cell[tile];
        if (kind === CELL_BLOCK || kind === CELL_LANTERN) break;
        const piece = (pieces[tile] ?? 0) | (fixed[tile] ?? 0);
        if (piece === PIECE_NONE) {
          if (placeable[tile] === 1) {
            const reachedAt = firstCross[tile] ?? 0;
            if (reachedAt === 0 || reachedAt > cursor) {
              sight[offset + (tile >> 5)] =
                (sight[offset + (tile >> 5)] ?? 0) | (1 << (tile & 31));
              any = true;
            }
          }
          continue;
        }
        if (piece === PIECE_PRISM) {
          // Light leaving a prism this way may have come in straight, or been split to either side.
          if (top + 2 < rayTile.length) {
            rayTile[top] = tile;
            rayDirection[top] = (direction + 1) & 3;
            top++;
            rayTile[top] = tile;
            rayDirection[top] = (direction + 3) & 3;
            top++;
          }
          continue;
        }
        // A mirror: the light arrived travelling the mirror image of the way it left.
        direction = reflect(piece, direction);
      }
    }
    return any;
  };

  const unlit = new Int32Array(Math.max(1, lanternCount));
  let unlitCount = 0;

  /**
   * Can `count` tiles between them stand in the sight set of every lantern in `mask` (bits index
   * the `unlit` list)? One tile must be in the first lantern's set; try each, drop the lanterns
   * it covers, and ask the same question of the rest with one tile fewer.
   */
  const canCover = (count: number, mask: number): boolean => {
    if (mask === 0) return true;
    if (count === 0) return false;
    let first = -1;
    let members = 0;
    for (let u = 0; u < unlitCount; u++) {
      if (((mask >> u) & 1) === 0) continue;
      members++;
      if (first < 0) first = u;
    }
    // Every sight set here is non-empty, so one tile per lantern always works.
    if (members <= count) return true;
    const firstOffset = (unlit[first] ?? 0) * sightWords;
    for (let w = 0; w < sightWords; w++) {
      let word = sight[firstOffset + w] ?? 0;
      while (word !== 0) {
        const low = word & -word;
        word ^= low;
        let rest = mask;
        for (let u = 0; u < unlitCount; u++) {
          if (((mask >> u) & 1) === 0) continue;
          if (((sight[(unlit[u] ?? 0) * sightWords + w] ?? 0) & low) !== 0)
            rest &= ~(1 << u);
        }
        if (canCover(count - 1, rest)) return true;
      }
    }
    return false;
  };

  const search = (remaining: number, depth: number, cursor: number): void => {
    if (outOfBudget || countingStopped) return;
    nodes++;
    if (nodes > nodeLimit) {
      outOfBudget = true;
      return;
    }

    runTrace(board, pieces, scratch, null);
    if (allLit(board, received)) {
      solutionCount++;
      if (!hasSolution) {
        hasSolution = true;
        for (const code of placed.slice().sort((a, b) => a - b))
          firstSolution.push(code);
      }
      if (solutionCount >= solutionCap) countingStopped = true;
      return;
    }
    if (remaining === 0) return;

    // Each unlit lantern needs a new piece inside its sight set. If the pieces left cannot stand
    // in all of those sets between them, this branch is dead.
    sightCommon.fill(-1);
    unlitCount = 0;
    for (let i = 0; i < lanternCount; i++) {
      if (lanternLit(board, received, i)) continue;
      if (!fillSight(i, lanternTiles[i] ?? 0, cursor)) return;
      unlit[unlitCount++] = i;
      const offset = i * sightWords;
      for (let w = 0; w < sightWords; w++)
        sightCommon[w] = (sightCommon[w] ?? 0) & (sight[offset + w] ?? 0);
    }
    if (
      unlitCount > remaining &&
      unlitCount < 31 &&
      !canCover(remaining, (1 << unlitCount) - 1)
    )
      return;
    // With one piece left, the sight-set filter on candidates below already does this job.
    if (remaining > 1 && lowerBound(remaining, cursor) > remaining) return;

    const tilesHere = candidateTile[depth];
    const whiteHere = candidateWhite[depth];
    const stepHere = candidateStep[depth];
    if (
      tilesHere === undefined ||
      whiteHere === undefined ||
      stepHere === undefined
    )
      return;
    let count = 0;
    for (let tile = 0; tile < tiles; tile++) {
      const reachedAt = firstCross[tile] ?? 0;
      if (
        reachedAt <= cursor ||
        placeable[tile] !== 1 ||
        pieces[tile] !== PIECE_NONE
      )
        continue;
      // The last piece has to stand where it can see every lantern that is still dark.
      if (
        remaining === 1 &&
        (((sightCommon[tile >> 5] ?? 0) >> (tile & 31)) & 1) === 0
      )
        continue;
      const base = tile * 4;
      const crossed =
        (visited[base] ?? 0) |
        (visited[base + 1] ?? 0) |
        (visited[base + 2] ?? 0) |
        (visited[base + 3] ?? 0);
      tilesHere[count] = tile;
      whiteHere[count] = (crossed >> WHITE) & 1;
      stepHere[count] = reachedAt;
      count++;
    }

    for (let i = 0; i < count; i++) {
      const tile = tilesHere[i] ?? 0;
      const nextCursor = stepHere[i] ?? 0;
      if (mirrorsLeft > 0) {
        mirrorsLeft--;
        for (let code = PIECE_SLASH; code <= PIECE_BACKSLASH; code++) {
          pieces[tile] = code;
          placed.push(tile * 4 + code);
          search(remaining - 1, depth + 1, nextCursor);
          placed.pop();
        }
        mirrorsLeft++;
      }
      if (prismsLeft > 0 && whiteHere[i] === 1) {
        prismsLeft--;
        pieces[tile] = PIECE_PRISM;
        placed.push(tile * 4 + PIECE_PRISM);
        search(remaining - 1, depth + 1, nextCursor);
        placed.pop();
        prismsLeft++;
      }
      pieces[tile] = PIECE_NONE;
    }
  };

  // First moves on offer from the empty board, for the difficulty score.
  runTrace(board, pieces, scratch, null);
  let rootBranching = 0;
  for (let tile = 0; tile < tiles; tile++) {
    if (placeable[tile] !== 1) continue;
    const base = tile * 4;
    const crossed =
      (visited[base] ?? 0) |
      (visited[base + 1] ?? 0) |
      (visited[base + 2] ?? 0) |
      (visited[base + 3] ?? 0);
    if (crossed === 0) continue;
    if (mirrorsLeft > 0) rootBranching += 2;
    if (prismsLeft > 0 && ((crossed >> WHITE) & 1) === 1) rootBranching += 1;
  }

  if (lanternCount === 0) return { status: 'unsolvable', nodes, rootBranching };

  for (let k = 0; k <= maxPieces; k++) {
    search(k, 0, 0);
    if (solutionCount > 0) {
      return {
        status: 'solved',
        par: k,
        solution: firstSolution.map((code) => toPlacement(code, width)),
        solutionCount,
        solutionCountComplete: !outOfBudget && !countingStopped,
        nodes,
        rootBranching,
      };
    }
    if (outOfBudget)
      return { status: 'limit', nodes, rootBranching, searchedThrough: k - 1 };
  }
  return { status: 'unsolvable', nodes, rootBranching };
}

function toPlacement(code: number, width: number): Placement {
  const tile = code >> 2;
  const pieceCode = code & 3;
  const x = tile % width;
  const y = Math.floor(tile / width);
  if (pieceCode === PIECE_PRISM) return { x, y, piece: { kind: 'prism' } };
  return {
    x,
    y,
    piece: {
      kind: 'mirror',
      orientation: pieceCode === PIECE_SLASH ? 'slash' : 'backslash',
    },
  };
}
