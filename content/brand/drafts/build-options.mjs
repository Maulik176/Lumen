/**
 * Logo drafts: three marks, each shown as an icon at 256, 64 and 32 px and as a lockup with the
 * "Lumen" wordmark in Young Serif. Writes options.html beside this file (font inlined) for
 * Maulik to choose from. Not part of the build.
 *
 *   node content/brand/drafts/build-options.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const font = readFileSync(
  join(here, '../../../src/client/assets/fonts/young-serif.woff2')
).toString('base64');

// The game's palette (src/shared/config.ts UI).
const night = '#1a1430';
const paper = '#faf0dc';
const ink = '#2a2233';
const amber = '#f0a94a';
const wood = '#8a5426';

const defs = (id) => `
  <defs>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${amber}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${amber}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-paper" cx="0.42" cy="0.4" r="0.65">
      <stop offset="0" stop-color="#fff1c9"/>
      <stop offset="0.55" stop-color="#f7c068"/>
      <stop offset="1" stop-color="#e08a32"/>
    </radialGradient>
    <filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.4"/>
    </filter>
  </defs>`;

/** A paper lantern centred on (x, y), body radius r. */
const lantern = (id, x, y, r, ribs = true) => `
  <circle cx="${x}" cy="${y}" r="${r * 2.1}" fill="url(#${id}-glow)"/>
  <ellipse cx="${x}" cy="${y}" rx="${r * 0.92}" ry="${r}" fill="url(#${id}-paper)"/>
  ${
    ribs
      ? `<path d="M${x} ${y - r} C ${x - r * 0.55} ${y - r * 0.4}, ${x - r * 0.55} ${y + r * 0.4}, ${x} ${y + r}
               M${x} ${y - r} C ${x + r * 0.55} ${y - r * 0.4}, ${x + r * 0.55} ${y + r * 0.4}, ${x} ${y + r}"
            fill="none" stroke="#c46a22" stroke-opacity="0.55" stroke-width="${Math.max(1, r * 0.09)}"/>`
      : ''
  }
  <rect x="${x - r * 0.5}" y="${y - r - r * 0.26}" width="${r}" height="${r * 0.3}" rx="${r * 0.1}" fill="${wood}"/>
  <rect x="${x - r * 0.5}" y="${y + r - r * 0.04}" width="${r}" height="${r * 0.3}" rx="${r * 0.1}" fill="${wood}"/>`;

/** A ray of light along a path: soft halo, then a bright core. */
const ray = (id, d, width) => `
  <path d="${d}" fill="none" stroke="${amber}" stroke-opacity="0.75" stroke-width="${width * 1.9}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-soft)"/>
  <path d="${d}" fill="none" stroke="#ffd98a" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A small wooden-framed mirror at (x, y), turned 45 degrees. */
const mirror = (x, y, size, turn = -45) => `
  <g transform="translate(${x} ${y}) rotate(${turn})">
    <rect x="${-size / 2}" y="${-size * 0.16}" width="${size}" height="${size * 0.32}" rx="${size * 0.08}" fill="${wood}"/>
    <rect x="${-size / 2 + size * 0.08}" y="${-size * 0.07}" width="${size * 0.84}" height="${size * 0.14}" rx="${size * 0.04}" fill="${paper}"/>
  </g>`;

/** A sun crystal: a small diamond. */
const sun = (x, y, size) => `
  <path d="M${x} ${y - size} L${x + size * 0.7} ${y} L${x} ${y + size} L${x - size * 0.7} ${y} Z" fill="${paper}"/>`;

// Each mark is drawn in a 64 x 64 box on the night tile.
const marks = {
  A: {
    title: 'A · Paper lantern',
    note: 'One shape: the lantern every player sends up. Simplest at small sizes.',
    draw: (id) => `${lantern(id, 32, 34, 17)}
      <path d="M32 8 V15" stroke="${paper}" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  B: {
    title: 'B · Light bent into a lantern',
    note: 'The whole game in one picture: a sun, a mirror, the light turning, a lantern lit.',
    draw: (id) => `${ray(id, 'M13 48 H38 V30', 4.2)}
      ${sun(10, 48, 5)}
      ${mirror(38, 48, 13)}
      ${lantern(id, 38, 18, 10.5)}`,
  },
  C: {
    title: 'C · The L is the light',
    note: "The light's path makes the L of Lumen: in from the sun, up at the mirror, into the lantern.",
    draw: (id) => `${ray(id, 'M50 48 H22 V28', 4.6)}
      ${sun(52, 48, 5)}
      ${mirror(22, 48, 13, 45)}
      ${lantern(id, 22, 16, 10.5)}`,
  },
};

