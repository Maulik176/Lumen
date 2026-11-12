/**
 * Compiled form of a puzzle and the one beam tracer everything else is built on.
 *
 * `trace.ts` wraps this for rendering and scoring; `solve.ts` calls it millions of times.
 * Nothing here allocates per trace: the caller owns a `Scratch` and reuses it.
 */
import { TRACE } from './config';
import type {
  BeamColour,
  Direction,
  LanternColour,
  MirrorOrientation,
  Puzzle,
} from './types';

/** What a tile is, as far as light is concerned. */
export const CELL_GRASS = 0;
/** Rock, tree or sun crystal: stops light. */
export const CELL_BLOCK = 1;
export const CELL_WATER = 2;
export const CELL_LANTERN = 3;

export const PIECE_NONE = 0;
export const PIECE_SLASH = 1;
export const PIECE_BACKSLASH = 2;
export const PIECE_PRISM = 3;

export const NORTH = 0;
export const EAST = 1;
export const SOUTH = 2;
export const WEST = 3;

export const WHITE = 0;
export const RED = 1;
export const GREEN = 2;
export const BLUE = 3;

/** Segment end codes, in the order of `SEGMENT_ENDS` in trace.ts. */
export const END_TURN = 0;
export const END_LANTERN = 1;
export const END_BLOCKED = 2;
export const END_EDGE = 3;
export const END_LOOP = 4;
export const END_CAP = 5;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

const DIRECTION_CODE: Record<Direction, number> = {
  north: NORTH,
  east: EAST,
  south: SOUTH,
  west: WEST,
};
const COLOUR_CODE: Record<BeamColour, number> = {
  white: WHITE,
  red: RED,
  green: GREEN,
  blue: BLUE,
};
const ORIENTATION_CODE: Record<MirrorOrientation, number> = {
  slash: PIECE_SLASH,
  backslash: PIECE_BACKSLASH,
};

const RED_BIT = 1 << RED;
const GREEN_BIT = 1 << GREEN;
const BLUE_BIT = 1 << BLUE;

/** Colour bits a lantern needs. 0 means "any beam at all" (a white lantern). */
const LANTERN_NEED: Record<LanternColour, number> = {
  white: 0,
  red: RED_BIT,
  green: GREEN_BIT,
  blue: BLUE_BIT,
  magenta: RED_BIT | BLUE_BIT,
  cyan: GREEN_BIT | BLUE_BIT,
  yellow: RED_BIT | GREEN_BIT,
};

export function directionCode(direction: Direction): number {
  return DIRECTION_CODE[direction];
}

export function colourCode(colour: BeamColour): number {
  return COLOUR_CODE[colour];
}

export function orientationCode(orientation: MirrorOrientation): number {
  return ORIENTATION_CODE[orientation];
}

/** Direction a mirror sends a beam. "/" swaps north with east and south with west; "\" the other pairs. */
export function reflect(pieceCode: number, direction: number): number {
  return pieceCode === PIECE_SLASH ? direction ^ 1 : 3 - direction;
}

export type Board = {
  width: number;
  height: number;
  tiles: number;
  /** CELL_* per tile. */
  cell: Uint8Array;
  /** PIECE_* of the fixed mirror on each tile, or PIECE_NONE. */
  fixed: Uint8Array;
  /** 1 where the player may place a piece: plain grass with nothing on it. */
  placeable: Uint8Array;
  /** Lantern index per tile, or -1. */
  lanternAt: Int16Array;
  lanternCount: number;
  /** Colour bits each lantern needs; 0 = any beam. */
  lanternNeed: Uint8Array;
  sourceCount: number;
  sourceTile: Int32Array;
  sourceDirection: Uint8Array;
  sourceColour: Uint8Array;
  stepCap: number;
};

/** Working memory for one trace. Reuse it between traces of the same board. */
export type Scratch = {
  /** Per tile and direction (tile x 4 + direction): bit per colour that has crossed. */
  visited: Uint8Array;
  /** Per lantern: bit per colour that has arrived. */
  received: Uint8Array;
  /**
   * Per tile and direction: the step number (1-based, counted across the whole trace) at which a
   * beam last entered that tile heading that way. 0 = never.
   */
  lastStep: Int32Array;
  /** Per tile: the step number at which any beam first entered it. 0 = never. */
  firstCross: Int32Array;
  stackTile: Int32Array;
  stackDirection: Uint8Array;
  stackColour: Uint8Array;
  steps: number;
  capped: boolean;
};

