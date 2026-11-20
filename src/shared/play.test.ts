import { describe, expect, it } from 'vitest';
import {
  canLockIn,
  hintFor,
  isPlaceable,
  keepRefining,
  lockIn,
  lockedWith,
  piecesLeft,
  reset,
  resumeWith,
  snapTile,
  startPlay,
  tapTile,
  undo,
  type PlayEvent,
  type PlayState,
} from './play';
import { puzzleFromText } from './puzzle-text';
import type { Puzzle } from './types';

// Par 1: "/" at (3,2). One sun, one lantern, a rock and some water.
function island(mirrors = 2, prisms = 0): Puzzle {
  return puzzleFromText({
    rows: ['...W..', '.#.~..', '>.....'],
    inventory: { mirrors, prisms },
    sourceColours: [],
  });
}

function taps(
  state: PlayState,
  ...tiles: [number, number][]
): { state: PlayState; events: PlayEvent[] } {
  let current = state;
  const events: PlayEvent[] = [];
  for (const [x, y] of tiles) {
    const step = tapTile(current, x, y);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

const kinds = (events: PlayEvent[]): string[] =>
  events.map((event) => event.type);

describe('tap cycle', () => {
  it('empty grass → "/" → "\\" → cleared, on a day without prisms', () => {
    let state = startPlay(island());
    state = tapTile(state, 1, 2).state;
    expect(state.placements).toEqual([
      { x: 1, y: 2, piece: { kind: 'mirror', orientation: 'slash' } },
    ]);
    state = tapTile(state, 1, 2).state;
    expect(state.placements).toEqual([
      { x: 1, y: 2, piece: { kind: 'mirror', orientation: 'backslash' } },
    ]);
    state = tapTile(state, 1, 2).state;
    expect(state.placements).toEqual([]);
  });

  it('empty grass → "/" → "\\" → prism → cleared, on a day with a prism', () => {
    let state = tapTile(startPlay(island(2, 1)), 1, 2).state;
    const seen = [state.placements[0]?.piece];
    for (let i = 0; i < 3; i++) {
      state = tapTile(state, 1, 2).state;
      seen.push(state.placements[0]?.piece);
    }
    expect(seen).toEqual([
      { kind: 'mirror', orientation: 'slash' },
      { kind: 'mirror', orientation: 'backslash' },
      { kind: 'prism' },
      undefined,
    ]);
  });

  it('reports what happened', () => {
    const { events } = taps(
      startPlay(island(2, 1)),
      [1, 2],
      [1, 2],
      [1, 2],
      [1, 2]
    );
    expect(kinds(events)).toEqual(['placed', 'turned', 'turned', 'cleared']);
  });

  it.each([
    ['rock', 1, 1],
    ['water', 3, 1],
    ['the sun crystal', 0, 2],
    ['the lantern', 3, 0],
    ['off the island', 6, 0],
    ['off the island', 0, -1],
  ])('ignores a tap on %s', (_name, x, y) => {
    const state = startPlay(island());
    const step = tapTile(state, x, y);
    expect(step.state).toBe(state);
    expect(kinds(step.events)).toEqual(['not-placeable']);
    expect(isPlaceable(state.puzzle, x, y)).toBe(false);
  });
});

describe('inventory', () => {
  it('counts pieces left', () => {
    const { state } = taps(
      startPlay(island(3, 1)),
      [1, 2],
      [2, 2],
      [2, 2],
      [2, 2]
    );
    expect(piecesLeft(state)).toEqual({ mirrors: 2, prisms: 0 });
  });

  it('refuses a new piece when nothing is left, and says so', () => {
    const full = taps(startPlay(island(2, 0)), [1, 2], [2, 2]).state;
    const step = tapTile(full, 4, 2);
    expect(step.state).toBe(full);
    expect(kinds(step.events)).toEqual(['no-pieces-left']);
    expect(step.state.placements).toHaveLength(2);
  });

  it('still lets the player turn or remove pieces when nothing is left', () => {
    const full = taps(startPlay(island(2, 0)), [1, 2], [2, 2]).state;
    const turned = tapTile(full, 1, 2);
    expect(kinds(turned.events)).toEqual(['turned']);
    const cleared = tapTile(turned.state, 1, 2);
    expect(cleared.state.placements).toHaveLength(1);
    expect(piecesLeft(cleared.state).mirrors).toBe(1);
  });

  it('places a prism on empty grass when only a prism is left', () => {
    const state = taps(startPlay(island(1, 1)), [1, 2]).state;
    const step = tapTile(state, 2, 2);
    expect(step.state.placements[1]?.piece).toEqual({ kind: 'prism' });
  });

  it("skips the prism in the cycle once the day's prisms are used", () => {
    // The only prism is already on the island, so "\" goes straight to cleared.
    const state = taps(
      startPlay(island(2, 1)),
      [1, 2],
      [1, 2],
      [1, 2],
      [2, 2],
      [2, 2]
    ).state;
    expect(state.placements.map((placement) => placement.piece.kind)).toEqual([
      'prism',
      'mirror',
    ]);
    const step = tapTile(state, 2, 2);
    expect(kinds(step.events)).toEqual(['cleared']);
  });

  it('never exceeds the inventory however the player taps', () => {
    let state = startPlay(island(2, 1));
    for (let round = 0; round < 3; round++) {
      for (const x of [1, 2, 4, 5]) state = tapTile(state, x, 2).state;
    }
    const left = piecesLeft(state);
    expect(left.mirrors).toBeGreaterThanOrEqual(0);
    expect(left.prisms).toBeGreaterThanOrEqual(0);
  });
});

describe('undo and reset', () => {
  it('undo steps back one change at a time', () => {
    const { state } = taps(startPlay(island()), [1, 2], [1, 2], [2, 2]);
    const once = undo(state);
    expect(once.state.placements).toHaveLength(1);
    expect(once.state.placements[0]?.piece).toEqual({
      kind: 'mirror',
      orientation: 'backslash',
    });
    const twice = undo(once.state);
    expect(twice.state.placements[0]?.piece).toEqual({
      kind: 'mirror',
      orientation: 'slash',
    });
    const thrice = undo(twice.state);
    expect(thrice.state.placements).toEqual([]);
    expect(kinds(undo(thrice.state).events)).toEqual(['nothing']);
  });

  it('reset clears the island and undo brings it back', () => {
    const { state } = taps(startPlay(island()), [1, 2], [2, 2]);
    const cleared = reset(state);
    expect(cleared.state.placements).toEqual([]);
    expect(kinds(cleared.events)).toEqual(['reset']);
    expect(undo(cleared.state).state.placements).toHaveLength(2);
    expect(kinds(reset(cleared.state).events)).toEqual(['nothing']);
  });

  it('the light is always traced for the current arrangement', () => {
    const lit = tapTile(startPlay(island()), 3, 2).state;
    expect(lit.light.solved).toBe(true);
    expect(undo(lit).state.light.solved).toBe(false);
  });
});

describe('all lit, Keep refining and Lock in', () => {
  it('lighting every lantern shows the prompt and locks nothing', () => {
    const step = tapTile(startPlay(island()), 3, 2);
    expect(step.state.phase).toBe('prompt');
    expect(kinds(step.events)).toEqual(['placed', 'all-lit']);
    expect(canLockIn(step.state)).toBe(true);
    // Still free to change the island.
    expect(tapTile(step.state, 3, 2).state.phase).toBe('playing');
  });

  it('Keep refining dismisses the prompt but leaves Lock in on offer', () => {
    const prompt = tapTile(startPlay(island()), 3, 2).state;
    const kept = keepRefining(prompt);
    expect(kept.state.phase).toBe('playing');
    expect(kept.state.promptDismissed).toBe(true);
    expect(canLockIn(kept.state)).toBe(true);
    expect(kinds(kept.events)).toEqual(['kept-refining']);
  });

  it('the prompt returns when the island is solved again after a change', () => {
    let state = keepRefining(
      tapTile(startPlay(island(3, 0)), 3, 2).state
    ).state;
    // An extra piece that changes nothing: still solved, prompt shows again without a new all-lit.
    const extra = tapTile(state, 5, 2);
    expect(extra.state.phase).toBe('prompt');
    expect(kinds(extra.events)).toEqual(['placed']);
    // Break it, then fix it: all-lit fires again.
    state = tapTile(extra.state, 3, 2).state;
    expect(state.light.solved).toBe(false);
    const fixed = undo(state);
    expect(kinds(fixed.events)).toEqual(['undone', 'all-lit']);
  });

  it('Lock in is refused until every lantern is lit', () => {
    const state = tapTile(startPlay(island()), 1, 2).state;
    expect(canLockIn(state)).toBe(false);
    expect(lockIn(state).state.phase).toBe('playing');
  });

  it('Lock in commits, and nothing can change afterwards', () => {
    const locked = lockIn(tapTile(startPlay(island()), 3, 2).state);
    expect(locked.state.phase).toBe('locked');
    expect(kinds(locked.events)).toEqual(['locked']);
    for (const step of [
      tapTile(locked.state, 1, 2),
      undo(locked.state),
      reset(locked.state),
      lockIn(locked.state),
    ]) {
      expect(step.state).toBe(locked.state);
      expect(kinds(step.events)).toEqual(['nothing']);
    }
  });

  it('a player can refine below their first solve before locking in', () => {
    // Solve wastefully with two pieces, then remove the spare one and lock in with one.
    let state = taps(startPlay(island(3, 0)), [5, 2], [3, 2]).state;
    expect(state.phase).toBe('prompt');
    expect(state.placements).toHaveLength(2);
    state = keepRefining(state).state;
    state = taps(state, [5, 2], [5, 2]).state;
    expect(state.placements).toHaveLength(1);
    expect(state.phase).toBe('prompt');
    expect(lockIn(state).state.placements).toHaveLength(1);
  });
});

describe('progress and hints', () => {
  const two = (): Puzzle =>
    puzzleFromText({
      rows: ['..W.W.', '......', '>.....', '>.....'],
      inventory: { mirrors: 3, prisms: 0 },
      sourceColours: [],
    });

  it('reports each new high in lanterns lit, and never a lower one', () => {
    const first = tapTile(startPlay(two()), 2, 2);
    expect(first.events).toContainEqual({ type: 'lit-more', lit: 1, total: 2 });
    const removed = tapTile(tapTile(first.state, 2, 2).state, 2, 2);
    expect(removed.state.light.litCount).toBe(0);
    expect(removed.state.bestLit).toBe(1);
    const again = tapTile(removed.state, 2, 2);
    expect(kinds(again.events)).toEqual(['placed']);
  });

  it('first-time hints: place, then turn, then nothing', () => {
    let state = startPlay(island());
    expect(hintFor(state)).toBe('place');
    state = tapTile(state, 1, 2).state;
    expect(hintFor(state)).toBe('turn');
    state = tapTile(state, 1, 2).state;
    expect(hintFor(state)).toBeNull();
  });

  it('on a prism day the last hint is about the prism, until one is placed', () => {
    let state = taps(startPlay(island(2, 1)), [1, 2], [1, 2]).state;
    expect(hintFor(state)).toBe('prism');
    state = tapTile(state, 1, 2).state;
    expect(hintFor(state)).toBeNull();
  });

  it('no hint while the "All lit" prompt is showing', () => {
    expect(hintFor(tapTile(startPlay(island()), 3, 2).state)).toBeNull();
  });
});

describe('lockedWith', () => {
  it('shows a stored answer as locked, lit, and unchangeable', () => {
    const puzzle = island();
    const state = lockedWith(puzzle, [
      { x: 3, y: 2, piece: { kind: 'mirror', orientation: 'slash' } },
    ]);
    expect(state.phase).toBe('locked');
    expect(state.light.solved).toBe(true);
    expect(tapTile(state, 3, 2).state).toBe(state);
    expect(canLockIn(state)).toBe(false);
  });
});

describe('snapTile', () => {
  // Row 1 is ". # . ~ . ." and row 0 has a lantern at x = 3.
  const puzzle = island();
  it('keeps a tap that lands on a usable tile', () => {
    expect(snapTile(puzzle, 0.5, 1.5)).toEqual({ x: 0, y: 1 });
  });
  it('moves a tap that only grazes a rock or lantern onto the usable tile beside it', () => {
    expect(snapTile(puzzle, 1.08, 1.5)).toEqual({ x: 0, y: 1 });
    expect(snapTile(puzzle, 1.92, 1.5)).toEqual({ x: 2, y: 1 });
    expect(snapTile(puzzle, 3.08, 0.5)).toEqual({ x: 2, y: 0 });
    expect(snapTile(puzzle, 3.5, 0.8)).toBeNull();
    expect(snapTile(puzzle, 1.5, 1.5)).toBeNull();
  });
  it('a tap well inside a rock or water does nothing (Nov 20, iPhone)', () => {
    // A mirror appeared on the next tile when Maulik tapped a rock or water on purpose.
    expect(snapTile(puzzle, 1.25, 1.5)).toBeNull();
    expect(snapTile(puzzle, 1.75, 1.5)).toBeNull();
    expect(snapTile(puzzle, 3.3, 1.5)).toBeNull();
  });
  it('takes a tap just off the edge, and ignores one far off', () => {
    expect(snapTile(puzzle, -0.3, 2.5)).toBeNull();
    expect(snapTile(puzzle, 0.5, -0.3)).toEqual({ x: 0, y: 0 });
    expect(snapTile(puzzle, 0.5, -0.8)).toBeNull();
  });
});

describe('resumeWith', () => {
  it('puts the pieces back, lit as they were, and still playable', () => {
    const puzzle = island();
    const state = resumeWith(puzzle, [
      { x: 3, y: 2, piece: { kind: 'mirror', orientation: 'slash' } },
    ]);
    expect(state.light.solved).toBe(true);
    expect(state.phase).toBe('prompt');
    expect(canLockIn(state)).toBe(true);
    expect(undo(state).state).toBe(state);
    expect(resumeWith(puzzle, []).phase).toBe('playing');
  });
});
