import { describe, expect, it } from 'vitest';
import {
  isJourneyAction,
  isJourneyKind,
  journeyStep,
  NEW_JOURNEY,
  type JourneyCall,
  type JourneyMemory,
} from './journey';
import type { PlayEvent } from './play';

const mirror = { kind: 'mirror', orientation: 'slash' } as const;

describe('journeyStep', () => {
  it('follows the typical journey in JOURNEY_MAP.md', () => {
    // Steps 2 to 7 of the table; step 1 (App.Ready) and 8 (the completed end) are sent elsewhere.
    const steps: PlayEvent[][] = [
      [{ type: 'placed', x: 1, y: 1, piece: mirror }],
      [
        { type: 'placed', x: 2, y: 1, piece: mirror },
        { type: 'lit-more', lit: 1, total: 4 },
      ],
      [{ type: 'undone' }],
      [
        { type: 'placed', x: 2, y: 2, piece: mirror },
        { type: 'lit-more', lit: 3, total: 4 },
      ],
      [{ type: 'placed', x: 3, y: 2, piece: mirror }, { type: 'all-lit' }],
      [{ type: 'kept-refining' }],
      [{ type: 'cleared', x: 3, y: 2 }],
      [{ type: 'placed', x: 4, y: 2, piece: mirror }, { type: 'all-lit' }],
    ];
    let memory: JourneyMemory = NEW_JOURNEY;
    const calls: JourneyCall[] = [];
    for (const events of steps) {
      const step = journeyStep(memory, events);
      memory = step.memory;
      calls.push(...step.calls);
    }
    expect(calls).toEqual([
      { type: 'start' },
      { type: 'progress', progress: 0.25, action: 'lantern_lit' },
      { type: 'interaction', action: 'undo' },
      { type: 'progress', progress: 0.75, action: 'lantern_lit' },
      { type: 'progress', progress: 1, action: 'all_lit' },
      { type: 'interaction', action: 'keep_refining' },
    ]);
  });

  it('starts only once, and Reset is an interaction', () => {
    const first = journeyStep(NEW_JOURNEY, [
      { type: 'placed', x: 0, y: 0, piece: mirror },
    ]);
    const second = journeyStep(first.memory, [
      { type: 'placed', x: 1, y: 0, piece: mirror },
      { type: 'reset' },
    ]);
    expect(second.calls).toEqual([{ type: 'interaction', action: 'reset' }]);
  });

  it('knows only the fixed words', () => {
    expect(isJourneyKind('ranked')).toBe(true);
    expect(isJourneyKind('u/someone')).toBe(false);
    expect(isJourneyAction('tutorial_skip')).toBe(true);
    expect(isJourneyAction('anything else')).toBe(false);
  });
});
