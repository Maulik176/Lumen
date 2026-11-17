/**
 * Renders the hand-made hero island (content/hero.json, never a daily island) large and lit at
 * dusk, with the interface hidden, for the Devpost thumbnail that shows real play: light leaving
 * a sun, turning at mirrors and a prism, lanterns lit. `build.mjs` lays the logo over it.
 *
 *   npm run debug                       (in another terminal)
 *   node content/brand/island.mjs       writes content/brand/island-render.png
 *   node content/brand/build.mjs        makes png/devpost-thumbnail-game-1500x1000.png
 *
 * Needs Google Chrome.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPage } from '../../scripts/shoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { taps } = JSON.parse(readFileSync(join(here, '../hero.json'), 'utf8'));
// Day 900 is the hero island on moss (scripts/hero.mjs serves 900 to 904, one per biome).
const DAY = 900;

await withPage(
  `http://localhost:5199/game.html?day=${DAY}&tutorial=0&calm=1&perf=1&hero=1`,
  { width: 1200, height: 900, scale: 2 },
  async (page) => {
    await page.run(
      `for (const rule of ['fixed', 'water', 'colour', 'mixed', 'sky']) localStorage.setItem('lumen.rule.' + rule, '1');
       localStorage.setItem('lumen.hints.done', '1');
       localStorage.setItem('lumen.tutorial.done', '1');
       fetch('/api/forget').then(() => location.reload()); 1`
    );
    await page.sleep(4500);
    await page.run(
      `for (const [x, y, n] of ${JSON.stringify(taps)}) for (let i = 0; i < n; i++) window.lumenTap(x, y);
       document.getElementById('hud').style.display = 'none'; 1`
    );
    await page.sleep(2500);
    await page.shot(join(here, 'island-render.png'));
  }
);
console.log('island-render.png');
