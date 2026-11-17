/**
 * The Lumen logo (option C, chosen Nov 17): the light's path is the L of Lumen. Light leaves a
 * sun, runs left along the foot, turns up at a mirror in the corner, and climbs the stem into a
 * paper lantern. "umen" is Young Serif (OFL), turned into outlines so no file needs the font.
 *
 * Writes SVGs and an HTML sheet for every PNG size to content/brand/, then renders the PNGs
 * with headless Chrome (scripts/shoot.mjs). Run from the repo root:
 *
 *   node content/brand/build.mjs
 *
 * Needs Google Chrome. `umen.json` holds the outlines, made once with fontTools (Python):
 *   python outline-font.py ../../src/client/assets/fonts/young-serif.woff2 umen > umen.json
 * (`pip install fonttools brotli`). Rebuild it only if the font or the word changes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withPage } from '../../scripts/shoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'png');
mkdirSync(out, { recursive: true });
const umen = JSON.parse(readFileSync(join(here, 'umen.json'), 'utf8'));
const font = readFileSync(
  join(here, '../../src/client/assets/fonts/young-serif.woff2')
).toString('base64');

// The game's palette (src/shared/config.ts UI), plus the wood of the mirror frames.
const C = {
  night: '#1a1430',
  nightHigh: '#3a2a5a',
  paper: '#faf0dc',
  ink: '#2a2233',
  amber: '#f0a94a',
  core: '#ffdc8f',
  wood: '#8a5426',
};

// --- The mark, in font units (1000 per em). Baseline at y = 0, y grows downward. -------------
const STEM = 156; // Young Serif's L stem is about 0.16 em.
const CAP = 750;
const stemX = 200;
const footY = -STEM / 2;
const footEnd = 640;
const sunX = 712;
const lanternR = 128;
const lanternY = -CAP - 64 - lanternR;
/** The mark's box: left, top, right, bottom (glow not included). */
const MARK_BOX = [stemX - lanternR, lanternY - lanternR * 1.32, sunX + 66, 6];
const UMEN_X = 800;

function markDefs(id, onPaper) {
  return `
    <filter id="${id}-soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="34"/>
    </filter>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.amber}" stop-opacity="${onPaper ? 0.45 : 0.6}"/>
      <stop offset="1" stop-color="${C.amber}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-paper" cx="0.42" cy="0.38" r="0.66">
      <stop offset="0" stop-color="#fff3cf"/>
      <stop offset="0.55" stop-color="#f7c068"/>
      <stop offset="1" stop-color="#df8530"/>
    </radialGradient>`;
}

/** The mark itself. `onPaper` deepens the light so it reads on a pale ground. */
function mark(id, onPaper) {
  const path = `M${footEnd} ${footY} H${stemX} V${-CAP + 20}`;
  const r = lanternR;
  const x = stemX;
  const y = lanternY;
  return `
    <path d="${path}" fill="none" stroke="${C.amber}" stroke-opacity="${onPaper ? 0.7 : 0.8}"
          stroke-width="${STEM * 1.5}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-soft)"/>
    <path d="${path}" fill="none" stroke="${onPaper ? C.amber : C.core}" stroke-width="${STEM}"
          stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(${stemX} ${footY}) rotate(45)">
      <rect x="-118" y="-30" width="236" height="60" rx="16" fill="${C.wood}"/>
      <rect x="-100" y="-13" width="200" height="26" rx="8" fill="${C.paper}"/>
    </g>
    <path d="M${sunX} ${footY - 92} L${sunX + 64} ${footY} L${sunX} ${footY + 92} L${sunX - 64} ${footY} Z"
          fill="${onPaper ? C.amber : C.paper}" ${onPaper ? `stroke="${C.ink}" stroke-width="10" stroke-linejoin="round"` : ''}/>
    <circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="url(#${id}-glow)"/>
    <ellipse cx="${x}" cy="${y}" rx="${r * 0.92}" ry="${r}" fill="url(#${id}-paper)"/>
    <path d="M${x} ${y - r} C ${x - r * 0.55} ${y - r * 0.4}, ${x - r * 0.55} ${y + r * 0.4}, ${x} ${y + r}
             M${x} ${y - r} C ${x + r * 0.55} ${y - r * 0.4}, ${x + r * 0.55} ${y + r * 0.4}, ${x} ${y + r}"
          fill="none" stroke="#c46a22" stroke-opacity="0.55" stroke-width="11"/>
    <rect x="${x - r * 0.5}" y="${y - r - r * 0.27}" width="${r}" height="${r * 0.31}" rx="12" fill="${C.wood}"/>
    <rect x="${x - r * 0.5}" y="${y + r - r * 0.05}" width="${r}" height="${r * 0.31}" rx="12" fill="${C.wood}"/>`;
}

