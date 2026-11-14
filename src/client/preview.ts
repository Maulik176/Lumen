/**
 * The feed card. It paints from the post's own data at once (no request, no Three.js): the
 * week's hero picture, today's island in outline, its name and the button. Then one small
 * request fills in the crowd and the player's own night.
 *
 * Once the player has locked in, the card says so and the button becomes "See tonight's sky";
 * "Light the lanterns" is never shown for a solved island.
 */
import { context, requestExpandedMode } from '@devvit/web/client';
import {
  readPostData,
  type CardResponse,
  type CardResult,
  type PostData,
} from '../shared/api';
import { biomeOfDay, weekdayLabel, type Biome } from '../shared/calendar';
import { CARD, COPY, UI } from '../shared/config';
import { recallSolved, rememberSolved } from './card-cache';

/** Rendered from the real 3D scene by `npm run hero`. Only the one in use is downloaded. */
const HERO: Record<Biome, string> = {
  moss: new URL('./assets/hero/moss.webp', import.meta.url).href,
  snow: new URL('./assets/hero/snow.webp', import.meta.url).href,
  blossom: new URL('./assets/hero/blossom.webp', import.meta.url).href,
  dune: new URL('./assets/hero/dune.webp', import.meta.url).href,
  autumn: new URL('./assets/hero/autumn.webp', import.meta.url).href,
};

/** Hand-drawn, single stroke, like the game's icons. Drawn on a 20 x 20 grid. */
const TICK = 'M4.2 10.6l3.9 3.900 7.800-8.700';
const FLAME =
  'M10 2.600c.6 3.100 4.600 4.700 4.600 9.100 0 3-2.100 5.300-4.600 5.300s-4.600-2.300-4.600-5.300c0-1.900.9-3.300 2-4.400.2 1.500.9 2.400 1.700 2.700-.3-2.500-.1-5.200.9-7.400z';

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`missing #${id}`);
  return node;
}

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  stroke.setAttribute('d', path);
  svg.append(stroke);
  return svg;
}

function text(tag: 'span' | 'b', value: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

const root = document.documentElement;
root.style.setProperty('--light', UI.light);
root.style.setProperty('--veil', UI.veil);
root.style.setProperty('--amber', UI.amber);
root.style.setProperty('--amber-ink', UI.amberInk);
root.style.setProperty('--night', UI.night);
root.style.setProperty('--night-soft', UI.nightSoft);
root.style.setProperty('--radius', `${UI.radiusPx}px`);

const card = byId('card');
const play = byId('play');
const how = byId('how');
const line = byId('line');
const crowd = byId('crowd');
how.textContent = COPY.howToPlay;

/**
 * Today's island in outline, seen from the same corner as the game: land as pale tiles, water
 * as gaps, a spark for each sun and a lantern for each lantern (lit once the player has solved it).
 */
function drawOutline(rows: readonly string[], lit: boolean): void {
  const canvas = document.getElementById('outline');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ratio = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.width = `${CARD.outlineWidth}px`;
  canvas.style.height = `${CARD.outlineHeight}px`;
  canvas.width = CARD.outlineWidth * ratio;
  canvas.height = CARD.outlineHeight * ratio;
  canvas.setAttribute('aria-label', COPY.cardOutline);
  const pen = canvas.getContext('2d');
  if (pen === null) return;
  pen.scale(ratio, ratio);
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width === 0) return;
  // Each tile is a flat diamond; the whole island is fitted inside the canvas with a margin.
  const half = Math.min(
    (CARD.outlineWidth - 14) / (width + height),
    ((CARD.outlineHeight - 16) / (width + height)) * 2
  );
  const rise = half / 2;
  const left = CARD.outlineWidth / 2 + ((height - width) * half) / 2;
  const top = (CARD.outlineHeight - (width + height) * rise) / 2 + 2;
  const at = (x: number, y: number): [number, number] => [
    left + (x - y) * half,
    top + (x + y) * rise,
  ];
  const lights: { x: number; y: number; sun: boolean }[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      const [cx, cy] = at(x, y);
      if (tile !== '~') {
        pen.beginPath();
        pen.moveTo(cx, cy);
        pen.lineTo(cx + half, cy + rise);
        pen.lineTo(cx, cy + rise * 2);
        pen.lineTo(cx - half, cy + rise);
        pen.closePath();
        pen.globalAlpha =
          tile === '#' || tile === 'T' ? 0.5 : (x + y) % 2 ? 0.8 : 0.9;
        pen.fillStyle = UI.light;
        pen.fill();
      }
      if ('WRGBMCY'.includes(tile)) lights.push({ x, y, sun: false });
      if ('^>v<'.includes(tile)) lights.push({ x, y, sun: true });
    });
  });
  for (const light of lights) {
    const [cx, top0] = at(light.x, light.y);
    const cy = top0 + rise - 1;
    pen.globalAlpha = 1;
    if (light.sun) {
      pen.fillStyle = UI.paper;
      pen.beginPath();
      pen.arc(cx, cy, 2.1, 0, Math.PI * 2);
      pen.fill();
      continue;
    }
    if (lit) {
      const glow = pen.createRadialGradient(cx, cy, 0, cx, cy, 8);
      glow.addColorStop(0, UI.amber);
      glow.addColorStop(1, 'transparent');
      pen.fillStyle = glow;
      pen.globalAlpha = 0.9;
      pen.fillRect(cx - 8, cy - 8, 16, 16);
      pen.globalAlpha = 1;
    }
    pen.beginPath();
    pen.arc(cx, cy, 2.9, 0, Math.PI * 2);
    pen.fillStyle = lit ? UI.amber : UI.ink;
    pen.fill();
    pen.lineWidth = 1.3;
    pen.strokeStyle = UI.amber;
    pen.stroke();
  }
}