export type SegmentSink = (
  fromTile: number,
  toTile: number,
  direction: number,
  colour: number,
  end: number
) => void;

/**
 * Turn a puzzle into flat arrays. Throws RangeError if something sits off the board or two
 * things share a tile; `validatePuzzle` reports the same problems without throwing.
 */
export function compileBoard(puzzle: Puzzle): Board {
  const { width, height } = puzzle;
  const tiles = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new RangeError('Board size must be positive whole numbers.');
  }
  if (puzzle.terrain.length !== tiles) {
    throw new RangeError('Terrain length does not match the board size.');
  }

  const cell = new Uint8Array(tiles);
  const fixed = new Uint8Array(tiles);
  const placeable = new Uint8Array(tiles);
  const lanternAt = new Int16Array(tiles).fill(-1);
  const occupied = new Uint8Array(tiles);

  for (let i = 0; i < tiles; i++) {
    const terrain = puzzle.terrain[i];
    if (terrain === 'rock' || terrain === 'tree') cell[i] = CELL_BLOCK;
    else if (terrain === 'water') cell[i] = CELL_WATER;
    else cell[i] = CELL_GRASS;
    placeable[i] = terrain === 'grass' ? 1 : 0;
  }

  const claim = (x: number, y: number, what: string): number => {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= width ||
      y >= height
    ) {
      throw new RangeError(`${what} is off the board.`);
    }
    const tile = y * width + x;
    if (occupied[tile] === 1)
      throw new RangeError(`${what} shares a tile with something else.`);
    if (puzzle.terrain[tile] !== 'grass')
      throw new RangeError(`${what} must stand on grass.`);
    occupied[tile] = 1;
    placeable[tile] = 0;
    return tile;
  };

  const sourceCount = puzzle.sources.length;
  const sourceTile = new Int32Array(sourceCount);
  const sourceDirection = new Uint8Array(sourceCount);
  const sourceColour = new Uint8Array(sourceCount);
  puzzle.sources.forEach((source, index) => {
    const tile = claim(source.x, source.y, 'A sun crystal');
    cell[tile] = CELL_BLOCK;
    sourceTile[index] = tile;
    sourceDirection[index] = DIRECTION_CODE[source.direction];
    sourceColour[index] = COLOUR_CODE[source.colour];
  });

  const lanternCount = puzzle.lanterns.length;
  const lanternNeed = new Uint8Array(lanternCount);
  puzzle.lanterns.forEach((lantern, index) => {
    const tile = claim(lantern.x, lantern.y, 'A lantern');
    cell[tile] = CELL_LANTERN;
    lanternAt[tile] = index;
    lanternNeed[index] = LANTERN_NEED[lantern.colour];
  });

  puzzle.fixedMirrors.forEach((mirror) => {
    const tile = claim(mirror.x, mirror.y, 'A fixed mirror');
    fixed[tile] = ORIENTATION_CODE[mirror.orientation];
  });

  return {
    width,
    height,
    tiles,
    cell,
    fixed,
    placeable,
    lanternAt,
    lanternCount,
    lanternNeed,
    sourceCount,
    sourceTile,
    sourceDirection,
    sourceColour,
    stepCap: TRACE.stepCapFactor * tiles * 4 * 4,
  };
}

export function createScratch(board: Board): Scratch {
  // A beam only forks where white light first enters a prism from a given side: at most two new
  // beams per tile and direction, plus one starting beam per source.
  const stackSize = board.tiles * 8 + board.sourceCount + 1;
  return {
    visited: new Uint8Array(board.tiles * 4),
    received: new Uint8Array(board.lanternCount),
    lastStep: new Int32Array(board.tiles * 4),
    firstCross: new Int32Array(board.tiles),
    stackTile: new Int32Array(stackSize),
    stackDirection: new Uint8Array(stackSize),
    stackColour: new Uint8Array(stackSize),
    steps: 0,
    capped: false,
  };
}

