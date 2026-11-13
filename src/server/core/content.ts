/**
 * The islands, read once from content/puzzles.json when the server starts.
 */
import raw from '../../../content/puzzles.json';
import { dayAt } from '../../shared/calendar';
import { readDailyFile, type DailyIsland } from '../../shared/daily';

const file = readDailyFile(raw);

export function islandForDay(day: number): DailyIsland | undefined {
  return file.days[day - 1];
}

export function lastDay(): number {
  return file.days.length;
}

/**
 * The day number for a moment in time, kept inside the days we have. Before launch this is day 1,
 * which is what a test post should show.
 */
export function dayNow(epochMs: number): number {
  return Math.min(lastDay(), Math.max(1, dayAt(epochMs)));
}
