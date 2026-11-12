import { describe, expect, it } from 'vitest';
import { puzzleFromText } from './puzzle-text';
import { createRng, type Rng } from './rng';
import { solve } from './solve';
import { trace } from './trace';
import {
  BEAM_COLOURS,
  DIRECTIONS,
  LANTERN_COLOURS,
  type BeamColour,
  type Piece,
  type Placement,
  type Puzzle,
  type Terrain,
} from './types';

function island(
  rows: string[],
  mirrors: number,
  prisms: number,
  sourceColours: BeamColour[] = []
): Puzzle {
  return puzzleFromText({
    rows,
    inventory: { mirrors, prisms },
    sourceColours,
  });
}

const ALL_PIECES: readonly Piece[] = [
  { kind: 'mirror', orientation: 'slash' },
  { kind: 'mirror', orientation: 'backslash' },
  { kind: 'prism' },
];

/**
 * Reference solver with none of the real solver's shortcuts: try every set of k tiles with every
 * piece on each, for k = 0, 1, 2, ... Slow, obviously correct, and only usable on small boards.
 */
function bruteForce(
  puzzle: Puzzle,
  maxPieces: number
): { par: number; count: number } | null {
  const taken = new Set<number>();
  for (const thing of [
    ...puzzle.sources,
    ...puzzle.lanterns,
    ...puzzle.fixedMirrors,
  ]) {
    taken.add(thing.y * puzzle.width + thing.x);
  }
  const free: number[] = [];
  puzzle.terrain.forEach((terrain, tile) => {
    if (terrain === 'grass' && !taken.has(tile)) free.push(tile);
  });

  for (let k = 0; k <= maxPieces; k++) {
    let count = 0;
    const chosen: Placement[] = [];
    const visit = (start: number, mirrors: number, prisms: number): void => {
      if (chosen.length === k) {
        if (trace(puzzle, chosen).solved) count++;
        return;
      }
      for (let i = start; i < free.length; i++) {
        const tile = free[i] ?? 0;
        for (const piece of ALL_PIECES) {
          const isPrism = piece.kind === 'prism';
          if (isPrism ? prisms === 0 : mirrors === 0) continue;
          chosen.push({
            x: tile % puzzle.width,
            y: Math.floor(tile / puzzle.width),
            piece,
          });
          visit(
            i + 1,
            isPrism ? mirrors : mirrors - 1,
            isPrism ? prisms - 1 : prisms
          );
          chosen.pop();
        }
      }
    };
    visit(0, puzzle.inventory.mirrors, puzzle.inventory.prisms);
    if (count > 0) return { par: k, count };
  }
  return null;
}

/** A random small island. Not a good puzzle, just a varied one. */
function randomIsland(rng: Rng, size: number): Puzzle {
  const tiles = size * size;
  const terrain: Terrain[] = [];
  for (let i = 0; i < tiles; i++) {
    const roll = rng.next();
    terrain.push(
      roll < 0.06
        ? 'rock'
        : roll < 0.1
          ? 'tree'
          : roll < 0.2
            ? 'water'
            : 'grass'
    );
  }
  const order = rng.shuffle(Array.from({ length: tiles }, (_, tile) => tile));
  const takeTile = (): { x: number; y: number } => {
    const tile = order.pop() ?? 0;
    terrain[tile] = 'grass';
    return { x: tile % size, y: Math.floor(tile / size) };
  };
  const puzzle: Puzzle = {
    width: size,
    height: size,
    terrain,
    sources: [],
    lanterns: [],
    fixedMirrors: [],
    inventory: { mirrors: rng.range(2, 4), prisms: rng.range(0, 1) },
  };
  const sourceCount = rng.range(1, 3);
  for (let i = 0; i < sourceCount; i++) {
    puzzle.sources.push({
      ...takeTile(),
      direction: rng.pick(DIRECTIONS),
      colour: rng.chance(0.8) ? 'white' : rng.pick(BEAM_COLOURS),
    });
  }
  const lanternCount = rng.range(1, 4);
  for (let i = 0; i < lanternCount; i++) {
    puzzle.lanterns.push({
      ...takeTile(),
      colour: rng.chance(0.75) ? 'white' : rng.pick(LANTERN_COLOURS),
    });
  }
  const fixedCount = rng.range(0, 2);
  for (let i = 0; i < fixedCount; i++) {
    puzzle.fixedMirrors.push({
      ...takeTile(),
      orientation: rng.chance(0.5) ? 'slash' : 'backslash',
    });
  }
  return puzzle;
}

