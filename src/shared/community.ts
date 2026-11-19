/**
 * Community islands, the parts both sides share: their numbers (a reserved range, so every
 * day-keyed system serves them unchanged), their realtime channel, their fallback name, the name
 * filter, and the key that tells two boards apart. Pure, so every rule is tested.
 */
import type { Biome } from './calendar';
import { COMMUNITY, COPY } from './config';
import type { Placement } from './types';

/** True for a community island's number; daily days and the hero island are far below. */
export function isCommunity(number: number): boolean {
  return number >= COMMUNITY.numberBase;
}

/** The island number of the k-th community island (k from 1). */
export function communityNumber(index: number): number {
  return COMMUNITY.numberBase + index;
}

export function communityIndex(number: number): number {
  return number - COMMUNITY.numberBase;
}

/** The realtime channel of an island's sky. Letters, digits and underscores only. */
export function skyChannel(number: number): string {
  return isCommunity(number)
    ? `sky_isl_${communityIndex(number)}`
    : `sky_${number}`;
}

/** The name an island gets when its maker left the name blank: "Moss Island #7". */
export function fallbackName(biome: Biome, index: number): string {
  return COPY.communityFallbackName
    .replace('{world}', COPY.builderBiomes[biome])
    .replace('{n}', String(index));
}

/** Letters people swap in to hide a word. */
const SWAPS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  $: 's',
  '@': 'a',
  '!': 'i',
};

const BLOCKED: ReadonlySet<string> = new Set(COMMUNITY.blockedWords);

function blocked(word: string): boolean {
  return (
    BLOCKED.has(word) ||
    (word.endsWith('s') && BLOCKED.has(word.slice(0, -1))) ||
    (word.endsWith('es') && BLOCKED.has(word.slice(0, -2)))
  );
}

/**
 * True when an island name has a word from the list, in any case, with swapped letters
 * ("sh1t", "$h!t") or spelled out a letter at a time ("s h i t", "s-h-i-t"). Whole words only,
 * so a place name that happens to contain one ("Scunthorpe", "Cockle Bay") passes.
 */
export function nameFiltered(name: string): boolean {
  const plain = [...name.toLowerCase()]
    .map((letter) => SWAPS[letter] ?? letter)
    .join('');
  const words = plain.split(/[^\p{L}]+/u).filter((word) => word !== '');
  const tokens: string[] = [];
  let run = '';
  for (const word of words) {
    if (word.length === 1) {
      run += word;
      continue;
    }
    if (run.length > 1) tokens.push(run);
    run = '';
    tokens.push(word);
  }
  if (run.length > 1) tokens.push(run);
  return tokens.some(blocked);
}

/** The same pieces in the same places and turns, in any order, give the same key. */
export function boardKey(placements: readonly Placement[]): string {
  return placements
    .map(
      ({ x, y, piece }) =>
        `${x},${y},${piece.kind === 'mirror' ? piece.orientation : 'prism'}`
    )
    .sort()
    .join(';');
}
