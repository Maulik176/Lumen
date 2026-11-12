/**
 * Checks on anything that arrives from outside: a player's placements, or a player-built island.
 * The server runs these before it believes or stores anything. The client never scores itself:
 * `scoreSubmission` recomputes pieces and lit lanterns from the placements alone.
 */
import { BOARD, SCORING } from './config';
import { trace } from './trace';
import {
  BEAM_COLOURS,
  DIRECTIONS,
  LANTERN_COLOURS,
  type Medal,
  type Placement,
  type Puzzle,
  type TraceResult,
} from './types';

export type PlacementProblem =
  | 'not-a-list'
  | 'malformed'
  | 'off-board'
  | 'not-placeable'
  | 'duplicate-tile'
  | 'too-many-mirrors'
  | 'too-many-prisms';

export type PlacementCheck =
  | { ok: true; placements: Placement[] }
  | { ok: false; problem: PlacementProblem; index: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read one untrusted value as a Placement, or null if it is not one. Extra fields are dropped. */
function readPlacement(value: unknown): Placement | null {
  if (!isRecord(value)) return null;
  const { x, y, piece } = value;
  if (typeof x !== 'number' || typeof y !== 'number' || !isRecord(piece))
    return null;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (piece['kind'] === 'prism') return { x, y, piece: { kind: 'prism' } };
  if (piece['kind'] === 'mirror') {
    const orientation = piece['orientation'];
    if (orientation === 'slash' || orientation === 'backslash') {
      return { x, y, piece: { kind: 'mirror', orientation } };
    }
  }
  return null;
}

/**
 * Check untrusted placements against a puzzle: shape, board bounds, legal tiles, one piece per
 * tile, and the day's inventory. Returns clean Placement objects on success.
 */
export function validatePlacements(
  puzzle: Puzzle,
  input: unknown
): PlacementCheck {
  if (!Array.isArray(input))
    return { ok: false, problem: 'not-a-list', index: -1 };
  const { width, height } = puzzle;
  const blocked = new Uint8Array(width * height);
  puzzle.terrain.forEach((terrain, tile) => {
    if (terrain !== 'grass') blocked[tile] = 1;
  });
  for (const thing of [
    ...puzzle.sources,
    ...puzzle.lanterns,
    ...puzzle.fixedMirrors,
  ]) {
    blocked[thing.y * width + thing.x] = 1;
  }

  const used = new Uint8Array(width * height);
  const placements: Placement[] = [];
  let mirrors = 0;
  let prisms = 0;

  for (let index = 0; index < input.length; index++) {
    const placement = readPlacement(input[index]);
    if (placement === null) return { ok: false, problem: 'malformed', index };
    const { x, y } = placement;
    if (x < 0 || y < 0 || x >= width || y >= height)
      return { ok: false, problem: 'off-board', index };
    const tile = y * width + x;
    if (blocked[tile] === 1)
      return { ok: false, problem: 'not-placeable', index };
    if (used[tile] === 1)
      return { ok: false, problem: 'duplicate-tile', index };
    used[tile] = 1;
    if (placement.piece.kind === 'prism') prisms++;
    else mirrors++;
    if (mirrors > puzzle.inventory.mirrors)
      return { ok: false, problem: 'too-many-mirrors', index };
    if (prisms > puzzle.inventory.prisms)
      return { ok: false, problem: 'too-many-prisms', index };
    placements.push(placement);
  }
  return { ok: true, placements };
}

export type SubmissionScore =
  | {
      ok: true;
      /** Every lantern lit. */
      solved: boolean;
      /** Pieces placed: the score. Fewer is better. */
      pieces: number;
      litCount: number;
      lanternCount: number;
      placements: Placement[];
      trace: TraceResult;
    }
  | { ok: false; problem: PlacementProblem; index: number };

/**
 * Validate and re-trace a submission. Anything the client claims about its own result is
 * ignored: the only input is the list of placements.
 */
export function scoreSubmission(
  puzzle: Puzzle,
  input: unknown
): SubmissionScore {
  const check = validatePlacements(puzzle, input);
  if (!check.ok) return check;
  const result = trace(puzzle, check.placements);
  return {
    ok: true,
    solved: result.solved,
    pieces: check.placements.length,
    litCount: result.litCount,
    lanternCount: puzzle.lanterns.length,
    placements: check.placements,
    trace: result,
  };
}

/** The medal for a solve. There is no failure state: any solve earns at least Spark. */
export function medalFor(pieces: number, par: number): Medal {
  if (pieces <= par + SCORING.lamplighterOverPar) return 'lamplighter';
  if (pieces <= par + SCORING.glowOverPar) return 'glow';
  return 'spark';
}

export type PuzzleProblem =
  | 'malformed'
  | 'bad-size'
  | 'bad-terrain'
  | 'bad-inventory'
  | 'no-sources'
  | 'too-many-sources'
  | 'no-lanterns'
  | 'too-many-lanterns'
  | 'off-board'
  | 'overlap'
  | 'not-on-grass'
  | 'bad-value';

export type PuzzleCheck =
  { ok: true; puzzle: Puzzle } | { ok: false; problem: PuzzleProblem };

function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Check an untrusted value (for example an island from the Island Builder) and return it as a
 * clean Puzzle. Structure only: whether it can be solved is the solver's job.
 */
export function validatePuzzle(input: unknown): PuzzleCheck {
  if (!isRecord(input)) return { ok: false, problem: 'malformed' };
  const { width, height, terrain, sources, lanterns, fixedMirrors, inventory } =
    input;
  if (!isWhole(width) || !isWhole(height))
    return { ok: false, problem: 'bad-size' };
  if (
    width < BOARD.minSize ||
    height < BOARD.minSize ||
    width > BOARD.maxSize ||
    height > BOARD.maxSize
  ) {
    return { ok: false, problem: 'bad-size' };
  }
  if (!Array.isArray(terrain) || terrain.length !== width * height)
    return { ok: false, problem: 'bad-terrain' };
  if (
    !Array.isArray(sources) ||
    !Array.isArray(lanterns) ||
    !Array.isArray(fixedMirrors)
  ) {
    return { ok: false, problem: 'malformed' };
  }
  if (!isRecord(inventory)) return { ok: false, problem: 'bad-inventory' };
  const mirrors = inventory['mirrors'];
  const prisms = inventory['prisms'];
  if (
    !isWhole(mirrors) ||
    !isWhole(prisms) ||
    mirrors < 0 ||
    prisms < 0 ||
    mirrors + prisms > width * height
  ) {
    return { ok: false, problem: 'bad-inventory' };
  }
  if (sources.length === 0) return { ok: false, problem: 'no-sources' };
  if (sources.length > BOARD.maxSources)
    return { ok: false, problem: 'too-many-sources' };
  if (lanterns.length === 0) return { ok: false, problem: 'no-lanterns' };
  if (lanterns.length > BOARD.maxLanterns)
    return { ok: false, problem: 'too-many-lanterns' };

  const clean: Puzzle = {
    width,
    height,
    terrain: [],
    sources: [],
    lanterns: [],
    fixedMirrors: [],
    inventory: { mirrors, prisms },
  };

  for (const ground of terrain) {
    if (
      ground === 'grass' ||
      ground === 'rock' ||
      ground === 'tree' ||
      ground === 'water'
    )
      clean.terrain.push(ground);
    else return { ok: false, problem: 'bad-terrain' };
  }

  const taken = new Uint8Array(width * height);
  const claim = (x: unknown, y: unknown): PuzzleProblem | null => {
    if (!isWhole(x) || !isWhole(y)) return 'bad-value';
    if (x < 0 || y < 0 || x >= width || y >= height) return 'off-board';
    const tile = y * width + x;
    if (taken[tile] === 1) return 'overlap';
    if (clean.terrain[tile] !== 'grass') return 'not-on-grass';
    taken[tile] = 1;
    return null;
  };

  for (const source of sources) {
    if (!isRecord(source)) return { ok: false, problem: 'malformed' };
    const { x, y } = source;
    const direction = DIRECTIONS.find((d) => d === source['direction']);
    const colour = BEAM_COLOURS.find((c) => c === source['colour']);
    if (direction === undefined || colour === undefined)
      return { ok: false, problem: 'bad-value' };
    const problem = claim(x, y);
    if (problem !== null) return { ok: false, problem };
    if (isWhole(x) && isWhole(y))
      clean.sources.push({ x, y, direction, colour });
  }
  for (const lantern of lanterns) {
    if (!isRecord(lantern)) return { ok: false, problem: 'malformed' };
    const { x, y } = lantern;
    const colour = LANTERN_COLOURS.find((c) => c === lantern['colour']);
    if (colour === undefined) return { ok: false, problem: 'bad-value' };
    const problem = claim(x, y);
    if (problem !== null) return { ok: false, problem };
    if (isWhole(x) && isWhole(y)) clean.lanterns.push({ x, y, colour });
  }
  for (const mirror of fixedMirrors) {
    if (!isRecord(mirror)) return { ok: false, problem: 'malformed' };
    const { x, y } = mirror;
    const orientation = mirror['orientation'];
    if (orientation !== 'slash' && orientation !== 'backslash')
      return { ok: false, problem: 'bad-value' };
    const problem = claim(x, y);
    if (problem !== null) return { ok: false, problem };
    if (isWhole(x) && isWhole(y))
      clean.fixedMirrors.push({ x, y, orientation });
  }

  return { ok: true, puzzle: clean };
}
