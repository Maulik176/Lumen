/**
 * A small text format for islands, used by hand-made fixtures, tests and the debug page.
 *
 *   .  grass        #  rock         T  tree         ~  water
 *   /  fixed mirror "/"             \  fixed mirror "\"
 *   ^ > v <  sun crystal facing north, east, south, west
 *   W R G B  white, red, green, blue lantern
 *   M C Y    magenta, cyan, yellow lantern
 *
 * Sun crystals are white unless `sourceColours` lists a colour for them, in reading order
 * (row by row, left to right).
 */
import {
  BEAM_COLOURS,
  type BeamColour,
  type Direction,
  type FixedMirror,
  type Inventory,
  type Lantern,
  type LanternColour,
  type Puzzle,
  type Source,
  type Terrain,
} from './types';

export type PuzzleText = {
  rows: string[];
  inventory: Inventory;
  sourceColours: BeamColour[];
};

/** A hand-made island with a par that was worked out by hand, not by the solver. */
export type Fixture = PuzzleText & {
  name: string;
  /** The reasoning behind the par, so a reader can check it. */
  note: string;
  par: number;
};

const SOURCE_CHARS: Record<string, Direction> = {
  '^': 'north',
  '>': 'east',
  'v': 'south',
  '<': 'west',
};
const LANTERN_CHARS: Record<string, LanternColour> = {
  W: 'white',
  R: 'red',
  G: 'green',
  B: 'blue',
  M: 'magenta',
  C: 'cyan',
  Y: 'yellow',
};
const TERRAIN_CHARS: Record<string, Terrain> = {
  '.': 'grass',
  '#': 'rock',
  'T': 'tree',
  '~': 'water',
};

const DIRECTION_CHAR: Record<Direction, string> = {
  north: '^',
  east: '>',
  south: 'v',
  west: '<',
};
const LANTERN_CHAR: Record<LanternColour, string> = {
  white: 'W',
  red: 'R',
  green: 'G',
  blue: 'B',
  magenta: 'M',
  cyan: 'C',
  yellow: 'Y',
};
const TERRAIN_CHAR: Record<Terrain, string> = {
  grass: '.',
  rock: '#',
  tree: 'T',
  water: '~',
};

/** Build a puzzle from rows of text. Throws Error with a plain message if the text is malformed. */
export function puzzleFromText(text: PuzzleText): Puzzle {
  const height = text.rows.length;
  const width = text.rows[0]?.length ?? 0;
  if (height === 0 || width === 0)
    throw new Error('An island needs at least one tile.');

  const terrain: Terrain[] = [];
  const sources: Source[] = [];
  const lanterns: Lantern[] = [];
  const fixedMirrors: FixedMirror[] = [];

  text.rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`Row ${y} is ${row.length} wide; expected ${width}.`);
    for (let x = 0; x < width; x++) {
      const char = row.charAt(x);
      const ground = TERRAIN_CHARS[char];
      const direction = SOURCE_CHARS[char];
      const lantern = LANTERN_CHARS[char];
      if (ground !== undefined) {
        terrain.push(ground);
        continue;
      }
      terrain.push('grass');
      if (direction !== undefined) {
        sources.push({
          x,
          y,
          direction,
          colour: text.sourceColours[sources.length] ?? 'white',
        });
      } else if (lantern !== undefined) {
        lanterns.push({ x, y, colour: lantern });
      } else if (char === '/') {
        fixedMirrors.push({ x, y, orientation: 'slash' });
      } else if (char === '\\') {
        fixedMirrors.push({ x, y, orientation: 'backslash' });
      } else {
        throw new Error(`Unknown tile "${char}" at ${x},${y}.`);
      }
    }
  });

  return {
    width,
    height,
    terrain,
    sources,
    lanterns,
    fixedMirrors,
    inventory: {
      mirrors: text.inventory.mirrors,
      prisms: text.inventory.prisms,
    },
  };
}

/** The reverse of `puzzleFromText`, for the debug page and for readable test failures. */
export function puzzleToRows(puzzle: Puzzle): string[] {
  const grid: string[][] = [];
  for (let y = 0; y < puzzle.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < puzzle.width; x++) {
      row.push(TERRAIN_CHAR[puzzle.terrain[y * puzzle.width + x] ?? 'grass']);
    }
    grid.push(row);
  }
  const put = (x: number, y: number, char: string): void => {
    const row = grid[y];
    if (row !== undefined && x >= 0 && x < row.length) row[x] = char;
  };
  for (const source of puzzle.sources)
    put(source.x, source.y, DIRECTION_CHAR[source.direction]);
  for (const lantern of puzzle.lanterns)
    put(lantern.x, lantern.y, LANTERN_CHAR[lantern.colour]);
  for (const mirror of puzzle.fixedMirrors)
    put(mirror.x, mirror.y, mirror.orientation === 'slash' ? '/' : '\\');
  return grid.map((row) => row.join(''));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBeamColour(value: unknown): value is BeamColour {
  return BEAM_COLOURS.some((colour) => colour === value);
}

function wholeNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${what} must be a whole number of 0 or more.`);
  }
  return value;
}

/** Check a parsed JSON value and return it as a Fixture. Throws Error if anything is missing. */
export function readFixture(value: unknown): Fixture {
  if (!isRecord(value)) throw new Error('A fixture must be an object.');
  const { name, note, par, rows, inventory, sourceColours } = value;
  if (typeof name !== 'string' || name.length === 0)
    throw new Error('A fixture needs a name.');
  if (typeof note !== 'string' || note.length === 0)
    throw new Error(`Fixture "${name}" needs a note.`);
  if (
    !Array.isArray(rows) ||
    !rows.every((row): row is string => typeof row === 'string')
  ) {
    throw new Error(`Fixture "${name}" needs rows of text.`);
  }
  if (!isRecord(inventory))
    throw new Error(`Fixture "${name}" needs an inventory.`);
  const colours: BeamColour[] = [];
  if (sourceColours !== undefined) {
    if (!Array.isArray(sourceColours))
      throw new Error(`Fixture "${name}": sourceColours must be a list.`);
    for (const colour of sourceColours) {
      if (!isBeamColour(colour))
        throw new Error(`Fixture "${name}": unknown source colour.`);
      colours.push(colour);
    }
  }
  return {
    name,
    note,
    par: wholeNumber(par, `Fixture "${name}" par`),
    rows,
    inventory: {
      mirrors: wholeNumber(inventory['mirrors'], `Fixture "${name}" mirrors`),
      prisms: wholeNumber(inventory['prisms'], `Fixture "${name}" prisms`),
    },
    sourceColours: colours,
  };
}