/** Mark and "umen", in font units; returns the SVG body and its box. */
function wordmark(id, onPaper) {
  const pad = 70;
  // Room for the lantern's glow, which reaches 2.2 lantern widths from its centre.
  const left = Math.min(MARK_BOX[0] - pad, stemX - lanternR * 2.2);
  const top = Math.min(MARK_BOX[1] - pad, lanternY - lanternR * 2.2);
  const right = UMEN_X + umen.advance + pad;
  const bottom = 40 + pad;
  const body = `${mark(id, onPaper)}
    <path transform="translate(${UMEN_X} 0)" d="${umen.path}" fill="${onPaper ? C.ink : C.paper}"/>`;
  return { body, box: [left, top, right - left, bottom - top] };
}

function svg(viewBox, defs, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}"${extra}>
  <defs>${defs}</defs>${body}
</svg>
`;
}

// --- SVG files. ------------------------------------------------------------------------------
const files = {};
for (const [name, onPaper] of [
  ['lumen-wordmark-on-dark.svg', false],
  ['lumen-wordmark-on-light.svg', true],
]) {
  const { body, box } = wordmark('w', onPaper);
  files[name] = svg(box, markDefs('w', onPaper), body);
}

/** The square icon: the mark centred on night, inside the circle Reddit crops icons to. */
function iconSvg() {
  const [l, t, r, b] = MARK_BOX;
  const w = r - l;
  const h = b - t;
  const side = Math.max(w, h) / 0.66;
  const cx = l + w / 2;
  const cy = t + h / 2;
  return svg(
    [cx - side / 2, cy - side / 2, side, side],
    `${markDefs('i', false)}
    <radialGradient id="sky" cx="0.5" cy="0.25" r="0.85">
      <stop offset="0" stop-color="${C.nightHigh}"/>
      <stop offset="1" stop-color="${C.night}"/>
    </radialGradient>`,
    `<rect x="${cx - side / 2}" y="${cy - side / 2}" width="${side}" height="${side}" fill="url(#sky)"/>
    ${mark('i', false)}`
  );
}
files['lumen-icon.svg'] = iconSvg();
const glowLeft = stemX - lanternR * 2.2;
const glowTop = lanternY - lanternR * 2.2;
files['lumen-mark-on-dark.svg'] = svg(
  [glowLeft, glowTop, MARK_BOX[2] + 90 - glowLeft, MARK_BOX[3] + 90 - glowTop],
  markDefs('m', false),
  mark('m', false)
);
for (const [name, text] of Object.entries(files))
  writeFileSync(join(here, name), text);

// --- Wide pictures: a night sky with drifting paper lanterns and the wordmark. --------------
/** A repeatable scatter, so every build draws the same sky. */
function scatter(count, seed) {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: count }, () => [next(), next(), next()]);
}

function skyPage(width, height, { wordWidth, tagline, lanterns }) {
  const word = files['lumen-wordmark-on-dark.svg'].replace(
    '<svg ',
    `<svg width="${wordWidth}" `
  );
  const stars = scatter(Math.round((width * height) / 9000), 7)
    .map(
      ([x, y, z]) =>
        `<circle cx="${(x * width).toFixed(1)}" cy="${(y * height * 0.9).toFixed(1)}" r="${(0.6 + z * 1.4).toFixed(2)}" fill="${C.paper}" opacity="${(0.25 + z * 0.55).toFixed(2)}"/>`
    )
    .join('');
  // Small paper lanterns rising at the sides, never behind the words.
  const drift = scatter(lanterns, 11)
    .map(([x, y, z], index) => {
      // Kept to the outer sixth on each side, clear of the words and the edges.
      const side = index % 2 === 0 ? 0.03 + x * 0.14 : 0.83 + x * 0.14;
      const size = 7 + z * 10;
      const cx = side * width;
      const cy = (0.12 + y * 0.8) * height;
      return `<g opacity="${(0.55 + z * 0.4).toFixed(2)}">
        <circle cx="${cx}" cy="${cy}" r="${size * 2.6}" fill="url(#halo)"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${size * 0.85}" ry="${size}" fill="url(#lamp)"/>
        <rect x="${cx - size * 0.45}" y="${cy + size * 0.92}" width="${size * 0.9}" height="${size * 0.28}" rx="2" fill="${C.wood}"/>
      </g>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  @font-face { font-family: 'Young Serif'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
  body { position: relative; background: radial-gradient(ellipse at 50% 120%, #4a2f52 0%, ${C.nightHigh} 35%, ${C.night} 80%); }
  svg.sky { position: absolute; inset: 0; }
  .lockup { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${Math.round(height * 0.03)}px; }
  .lockup svg { display: block; height: auto; }
  p { margin: 0; font: ${Math.round(wordWidth * 0.06)}px 'Young Serif', serif; color: ${C.paper}; opacity: 0.85; letter-spacing: 0.01em; }
</style></head><body>
<svg class="sky" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo"><stop offset="0" stop-color="${C.amber}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>
    <radialGradient id="lamp" cx="0.42" cy="0.38" r="0.66"><stop offset="0" stop-color="#fff3cf"/><stop offset="0.55" stop-color="#f7c068"/><stop offset="1" stop-color="#df8530"/></radialGradient>
  </defs>
  ${stars}${drift}
</svg>
<div class="lockup">${word}${tagline ? `<p>${tagline}</p>` : ''}</div>
</body></html>`;
}

const TAGLINE = 'A new island every night';
const pages = [
  // Reddit's banner editor asks for at least 1072 x 128 (desktop) and 1080 x 128 (the Reddit
  // app), about 8.4 to 1. Drawn at twice that so they stay sharp; the wordmark fills the height.
  [
    'subreddit-banner-desktop-2144x256',
    2144,
    256,
    { wordWidth: 600, tagline: '', lanterns: 16 },
  ],
  [
    'subreddit-banner-mobile-2160x256',
    2160,
    256,
    { wordWidth: 600, tagline: '', lanterns: 16 },
  ],
  [
    'devpost-thumbnail-1500x1000',
    1500,
    1000,
    { wordWidth: 900, tagline: TAGLINE, lanterns: 18 },
  ],
  [
    'trailer-title-1920x1080',
    1920,
    1080,
    { wordWidth: 1100, tagline: TAGLINE, lanterns: 20 },
  ],
];

function iconPage(size) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; overflow: hidden; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style></head><body>${files['lumen-icon.svg']}</body></html>`;
}

function clearPage(svgText, width) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  html, body { margin: 0; background: transparent; }
  svg { display: block; width: ${width}px; height: auto; }
</style></head><body>${svgText}</body></html>`;
}

/**
 * The Devpost thumbnail that shows play: the real hero island (island-render.png, made by
 * island.mjs) with light turning into lit lanterns, and the wordmark in a night corner.
 */
function gamePage(width, height) {
  const picture = readFileSync(join(here, 'island-render.png')).toString(
    'base64'
  );
  const word = files['lumen-wordmark-on-dark.svg'].replace(
    '<svg ',
    `<svg width="${Math.round(width * 0.28)}" `
  );
  // The render is 4:3; it is drawn a little larger than the frame and to the right, so the
  // island sits clear of the words. Its left edge fades into the render's own sky colours.
  const scale = 0.66;
  const left = Math.round(width * 0.1);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  @font-face { font-family: 'Young Serif'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
  body { position: relative; background: linear-gradient(180deg, #e8a469 0%, #e39f63 25%, #da9a61 50%, #d39865 75%, #c88c5a 100%); }
  .island { position: absolute; left: ${left}px; top: -${Math.round(height * 0.04)}px; width: ${Math.round(2400 * scale)}px;
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 ${Math.round(width * 0.08)}px); mask-image: linear-gradient(90deg, transparent 0, #000 ${Math.round(width * 0.08)}px); }
  .corner { position: absolute; inset: 0; background: radial-gradient(ellipse 48% 40% at 0% 0%, rgba(26, 20, 48, 0.92) 0%, rgba(26, 20, 48, 0.78) 55%, rgba(26, 20, 48, 0) 100%); }
  .words { position: absolute; left: ${Math.round(width * 0.035)}px; top: ${Math.round(height * 0.035)}px; }
  .words svg { display: block; height: auto; }
  p { margin: 0 0 0 ${Math.round(width * 0.008)}px; font: ${Math.round(width * 0.018)}px 'Young Serif', serif; color: ${C.paper}; }
</style></head><body>
  <img class="island" src="data:image/png;base64,${picture}" alt="">
  <div class="corner"></div>
  <div class="words">${word}<p>Bend the light into every lantern</p></div>
</body></html>`;
}

const renders = [
  ['app-icon-1024', 1024, 1024, iconPage(1024), false],
  ['subreddit-icon-512', 512, 512, iconPage(512), false],
  ['subreddit-icon-256', 256, 256, iconPage(256), false],
  ...pages.map(([name, w, h, options]) => [
    name,
    w,
    h,
    skyPage(w, h, options),
    false,
  ]),
];
if (existsSync(join(here, 'island-render.png')))
  renders.push([
    'devpost-thumbnail-game-1500x1000',
    1500,
    1000,
    gamePage(1500, 1000),
    false,
  ]);
// Transparent wordmarks for slides, the README and anywhere else.
for (const [name, file] of [
  ['wordmark-on-dark-1600', 'lumen-wordmark-on-dark.svg'],
  ['wordmark-on-light-1600', 'lumen-wordmark-on-light.svg'],
]) {
  const [, , w, h] = files[file]
    .match(/viewBox="([^"]+)"/)[1]
    .split(' ')
    .map(Number);
  renders.push([
    name,
    1600,
    Math.round((1600 * h) / w),
    clearPage(files[file], 1600),
    true,
  ]);
}

// A check sheet, not a deliverable: the icon at 64, 32 and 16 px and the wordmark at small
// widths, on night and on paper, drawn at true size.
const small = (svgText, width) =>
  svgText.replace('<svg ', `<svg width="${width}" style="display:block" `);
renders.push([
  'check-small-sizes',
  560,
  220,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  html, body { margin: 0; } .row { display: flex; gap: 18px; align-items: center; padding: 14px 18px; }
</style></head><body>
  <div class="row" style="background:${C.night}">${[64, 32, 16].map((w) => small(files['lumen-icon.svg'], w)).join('')}${small(files['lumen-wordmark-on-dark.svg'], 180)}${small(files['lumen-wordmark-on-dark.svg'], 96)}</div>
  <div class="row" style="background:${C.paper}">${[64, 32, 16].map((w) => small(files['lumen-icon.svg'], w)).join('')}${small(files['lumen-wordmark-on-light.svg'], 180)}${small(files['lumen-wordmark-on-light.svg'], 96)}</div>
</body></html>`,
  false,
]);

const sheets = join(here, '.sheets');
mkdirSync(sheets, { recursive: true });
for (const [name, width, height, html, clear] of renders) {
  const file = join(sheets, `${name}.html`);
  writeFileSync(file, html);
  await withPage(
    pathToFileURL(file).href,
    { width, height, scale: 1 },
    async (page) => {
      if (clear) await page.clear();
      await page.shot(
        name.startsWith('check-')
          ? join(here, 'drafts', `${name}.png`)
          : join(out, `${name}.png`)
      );
    }
  );
  console.log(`${name}.png`);
}
