/**
 * The four-seat judge pass (CLAUDE.md, Nov 20). Seeds realistic crowds on the local stand-in,
 * which runs the real game code, then opens the game in headless Chrome as four players and
 * checks, from the text on screen, that "See others' islands" and the board account for every
 * player. Saves a screenshot of each list at each size.
 *
 *   npm run debug                         (in another terminal, or the app's preview)
 *   node scripts/seats.mjs [outDir] [430x701 360x460 1100x700]
 *
 * Seats: the player first on the board, a later player with the same board, a player with a
 * different board, and the maker of a community island who also played it. Exits non-zero when
 * any list leaves someone out or counts someone twice.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { withPage } from './shoot.mjs';

const BASE = process.env.LUMEN_LOCAL ?? 'http://localhost:5199';
const out = process.argv[2] ?? 'captures/seats';
const sizes = (
  process.argv.length > 3
    ? process.argv.slice(3)
    : ['430x701', '360x460', '1100x700']
).map((size) => size.split('x').map(Number));
mkdirSync(out, { recursive: true });

const api = async (path, user) =>
  (
    await fetch(`${BASE}${path}`, {
      headers: user ? { referer: `${BASE}/game.html?user=${user}` } : {},
    })
  ).json();

/** Polls the page until `js` is truthy, or gives up after `ms`. */
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

const clickText = (text) => `(() => {
  const node = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)});
  if (node) node.click();
  return Boolean(node);
})()`;

const hasText = (text) =>
  `[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(text)})`;

const readList = `[...document.querySelectorAll('.sheet-row')].map((row) => ({
  name: row.querySelector('.sheet-name')?.textContent ?? '',
  detail: row.querySelector('.sheet-detail')?.textContent ?? '',
  mine: row.classList.contains('mine'),
}))`;

/** Players a row of See others' islands stands for, from its text alone. */
function playersOn(row) {
  if (row.name === "Creator's board" || row.name === 'The par answer') return 0;
  const more = /same as (?:u\/\S+ and )?(\d+) others?/.exec(row.detail);
  if (row.mine) {
    if (/same as u\/\S+ and (\d+) others?/.test(row.detail))
      return 2 + Number(/and (\d+) other/.exec(row.detail)[1]);
    if (/same as u\/\S+$/.test(row.detail)) return 2;
    if (more) return 1 + Number(more[1]);
    return 1;
  }
  const group = /(\d+) players/.exec(row.detail);
  return group ? Number(group[1]) : 1;
}

const failures = [];

async function seat({ label, day, user, total, distinct }) {
  for (const [width, height] of sizes) {
    const url = `${BASE}/game.html?day=${day}&user=${user}&tutorial=0`;
    await withPage(url, { width, height }, async (page) => {
      const tag = `${label} (u/${user}) at ${width}x${height}`;
      if (!(await until(page, hasText("See others' islands")))) {
        failures.push(`${tag}: no "See others' islands" on the result card`);
        return;
      }
      await page.run(clickText("See others' islands"));
      await until(page, `document.querySelectorAll('.others-row').length > 0`);
      await page.sleep(1800);
      const rows = await page.run(readList);
      const title = await page.run(
        `document.querySelector('.sheet-title')?.textContent ?? ''`
      );
      const empty = await page.run(
        `[...document.querySelectorAll('.sheet-empty:not(.crowd-hint)')].map((n) => n.textContent).join(' ')`
      );
      await page.shot(join(out, `${label}-others-${width}x${height}.png`));
      const counted = rows.reduce((sum, row) => sum + playersOn(row), 0);
      const lines = rows.map(
        (row) => `${row.mine ? '*' : ' '} ${row.name} | ${row.detail}`
      );
      console.log(
        `\n${tag}: ${title}\n  ${lines.join('\n  ')}${empty ? `\n  (${empty})` : ''}`
      );
      if (distinct <= 11 && counted !== total)
        failures.push(
          `${tag}: the list accounts for ${counted} of ${total} players`
        );
      if (rows.filter((row) => row.mine).length !== 1)
        failures.push(`${tag}: "Your island" is not shown exactly once`);

      // The board, from the same result card.
      await page.run(clickText('Back'));
      await page.sleep(600);
      await page.run(`document.querySelector('.result-time')?.click()`);
      await until(page, `document.querySelectorAll('.board-row').length > 0`);
      await page.sleep(800);
      const board = await page.run(readList);
      await page.shot(join(out, `${label}-board-${width}x${height}.png`));
      const names = board.map((row) => row.name);
      if (new Set(names).size !== names.length)
        failures.push(`${tag}: a name twice on the board`);
      // The top ten, plus the player's own row when they are lower down.
      if (board.length < Math.min(10, total) || board.length > 11)
        failures.push(
          `${tag}: the board shows ${board.length} rows for ${total} players`
        );
      if (!names.includes(`u/${user}`))
        failures.push(`${tag}: the player is not on their own board`);
    });
  }
}

// A daily island: eight players, most with the par answer.
await api('/api/forget');
const daily = 1;
await api(`/api/dev/crowd?day=${daily}&players=8&seed=seats&practice=0`);
const board = await api(`/api/leaderboard?day=${daily}`);
const first = board.top[0].username;
const fromFirst = await api(`/api/others?day=${daily}`, first);
const sameBoard = fromFirst.me.sameAs
  ? (await api(`/api/leaderboard?day=${daily}`)).top.find(
      (row) => row.username !== first && row.pieces === fromFirst.me.pieces
    )?.username
  : null;
const different = fromFirst.top[0]?.username ?? null;
const distinct = 1 + fromFirst.top.length;

// A community island whose maker plays it too, like u/mohak2605's Blossom Island #3.
const made = await api(
  '/api/dev/island?day=2&maker=p0&biome=blossom&name=Blossom%20Hollow'
);
await api(`/api/dev/crowd?day=${made.day}&players=4&seed=blossom&practice=0`);
const islandBoard = await api(`/api/leaderboard?day=${made.day}`);
const fromMaker = await api(`/api/others?day=${made.day}`, 'p0');

const seats = [
  { label: '1-first', day: daily, user: first, total: board.total, distinct },
  sameBoard && {
    label: '2-same-board',
    day: daily,
    user: sameBoard,
    total: board.total,
    distinct,
  },
  different && {
    label: '3-other-board',
    day: daily,
    user: different,
    total: board.total,
    distinct,
  },
  {
    label: '4-maker',
    day: made.day,
    user: 'p0',
    total: islandBoard.total,
    distinct: 1 + (fromMaker.top?.length ?? 0),
  },
].filter(Boolean);

for (const one of seats) await seat(one);

console.log(
  failures.length === 0
    ? '\nFour seats: everyone accounted for.'
    : `\n${failures.join('\n')}`
);
process.exit(failures.length === 0 ? 0 : 1);
