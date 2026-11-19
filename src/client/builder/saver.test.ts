import { describe, expect, it } from 'vitest';
import { delayedSave, type Timers } from './saver';

/** Timers the test moves by hand. */
function fakeTimers(): Timers & { run: () => void } {
  let waiting: (() => void) | null = null;
  return {
    set: (run) => {
      waiting = run;
      return 1;
    },
    clear: () => {
      waiting = null;
    },
    run: () => {
      const run = waiting;
      waiting = null;
      run?.();
    },
  };
}

describe('saving the draft', () => {
  it('waits for a pause in the changes, then saves once', () => {
    const timers = fakeTimers();
    let saves = 0;
    const saver = delayedSave(() => (saves += 1), 900, timers);
    saver.change();
    saver.change();
    expect(saves).toBe(0);
    timers.run();
    expect(saves).toBe(1);
  });

  it('an edit made just before closing is saved at once', () => {
    // Nov 19, iPhone: a tree placed under a second before closing was gone on reopening.
    const timers = fakeTimers();
    let saves = 0;
    const saver = delayedSave(() => (saves += 1), 900, timers);
    saver.change();
    saver.flush();
    expect(saves).toBe(1);
    // And not twice: the waiting save was the same one.
    timers.run();
    expect(saves).toBe(1);
  });

  it('closing with nothing new to save sends nothing', () => {
    const timers = fakeTimers();
    let saves = 0;
    const saver = delayedSave(() => (saves += 1), 900, timers);
    saver.flush();
    saver.change();
    timers.run();
    saver.flush();
    expect(saves).toBe(1);
  });
});
