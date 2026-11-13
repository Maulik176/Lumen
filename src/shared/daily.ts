/**
 * The published form of a day's island, as stored in content/puzzles.json, seeded into Redis and
 * read by the debug page. Compact text rows rather than a full Puzzle object.
 */
import { biomeOfDay, dateOfDay, type Biome, type Weekday } from './calendar';
import { BIOMES, CALENDAR } from './config';
import type { Difficulty, DifficultyFactors } from './difficulty';
import type { GeneratedIsland } from './generate';
import { puzzleFromText, puzzleToRows } from './puzzle-text';
import { validatePlacements } from './validate';
import {
  BEAM_COLOURS,
  type BeamColour,
  type Inventory,
  type Placement,
  type Puzzle,
} from './types';

export type DailyIsland = {
  day: number;
  /** UTC date, YYYY-MM-DD. */
  date: string;
  weekday: Weekday;
  biome: Biome;
  name: string;
  rows: string[];
  inventory: Inventory;
  sourceColours: BeamColour[];
  par: number;
  /** One minimum solution. Never sent to a client before the day has ended. */
  solution: Placement[];
  difficulty: Difficulty;
  /** Islands tried before this one fitted its weekday. */
  attempts: number;
  /** Search nodes the solver needed; about 5 microseconds each. */
  solveNodes: number;
};

export type DailyFile = {
  version: 1;
  dayOne: string;
  days: DailyIsland[];
};

export function toDailyIsland(
  island: GeneratedIsland,
  name: string
): DailyIsland {
  return {
    day: island.day,
    date: dateOfDay(island.day),
    weekday: island.weekday,
    biome: biomeOfDay(island.day),
    name,
    rows: puzzleToRows(island.puzzle),
    inventory: island.puzzle.inventory,
    sourceColours: island.puzzle.sources.map((source) => source.colour),
    par: island.par,
    solution: island.solution,
    difficulty: island.difficulty,
    attempts: island.attempts,
    solveNodes: island.solveNodes,
  };
}

const puzzleCache = new WeakMap<DailyIsland, Puzzle>();

/** The playable puzzle for a daily island. Cached per object. */
export function puzzleOfDaily(island: DailyIsland): Puzzle {
  const cached = puzzleCache.get(island);
  if (cached !== undefined) return cached;
  const puzzle = puzzleFromText(island);
  puzzleCache.set(island, puzzle);
  return puzzle;
}

const WEEKDAY_NAMES: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const FACTOR_KEYS: readonly (keyof DifficultyFactors)[] = [
  'par',
  'firstMoves',
  'minimumSolutions',
  'prismNeeded',
  'mixedLanterns',
  'decoys',
  'prismsAsTurns',
  'lanterns',
  'fixedMirrors',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function whole(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${what} must be a whole number of 0 or more.`);
  }
  return value;
}

function numberRecord(
  value: unknown,
  what: string
): Record<keyof DifficultyFactors, number> {
  if (!isRecord(value)) throw new Error(`${what} is missing.`);
  const read = (key: keyof DifficultyFactors): number => {
    const entry = value[key];
    if (typeof entry !== 'number' || !Number.isFinite(entry))
      throw new Error(`${what}.${key} must be a number.`);
    return entry;
  };
  return {
    par: read('par'),
    firstMoves: read('firstMoves'),
    minimumSolutions: read('minimumSolutions'),
    prismNeeded: read('prismNeeded'),
    mixedLanterns: read('mixedLanterns'),
    decoys: read('decoys'),
    prismsAsTurns: read('prismsAsTurns'),
    lanterns: read('lanterns'),
    fixedMirrors: read('fixedMirrors'),
  };
}

function readDailyIsland(value: unknown): DailyIsland {
  if (!isRecord(value)) throw new Error('A day must be an object.');
  const day = whole(value['day'], 'day');
  const what = `Day ${day}`;
  const { date, name, rows, inventory, sourceColours, difficulty } = value;
  const weekday = WEEKDAY_NAMES.find((entry) => entry === value['weekday']);
  const biome = BIOMES.find((entry) => entry === value['biome']);
  if (typeof date !== 'string' || typeof name !== 'string' || name.length === 0)
    throw new Error(`${what}: bad name or date.`);
  if (weekday === undefined || biome === undefined)
    throw new Error(`${what}: bad weekday or biome.`);
  if (
    !Array.isArray(rows) ||
    !rows.every((row): row is string => typeof row === 'string')
  ) {
    throw new Error(`${what}: rows must be text.`);
  }
  if (!isRecord(inventory)) throw new Error(`${what}: no inventory.`);
  if (!Array.isArray(sourceColours))
    throw new Error(`${what}: no source colours.`);
  const colours: BeamColour[] = [];
  for (const colour of sourceColours) {
    const known = BEAM_COLOURS.find((entry) => entry === colour);
    if (known === undefined) throw new Error(`${what}: unknown source colour.`);
    colours.push(known);
  }
  if (!isRecord(difficulty) || typeof difficulty['score'] !== 'number')
    throw new Error(`${what}: no difficulty.`);

  const text = {
    rows,
    inventory: {
      mirrors: whole(inventory['mirrors'], `${what} mirrors`),
      prisms: whole(inventory['prisms'], `${what} prisms`),
    },
    sourceColours: colours,
  };
  // The stored solution is checked against the island itself, with room for every piece.
  const puzzle = puzzleFromText(text);
  const roomy: Puzzle = {
    ...puzzle,
    inventory: {
      mirrors: puzzle.width * puzzle.height,
      prisms: puzzle.width * puzzle.height,
    },
  };
  const solution = validatePlacements(roomy, value['solution']);
  if (!solution.ok)
    throw new Error(
      `${what}: stored solution is not legal (${solution.problem}).`
    );

  return {
    day,
    date,
    weekday,
    biome,
    name,
    ...text,
    par: whole(value['par'], `${what} par`),
    solution: solution.placements,
    difficulty: {
      score: difficulty['score'],
      factors: numberRecord(difficulty['factors'], `${what} factors`),
      points: numberRecord(difficulty['points'], `${what} points`),
    },
    attempts: whole(value['attempts'], `${what} attempts`),
    solveNodes: whole(value['solveNodes'], `${what} solveNodes`),
  };
}

/** Check a parsed content/puzzles.json. Throws Error with a plain message if anything is off. */
export function readDailyFile(value: unknown): DailyFile {
  if (!isRecord(value) || value['version'] !== 1)
    throw new Error('Not a Lumen daily file (version 1).');
  const { dayOne, days } = value;
  if (typeof dayOne !== 'string')
    throw new Error('The daily file has no dayOne.');
  if (!Array.isArray(days)) throw new Error('The daily file has no days.');
  const read = days.map(readDailyIsland);
  read.forEach((island, index) => {
    if (island.day !== index + 1)
      throw new Error(
        `Days must run 1, 2, 3...; found ${island.day} at position ${index + 1}.`
      );
  });
  return { version: 1, dayOne, days: read };
}

/** True when the file was generated for the launch date now in config. */
export function dailyFileIsCurrent(file: DailyFile): boolean {
  return file.dayOne === CALENDAR.dayOne;
}

export { FACTOR_KEYS };
