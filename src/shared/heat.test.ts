import { describe, expect, it } from 'vitest';
import { BIOMES, BIOME_LOOK, HEAT } from './config';
import { poolColour, poolOverGround, warmth } from './heat';

describe('crowd pools read as warm on every biome (the snow report)', () => {
  it.each(BIOMES)(
    '%s: a used tile is clearly warmer than the bare ground',
    (biome) => {
      for (const ground of [
        BIOME_LOOK[biome].groundA,
        BIOME_LOOK[biome].groundB,
      ]) {
        const busiest = poolOverGround(ground, 1);
        const quietest = poolOverGround(ground, 0.1);
        expect(warmth(busiest) - warmth(ground)).toBeGreaterThanOrEqual(
          HEAT.minWarmthGain
        );
        expect(warmth(quietest) - warmth(ground)).toBeGreaterThan(0);
        // Never washed out to white: there is always colour left in it.
        expect(busiest).not.toBe(0xffffff);
      }
    }
  );

  it('busier tiles are a deeper orange', () => {
    expect(warmth(poolColour(1))).toBeGreaterThan(warmth(poolColour(0.2)));
  });
});
