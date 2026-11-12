import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  puzzleFromText,
  readFixture,
  type Fixture,
} from '../src/shared/puzzle-text';
import { solve } from '../src/shared/solve';
import { trace } from '../src/shared/trace';
import { validatePlacements, validatePuzzle } from '../src/shared/validate';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'content', 'fixtures');

const fixtures: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) =>
    readFixture(JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')))
  );

describe('hand-made fixtures', () => {
  it('there are ten of them', () => {
    expect(fixtures).toHaveLength(10);
  });

  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
    '%s: the solver finds the par worked out by hand, in under 2 seconds',
    (_name, fixture) => {
      const puzzle = puzzleFromText(fixture);
      expect(validatePuzzle(puzzle).ok).toBe(true);

      const started = performance.now();
      const result = solve(puzzle);
      const elapsed = performance.now() - started;

      expect(result.status).toBe('solved');
      if (result.status !== 'solved') return;
      expect(result.par).toBe(fixture.par);
      expect(result.solutionCountComplete).toBe(true);
      expect(elapsed).toBeLessThan(2000);

      // The solution is legal for a player to submit and really lights everything.
      expect(validatePlacements(puzzle, result.solution).ok).toBe(true);
      expect(trace(puzzle, result.solution).solved).toBe(true);
      // Par is a true minimum: no solution exists with one piece fewer.
      if (fixture.par > 0) {
        expect(solve(puzzle, { maxPieces: fixture.par - 1 }).status).toBe(
          'unsolvable'
        );
      }
    }
  );

  it('no fixture is already solved with no pieces', () => {
    for (const fixture of fixtures) {
      expect(trace(puzzleFromText(fixture), []).solved, fixture.name).toBe(
        false
      );
    }
  });
});
