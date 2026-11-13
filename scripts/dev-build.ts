/**
 * The watch build that `devvit playtest` runs (devvit.json `scripts.dev`).
 *
 * Why it exists: playtest uploads whatever is in dist/ the moment anything there changes, and
 * Vite empties its output folder at the start of every rebuild. An upload that lands in that
 * window ships a build with no preview.html, and the post shows "Not Found: failed to get webview
 * assets". So:
 *  1. Vite builds into .build-staging/ instead of dist/.
 *  2. When staging has been quiet for a moment, the build is checked (scripts/build-check.ts).
 *  3. Only a build that passes is copied into dist/: each file written to a temporary name and
 *     renamed into place, pages last, nothing ever deleted. A failing build never reaches dist/,
 *     so playtest keeps serving the last good one.
 */
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { checkBuild } from './build-check';

const ROOT = resolve(import.meta.dirname, '..');
const STAGE = join(ROOT, '.build-staging');
const DIST = join(ROOT, 'dist');
/** Staging must be unchanged for this long before a build counts as finished. */
const QUIET_MS = 700;
const POLL_MS = 250;

mkdirSync(STAGE, { recursive: true });

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

/** A cheap fingerprint of everything in staging: names, sizes and modification times. */
function signature(): string {
  return walk(STAGE)
    .map((file) => {
      const info = statSync(file, { throwIfNoEntry: false });
      return info === undefined
        ? ''
        : `${relative(STAGE, file)}:${info.size}:${info.mtimeMs}`;
    })
    .sort()
    .join('|');
}

function sameContent(a: string, b: string): boolean {
  if (!existsSync(b)) return false;
  if (statSync(a).size !== statSync(b).size) return false;
  return readFileSync(a).equals(readFileSync(b));
}

/** Copy staging into dist: every file atomically, pages last, nothing removed. */
function publish(force: boolean): number {
  const files = walk(STAGE).sort(
    (a, b) => Number(a.endsWith('.html')) - Number(b.endsWith('.html'))
  );
  let written = 0;
  for (const source of files) {
    const target = join(DIST, relative(STAGE, source));
    if (!force && sameContent(source, target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    const temporary = `${target}.sync-${process.pid}`;
    copyFileSync(source, temporary);
    renameSync(temporary, target);
    written++;
  }
  return written;
}

const vite = spawn('npx', ['vite', 'build', '--watch'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, LUMEN_STAGE_DIR: STAGE },
});

let seen = '';
let changedAt = Date.now();
let published = '';
let reported = '';
let first = true;

const timer = setInterval(() => {
  const now = signature();
  if (now !== seen) {
    seen = now;
    changedAt = Date.now();
    return;
  }
  if (now === '' || now === published || Date.now() - changedAt < QUIET_MS)
    return;

  const problems = checkBuild(STAGE);
  if (problems.length > 0) {
    if (reported !== now) {
      reported = now;
      console.error(
        '\n[lumen] Build check FAILED; playtest keeps the last good build:'
      );
      for (const problem of problems) console.error(`  - ${problem}`);
    }
    return;
  }
  const written = publish(first);
  first = false;
  published = now;
  console.log(
    `[lumen] Build checked and published to dist/ (${written} file${written === 1 ? '' : 's'} changed).`
  );
}, POLL_MS);

const stop = (): void => {
  clearInterval(timer);
  vite.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', (code) => {
  clearInterval(timer);
  process.exit(code ?? 0);
});
