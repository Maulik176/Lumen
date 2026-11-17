import { describe, expect, it } from 'vitest';
import { BIOMES, BIOME_LOOK } from './config';
import { beamEdge, groundLight, sunGlow } from './glare';

const ground = (biome: (typeof BIOMES)[number]): number =>
  BIOME_LOOK[biome].groundA;

describe('light stays readable on pale ground', () => {
  it('measures ground from dark to light', () => {
    expect(groundLight(0x000000)).toBe(0);
    expect(groundLight(0xffffff)).toBeCloseTo(1);
    expect(groundLight(ground('snow'))).toBeGreaterThan(
      groundLight(ground('moss'))
    );
  });

  it('lines beams with shade on snow, and barely on moss', () => {
    // Birch Steps (snow, day 7): white light on near-white ground had almost no edge.
    expect(beamEdge(ground('snow'))).toBeGreaterThanOrEqual(0.4);
    expect(beamEdge(ground('moss'))).toBeLessThanOrEqual(0.08);
    for (const biome of BIOMES)
      expect(beamEdge(ground(biome))).toBeLessThanOrEqual(
        beamEdge(ground('snow'))
      );
  });

  it('turns sun glare down on snow, and leaves moss as it was', () => {
    // Two suns side by side on snow merged into one white flare.
    expect(sunGlow(ground('snow'))).toBeLessThanOrEqual(0.6);
    expect(sunGlow(ground('moss'))).toBeGreaterThanOrEqual(0.95);
    for (const biome of BIOMES) {
      expect(sunGlow(ground(biome))).toBeGreaterThan(0);
      expect(sunGlow(ground(biome))).toBeLessThanOrEqual(1);
    }
  });
});
