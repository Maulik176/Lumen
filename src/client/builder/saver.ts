/**
 * Saving the Builder's draft: a little after the last change, so a burst of taps is one save,
 * and at once when the Builder closes or the page goes away, so the last edit is never lost.
 */

export type Timers = {
  set: (run: () => void, ms: number) => number;
  clear: (id: number) => void;
};

export type Saver = {
  /** Something changed: save once the changes pause. */
  change: () => void;
  /** Save now if anything is still waiting. */
  flush: () => void;
};

export function delayedSave(
  write: () => void,
  delayMs: number,
  timers: Timers
): Saver {
  let waiting: number | null = null;
  const flush = (): void => {
    if (waiting === null) return;
    timers.clear(waiting);
    waiting = null;
    write();
  };
  return {
    change: () => {
      if (waiting !== null) timers.clear(waiting);
      waiting = timers.set(() => {
        waiting = null;
        write();
      }, delayMs);
    },
    flush,
  };
}
