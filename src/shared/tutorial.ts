/**
 * The three small islands a first-time player meets, about ten seconds each:
 * place a mirror, turn a mirror, make a prism. One tile matters on each, and tapping it the
 * stated number of times lights every lantern.
 */
import { COPY } from './config';
import { piecesLeft, type PlayEvent, type PlayState } from './play';
import type { PuzzleText } from './puzzle-text';

export type TutorialHint = 'mirror' | 'turn' | 'prism';

export type TutorialStep = PuzzleText & {
  /** The one tile the lesson is about. */
  tap: { x: number; y: number };
  /** Taps on that tile that finish the island. */
  taps: number;
  /** The hint to show after 0, 1, 2... taps. The last one stays. */
  hints: TutorialHint[];
};

export const TUTORIAL: readonly TutorialStep[] = [
  {
    // One tap: the mirror sends the light north into the lantern.
    rows: ['..W.', '....', '>...', '....'],
    inventory: { mirrors: 1, prisms: 0 },
    sourceColours: [],
    tap: { x: 2, y: 2 },
    taps: 1,
    hints: ['mirror'],
  },
  {
    // The first tap sends the light the wrong way; the second turns the mirror.
    rows: ['....', '>...', '....', '..W.'],
    inventory: { mirrors: 1, prisms: 0 },
    sourceColours: [],
    tap: { x: 2, y: 1 },
    taps: 2,
    hints: ['mirror', 'turn'],
  },
  {
    // The third tap makes a prism: red goes left, green straight on, blue right.
    rows: ['..R..', '.....', '>...G', '.....', '..B..'],
    inventory: { mirrors: 1, prisms: 1 },
    sourceColours: [],
    tap: { x: 2, y: 2 },
    taps: 3,
    hints: ['mirror', 'turn', 'prism'],
  },
];

/**
 * The fourth island, "Your turn": no hint and no ghost hand. One mirror, turned once, lights it,
 * and the player has to find where. About ten seconds.
 */
export const TUTORIAL_SOLO: PuzzleText = {
  rows: ['....', '>...', '....', '.W..'],
  inventory: { mirrors: 2, prisms: 0 },
  sourceColours: [],
};

/**
 * The line under "Your turn", which has no hand and no Undo: how many mirrors are left, and once
 * they are all down without lighting the lantern, how to get one back, with "Start again"
 * offered. Before this, a tap on empty grass with nothing left looked like it did nothing.
 */
export function soloLine(
  state: PlayState,
  events: readonly PlayEvent[]
): { text: string; again: boolean } {
  const stuck = !state.light.solved && piecesLeft(state).mirrors === 0;
  if (events.some((event) => event.type === 'no-pieces-left'))
    return { text: COPY.tutorialSoloStuck, again: true };
  if (stuck) return { text: COPY.tutorialSoloNone, again: true };
  const left = piecesLeft(state).mirrors;
  return {
    text:
      left === 1
        ? COPY.tutorialSoloLeftOne
        : COPY.tutorialSoloLeft.replace('{count}', String(left)),
    again: false,
  };
}
