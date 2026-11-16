/**
 * npm run gen -- --from 1 --to 90
 * Generates daily islands into content/puzzles.json. Days before --from are kept as they are.
 *
 * npm run gen -- --only 26,47,89
 * Regenerates just those days and keeps every other day exactly as stored (their names are
 * avoided, so no two islands share one). For replacing a few unplayed days.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { biomeOfDay } from '../src/shared/calendar';
import { CALENDAR } from '../src/shared/config';
import {
  readDailyFile,
  toDailyIsland,
  type DailyIsland,
} from '../src/shared/daily';
import { generateIsland } from '../src/shared/generate';
import { nameIsland } from '../src/shared/names';
import { createRng, daySeed } from '../src/shared/rng';

const FILE = join(import.meta.dirname, '..', 'content', 'puzzles.json');

function option(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`--${name} must be a whole number of 1 or more.`);
  return value;
}

const onlyAt = process.argv.indexOf('--only');
if (onlyAt >= 0) {
  const wanted = (process.argv[onlyAt + 1] ?? '')
    .split(',')
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1);
  if (wanted.length === 0)
    throw new Error('--only needs day numbers, such as --only 26,47,89.');
  const existing = readDailyFile(JSON.parse(readFileSync(FILE, 'utf8')));
  if (existing.dayOne !== CALENDAR.dayOne)
    throw new Error(
      'The existing file was made for a different launch date. Run from day 1.'
    );
  const replace = new Set(wanted);
  const others = existing.days.filter((island) => !replace.has(island.day));
  const taken = new Set(others.map((island) => island.name));
  const days = existing.days.map((island) => {
    if (!replace.has(island.day)) return island;
    const fresh = generateIsland(island.day);
    if (fresh === null)
      throw new Error(
        `Day ${island.day}: no island fitted its weekday within the attempt budget.`
      );
    const name = nameIsland(
      fresh.puzzle,
      biomeOfDay(island.day),
      createRng(`${daySeed(island.day)}-name`),
      taken
    );
    taken.add(name);
    const daily = toDailyIsland(fresh, name);
    console.log(
      `day ${island.day}: was "${island.name}" (par ${island.par}), now "${daily.name}" (par ${daily.par}, difficulty ${daily.difficulty.score.toFixed(1)}, ${daily.attempts} tries)`
    );
    return daily;
  });
  writeFileSync(
    FILE,
    `${JSON.stringify({ version: 1, dayOne: CALENDAR.dayOne, days }, null, 1)}\n`
  );
  console.log(
    `Replaced ${replace.size} days; kept ${others.length} as stored.`
  );
  process.exit(0);
}

const from = option('from', 1);
const to = option('to', CALENDAR.daysGenerated);

const kept: DailyIsland[] = [];
if (from > 1) {
  if (!existsSync(FILE))
    throw new Error(
      `--from ${from} needs an existing ${FILE} holding the earlier days.`
    );
  const existing = readDailyFile(JSON.parse(readFileSync(FILE, 'utf8')));
  if (existing.dayOne !== CALENDAR.dayOne)
    throw new Error(
      'The existing file was made for a different launch date. Run from day 1.'
    );
  kept.push(...existing.days.filter((island) => island.day < from));
  if (kept.length !== from - 1)
    throw new Error(`The existing file does not hold days 1 to ${from - 1}.`);
}

const taken = new Set(kept.map((island) => island.name));
const days: DailyIsland[] = kept.slice();
const started = performance.now();

for (let day = from; day <= to; day++) {
  const dayStarted = performance.now();
  const island = generateIsland(day);
  if (island === null)
    throw new Error(
      `Day ${day}: no island fitted its weekday within the attempt budget.`
    );
  const name = nameIsland(
    island.puzzle,
    biomeOfDay(day),
    createRng(`${daySeed(day)}-name`),
    taken
  );
  const daily = toDailyIsland(island, name);
  days.push(daily);
  const seconds = ((performance.now() - dayStarted) / 1000).toFixed(1);
  console.log(
    `day ${String(day).padStart(2)}  ${daily.weekday.padEnd(9)}  par ${daily.par}  difficulty ${daily.difficulty.score
      .toFixed(1)
      .padStart(
        5
      )}  tries ${String(daily.attempts).padStart(4)}  ${seconds.padStart(5)} s  ${daily.name}`
  );
}

const file = { version: 1, dayOne: CALENDAR.dayOne, days };
writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
console.log(
  `\nWrote ${days.length} days to content/puzzles.json in ${((performance.now() - started) / 1000).toFixed(1)} s.`
);