function hoursAndMinutes(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** The post's own data. Outside Reddit (local checks) there is none, and the server is asked. */
function ownPost(): PostData | null {
  try {
    return readPostData(context.postData);
  } catch {
    return null;
  }
}

let post: PostData | null = ownPost();
let solved: CardResult | null = post === null ? null : recallSolved(post.day);
let skyCount: number | null = null;
/** When the next island arrives, on this page's own clock. */
let nextAt: number | null = null;
let known = solved !== null;
let heroSet = false;

function paint(): void {
  if (post === null) {
    byId('name').textContent = 'Lumen';
    return;
  }
  byId('kicker').textContent = COPY.cardKicker
    .replace('{day}', String(post.day))
    .replace('{weekday}', weekdayLabel(post.weekday))
    .replace('{par}', String(post.par));
  byId('name').textContent = post.name;
  if (!heroSet) {
    heroSet = true;
    const hero = byId('hero');
    if (hero instanceof HTMLImageElement) {
      hero.addEventListener('load', () => hero.classList.add('shown'));
      hero.src = HERO[biomeOfDay(post.day)];
    }
  }
  if (post.rows !== undefined) drawOutline(post.rows, solved !== null);

  card.classList.toggle('solved', solved !== null);
  play.classList.toggle('waiting', !known);
  play.textContent = solved === null ? COPY.playButton : COPY.cardSeeSky;

  if (solved === null) {
    line.replaceChildren(text('span', COPY.previewGoal));
  } else {
    const parts: Node[] = [
      icon(TICK),
      text(
        'span',
        COPY.cardSolved
          .replace(
            '{pieces}',
            solved.pieces === 1 ? '1 piece' : `${solved.pieces} pieces`
          )
          .replace('{par}', String(solved.par))
      ),
    ];
    if (solved.rank > 0)
      parts.push(
        text('span', '·'),
        text('b', COPY.cardRank.replace('{rank}', String(solved.rank)))
      );
    if (solved.streak > 1)
      parts.push(
        text('span', '·'),
        icon(FLAME),
        text('b', String(solved.streak))
      );
    line.replaceChildren(...parts);
  }

  const words: string[] = [];
  if (solved !== null && nextAt !== null)
    words.push(
      COPY.cardNext.replace(
        '{time}',
        hoursAndMinutes(nextAt - performance.now())
      )
    );
  if (skyCount !== null)
    words.push(
      skyCount === 0
        ? COPY.cardSkyNone
        : skyCount === 1
          ? COPY.cardSkyOne
          : COPY.cardSky.replace('{count}', skyCount.toLocaleString('en'))
    );
  crowd.textContent = words.join(' · ');
}

async function refresh(): Promise<void> {
  try {
    const asked = new URLSearchParams(location.search).get('day');
    const response = await fetch(
      asked === null
        ? '/api/card'
        : `/api/card?day=${encodeURIComponent(asked)}`
    );
    const body: CardResponse = await response.json();
    if (!body.ok) return;
    post = post ?? body.post;
    if (post.rows === undefined) post = { ...post, rows: body.post.rows ?? [] };
    skyCount = body.skyCount;
    nextAt = body.nextInMs === null ? null : performance.now() + body.nextInMs;
    solved = body.result;
    if (solved !== null) rememberSolved(post.day, solved);
  } catch {
    // The card stays as the post's own data painted it.
  } finally {
    known = true;
    paint();
  }
}

paint();
void refresh();
// Never hold the button back for long: a slow answer must not hide the way in.
window.setTimeout(() => {
  known = true;
  paint();
}, CARD.holdMs);
window.setInterval(paint, CARD.tickMs);
// Back from the game: the night may have changed.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refresh();
});
window.addEventListener('focus', () => void refresh());

// Expanded mode must be asked for directly inside the tap, never after waiting for anything.
how.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'howto');
  } catch (error) {
    console.error(error);
  }
});
play.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'game');
  } catch (error) {
    console.error(error);
  }
});