/**
 * Trace every beam on `board` with the player's `pieces` (PIECE_* per tile).
 * Fills every field of `scratch` except the stack, which is working space.
 * If `sink` is given it is called once per straight run of light, in a fixed order.
 */
export function runTrace(
  board: Board,
  pieces: Uint8Array,
  scratch: Scratch,
  sink: SegmentSink | null
): void {
  const { width, height, cell, fixed, lanternAt, stepCap } = board;
  const {
    visited,
    received,
    lastStep,
    firstCross,
    stackTile,
    stackDirection,
    stackColour,
  } = scratch;
  visited.fill(0);
  received.fill(0);
  lastStep.fill(0);
  firstCross.fill(0);
  let steps = 0;
  scratch.capped = false;

  for (let s = 0; s < board.sourceCount; s++) {
    stackTile[0] = board.sourceTile[s] ?? 0;
    stackDirection[0] = board.sourceDirection[s] ?? 0;
    stackColour[0] = board.sourceColour[s] ?? 0;
    let top = 1;

    while (top > 0) {
      top--;
      let tile = stackTile[top] ?? 0;
      let direction = stackDirection[top] ?? 0;
      let colour = stackColour[top] ?? 0;
      let runStart = tile;

      for (;;) {
        const x = (tile % width) + (DX[direction] ?? 0);
        const y = ((tile / width) | 0) + (DY[direction] ?? 0);
        if (x < 0 || y < 0 || x >= width || y >= height) {
          if (sink !== null) sink(runStart, tile, direction, colour, END_EDGE);
          break;
        }
        const next = y * width + x;
        const kind = cell[next];
        if (kind === CELL_BLOCK) {
          if (sink !== null)
            sink(runStart, next, direction, colour, END_BLOCKED);
          break;
        }
        if (kind === CELL_LANTERN) {
          const lantern = lanternAt[next] ?? 0;
          received[lantern] = (received[lantern] ?? 0) | (1 << colour);
          if (sink !== null)
            sink(runStart, next, direction, colour, END_LANTERN);
          break;
        }
        const state = next * 4 + direction;
        const bit = 1 << colour;
        const seen = visited[state] ?? 0;
        if ((seen & bit) !== 0) {
          if (sink !== null) sink(runStart, next, direction, colour, END_LOOP);
          break;
        }
        visited[state] = seen | bit;
        steps++;
        lastStep[state] = steps;
        if (firstCross[next] === 0) firstCross[next] = steps;
        tile = next;
        if (steps >= stepCap) {
          if (sink !== null) sink(runStart, tile, direction, colour, END_CAP);
          scratch.steps = steps;
          scratch.capped = true;
          return;
        }

        const piece = (pieces[tile] ?? 0) | (fixed[tile] ?? 0);
        if (piece === PIECE_NONE) continue;
        if (piece === PIECE_PRISM) {
          // A coloured beam passes straight through a prism unchanged.
          if (colour !== WHITE) continue;
          // White splits: red turns left, green carries straight on, blue turns right.
          if (sink !== null) sink(runStart, tile, direction, colour, END_TURN);
          stackTile[top] = tile;
          stackDirection[top] = (direction + 1) & 3;
          stackColour[top] = BLUE;
          top++;
          stackTile[top] = tile;
          stackDirection[top] = (direction + 3) & 3;
          stackColour[top] = RED;
          top++;
          colour = GREEN;
          runStart = tile;
          continue;
        }
        if (sink !== null) sink(runStart, tile, direction, colour, END_TURN);
        direction = reflect(piece, direction);
        runStart = tile;
      }
    }
  }
  scratch.steps = steps;
}

/** Is lantern `index` lit, given the colour bits that reached it? */
export function lanternLit(
  board: Board,
  received: Uint8Array,
  index: number
): boolean {
  const need = board.lanternNeed[index] ?? 0;
  const got = received[index] ?? 0;
  return need === 0 ? got !== 0 : (got & need) === need;
}

/** True when the board has at least one lantern and all of them are lit. */
export function allLit(board: Board, received: Uint8Array): boolean {
  if (board.lanternCount === 0) return false;
  for (let i = 0; i < board.lanternCount; i++) {
    if (!lanternLit(board, received, i)) return false;
  }
  return true;
}
