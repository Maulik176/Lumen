/**
 * Day numbers, dates and weekdays. Day 1 is the launch date; days roll over at 00:00 UTC.
 * Pure date arithmetic only: nothing here reads the clock.
 */
import { BIOMES, CALENDAR } from './config';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type Biome = (typeof BIOMES)[number];

/** Indexed by Date.getUTCDay(): 0 is Sunday. */
const WEEKDAYS: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const MS_PER_DAY = 86_400_000;

function dayOneMs(): number {
  const [year, month, date] = CALENDAR.dayOne.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/** The UTC date of a day number, as YYYY-MM-DD. */
export function dateOfDay(day: number): string {
  return new Date(dayOneMs() + (day - 1) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** The real UTC weekday of a day number. */
export function weekdayOfDay(day: number): Weekday {
  return (
    WEEKDAYS[new Date(dayOneMs() + (day - 1) * MS_PER_DAY).getUTCDay()] ??
    'monday'
  );
}

/** The moment a day begins: 00:00 UTC, in milliseconds since the epoch. */
export function dayStartMs(day: number): number {
  return dayOneMs() + (day - 1) * MS_PER_DAY;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Nov 29": a day number's date, short, for lines such as "Chosen for Sunday, Nov 29". */
export function monthDay(day: number): string {
  const date = new Date(dayStartMs(day));
  return `${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCDate()}`;
}

/** The day number that a moment in time (milliseconds since the epoch, UTC) falls on. */
export function dayAt(epochMs: number): number {
  return Math.floor((epochMs - dayOneMs()) / MS_PER_DAY) + 1;
}

/** Weeks run Monday to Sunday. Week 0 is the week that contains day 1. */
export function weekOfDay(day: number): number {
  const sinceMonday = (new Date(dayOneMs()).getUTCDay() + 6) % 7;
  return Math.floor((day - 1 + sinceMonday) / 7);
}

/** The biome changes every Monday and cycles through the list. */
export function biomeOfDay(day: number): Biome {
  const week = weekOfDay(day);
  return (
    BIOMES[((week % BIOMES.length) + BIOMES.length) % BIOMES.length] ?? 'moss'
  );
}

/** "Thursday" from 'thursday', for titles such as "Lumen #12 · Moss Steps · Thursday". */
export function weekdayLabel(weekday: Weekday): string {
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/**
 * For a newcomer arriving on a hard day: the most recent easier island (a Monday or Tuesday)
 * before `day`, or null when this is not a hard day or there is no such island yet.
 */
export function warmUpDay(day: number): number | null {
  const today = weekdayOfDay(day);
  if (today !== 'thursday' && today !== 'friday' && today !== 'saturday')
    return null;
  for (let earlier = day - 1; earlier >= 1 && earlier >= day - 7; earlier--) {
    const weekday = weekdayOfDay(earlier);
    if (weekday === 'tuesday' || weekday === 'monday') return earlier;
  }
  return null;
}
