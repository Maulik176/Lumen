/**
 * Keeping light readable on pale ground. On snow, white light over near-white tiles had almost
 * no edge, and two suns side by side merged into one flare (review, Nov 17). Both are scaled by
 * how light the ground is, so dark biomes look exactly as before.
 */
import { GLARE, type Hex } from './config';

/** Relative luminance of a 0xrrggbb colour, 0 for black to 1 for white (WCAG). */
export function groundLight(hex: Hex): number {
  const channel = (shift: number): number => {
    const value = ((hex >> shift) & 0xff) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** How far along from "dark enough to need nothing" to the palest ground, 0 to 1. */
function paleness(ground: Hex): number {
  const light = groundLight(ground);
  return Math.min(
    1,
    Math.max(0, (light - GLARE.paleFrom) / (GLARE.paleTo - GLARE.paleFrom))
  );
}

/** How strongly a beam is lined with soft shade on this ground, 0 (none) to GLARE.edgeMax. */
export function beamEdge(ground: Hex): number {
  return paleness(ground) * GLARE.edgeMax;
}

/** A sun's halo and rays on this ground, as a share of full strength. */
export function sunGlow(ground: Hex): number {
  return 1 - paleness(ground) * (1 - GLARE.sunMin);
}
