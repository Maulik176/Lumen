/**
 * Phase 3 judge pass: a week on the local stand-in (real server code), then every screen the
 * Sunday pick touches, from four seats, checked from the words on screen, with screenshots.
 *
 *   npm run debug                      (or the app's preview)
 *   node scripts/sunday-pass.mjs [outDir] [430x701 360x460 1100x700]
 *
 * The week: three makers publish (p0's island is meant to win), votes differ, the pick runs
 * on Saturday 20:05 UTC, then a crowd plays Sunday (day 6), p0 among them as its maker. Exits
 * non-zero when a screen does not say what it should.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { withPage } from './shoot.mjs';

const BASE = process.env.LUMEN_LOCAL ?? 'http://localhost:5199';
const out = process.argv[2] ?? 'captures/phase3-judge';
const sizes = (
  process.argv.length > 3
    ? process.argv.slice(3)
    : ['430x701', '360x460', '1100x700']
).map((size) => size.split('x').map(Number));
mkdirSync(out, { recursive: true });

const api = async (path, user = 'x', at = '') =>
  (
    await fetch(`${BASE}${path}`, {
      headers: {
        referer: `${BASE}/game.html?user=${user}${at === '' ? '' : `&at=${at}`}`,
      },
    })
  ).json();

const failures = [];
const expectText = (tag, text, wanted) => {
  for (const word of wanted)
    if (!text.includes(word)) failures.push(`${tag}: no "${word}" on screen`);
};

// The week.
await api('/api/forget');
const MID = '2026-11-25T12:00:00Z';
const island = async (day, maker, name, at) =>
  (
    await api(
      `/api/dev/island?day=${day}&maker=${maker}&name=${encodeURIComponent(name)}&at=${at}`
    )
  ).day;
const winner = await island(8, 'p0', 'Cloud Steps', MID);
const second = await island(13, 'ana', 'Sleet Stair', '2026-11-25T13:00:00Z');
const third = await island(17, 'ben', 'Lantern Ford', '2026-11-25T14:00:00Z');
await api(`/api/dev/score?day=${winner}&score=9`, 'x', '2026-11-26T12:00:00Z');
await api(`/api/dev/score?day=${second}&score=5`, 'x', '2026-11-26T12:00:00Z');
await api(`/api/dev/score?day=${third}&score=3`, 'x', '2026-11-26T12:00:00Z');
const pick = await api('/api/dev/pick?day=6', 'x', '2026-11-28T20:05:00Z');
console.log(pick.line);
if (!pick.line.includes('by u/p0'))
  failures.push(`the pick did not choose p0's island: ${pick.line}`);
const log = (await api('/api/dev/log')).log;
console.log(log.map((line) => `  ${line}`).join('\n'));
if (!log.some((line) => line.startsWith('flair u/p0: Islandwright')))
  failures.push('no Islandwright flair for p0');
// Sunday, played: p0 is the maker; Saturday played too, so the map has something to show.
await api('/api/dev/crowd?day=6&players=7&seed=sunday&practice=0&maker=p0');
await api('/api/dev/crowd?day=7&players=4&seed=monday&practice=0');
const board = await api('/api/leaderboard?day=6');
const first = board.top[0].username;
const fromFirst = await api('/api/others?day=6', first);
const sameBoard = fromFirst.me.sameAs ?? null;
const otherBoard = fromFirst.top[0]?.username ?? null;

const clickText = (text) => `(() => {
  const node = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)});
  if (node) node.click();
  return Boolean(node);
})()`;
const until = (page, js, ms = 8000) =>
  page.run(`new Promise((done) => {
    const started = Date.now();
    const look = () => {
      const value = (${js});
      if (value || Date.now() - started > ${ms}) done(Boolean(value));
      else setTimeout(look, 150);
    };
    look();
  })`);
const visibleText = `document.body.innerText`;

for (const [width, height] of sizes) {
  const size = `${width}x${height}`;
  // The feed card of Sunday's post.
  await withPage(
    `${BASE}/preview.html?day=6&user=${first}`,
    { width, height: Math.min(height, 520) },
    async (page) => {
      await page.sleep(1500);
      const text = await page.run(visibleText);
      expectText(`feed card ${size}`, text, ['Island by u/p0', 'Cloud Steps']);
      await page.shot(join(out, `card-${size}.png`));
    }
  );
  // Four seats on Sunday: the result card, See others' islands, the board.
  const seats = [
    ['first', first],
    ['same-board', sameBoard],
    ['other-board', otherBoard],
    ['maker', 'p0'],
  ].filter(([, user]) => user !== null);
  for (const [label, user] of seats) {
    await withPage(
      `${BASE}/game.html?day=6&user=${user}&tutorial=0`,
      { width, height },
      async (page) => {
        const tag = `${label} u/${user} ${size}`;
        await until(
          page,
          `document.querySelector('.result')?.innerText.length > 0`
        );
        await page.sleep(1200);
        const card = await page.run(
          `document.querySelector('.result')?.innerText ?? ''`
        );
        const bar = await page.run(
          `document.querySelector('.bar-top')?.innerText ?? ''`
        );
        expectText(`${tag} top bar`, bar, ['Lumen #6', 'by u/p0']);
        if (label === 'maker')
          expectText(`${tag} result`, card, [
            'Your island',
            'Chosen by the community for Sunday',
            'not ranked',
            'Your streak goes on',
          ]);
        else
          expectText(`${tag} result`, card, [
            'Island by u/p0, chosen by the community',
          ]);
        await page.shot(join(out, `${label}-result-${size}.png`));
        await page.run(clickText("See others' islands"));
        await until(
          page,
          `document.querySelectorAll('.others-row').length > 0`
        );
        await page.sleep(1600);
        const list = await page.run(
          `[...document.querySelectorAll('.others-row')].map((r) => r.innerText).join('\\n')`
        );
        expectText(`${tag} others`, list, ["Maker's board", 'Your island']);
        await page.shot(join(out, `${label}-others-${size}.png`));
      }
    );
  }
  // The map: Nights with the maker's badge on Sunday, then Community with the pick.
  await withPage(
    `${BASE}/game.html?day=7&user=p1&tutorial=0&at=2026-11-30T12:00:00Z`,
    { width, height },
    async (page) => {
      const tag = `map ${size}`;
      await until(
        page,
        `document.querySelector('.result')?.innerText.length > 0`
      );
      await page.sleep(800);
      await page.run(clickText('Explore past islands'));
      await until(page, `document.querySelectorAll('.map-island').length > 0`);
      await page.sleep(1200);
      expectText(`${tag} nights`, await page.run(visibleText), [
        'by u/p0',
        'Nights',
        'Community',
      ]);
      await page.shot(join(out, `map-nights-${size}.png`));
      await page.run(clickText('Community'));
      await until(page, `document.querySelectorAll('.map-row').length > 0`);
      await page.sleep(800);
      expectText(
        `${tag} community`,
        await page.run(`document.querySelector('.map-shelf')?.innerText ?? ''`),
        ["Sunday's island", 'Cloud Steps', 'by u/p0', 'More islands, newest first']
      );
      await page.shot(join(out, `map-community-${size}.png`));
    }
  );
}

console.log(
  failures.length === 0
    ? '\nPhase 3 pass: every screen says what it should.'
    : `\n${failures.join('\n')}`
);
process.exit(failures.length === 0 ? 0 : 1);
