import { describe, expect, it } from 'vitest';
import { weekdayOfDay } from './calendar';
import {
  advanceStreak,
  flairText,
  NEW_STREAK,
  styleFor,
  type StreakState,
} from './streak';

/** Solve on each listed day, in order. */
function run(days: number[], from: StreakState = NEW_STREAK): StreakState {
  return days.reduce((state, day) => advanceStreak(state, day), from);
}

describe('streaks', () => {
  it('counts days in a row', () => {
    expect(run([1]).streak).toBe(1);
    expect(run([1, 2, 3, 4]).streak).toBe(4);
  });

  it('solving the same day again changes nothing', () => {
    const state = run([1, 2]);
    expect(advanceStreak(state, 2)).toBe(state);
  });

  it('forgives one missed day in a week, and the missed day adds nothing', () => {
    // Day 7 is a Monday. Miss day 9 (Wednesday).
    expect(weekdayOfDay(7)).toBe('monday');
    const state = run([7, 8, 10]);
    expect(state.streak).toBe(3);
  });

  it('a second missed day in the same week breaks the streak', () => {
    // Miss Wednesday (9) and Friday (11) of the same week.
    expect(run([7, 8, 10, 12]).streak).toBe(1);
  });

  it('forgiveness returns the next week', () => {
    // Miss Wednesday day 9, then miss Wednesday day 16 a week later.
    expect(run([7, 8, 10, 11, 12, 13, 14, 15, 17]).streak).toBe(9);
  });

  it('two missed days in a row always break it', () => {
    expect(run([7, 8, 11]).streak).toBe(1);
  });

  it('a ten-day run with one forgiven day and then a break', () => {
    const state = run([7, 8, 9, 11, 12, 13, 14, 15, 16]);
    expect(state.streak).toBe(9);
    expect(state.best).toBe(9);
    const broken = advanceStreak(state, 20);
    expect(broken.streak).toBe(1);
    expect(broken.best).toBe(9);
  });

  it('unlocks lantern styles at 3, 7, 14 and 30 days', () => {
    expect([0, 2, 3, 6, 7, 13, 14, 29, 30, 99].map(styleFor)).toEqual([
      'plain',
      'plain',
      'paper',
      'paper',
      'star',
      'star',
      'koi',
      'koi',
      'comet',
      'comet',
    ]);
  });

  it('writes flair as medal and streak', () => {
    expect(flairText('Lamplighter', 12)).toBe('Lamplighter 🔥12');
  });
});
