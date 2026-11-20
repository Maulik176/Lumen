/**
 * Streaks: days in a row with a ranked solve. One missed day per week (Monday to Sunday, UTC) is
 * forgiven; a forgiven day keeps the streak alive but adds nothing to it.
 */
import { weekOfDay } from './calendar';
import { COPY, STREAK, type LanternStyle } from './config';
import type { Medal } from './types';

export type StreakState = {
  /** Current streak in days. 0 before the first ranked solve. */
  streak: number;
  /** Day number of the last ranked solve, or 0. */
  lastDay: number;
  /** Week number in which the forgiven day was used, or -1. */
  graceWeek: number;
  best: number;
};

export const NEW_STREAK: StreakState = {
  streak: 0,
  lastDay: 0,
  graceWeek: -1,
  best: 0,
};

/** The streak after a ranked solve on `day`. Solving the same day twice changes nothing. */
export function advanceStreak(state: StreakState, day: number): StreakState {
  if (state.lastDay === day) return state;
  let streak = 1;
  let graceWeek = state.graceWeek;
  const gap = day - state.lastDay;
  if (state.lastDay > 0 && gap === 1) {
    streak = state.streak + 1;
  } else if (state.lastDay > 0 && gap === 2 && STREAK.graceDaysPerWeek > 0) {
    // Exactly one day was missed. Forgive it if this week's forgiveness is unused.
    const missedWeek = weekOfDay(day - 1);
    if (state.graceWeek !== missedWeek) {
      streak = state.streak + 1;
      graceWeek = missedWeek;
    }
  }
  return {
    streak,
    lastDay: day,
    graceWeek,
    best: Math.max(state.best, streak),
  };
}

/** The sky-lantern style a streak has earned. */
export function styleFor(streak: number): LanternStyle {
  return STREAK.styles.find((entry) => streak >= entry.days)?.style ?? 'plain';
}

export function flairText(medalName: string, streak: number): string {
  return STREAK.flair
    .replace('{medal}', medalName)
    .replace('{streak}', String(streak));
}

/** A medal's name as players read it (flair, result card). */
export function medalName(medal: Medal): string {
  return medal === 'lamplighter'
    ? COPY.medalLamplighter
    : medal === 'glow'
      ? COPY.medalGlow
      : COPY.medalSpark;
}

/**
 * The whole flair: medal and streak, then "Islandwright" for the maker of a Sunday pick, which is
 * kept for good (PHASE3_PLAN.md E7). A maker with no daily medal yet reads "Islandwright". Empty
 * when there is nothing to show.
 */
export function flairFor(
  medal: string | null,
  streak: number,
  islandwright: boolean
): string {
  const base = medal === null ? '' : flairText(medal, streak);
  if (!islandwright) return base;
  return base === ''
    ? STREAK.islandwright
    : STREAK.flairIslandwright.replace('{flair}', base);
}
