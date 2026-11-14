/**
 * Renders the feed card's hero image for each biome from the real 3D scene: the hand-made
 * island in content/hero.json (never a daily island, so no answer is given away), solved and
 * lit at dusk, with the interface hidden. Run again whenever the look changes.
 *
 *   npm run debug     (in another terminal)
 *   npm run hero
 *
 * Needs Google Chrome and `cwebp`. Writes src/client/assets/hero/<biome>.webp, each under 60 KB.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withPage } from './shoot.mjs';

/** The hand-made hero island is served locally as days 900 to 904, one per biome. */
const BIOMES = ['moss', 'snow', 'blossom', 'dune', 'autumn'];
// Wide, so one picture covers a phone card (sides cropped) and a desktop card (whole).
const SIZE = { width: 1080, height: 480, scale: 2 };
const LIMIT = 60 * 1024;

const { taps } = JSON.parse(
  readFileSync(new URL('../content/hero.json', import.meta.url), 'utf8')
);
const out = new URL('../src/client/assets/hero/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

for (const [index, biome] of BIOMES.entries()) {
  const day = 900 + index;
  const png = join(tmpdir(), `lumen-hero-${biome}.png`);
  await withPage(
    `http://localhost:5199/game.html?day=${day}&tutorial=0&calm=1&perf=1&hero=1`,
    SIZE,
    async (page) => {
      await page.run(
        `for (const [x, y, n] of ${JSON.stringify(taps)}) for (let i = 0; i < n; i++) window.lumenTap(x, y);
         document.getElementById('hud').style.display = 'none'; 1`
      );
      await page.sleep(2500);
      await page.shot(png);
    }
  );
  const file = join(out, `${biome}.webp`);
  for (const quality of [78, 70, 62, 54, 46, 38]) {
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      String(quality),
      '-resize',
      '1080',
      '480',
      png,
      '-o',
      file,
    ]);
    if (statSync(file).size <= LIMIT) break;
  }
  rmSync(png);
  console.log(`${biome}: ${(statSync(file).size / 1024).toFixed(1)} KB`);
}