const tile = (id, size, draw) => `
  <svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    ${defs(`${id}${size}`)}
    <rect width="64" height="64" rx="14" fill="${night}"/>
    ${draw(`${id}${size}`)}
  </svg>`;

/** Mark and wordmark side by side, on night or on paper. */
const lockup = (id, draw, dark, dropL) => {
  const text = dark ? paper : ink;
  const word = dropL ? 'umen' : 'Lumen';
  return `
  <svg width="520" height="150" viewBox="0 0 520 150" xmlns="http://www.w3.org/2000/svg">
    ${defs(`${id}lock${dark}`)}
    <rect width="520" height="150" rx="18" fill="${dark ? night : paper}"/>
    <g transform="translate(${dropL ? 30 : 34} ${dropL ? 18 : 11}) scale(2)">${draw(`${id}lock${dark}`)}</g>
    <text x="${dropL ? 150 : 172}" y="${dropL ? 121 : 98}" font-family="Young Serif" font-size="${dropL ? 92 : 76}" fill="${text}">${word}</text>
  </svg>`;
};

const sections = Object.entries(marks)
  .map(
    ([id, mark]) => `
  <section>
    <h2>${mark.title}</h2>
    <p>${mark.note}</p>
    <div class="row">
      ${tile(id, 256, mark.draw)}
      <div class="small">
        ${tile(id, 64, mark.draw)}
        ${tile(id, 32, mark.draw)}
        <span>256 · 64 · 32 px</span>
      </div>
      <div class="locks">
        ${lockup(id, mark.draw, true, id === 'C')}
        ${lockup(id, mark.draw, false, id === 'C')}
      </div>
    </div>
  </section>`
  )
  .join('');

const real = Object.entries(marks)
  .map(
    ([id, mark]) =>
      `<div class="real"><b>${id}</b>${tile(`r${id}`, 32, mark.draw)}${tile(`s${id}`, 16, mark.draw)}</div>`
  )
  .join('');

writeFileSync(
  join(here, 'options.html'),
  `<!doctype html>
<html><head><meta charset="utf-8"><title>Lumen logo options</title>
<style>
  @font-face { font-family: 'Young Serif'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
  body { margin: 0; padding: 28px 36px; background: #efe4cc; color: ${ink}; font: 15px/1.4 system-ui, sans-serif; }
  h1 { font: 34px 'Young Serif'; margin: 0 0 4px; }
  h2 { font: 24px 'Young Serif'; margin: 0; }
  p { margin: 2px 0 12px; color: #5f566b; }
  section { padding: 18px 0; border-top: 1px solid #d8c9a8; }
  .row { display: flex; gap: 24px; align-items: center; }
  .small { display: flex; flex-direction: column; gap: 14px; align-items: center; }
  .small span { font-size: 12px; color: #5f566b; }
  .locks { display: flex; flex-direction: column; gap: 12px; }
  svg { display: block; }
  .real { display: flex; gap: 10px; align-items: center; margin-right: 30px; }
</style></head>
<body><h1>Lumen logo options</h1><p>Each mark as the app icon (256, 64 and the 32 px it must survive), and as a lockup with the wordmark.</p>
${sections}
<section><h2>At real size (32 and 16 px)</h2><div class="row">${real}</div></section>
</body></html>`
);
console.log('wrote options.html');
