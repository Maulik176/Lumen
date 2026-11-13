/**
 * Island names: two calm words, such as "Moss Steps" or "Two Suns".
 * The first word comes from the week's biome, the second from the shape of the island.
 * Word lists are content, not tuning numbers, so they live here rather than in config.ts.
 */
import type { Biome } from './calendar';
import type { Rng } from './rng';
import type { Puzzle } from './types';

const FIRST_WORDS: Record<Biome, readonly string[]> = {
  moss: [
    'Moss',
    'Fern',
    'Clover',
    'Lichen',
    'Reed',
    'Willow',
    'Thistle',
    'Ivy',
    'Bracken',
    'Sorrel',
    'Dew',
    'Meadow',
  ],
  snow: [
    'Snow',
    'Frost',
    'Rime',
    'Drift',
    'Pine',
    'Hush',
    'Sleet',
    'Flint',
    'Birch',
    'Glass',
    'Hoar',
    'Still',
  ],
  blossom: [
    'Petal',
    'Plum',
    'Blossom',
    'Peach',
    'Silk',
    'Wren',
    'Bloom',
    'Rose',
    'Sparrow',
    'Lilac',
    'Spring',
    'Blush',
  ],
  dune: [
    'Dune',
    'Sand',
    'Amber',
    'Salt',
    'Ochre',
    'Clay',
    'Sun',
    'Dust',
    'Agave',
    'Copper',
    'Mesa',
    'Ember',
  ],
  autumn: [
    'Maple',
    'Rust',
    'Hazel',
    'Acorn',
    'Russet',
    'Oak',
    'Harvest',
    'Cedar',
    'Barley',
    'Smoke',
    'Bramble',
    'Chestnut',
  ],
};

const PLACE_WORDS: readonly string[] = [
  'Steps',
  'Hollow',
  'Rise',
  'Shelf',
  'Reach',
  'Crossing',
  'Terrace',
  'Hearth',
  'Lookout',
  'Garden',
  'Rest',
  'Bend',
  'Ledge',
  'Stair',
  'Gate',
  'Nook',
  'Ridge',
  'Landing',
];

const WATER_WORDS: readonly string[] = [
  'Pool',
  'Ford',
  'Shallows',
  'Spring',
  'Well',
  'Brook',
  'Mirror',
];
const PRISM_WORDS: readonly string[] = [
  'Glass',
  'Fan',
  'Prism',
  'Window',
  'Halo',
  'Veil',
];
const MIXED_WORDS: readonly string[] = [
  'Weave',
  'Braid',
  'Meeting',
  'Twine',
  'Chord',
  'Knot',
];

/** Names that say something true about the island, used now and then instead of a biome word. */
function shapeNames(puzzle: Puzzle): string[] {
  const names: string[] = [];
  if (puzzle.sources.length === 2) names.push('Two Suns');
  if (puzzle.sources.length === 3) names.push('Three Suns');
  if (puzzle.lanterns.length === 1) names.push('Lone Lantern');
  if (puzzle.lanterns.length === 4) names.push('Four Lanterns');
  return names;
}

/**
 * Pick a name nobody has used yet. `taken` is updated. Falls back to a numbered name only if
 * every combination is used up, which cannot happen inside 90 days.
 */
export function nameIsland(
  puzzle: Puzzle,
  biome: Biome,
  rng: Rng,
  taken: Set<string>
): string {
  const hasWater = puzzle.terrain.includes('water');
  const hasPrism = puzzle.inventory.prisms > 0;
  const hasMixed = puzzle.lanterns.some(
    (lantern) =>
      lantern.colour === 'magenta' ||
      lantern.colour === 'cyan' ||
      lantern.colour === 'yellow'
  );

  const seconds = PLACE_WORDS.slice();
  if (hasWater) seconds.push(...WATER_WORDS, ...WATER_WORDS);
  if (hasPrism) seconds.push(...PRISM_WORDS);
  if (hasMixed) seconds.push(...MIXED_WORDS, ...MIXED_WORDS);

  if (rng.chance(0.12)) {
    const special = rng
      .shuffle(shapeNames(puzzle))
      .find((name) => !taken.has(name));
    if (special !== undefined) {
      taken.add(special);
      return special;
    }
  }

  const firsts = FIRST_WORDS[biome];
  for (let attempt = 0; attempt < 200; attempt++) {
    const first = rng.pick(firsts);
    const second = rng.pick(seconds);
    if (first === second) continue;
    const name = `${first} ${second}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  for (const first of firsts) {
    for (const second of seconds) {
      const name = `${first} ${second}`;
      if (first !== second && !taken.has(name)) {
        taken.add(name);
        return name;
      }
    }
  }
  const fallback = `${firsts[0] ?? 'Island'} ${taken.size + 1}`;
  taken.add(fallback);
  return fallback;
}
