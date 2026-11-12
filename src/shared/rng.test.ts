import { describe, expect, it } from 'vitest';
import { createRng, daySeed, hashSeed } from './rng';

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng('lumen-12');
    const b = createRng('lumen-12');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next())
    );
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng('lumen-1').next()).not.toBe(createRng('lumen-2').next());
    expect(hashSeed('lumen-1')).not.toBe(hashSeed('lumen-2'));
  });

  it('pins the first values, so islands never change by accident', () => {
    const rng = createRng(daySeed(1));
    expect(daySeed(1)).toBe('lumen-1');
    expect([rng.int(1000), rng.int(1000), rng.int(1000)])
      .toMatchInlineSnapshot(`
      [
        28,
        56,
        683,
      ]
    `);
  });

  it('stays inside its bounds and covers them', () => {
    const rng = createRng('bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const ranged = rng.range(3, 7);
      expect(ranged).toBeGreaterThanOrEqual(3);
      expect(ranged).toBeLessThanOrEqual(7);
      seen.add(ranged);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('shuffles without losing or changing items, and leaves the input alone', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(output.slice().sort()).toEqual(input);
    expect(output).not.toEqual(input);
  });

  it('refuses nonsense', () => {
    const rng = createRng('errors');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(1.5)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
