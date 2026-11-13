import { describe, expect, it } from 'vitest';
import { BIOMES, BIOME_LOOK, COLOUR_SHAPE, UI } from '../../shared/config';
import { LANTERN_COLOURS } from '../../shared/types';
import { partsOf, SHAPE_CODE } from './shapes';

/** Relative luminance of "#rrggbb", per WCAG. */
function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe('interface colours', () => {
  it.each([
    ['ink on paper', UI.ink, UI.paper],
    ['soft ink on paper', UI.inkSoft, UI.paper],
    ['button text on amber', UI.amberInk, UI.amber],
    ['Lamplighter medal on paper', UI.medalLamplighter, UI.paper],
    ['Glow medal on paper', UI.medalGlow, UI.paper],
    ['Spark medal on paper', UI.medalSpark, UI.paper],
  ])(
    '%s passes WCAG AA for normal text (4.5 to 1)',
    (_name, text, background) => {
      expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('tap targets are at least 44 pixels', () => {
    expect(UI.tapPx).toBeGreaterThanOrEqual(44);
  });
});

describe('colour shapes', () => {
  it('each primary colour has its own shape', () => {
    expect(COLOUR_SHAPE).toEqual({
      red: 'triangle',
      green: 'circle',
      blue: 'square',
    });
    expect(new Set(Object.values(COLOUR_SHAPE)).size).toBe(3);
  });

  it('every lantern colour maps to the shapes of the light it needs', () => {
    const shapes = Object.fromEntries(
      LANTERN_COLOURS.map((colour) => [colour, partsOf(colour)])
    );
    expect(shapes).toEqual({
      white: [],
      red: ['red'],
      green: ['green'],
      blue: ['blue'],
      magenta: ['red', 'blue'],
      cyan: ['green', 'blue'],
      yellow: ['red', 'green'],
    });
  });

  it('white light carries no shape and each coloured beam carries a different one', () => {
    expect(SHAPE_CODE.white).toBe(0);
    expect(
      new Set([SHAPE_CODE.red, SHAPE_CODE.green, SHAPE_CODE.blue]).size
    ).toBe(3);
  });
});

describe('biomes', () => {
  it('every biome has a complete look', () => {
    for (const biome of BIOMES) {
      const look = BIOME_LOOK[biome];
      expect(look.skyTop, biome).toHaveLength(3);
      expect(look.skyHorizon, biome).toHaveLength(3);
      expect(['pine', 'round', 'cactus']).toContain(look.tree);
      for (const value of [
        look.groundA,
        look.groundB,
        look.rock,
        look.water,
        look.crown,
        look.rim,
      ]) {
        expect(
          Number.isInteger(value) && value >= 0 && value <= 0xffffff,
          biome
        ).toBe(true);
      }
    }
  });

  it('no two biomes share a ground colour or a tree colour', () => {
    expect(new Set(BIOMES.map((biome) => BIOME_LOOK[biome].groundA)).size).toBe(
      BIOMES.length
    );
    expect(new Set(BIOMES.map((biome) => BIOME_LOOK[biome].crown)).size).toBe(
      BIOMES.length
    );
  });

  it('every night sky is darker than its afternoon', () => {
    const brightness = (hex: number): number =>
      ((hex >> 16) & 255) + ((hex >> 8) & 255) + (hex & 255);
    for (const biome of BIOMES) {
      const look = BIOME_LOOK[biome];
      expect(brightness(look.skyTop[2]), biome).toBeLessThan(
        brightness(look.skyTop[0]) / 3
      );
    }
  });
});
