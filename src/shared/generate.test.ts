import { describe, expect, it } from 'vitest';
import type { Weekday } from './calendar';
import { weekdayOfDay } from './calendar';
import { GENERATOR } from './config';
import { readDailyFile, toDailyIsland, puzzleOfDaily } from './daily';
import { generateIsland } from './generate';
import { nameIsland } from './names';
import { createRng } from './rng';
import { solve } from './solve';
import { trace } from './trace';
import { validatePuzzle } from './validate';

const WEEK: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** One day number for each weekday, so every template is exercised. Days 1 to 7 cover the week. */
const DAY_FOR: Record<Weekday, number> = {
  monday: 7,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

describe('generateIsland', () => {
  it('the sample days fall on the weekdays the test expects', () => {
    for (const weekday of WEEK)
      expect(weekdayOfDay(DAY_FOR[weekday])).toBe(weekday);
  });

  it.each(WEEK)(
    '%s: fits its template, is solvable at the stated par, and is not loose',
    (weekday) => {
      const template = GENERATOR.templates[weekday];
      const island = generateIsland(DAY_FOR[weekday]);
      expect(island).not.toBeNull();
      if (island === null) return;
      const { puzzle } = island;

      expect(island.weekday).toBe(weekday);
      expect(validatePuzzle(puzzle).ok).toBe(true);
      expect(template.sizes).toContain(puzzle.width);
      expect(puzzle.height).toBe(puzzle.width);
      expect(puzzle.sources.length).toBeGreaterThanOrEqual(template.sources[0]);
      expect(puzzle.sources.length).toBeLessThanOrEqual(template.sources[1]);
      expect(puzzle.lanterns.length).toBeGreaterThanOrEqual(
        template.lanterns[0]
      );
      expect(puzzle.lanterns.length).toBeLessThanOrEqual(
        template.lanterns[1] + template.mixedLanterns[1]
      );

      // Par band, and par is the solver's own answer.
      expect(island.par).toBeGreaterThanOrEqual(template.par[0]);
      expect(island.par).toBeLessThanOrEqual(template.par[1]);
      const solved = solve(puzzle);
      expect(solved).toMatchObject({
        status: 'solved',
        par: island.par,
        solutionCountComplete: true,
      });
      if (solved.status !== 'solved') return;
      expect(solved.solutionCount).toBeLessThanOrEqual(
        GENERATOR.maxMinimumSolutions
      );
      expect(solved.nodes).toBeLessThanOrEqual(GENERATOR.maxSolveNodes);
      expect(trace(puzzle, island.solution).solved).toBe(true);

      // Never solved, or even partly lit, before a piece is placed.
      expect(trace(puzzle, []).litCount).toBe(0);

      // Difficulty band.
      expect(island.difficulty.score).toBeGreaterThanOrEqual(
        template.difficulty[0]
      );
      expect(island.difficulty.score).toBeLessThanOrEqual(
        template.difficulty[1]
      );
      expect(island.difficulty.factors.decoys).toBeGreaterThanOrEqual(
        template.decoys[0]
      );

      // Inventory: par plus slack in mirrors; prisms are scarce.
      expect(puzzle.inventory.mirrors).toBe(island.par + GENERATOR.mirrorSlack);
      expect(puzzle.inventory.prisms).toBeLessThanOrEqual(
        template.builtPrisms[1]
      );
    }
  );

  it('gives the same island for the same day, every time', () => {
    const first = generateIsland(3);
    const second = generateIsland(3);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('gives different islands for different days of the same weekday', () => {
    const one = generateIsland(1);
    const eight = generateIsland(8);
    expect(JSON.stringify(one?.puzzle)).not.toBe(JSON.stringify(eight?.puzzle));
  });

  it('weekday rules: Monday has two suns, two lanterns and mirrors only; prism days need their prism; Friday has a mixed lantern', () => {
    const monday = generateIsland(DAY_FOR.monday);
    expect(monday?.puzzle.inventory.prisms).toBe(0);
    expect(monday?.puzzle.sources).toHaveLength(2);
    expect(monday?.puzzle.lanterns).toHaveLength(2);
    expect(monday?.puzzle.terrain).not.toContain('water');

    const wednesday = generateIsland(DAY_FOR.wednesday);
    expect(wednesday?.puzzle.inventory.prisms).toBe(1);
    expect(wednesday?.difficulty.factors.prismNeeded).toBe(1);

    const thursday = generateIsland(DAY_FOR.thursday);
    expect(thursday?.puzzle.terrain).toContain('water');

    const friday = generateIsland(DAY_FOR.friday);
    expect(friday?.difficulty.factors.mixedLanterns).toBeGreaterThanOrEqual(1);
  });

  it('can make a fallback island for another weekday, such as a generated Sunday', () => {
    const island = generateIsland(5, 'sunday');
    expect(island?.weekday).toBe('sunday');
    expect(island?.par).toBeLessThanOrEqual(GENERATOR.templates.sunday.par[1]);
  });

  it('Saturday par is never above 6', () => {
    expect(GENERATOR.templates.saturday.par[1]).toBe(6);
    for (const weekday of WEEK)
      expect(GENERATOR.templates[weekday].par[1]).toBeLessThanOrEqual(6);
  });
});

describe('daily islands', () => {
  it('survive the trip to the stored form and back, unchanged', () => {
    for (const day of [4, 5]) {
      const island = generateIsland(day);
      expect(island).not.toBeNull();
      if (island === null) continue;
      const stored = toDailyIsland(island, 'Test Name');
      const file = readDailyFile(
        JSON.parse(
          JSON.stringify({ version: 1, dayOne: '2026-11-24', days: [] })
        )
      );
      expect(file.days).toEqual([]);
      const back = puzzleOfDaily(stored);
      expect(back).toEqual(island.puzzle);
      expect(trace(back, stored.solution).solved).toBe(true);
    }
  });

  it('readDailyFile rejects a file that is not ours, out of order, or carries an illegal solution', () => {
    expect(() => readDailyFile(null)).toThrow();
    expect(() => readDailyFile({ version: 2, dayOne: 'x', days: [] })).toThrow(
      /version 1/
    );
    const island = generateIsland(1);
    if (island === null) throw new Error('day 1 must generate');
    const stored = JSON.parse(JSON.stringify(toDailyIsland(island, 'One')));
    expect(
      readDailyFile({ version: 1, dayOne: '2026-11-24', days: [stored] }).days
    ).toHaveLength(1);
    expect(() =>
      readDailyFile({
        version: 1,
        dayOne: '2026-11-24',
        days: [{ ...stored, day: 2 }],
      })
    ).toThrow(/1, 2, 3/);
    const cheat = {
      ...stored,
      solution: [{ x: 0, y: 0, piece: { kind: 'lens' } }],
    };
    expect(() =>
      readDailyFile({ version: 1, dayOne: '2026-11-24', days: [cheat] })
    ).toThrow(/solution/);
  });
});

describe('nameIsland', () => {
  it('never repeats a name and always gives two words', () => {
    const island = generateIsland(3);
    if (island === null) throw new Error('day 3 must generate');
    const taken = new Set<string>();
    const rng = createRng('names');
    const names = Array.from({ length: 120 }, () =>
      nameIsland(island.puzzle, 'moss', rng, taken)
    );
    expect(new Set(names).size).toBe(120);
    for (const name of names) expect(name.split(' ')).toHaveLength(2);
  });

  it('is the same for the same seed', () => {
    const island = generateIsland(3);
    if (island === null) throw new Error('day 3 must generate');
    const a = nameIsland(island.puzzle, 'snow', createRng('n'), new Set());
    const b = nameIsland(island.puzzle, 'snow', createRng('n'), new Set());
    expect(a).toBe(b);
  });
});
