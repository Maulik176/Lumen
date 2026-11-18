/**
 * The lines shown while the player's lantern rises after a ranked Lock in. The first time ever:
 * what the sky is. On a quiet night, when last night's lanterns are in the sky too: whether the
 * player was first tonight, and that the faint ones are last night's (Nov 18: the first player of
 * the night saw lanterns and thought others had already lit it). When both are due, the first
 * is short and the second follows by itself: no tap.
 */
import { COPY, SKY } from './config';

export type SkyNote = { text: string; ms: number };

export function releaseNotes(night: {
  /** Only a ranked solve sends a lantern up. */
  ranked: boolean;
  /** The player has never been told what the sky is. */
  firstEver: boolean;
  /** Last night's lanterns are in the sky (fewer than SKY.quietBelow tonight). */
  lastNightShown: boolean;
  /** Lanterns lit tonight, the player's own included. */
  tonight: number;
}): SkyNote[] {
  if (!night.ranked) return [];
  const notes: SkyNote[] = [];
  if (night.lastNightShown)
    notes.push({
      text:
        night.tonight <= 1
          ? COPY.skyQuietFirst
          : COPY.skyQuiet.replace('{count}', String(night.tonight)),
      ms: SKY.quietLineMs,
    });
  if (night.firstEver)
    notes.unshift({
      text: COPY.skyJoin,
      ms: notes.length > 0 ? SKY.joinLineQueuedMs : SKY.joinLineMs,
    });
  return notes;
}
