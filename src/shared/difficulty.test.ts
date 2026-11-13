import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from './config';
import { countPrismsAsTurns, rateDifficulty } from './difficulty';
import { puzzleFromText } from './puzzle-text';
import { solve } from './solve';
import type { BeamColour, Puzzle } from './types';

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

function rate(puzzle: Puzzle, decoys = 0) {
  const solved = solve(puzzle);
  if (solved.status !== 'solved')
    throw new Error('test island must be solvable');
  return rateDifficulty(puzzle, solved, decoys);
}

describe('rateDifficulty', () => {
  it('reports every factor and the points each one contributed', () => {
    const rated = rate(island(['...W..', '......', '>.....'], 3, 0), 2);
    expect(rated.factors).toEqual({
      par: 1,
      firstMoves: 10,
      minimumSolutions: 1,
      prismNeeded: 0,
      mixedLanterns: 0,
      decoys: 2,
      prismsAsTurns: 0,
      lanterns: 1,
      fixedMirrors: 0,
    });
    expect(rated.points.par).toBe(DIFFICULTY.parWeight);
    expect(rated.points.decoys).toBe(2 * DIFFICULTY.decoyWeight);
    expect(rated.points.minimumSolutions).toBe(DIFFICULTY.uniquenessWeight);
    const total = Object.values(rated.points).reduce(
      (sum, value) => sum + value,
      0
    );
    expect(rated.score).toBeCloseTo(total, 5);
  });

  it('scores a higher par higher', () => {
    const one = rate(
      island(['...W..', '......', '>.....', '......', '......', '......'], 3, 0)
    );
    const three = rate(
      island(['>....#', '####.#', '.....#', '#.####', '......', '.W....'], 3, 0)
    );
    expect(three.score).toBeGreaterThan(one.score);
  });

  it('scores a single minimum solution higher than many', () => {
    const tight = rate(island(['..W..', '.....', '>....'], 2, 0));
    const loose = rate(
      island(['..W..', '.....', '>...<', '.....', '.....'], 2, 0)
    );
    expect(tight.factors.minimumSolutions).toBe(1);
    expect(loose.factors.minimumSolutions).toBe(2);
    expect(tight.points.minimumSolutions).toBeGreaterThan(
      loose.points.minimumSolutions
    );
  });

  it('counts a prism that makes a needed colour', () => {
    const rated = rate(
      island(['...R..', '......', '>....G', '......', '......', '...B..'], 2, 1)
    );
    expect(rated.factors.prismNeeded).toBe(1);
    expect(rated.factors.prismsAsTurns).toBe(0);
    expect(rated.points.prismNeeded).toBe(DIFFICULTY.prismWeight);
  });

  it('counts mixed lanterns', () => {
    const rated = rate(
      island(
        ['......', '......', '>..M..', '......', '......', '.....^'],
        2,
        0,
        ['red', 'blue']
      )
    );
    expect(rated.factors.mixedLanterns).toBe(1);
    expect(rated.points.mixedLanterns).toBe(DIFFICULTY.mixedLanternWeight);
  });
});

describe('countPrismsAsTurns', () => {
  const puzzle = island(['...W..', '......', '>.....'], 0, 1);

  it('counts a prism that only bends light toward a white lantern', () => {
    // Red leaves the prism to the north and lights the white lantern; a "/" would do the same.
    expect(
      countPrismsAsTurns(puzzle, [{ x: 3, y: 2, piece: { kind: 'prism' } }])
    ).toBe(1);
    const rated = rate(puzzle);
    expect(rated.factors.prismsAsTurns).toBe(1);
    expect(rated.factors.prismNeeded).toBe(0);
    expect(rated.points.prismsAsTurns).toBe(DIFFICULTY.prismAsTurnWeight);
  });

  it('does not count a prism that a mirror cannot replace', () => {
    const coloured = island(['...R..', '......', '>.....'], 0, 1);
    expect(
      countPrismsAsTurns(coloured, [{ x: 3, y: 2, piece: { kind: 'prism' } }])
    ).toBe(0);
  });

  it('ignores mirrors', () => {
    expect(
      countPrismsAsTurns(puzzle, [
        { x: 3, y: 2, piece: { kind: 'mirror', orientation: 'slash' } },
      ])
    ).toBe(0);
  });
});
