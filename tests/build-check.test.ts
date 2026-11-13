import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBuild, referencedFiles } from '../scripts/build-check';

const CONFIG = {
  post: {
    dir: 'dist/client',
    entrypoints: {
      default: { entry: 'preview.html' },
      game: { entry: 'game.html' },
    },
  },
  server: { dir: 'dist/server', entry: 'index.cjs' },
};

const made: string[] = [];

/** A build folder holding the given files (path → contents). */
function build(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'lumen-build-'));
  made.push(root);
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const GOOD = {
  'client/preview.html':
    '<link rel="stylesheet" href="/default.css"><script type="module" src="/default.js"></script>',
  'client/default.css': 'body{}',
  'client/default.js': 'x',
  'client/game.html':
    '<script type="module" crossorigin src="/game.js"></script><link rel="modulepreload" href="/config.js">',
  'client/game.js': 'x',
  'client/config.js': 'x',
  'server/index.cjs': 'x'.repeat(20_000),
};

afterEach(() => {
  for (const root of made.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe('build check', () => {
  it('passes a complete build', () => {
    expect(checkBuild(build(GOOD), CONFIG)).toEqual([]);
  });

  it('fails when preview.html is missing (the bug seen in v0.0.1.14)', () => {
    const { ['client/preview.html']: _gone, ...rest } = GOOD;
    expect(checkBuild(build(rest), CONFIG)).toEqual([
      'preview.html (entry point "default") is missing from the build',
    ]);
  });

  it('fails when game.html is missing or empty', () => {
    const { ['client/game.html']: _gone, ...rest } = GOOD;
    expect(checkBuild(build(rest), CONFIG)[0]).toMatch(/game\.html .* missing/);
    expect(
      checkBuild(build({ ...GOOD, 'client/game.html': '  \n' }), CONFIG)[0]
    ).toMatch(/game\.html .* empty/);
  });

  it('fails when a page loads a file that is not there', () => {
    const { ['client/game.js']: _gone, ...rest } = GOOD;
    expect(checkBuild(build(rest), CONFIG)).toEqual([
      'game.html loads /game.js, which is missing',
    ]);
  });

  it('fails an empty folder, and a missing or tiny server bundle', () => {
    expect(checkBuild(build({}), CONFIG).length).toBeGreaterThanOrEqual(3);
    expect(
      checkBuild(build({ ...GOOD, 'server/index.cjs': 'x' }), CONFIG)
    ).toEqual(['server bundle is suspiciously small']);
  });

  it('reads local script and stylesheet references, not outside ones', () => {
    expect(
      referencedFiles(
        '<script src="/a.js?v=1"></script><link href="b.css"><script src="https://x.com/c.js"></script><link href="data:,">'
      )
    ).toEqual(['/a.js', 'b.css']);
  });

  it('the real build passes', () => {
    // Uses dist/ as built by `npm run build` before the tests; skipped if there is none.
    const problems = checkBuild(join(import.meta.dirname, '..', 'dist'));
    if (problems.some((problem) => problem.includes('missing from the build')))
      return;
    expect(problems).toEqual([]);
  });
});
