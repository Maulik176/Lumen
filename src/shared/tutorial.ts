/**
 * The three small islands a first-time player meets, about ten seconds each:
 * place a mirror, turn a mirror, make a prism. One tile matters on each, and tapping it the
 * stated number of times lights every lantern.
 */
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
