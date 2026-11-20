/**
 * The rules of a play session, as a pure state machine. The 3D view and the HUD only draw what
 * this says; nothing about how the game behaves lives in rendering code.
 *
 *   tap empty grass      → mirror "/"            (or a prism, if only prisms are left)
 *   tap a "/" mirror     → mirror "\"
 *   tap a "\" mirror     → prism, if the day has one free; otherwise the tile is cleared
 *   tap a prism          → the tile is cleared
 *
 * Lighting every lantern locks nothing. The player is offered Lock in or Keep refining; Lock in
 * is the single ranked submission (PROMPT section 7, A1).
 */
import { RULES } from './config';
import { trace } from './trace';
import type { Piece, Placement, Puzzle, TraceResult } from './types';

export type PlayPhase =
  /** Placing and moving pieces. */
  | 'playing'
  /** Every lantern is lit and the "All lit" prompt is showing. */
  | 'prompt'
  /** The player chose Lock in. Nothing can change any more. */
  | 'locked';

export type PlayState = {
  puzzle: Puzzle;
  placements: Placement[];
  /** Earlier arrangements, oldest first, for Undo. */
  history: Placement[][];
  phase: PlayPhase;
  /** The light as it falls now. Recomputed on every change. */
  light: TraceResult;
  /** True after Keep refining, until the arrangement changes. A small Lock in stays on offer. */
  promptDismissed: boolean;
  /** Most lanterns lit at once so far, for progress reporting. Never goes down. */
  bestLit: number;
  /** What the first-time hints need to know. */
  everPlaced: boolean;
  everTurned: boolean;
};

export type PlayEvent =
  | { type: 'placed'; x: number; y: number; piece: Piece }
  | { type: 'turned'; x: number; y: number; piece: Piece }
  | { type: 'cleared'; x: number; y: number }
  | { type: 'no-pieces-left' }
  | { type: 'not-placeable' }
  | { type: 'undone' }
  | { type: 'reset' }
  | { type: 'lit-more'; lit: number; total: number }
  | { type: 'all-lit' }
  | { type: 'kept-refining' }
  | { type: 'locked' }
  | { type: 'nothing' };

export type PlayStep = { state: PlayState; events: PlayEvent[] };

export type PiecesLeft = { mirrors: number; prisms: number };

export function startPlay(puzzle: Puzzle): PlayState {
  return {
    puzzle,
    placements: [],
    history: [],
    phase: 'playing',
    light: trace(puzzle, []),
    promptDismissed: false,
    bestLit: 0,
    everPlaced: false,
    everTurned: false,
  };
}

export function piecesLeft(state: PlayState): PiecesLeft {
  const prisms = state.placements.filter(
    (placement) => placement.piece.kind === 'prism'
  ).length;
  const mirrors = state.placements.length - prisms;
  return {
    mirrors: state.puzzle.inventory.mirrors - mirrors,
    prisms: state.puzzle.inventory.prisms - prisms,
  };
}

/** True where the player may put a piece: plain grass with nothing standing on it. */
export function isPlaceable(puzzle: Puzzle, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) return false;
  if (puzzle.terrain[y * puzzle.width + x] !== 'grass') return false;
  const here = (thing: { x: number; y: number }): boolean =>
    thing.x === x && thing.y === y;
  return (
    !puzzle.sources.some(here) &&
    !puzzle.lanterns.some(here) &&
    !puzzle.fixedMirrors.some(here)
  );
}

/**
 * The tile a tap means. `fx`, `fy` are where the tap fell on the island, in tiles from its top
 * left corner (so 2.5, 0.5 is the middle of tile 2,0). A tap on a usable tile is that tile; a
 * tap on anything else goes to the nearest usable tile within `RULES.tapSnapTiles`, or nowhere.
 */
export function snapTile(
  puzzle: Puzzle,
  fx: number,
  fy: number
): { x: number; y: number } | null {
  const hereX = Math.floor(fx);
  const hereY = Math.floor(fy);
  if (isPlaceable(puzzle, hereX, hereY)) return { x: hereX, y: hereY };
  // On the island, a tap on a rock or water is taken at its word unless it barely grazes a
  // usable tile; just off the island, there is nothing else it could have meant.
  const onIsland =
    hereX >= 0 && hereY >= 0 && hereX < puzzle.width && hereY < puzzle.height;
  let best: { x: number; y: number } | null = null;
  let nearest: number = onIsland ? RULES.tapSnapInside : RULES.tapSnapTiles;
  for (let y = hereY - 1; y <= hereY + 1; y++) {
    for (let x = hereX - 1; x <= hereX + 1; x++) {
      if (!isPlaceable(puzzle, x, y)) continue;
      // Distance from the tap to the tile's nearest edge.
      const away = Math.hypot(
        Math.max(x - fx, 0, fx - (x + 1)),
        Math.max(y - fy, 0, fy - (y + 1))
      );
      if (away >= nearest) continue;
      nearest = away;
      best = { x, y };
    }
  }
  return best;
}

