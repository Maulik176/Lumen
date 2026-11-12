/**
 * The deterministic beam tracer: the single source of truth for where light goes.
 * The client draws from it; the server scores with it. Same inputs, same output, always.
 */
import {
  compileBoard,
  createScratch,
  lanternLit,
  orientationCode,
  PIECE_PRISM,
  runTrace,
  type Board,
} from './board';
import {
  BEAM_COLOURS,
  DIRECTIONS,
  type BeamColour,
  type BeamSegment,
  type Direction,
  type Placement,
  type Puzzle,
  type SegmentEnd,
  type TraceResult,
} from './types';

/** Indexed by the END_* codes in board.ts. */
const SEGMENT_ENDS: readonly SegmentEnd[] = [
  'turn',
  'lantern',
  'blocked',
  'edge',
  'loop',
  'cap',
];

const boardCache = new WeakMap<Puzzle, Board>();

/** Compiled board for a puzzle, cached per puzzle object. Treat puzzles as immutable. */
export function boardFor(puzzle: Puzzle): Board {
  const cached = boardCache.get(puzzle);
  if (cached !== undefined) return cached;
  const board = compileBoard(puzzle);
  boardCache.set(puzzle, board);
  return board;
}

/**
 * Lay placements onto a piece grid.
 * Throws RangeError for a placement off the board, on a tile that cannot hold a piece, or on a
 * tile already used. Run `validatePlacements` first on anything that came from a player.
 */
export function piecesFromPlacements(
  board: Board,
  placements: readonly Placement[]
): Uint8Array {
  const pieces = new Uint8Array(board.tiles);
  for (const placement of placements) {
    const { x, y } = placement;
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= board.width ||
      y >= board.height
    ) {
      throw new RangeError('A piece is off the board.');
    }
    const tile = y * board.width + x;
    if (board.placeable[tile] !== 1)
      throw new RangeError('A piece is on a tile that cannot hold one.');
    if (pieces[tile] !== 0) throw new RangeError('Two pieces share a tile.');
    pieces[tile] =
      placement.piece.kind === 'prism'
        ? PIECE_PRISM
        : orientationCode(placement.piece.orientation);
  }
  return pieces;
}

/** Trace all beams for a puzzle with the given pieces placed. */
export function trace(
  puzzle: Puzzle,
  placements: readonly Placement[]
): TraceResult {
  const board = boardFor(puzzle);
  const pieces = piecesFromPlacements(board, placements);
  const scratch = createScratch(board);
  const segments: BeamSegment[] = [];
  const { width } = board;

  runTrace(
    board,
    pieces,
    scratch,
    (fromTile, toTile, direction, colour, end) => {
      const dir: Direction = DIRECTIONS[direction] ?? 'north';
      const col: BeamColour = BEAM_COLOURS[colour] ?? 'white';
      segments.push({
        from: { x: fromTile % width, y: Math.floor(fromTile / width) },
        to: { x: toTile % width, y: Math.floor(toTile / width) },
        direction: dir,
        colour: col,
        end: SEGMENT_ENDS[end] ?? 'cap',
      });
    }
  );

  const lit: boolean[] = [];
  const received: BeamColour[][] = [];
  let litCount = 0;
  for (let i = 0; i < board.lanternCount; i++) {
    const isLit = lanternLit(board, scratch.received, i);
    lit.push(isLit);
    if (isLit) litCount++;
    const bits = scratch.received[i] ?? 0;
    received.push(BEAM_COLOURS.filter((_, code) => (bits & (1 << code)) !== 0));
  }

  return {
    segments,
    lit,
    received,
    litCount,
    solved: board.lanternCount > 0 && litCount === board.lanternCount,
    steps: scratch.steps,
    capped: scratch.capped,
  };
}
