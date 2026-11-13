import { describe, expect, it } from 'vitest';
import {
  biomeOfDay,
  dateOfDay,
  dayAt,
  weekdayLabel,
  weekdayOfDay,
  weekOfDay,
} from './calendar';
import { BIOMES, CALENDAR } from './config';

describe('calendar', () => {
  it('day 1 is the launch date', () => {
    expect(dateOfDay(1)).toBe(CALENDAR.dayOne);
    expect(dateOfDay(2)).toBe('2026-11-25');
    expect(dateOfDay(8)).toBe('2026-12-01');
    expect(dateOfDay(39)).toBe('2027-01-01');
  });

  it('uses the real UTC weekday, not day number modulo 7', () => {
    // Nov 24, 2026 is a Tuesday.
    expect(weekdayOfDay(1)).toBe('tuesday');
    expect(weekdayOfDay(5)).toBe('saturday');
    expect(weekdayOfDay(6)).toBe('sunday');
    expect(weekdayOfDay(7)).toBe('monday');
    expect(weekdayOfDay(90)).toBe('sunday');
  });

  it('rolls over at 00:00 UTC', () => {
    const dayOne = Date.UTC(2026, 10, 24);
    expect(dayAt(dayOne)).toBe(1);
    expect(dayAt(dayOne + 86_399_999)).toBe(1);
    expect(dayAt(dayOne + 86_400_000)).toBe(2);
    expect(dayAt(dayOne - 1)).toBe(0);
  });

  it('weeks run Monday to Sunday and the biome changes on Mondays', () => {
    expect(weekOfDay(1)).toBe(0);
    expect(weekOfDay(6)).toBe(0);
    expect(weekOfDay(7)).toBe(1);
    expect(biomeOfDay(6)).toBe(BIOMES[0]);
    expect(biomeOfDay(7)).toBe(BIOMES[1]);
    expect(biomeOfDay(13)).toBe(BIOMES[1]);
    expect(biomeOfDay(14)).toBe(BIOMES[2]);
    for (let day = 1; day <= 90; day++) {
      if (weekdayOfDay(day) !== 'monday' && day > 1)
        expect(biomeOfDay(day)).toBe(biomeOfDay(day - 1));
    }
  });

  it('cycles through every biome', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, index) => biomeOfDay(index + 1))
    );
    expect(seen.size).toBe(BIOMES.length);
  });

  it('labels weekdays for titles', () => {
    expect(weekdayLabel('thursday')).toBe('Thursday');
  });
});
