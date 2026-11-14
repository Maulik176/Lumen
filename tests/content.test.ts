import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { biomeOfDay, dateOfDay, weekdayOfDay } from '../src/shared/calendar';
import { CALENDAR, GENERATOR } from '../src/shared/config';
import {
  dailyFileIsCurrent,
  puzzleOfDaily,
  readDailyFile,
  toDailyIsland,
} from '../src/shared/daily';
import { rateDifficulty } from '../src/shared/difficulty';
import { generateIsland } from '../src/shared/generate';
import { solve } from '../src/shared/solve';
import { trace } from '../src/shared/trace';
import { validatePlacements, validatePuzzle } from '../src/shared/validate';

const file = readDailyFile(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '..', 'content', 'puzzles.json'),
      'utf8'
    )
  )
);

describe('content/puzzles.json', () => {
  it(`holds ${CALENDAR.daysGenerated} days made for the launch date in config`, () => {
    expect(file.days).toHaveLength(CALENDAR.daysGenerated);
    expect(dailyFileIsCurrent(file)).toBe(true);
  });

  it('every day is solvable, its par matches the solver, and it solves in under 2 seconds', () => {
    let slowest = 0;
    for (const island of file.days) {
      const puzzle = puzzleOfDaily(island);
      expect(validatePuzzle(puzzle).ok, `day ${island.day}`).toBe(true);
      const started = performance.now();
      const solved = solve(puzzle);
      let elapsed = performance.now() - started;
      // The limit is on the solver's own cost, not on how busy this machine is. One slow
      // reading may be noise (other tests run alongside), so a day that reads slow is timed
      // again and its best time counts: a solve that is truly slow is slow every time. The
      // deterministic bound on the work itself is the node count checked below.
      for (let retry = 0; retry < 3 && elapsed >= 2000; retry++) {
        const again = performance.now();
        solve(puzzle);
        elapsed = Math.min(elapsed, performance.now() - again);
      }
      slowest = Math.max(slowest, elapsed);
      expect(solved, `day ${island.day}`).toMatchObject({
        status: 'solved',
        par: island.par,
        solutionCountComplete: true,
      });
      expect(elapsed, `day ${island.day} solve time`).toBeLessThan(2000);
      if (solved.status !== 'solved') continue;
      expect(solved.solutionCount, `day ${island.day}`).toBeLessThanOrEqual(
        GENERATOR.maxMinimumSolutions
      );
      expect(solved.nodes, `day ${island.day}`).toBeLessThanOrEqual(
        GENERATOR.maxSolveNodes
      );
      // The stored difficulty is what the model gives today.
      expect(
        rateDifficulty(puzzle, solved, island.difficulty.factors.decoys).score,
        `day ${island.day}`
      ).toBe(island.difficulty.score);
    }
    expect(slowest).toBeLessThan(2000);
  }, 120_000);

  it('every stored solution is legal for a player, uses par pieces and lights everything', () => {
    for (const island of file.days) {
      const puzzle = puzzleOfDaily(island);
      expect(
        validatePlacements(puzzle, island.solution).ok,
        `day ${island.day}`
      ).toBe(true);
      expect(island.solution, `day ${island.day}`).toHaveLength(island.par);
      expect(trace(puzzle, island.solution).solved, `day ${island.day}`).toBe(
        true
      );
    }
  });

  it('no day has a lantern lit before the first piece', () => {
    for (const island of file.days) {
      expect(
        trace(puzzleOfDaily(island), []).litCount,
        `day ${island.day}`
      ).toBe(0);
    }
  });

  it('every day sits inside its weekday par band and difficulty band', () => {
    for (const island of file.days) {
      const template = GENERATOR.templates[island.weekday];
      expect(island.par, `day ${island.day}`).toBeGreaterThanOrEqual(
        template.par[0]
      );
      expect(island.par, `day ${island.day}`).toBeLessThanOrEqual(
        template.par[1]
      );
      expect(
        island.difficulty.score,
        `day ${island.day}`
      ).toBeGreaterThanOrEqual(template.difficulty[0]);
      expect(island.difficulty.score, `day ${island.day}`).toBeLessThanOrEqual(
        template.difficulty[1]
      );
    }
  });

  it('difficulty climbs from Monday to Saturday', () => {
    const order = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const;
    const medians = order.map((weekday) => {
      const scores = file.days
        .filter((island) => island.weekday === weekday)
        .map((island) => island.difficulty.score)
        .sort((a, b) => a - b);
      return scores[Math.floor(scores.length / 2)] ?? 0;
    });
    for (let i = 1; i < medians.length; i++) {
      expect(medians[i], `${order[i]} vs ${order[i - 1]}`).toBeGreaterThan(
        medians[i - 1] ?? 0
      );
    }
  });

  it('dates, weekdays and biomes match the calendar', () => {
    for (const island of file.days) {
      expect(island.date).toBe(dateOfDay(island.day));
      expect(island.weekday).toBe(weekdayOfDay(island.day));
      expect(island.biome).toBe(biomeOfDay(island.day));
    }
  });

  it('names are unique, two words, and Saturday par never exceeds 6', () => {
    expect(new Set(file.days.map((island) => island.name)).size).toBe(
      file.days.length
    );
    for (const island of file.days) {
      expect(island.name.split(' '), `day ${island.day}`).toHaveLength(2);
      expect(island.par).toBeLessThanOrEqual(6);
      expect(island.inventory.prisms).toBeLessThanOrEqual(2);
    }
  });

  it('is exactly what the generator produces today (spot check of four days)', () => {
    for (const day of [1, 7, 12, 30]) {
      const fresh = generateIsland(day);
      expect(fresh, `day ${day}`).not.toBeNull();
      if (fresh === null) continue;
      const stored = file.days[day - 1];
      expect(stored, `day ${day}`).toBeDefined();
      if (stored === undefined) continue;
      expect(toDailyIsland(fresh, stored.name)).toEqual(stored);
    }
  }, 120_000);
});
