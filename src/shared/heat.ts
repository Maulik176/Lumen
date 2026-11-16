/**
 * The crowd view's pools: a soft disc of colour on each tile players used. They are laid over
 * the ground (not added to it as light), so they read as warm on every biome, pale snow and
 * dark moss alike. Pure, so the colours can be tested against each biome's ground.
 */
import { HEAT } from './config';

type Rgb = [number, number, number];

function rgb(hex: number): Rgb {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function hex([r, g, b]: Rgb): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Each channel of `a` and `b` mixed: `t` of the way from a to b. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** A pool's colour for a tile used by this share (0..1) of the busiest tile's players. */
export function poolColour(share: number): number {
  const t = Math.min(1, Math.max(0, share));
  const low = rgb(HEAT.paleColour);
  const high = rgb(HEAT.colour);
  return hex(mix(low, high, t));
}

/** What the eye sees at a pool's centre: its colour laid over the ground at HEAT.poolOpacity. */
export function poolOverGround(ground: number, share: number): number {
  return hex(mix(rgb(ground), rgb(poolColour(share)), HEAT.poolOpacity));
}

/** How warm a colour is: red above blue, 0..255. */
export function warmth(colour: number): number {
  const [r, , b] = rgb(colour);
  return r - b;
}