/** Apply a new arrangement and work out what the light did. */
function settle(
  state: PlayState,
  placements: Placement[],
  events: PlayEvent[],
  remember: boolean
): PlayStep {
  const light = trace(state.puzzle, placements);
  const wasSolved = state.light.solved;
  const next: PlayState = {
    ...state,
    placements,
    history: remember ? [...state.history, state.placements] : state.history,
    light,
    promptDismissed: false,
    phase: 'playing',
  };
  if (light.litCount > state.bestLit) {
    next.bestLit = light.litCount;
    if (!light.solved)
      events.push({
        type: 'lit-more',
        lit: light.litCount,
        total: light.lit.length,
      });
  }
  if (light.solved) {
    next.phase = 'prompt';
    if (!wasSolved) events.push({ type: 'all-lit' });
    if (RULES.autoLockInOnSolve) {
      next.phase = 'locked';
      events.push({ type: 'locked' });
    }
  }
  return { state: next, events };
}

/** The player tapped tile (x, y). */
export function tapTile(state: PlayState, x: number, y: number): PlayStep {
  if (state.phase === 'locked') return { state, events: [{ type: 'nothing' }] };
  if (!isPlaceable(state.puzzle, x, y))
    return { state, events: [{ type: 'not-placeable' }] };

  const index = state.placements.findIndex(
    (placement) => placement.x === x && placement.y === y
  );
  const existing = state.placements[index];
  const left = piecesLeft(state);
  const placements = state.placements.slice();

  if (existing === undefined) {
    let piece: Piece;
    if (left.mirrors > 0) piece = { kind: 'mirror', orientation: 'slash' };
    else if (left.prisms > 0) piece = { kind: 'prism' };
    else return { state, events: [{ type: 'no-pieces-left' }] };
    placements.push({ x, y, piece });
    return settle(
      { ...state, everPlaced: true },
      placements,
      [{ type: 'placed', x, y, piece }],
      true
    );
  }

  if (
    existing.piece.kind === 'mirror' &&
    existing.piece.orientation === 'slash'
  ) {
    const piece: Piece = { kind: 'mirror', orientation: 'backslash' };
    placements[index] = { x, y, piece };
    return settle(
      { ...state, everTurned: true },
      placements,
      [{ type: 'turned', x, y, piece }],
      true
    );
  }

  if (existing.piece.kind === 'mirror' && left.prisms > 0) {
    const piece: Piece = { kind: 'prism' };
    placements[index] = { x, y, piece };
    return settle(
      { ...state, everTurned: true },
      placements,
      [{ type: 'turned', x, y, piece }],
      true
    );
  }

  placements.splice(index, 1);
  return settle(state, placements, [{ type: 'cleared', x, y }], true);
}

/** Step back one change. */
export function undo(state: PlayState): PlayStep {
  if (state.phase === 'locked') return { state, events: [{ type: 'nothing' }] };
  const previous = state.history[state.history.length - 1];
  if (previous === undefined) return { state, events: [{ type: 'nothing' }] };
  const trimmed: PlayState = { ...state, history: state.history.slice(0, -1) };
  return settle(trimmed, previous, [{ type: 'undone' }], false);
}

/** Take every piece off the island. Undo brings them back. */
export function reset(state: PlayState): PlayStep {
  if (state.phase === 'locked' || state.placements.length === 0) {
    return { state, events: [{ type: 'nothing' }] };
  }
  return settle(state, [], [{ type: 'reset' }], true);
}

/** The player chose Keep refining at the "All lit" prompt. */
export function keepRefining(state: PlayState): PlayStep {
  if (state.phase !== 'prompt') return { state, events: [{ type: 'nothing' }] };
  return {
    state: { ...state, phase: 'playing', promptDismissed: true },
    events: [{ type: 'kept-refining' }],
  };
}

/** True when Lock in may be offered: every lantern is lit and nothing is locked yet. */
export function canLockIn(state: PlayState): boolean {
  return state.phase !== 'locked' && state.light.solved;
}

/** The player chose Lock in. This is the single ranked submission. */
export function lockIn(state: PlayState): PlayStep {
  if (!canLockIn(state)) return { state, events: [{ type: 'nothing' }] };
  return { state: { ...state, phase: 'locked' }, events: [{ type: 'locked' }] };
}

/** An island as it was locked in, for showing a stored result again. Nothing can be changed. */
export function lockedWith(puzzle: Puzzle, placements: Placement[]): PlayState {
  return {
    ...startPlay(puzzle),
    placements,
    light: trace(puzzle, placements),
    phase: 'locked',
    everPlaced: placements.length > 0,
    everTurned: placements.length > 0,
  };
}

/** A board picked up where it was left: the pieces back in place, still free to change. */
export function resumeWith(puzzle: Puzzle, placements: Placement[]): PlayState {
  const fresh = startPlay(puzzle);
  if (placements.length === 0) return fresh;
  return settle(
    { ...fresh, everPlaced: true, everTurned: true },
    placements,
    [],
    false
  ).state;
}

/** Which first-time hint to show, if any. */
export function hintFor(state: PlayState): 'place' | 'turn' | 'prism' | null {
  if (state.phase !== 'playing' || state.light.solved) return null;
  if (!state.everPlaced) return 'place';
  if (!state.everTurned) return 'turn';
  if (
    state.puzzle.inventory.prisms > 0 &&
    !state.placements.some((placement) => placement.piece.kind === 'prism')
  ) {
    return 'prism';
  }
  return null;
}
