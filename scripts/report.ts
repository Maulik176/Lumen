/**
 * npm run report               par and difficulty per weekday, from content/puzzles.json
 * npm run report -- --show 12  print day 12's island, its par solution and its difficulty factors
 * npm run report -- --verify   re-solve every day and time it
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Weekday } from '../src/shared/calendar';
import { GENERATOR, SOLVER } from '../src/shared/config';
import {
  FACTOR_KEYS,
  puzzleOfDaily,
  readDailyFile,
  type DailyIsland,
} from '../src/shared/daily';
import { solve } from '../src/shared/solve';
import { trace } from '../src/shared/trace';

const file = readDailyFile(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '..', 'content', 'puzzles.json'),
      'utf8'
    )
  )
);
const WEEK: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const median = (values: number[]): number => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function show(island: DailyIsland): void {
  const grid = island.rows.map((row) => row.split(''));
  for (const placement of island.solution) {
    const row = grid[placement.y];
    if (row === undefined) continue;
    row[placement.x] =
      placement.piece.kind === 'prism'
        ? '*'
        : placement.piece.orientation === 'slash'
          ? '╱'
          : '╲';
  }
  console.log(
    `\nLumen #${island.day} · ${island.name} · ${island.weekday} · ${island.date} · ${island.biome}`
  );
  console.log(
    `par ${island.par}, inventory ${island.inventory.mirrors} mirrors + ${island.inventory.prisms} prisms`
  );
  if (island.sourceColours.some((colour) => colour !== 'white'))
    console.log(`sun colours: ${island.sourceColours.join(', ')}`);
  console.log('\n  island        par solution (╱ ╲ mirrors, * prism)');
  island.rows.forEach((row, y) =>
    console.log(`  ${row.padEnd(12)}  ${(grid[y] ?? []).join('')}`)
  );
  console.log(`\n  difficulty ${island.difficulty.score}`);
  for (const key of FACTOR_KEYS) {
    console.log(
      `    ${key.padEnd(17)} ${String(island.difficulty.factors[key]).padStart(4)}  →  ${island.difficulty.points[key]} points`
    );
  }
  console.log(`  tries ${island.attempts}, solver nodes ${island.solveNodes}`);
}

const showIndex = process.argv.indexOf('--show');
if (showIndex >= 0) {
  const wanted = process.argv[showIndex + 1];
  const list =
    wanted === 'all'
      ? file.days
      : file.days.filter((island) => String(island.day) === wanted);
  if (list.length === 0)
    throw new Error(`No day ${wanted} in content/puzzles.json.`);
  list.forEach(show);
} else if (process.argv.includes('--verify')) {
  let slowest = 0;
  let slowestDay = 0;
  let wrong = 0;
  for (const island of file.days) {
    const puzzle = puzzleOfDaily(island);
    const started = performance.now();
    const result = solve(puzzle);
    const elapsed = performance.now() - started;
    if (elapsed > slowest) {
      slowest = elapsed;
      slowestDay = island.day;
    }
    const ok =
      result.status === 'solved' &&
      result.par === island.par &&
      trace(puzzle, island.solution).solved;
    if (!ok) {
      wrong++;
      console.log(
        `day ${island.day}: stored par ${island.par}, solver says ${result.status === 'solved' ? result.par : result.status}`
      );
    }
  }
  console.log(
    `${file.days.length} days re-solved. Mismatches: ${wrong}. Slowest: day ${slowestDay}, ${slowest.toFixed(0)} ms.`
  );
  if (wrong > 0) process.exitCode = 1;
} else {
  console.log(
    `content/puzzles.json: ${file.days.length} days from ${file.dayOne}\n`
  );
  console.log(
    'weekday    days  par band  par seen     difficulty band   min    med    max   tries  max nodes  in band'
  );
  for (const weekday of WEEK) {
    const islands = file.days.filter((island) => island.weekday === weekday);
    if (islands.length === 0) continue;
    const template = GENERATOR.templates[weekday];
    const pars = islands.map((island) => island.par);
    const scores = islands.map((island) => island.difficulty.score);
    const parCounts = [...new Set(pars)]
      .sort()
      .map((par) => `${par}x${pars.filter((value) => value === par).length}`);
    const inBand = islands.every(
      (island) =>
        island.par >= template.par[0] &&
        island.par <= template.par[1] &&
        island.difficulty.score >= template.difficulty[0] &&
        island.difficulty.score <= template.difficulty[1]
    );
    console.log(
      [
        weekday.padEnd(9),
        String(islands.length).padStart(5),
        `${template.par[0]}-${template.par[1]}`.padStart(9),
        parCounts.join(' ').padEnd(12),
        `${template.difficulty[0]}-${template.difficulty[1]}`.padStart(15),
        Math.min(...scores)
          .toFixed(1)
          .padStart(6),
        median(scores).toFixed(1).padStart(6),
        Math.max(...scores)
          .toFixed(1)
          .padStart(6),
        mean(islands.map((island) => island.attempts))
          .toFixed(0)
          .padStart(7),
        String(
          Math.max(...islands.map((island) => island.solveNodes))
        ).padStart(10),
        (inBand ? 'yes' : 'NO').padStart(8),
      ].join(' ')
    );
  }
  console.log('\naverage factor values per weekday');
  console.log(
    `weekday    ${FACTOR_KEYS.map((key) => key.slice(0, 9).padStart(10)).join('')}`
  );
  for (const weekday of WEEK) {
    const islands = file.days.filter((island) => island.weekday === weekday);
    if (islands.length === 0) continue;
    console.log(
      `${weekday.padEnd(9)}  ${FACTOR_KEYS.map((key) =>
        mean(islands.map((island) => island.difficulty.factors[key]))
          .toFixed(1)
          .padStart(10)
      ).join('')}`
    );
  }
  const nodes = Math.max(...file.days.map((island) => island.solveNodes));
  console.log(
    `\nLargest solve: ${nodes} nodes (limit for a published day ${GENERATOR.maxSolveNodes}; solver default ${SOLVER.nodeLimit}).`
  );
  const names = new Set(file.days.map((island) => island.name));
  console.log(`Names: ${names.size} distinct of ${file.days.length}.`);
}
