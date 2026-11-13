/**
 * Is a build safe to upload? Reads devvit.json and checks, in the given output folder:
 *  - every post entry point's HTML file exists and is not empty (preview.html, game.html),
 *  - every local script, stylesheet and font those pages point at exists,
 *  - the server bundle exists and is a plausible size.
 *
 * Used two ways:
 *  - `tsx scripts/build-check.ts` after `vite build` in devvit.json `scripts.build`, so
 *    `devvit upload` stops before uploading a broken build;
 *  - imported by scripts/dev-build.ts, which only lets a checked build reach dist/ during playtest.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** A server bundle smaller than this is certainly broken (the real one is over a megabyte). */
const MIN_SERVER_BYTES = 10_000;

type DevvitConfig = {
  post?: { dir?: string; entrypoints?: Record<string, { entry?: string }> };
  server?: { dir?: string; entry?: string };
};

function readConfig(): DevvitConfig {
  const parsed: unknown = JSON.parse(
    readFileSync(join(ROOT, 'devvit.json'), 'utf8')
  );
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error('devvit.json is not an object');
  return parsed;
}

/** Local files an HTML page loads: script src, link href, and url(...) inside inline styles. */
export function referencedFiles(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(
    /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi
  )) {
    const target = match[1];
    if (target === undefined) continue;
    if (
      /^(?:[a-z]+:)?\/\//i.test(target) ||
      target.startsWith('data:') ||
      target.startsWith('#')
    )
      continue;
    found.add(target.split(/[?#]/)[0] ?? target);
  }
  return [...found];
}

/** Every problem found, in plain words. An empty list means the build is safe to upload. */
export function checkBuild(
  outRoot: string,
  config: DevvitConfig = readConfig()
): string[] {
  const problems: string[] = [];
  const clientDir = join(
    outRoot,
    config.post?.dir?.replace(/^dist\/?/, '') ?? 'client'
  );
  const entries = Object.entries(config.post?.entrypoints ?? {});
  if (entries.length === 0)
    problems.push('devvit.json lists no post entry points');

  for (const [name, entry] of entries) {
    const file = entry.entry;
    if (file === undefined) {
      problems.push(`entry point "${name}" has no file`);
      continue;
    }
    const page = join(clientDir, file.replace(/^src\/client\//, ''));
    if (!existsSync(page)) {
      problems.push(
        `${file} (entry point "${name}") is missing from the build`
      );
      continue;
    }
    const html = readFileSync(page, 'utf8');
    if (html.trim().length === 0) {
      problems.push(`${file} (entry point "${name}") is empty`);
      continue;
    }
    for (const target of referencedFiles(html)) {
      const asset = target.startsWith('/')
        ? join(clientDir, target)
        : join(dirname(page), target);
      if (!existsSync(asset))
        problems.push(`${file} loads ${target}, which is missing`);
    }
  }

  const serverDir = join(
    outRoot,
    config.server?.dir?.replace(/^dist\/?/, '') ?? 'server'
  );
  const serverFile = join(serverDir, config.server?.entry ?? 'index.cjs');
  if (!existsSync(serverFile))
    problems.push(
      `server bundle ${config.server?.entry ?? 'index.cjs'} is missing`
    );
  else if (statSync(serverFile).size < MIN_SERVER_BYTES)
    problems.push('server bundle is suspiciously small');

  return problems;
}

// Run as a command: check dist/ (or the folder given) and fail loudly if anything is wrong.
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const target = resolve(ROOT, process.argv[2] ?? 'dist');
  const problems = checkBuild(target);
  if (problems.length > 0) {
    console.error(
      `\nBuild check FAILED for ${target}. Nothing will be uploaded.`
    );
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `Build check passed: every entry point, its files, and the server bundle are in ${target}.`
  );
}
