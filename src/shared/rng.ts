/**
 * Seeded random numbers. The engine never calls Math.random: every random choice comes from a
 * generator created here, so a seed such as "lumen-12" always produces the same island.
 */

export type Rng = {
  /** Uniform in [0, 1). */
  next: () => number;
  /** Uniform whole number in [0, bound). */
  int: (bound: number) => number;
  /** Uniform whole number in [min, max], both included. */
  range: (min: number, max: number) => number;
  /** True with the given probability. */
  chance: (probability: number) => boolean;
  /** One item of a non-empty list. */
  pick: <T>(items: readonly T[]) => T;
  /** A shuffled copy; the input is left alone. */
  shuffle: <T>(items: readonly T[]) => T[];
};

/** xmur3 string hash: turns any seed text into a well-mixed 32-bit number. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 keyed by a seed string. */
export function createRng(seed: string): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (bound: number): number => {
    if (!Number.isInteger(bound) || bound <= 0)
      throw new RangeError('bound must be a positive whole number.');
    return Math.floor(next() * bound);
  };

  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(items.length)];
    if (item === undefined)
      throw new RangeError('Cannot pick from an empty list.');
    return item;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const a = copy[i];
      const b = copy[j];
      if (a !== undefined && b !== undefined) {
        copy[i] = b;
        copy[j] = a;
      }
    }
    return copy;
  };

  return {
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    chance: (probability) => next() < probability,
    pick,
    shuffle,
  };
}

/** The seed for a given day of Lumen. Day 1 is launch day. */
export function daySeed(day: number): string {
  return `lumen-${day}`;
}
