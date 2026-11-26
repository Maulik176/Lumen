/**
 * Renders a feed card picture for every daily island (Phase 4, item 2): the island itself, from
 * the real 3D scene, unsolved (no pieces placed, lanterns unlit, only the suns' first straight
 * light), in the afternoon light a player first sees, with the interface hidden. Nothing of the
 * answer is shown: the same view the game opens on.
 *
 *   npm run debug          (in another terminal)
 *   npm run day-cards      (all days; or: npm run day-cards -- 3 4 5)
 *
 * Needs Google Chrome and `cwebp`. Writes src/client/assets/days/<day>.webp, each under 24 KB.
 * Run again whenever the look changes or `content/puzzles.json` is regenerated.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withPage } from './shoot.mjs';

const BASE = process.env.LUMEN_LOCAL ?? 'http://localhost:5199';
// The same frame as the stock pictures (npm run hero): one picture covers a phone card (sides
// cropped) and a desktop card (whole).
const SIZE = { width: 1080, height: 480, scale: 2 };
const LIMIT = 24 * 1024;

const puzzles = JSON.parse(
  readFileSync(new URL('../content/puzzles.json', import.meta.url), 'utf8')
);
const all = (Array.isArray(puzzles) ? puzzles : puzzles.days).map(
  (entry) => entry.day
);
const only = process.argv.slice(2).map(Number).filter(Number.isInteger);
const days = only.length > 0 ? only : all;
const out = new URL('../src/client/assets/days/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

for (const day of days) {
  const png = join(tmpdir(), `lumen-day-${day}.png`);
  await withPage(
    `${BASE}/game.html?day=${day}&tutorial=0&calm=1&user=cardpainter`,
    SIZE,
    async (page) => {
      // A fresh browser would show the one-time rule cards (and on a wide view the island moves
      // aside for them), and Thursday to Saturday a newcomer is offered a warm-up island.
      await page.run(
        `for (const rule of ['fixed', 'water', 'colour', 'mixed', 'sky']) localStorage.setItem('lumen.rule.' + rule, '1');
         localStorage.setItem('lumen.hints.done', '1');
         localStorage.setItem('lumen.tutorial.done', '1');
         location.reload(); 1`
      );
      await page.sleep(4000);
      await page.run(
        `for (const id of ['hud', 'cards', 'warmup']) { const node = document.getElementById(id); if (node) node.style.display = 'none'; }
         for (const node of document.querySelectorAll('.panel, .card, .notice')) node.style.display = 'none'; 1`
      );
      await page.sleep(1200);
      await page.shot(png);
    }
  );
  const file = join(out, `${day}.webp`);
  for (const quality of [72, 64, 56, 48, 40, 32]) {
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
  console.log(`day ${day}: ${(statSync(file).size / 1024).toFixed(1)} KB`);
}