describe('solve', () => {
  it('finds par 0 when the lanterns are already lit', () => {
    const result = solve(island(['>...W'], 2, 0));
    expect(result).toMatchObject({
      status: 'solved',
      par: 0,
      solution: [],
      solutionCount: 1,
    });
  });

  it('finds the single mirror', () => {
    const result = solve(island(['...W..', '......', '>.....'], 2, 0));
    expect(result).toMatchObject({
      status: 'solved',
      par: 1,
      solution: [
        { x: 3, y: 2, piece: { kind: 'mirror', orientation: 'slash' } },
      ],
      solutionCount: 1,
      solutionCountComplete: true,
    });
  });

  it('returns a solution that really solves the puzzle and fits the inventory', () => {
    const puzzle = island(
      [
        '......Y',
        '...~...',
        '.......',
        '>...~~.',
        '.......',
        '.......',
        '...B...',
      ],
      3,
      1
    );
    const result = solve(puzzle);
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    expect(result.par).toBe(3);
    expect(trace(puzzle, result.solution).solved).toBe(true);
    expect(
      result.solution.filter((placement) => placement.piece.kind === 'prism')
    ).toHaveLength(1);
  });

  it('reports unsolvable when no arrangement works', () => {
    expect(solve(island(['>.#.W'], 3, 1)).status).toBe('unsolvable');
    expect(solve(island(['>...R'], 3, 0)).status).toBe('unsolvable');
    expect(solve(island(['>....'], 3, 1)).status).toBe('unsolvable');
  });

  it('respects the inventory', () => {
    const rows = ['>....#', '####.#', '.....#', '#.####', '......', '.W....'];
    expect(solve(island(rows, 3, 0))).toMatchObject({
      status: 'solved',
      par: 3,
    });
    expect(solve(island(rows, 2, 0)).status).toBe('unsolvable');
    // A prism also turns light (its red and blue parts), so it can stand in for the third mirror.
    expect(solve(island(rows, 2, 1))).toMatchObject({
      status: 'solved',
      par: 3,
    });
    expect(solve(island(rows, 1, 1)).status).toBe('unsolvable');
    expect(solve(island(['...R..', '......', '>.....'], 3, 0)).status).toBe(
      'unsolvable'
    );
  });

  it('respects maxPieces', () => {
    const rows = ['>....#', '####.#', '.....#', '#.####', '......', '.W....'];
    expect(solve(island(rows, 5, 0), { maxPieces: 2 }).status).toBe(
      'unsolvable'
    );
    expect(solve(island(rows, 5, 0), { maxPieces: 3 }).status).toBe('solved');
  });

  it('counts distinct minimum solutions', () => {
    const one = solve(island(['.W...', '.....', '>....'], 2, 0));
    expect(one).toMatchObject({
      status: 'solved',
      par: 1,
      solutionCount: 1,
      solutionCountComplete: true,
    });
    // Two beams meet a single tile below the lantern; either mirror turns one of them north.
    const two = solve(
      island(['..W..', '.....', '>...<', '.....', '.....'], 2, 0)
    );
    expect(two).toMatchObject({
      status: 'solved',
      par: 1,
      solutionCount: 2,
      solutionCountComplete: true,
    });
  });

  it('stops counting at the cap and says so', () => {
    const two = solve(
      island(['..W..', '.....', '>...<', '.....', '.....'], 2, 0),
      { solutionCap: 1 }
    );
    expect(two).toMatchObject({
      status: 'solved',
      par: 1,
      solutionCount: 1,
      solutionCountComplete: false,
    });
  });

  it('reports the limit when the node budget runs out, and how far it got', () => {
    const rows = ['>....#', '####.#', '.....#', '#.####', '......', '.W....'];
    const result = solve(island(rows, 3, 0), { nodeLimit: 3 });
    expect(result.status).toBe('limit');
    if (result.status !== 'limit') return;
    expect(result.searchedThrough).toBeGreaterThanOrEqual(0);
    expect(result.searchedThrough).toBeLessThan(3);
  });

  it('counts first moves on the empty board', () => {
    // Four free tiles on the beam; two mirror turns each, plus a prism where white light crosses.
    expect(solve(island(['>....'], 2, 0)).rootBranching).toBe(8);
    expect(solve(island(['>....'], 2, 1)).rootBranching).toBe(12);
    expect(solve(island(['>....'], 2, 1, ['red'])).rootBranching).toBe(8);
    expect(solve(island(['>~~..'], 2, 0)).rootBranching).toBe(4);
  });

  it('agrees with brute force on an island where fixed mirrors carry light round a loop', () => {
    const rows = ['./..\\', '.....', '>.../', '.....', '.....', '...W.'];
    const puzzle = island(rows, 3, 0);
    const result = solve(puzzle);
    const reference = bruteForce(puzzle, 3);
    expect(reference).not.toBeNull();
    expect(result).toMatchObject({
      status: 'solved',
      par: reference?.par,
      solutionCount: reference?.count,
    });
  });

  it('agrees with brute force on 400 random small islands', () => {
    const rng = createRng('solver-cross-check');
    let solved = 0;
    let unsolvable = 0;
    const parsSeen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const puzzle = randomIsland(rng, rng.range(4, 5));
      const maxPieces = Math.min(
        puzzle.width === 4 ? 4 : 3,
        puzzle.inventory.mirrors + puzzle.inventory.prisms
      );
      const expected = bruteForce(puzzle, maxPieces);
      const actual = solve(puzzle, { maxPieces, solutionCap: 1_000_000 });
      if (expected === null) {
        unsolvable++;
        expect(actual.status, `island ${i}`).toBe('unsolvable');
      } else {
        solved++;
        parsSeen.add(expected.par);
        expect(actual, `island ${i}`).toMatchObject({
          status: 'solved',
          par: expected.par,
          solutionCount: expected.count,
          solutionCountComplete: true,
        });
        if (actual.status === 'solved')
          expect(trace(puzzle, actual.solution).solved).toBe(true);
      }
    }
    // The sample must exercise both outcomes, or the comparison proves little.
    expect(solved).toBeGreaterThan(60);
    expect(unsolvable).toBeGreaterThan(30);
    expect(parsSeen.size).toBeGreaterThanOrEqual(4);
  }, 120_000);

  it('is deterministic', () => {
    const puzzle = island(
      [
        '......Y',
        '...~...',
        '.......',
        '>...~~.',
        '.......',
        '.......',
        '...B...',
      ],
      3,
      1
    );
    expect(JSON.stringify(solve(puzzle))).toBe(JSON.stringify(solve(puzzle)));
  });
});
