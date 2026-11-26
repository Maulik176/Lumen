/**
 * Reading Sunday's pick (`sun:{day}`, written by sunday.ts) and serving the island behind a daily
 * number with it. Kept apart from sunday.ts so the island lookup in community.ts can use it
 * without the two modules importing each other.
 */
import {
  cleanPicture,
  type CommunityCredit,
  type OtherIsland,
} from '../../shared/api';
import { readDraft } from '../../shared/builder';
import { dateOfDay, weekdayOfDay } from '../../shared/calendar';
import { COMMUNITY } from '../../shared/config';
import type { PlayableIsland } from '../../shared/daily';
import type { Inventory, Placement } from '../../shared/types';
import { islandForDay } from './content';
import { KEYS, type Store } from './store';

/** A daily island number that falls on a Sunday (community and hero numbers never do). */
export function isSunday(day: number): boolean {
  return day >= 1 && day < 900 && weekdayOfDay(day) === 'sunday';
}

/** What a pick decided for one Sunday, as kept in `sun:{day}`. */
export type SundayPick = {
  day: number;
  state: 'community' | 'generated';
  /** Why: the winner's score and par, or why nothing qualified. Logged and shown to devs. */
  why: string;
  pickedAt: number;
  /** A developer's pick (every island so far was in the running, not just the week's). */
  dev: boolean;
  /** Set once Sunday's post exists: from then on nothing changes the pick. */
  posted: boolean;
  /** The winner (state community only). */
  winner: {
    index: number;
    postId: string;
    url: string;
    score: number;
    island: PlayableIsland;
    credit: CommunityCredit & { makerId: string };
    /** The maker's own test solve: "Maker's board" in See others' islands. */
    creator: OtherIsland;
  } | null;
  /** The app's comment on the winning post, once made. */
  comment: string;
  /** The maker's flair has been given "Islandwright". */
  flaired: boolean;
};

function json(text: string | undefined): unknown {
  if (text === undefined) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readWinner(fields: Record<string, string>): SundayPick['winner'] {
  const island = json(fields['island']);
  const credit = json(fields['credit']);
  const creator = json(fields['creator']);
  if (!isRecord(island) || !isRecord(credit) || !isRecord(creator)) return null;
  const rows = island['rows'];
  const inventory = island['inventory'];
  const solution = island['solution'];
  const placements = creator['placements'];
  if (
    !Array.isArray(rows) ||
    !rows.every((row): row is string => typeof row === 'string') ||
    !isRecord(inventory) ||
    !Array.isArray(solution) ||
    !Array.isArray(placements)
  )
    return null;
  const { maker, makerAvatar, makerId, label, picture } = credit;
  if (
    typeof maker !== 'string' ||
    typeof makerId !== 'string' ||
    (label !== 'gentle' && label !== 'tricky' && label !== 'fiendish')
  )
    return null;
  const stock: Inventory = {
    mirrors: Number(inventory['mirrors']) || 0,
    prisms: Number(inventory['prisms']) || 0,
  };
  const day = Number(island['day']);
  const biome = readDraft({
    size: rows.length,
    biome: island['biome'],
    name: '',
    spare: 0,
    rows,
  })?.biome;
  if (!Number.isInteger(day) || biome === undefined) return null;
  const pieces = (list: unknown[]): Placement[] =>
    list.filter(
      (entry): entry is Placement =>
        isRecord(entry) && 'piece' in entry && 'x' in entry && 'y' in entry
    );
  const colours = island['sourceColours'];
  return {
    index: Number(fields['index']) || 0,
    postId: fields['postId'] ?? '',
    url: fields['url'] ?? '',
    score: Number(fields['score']) || 0,
    island: {
      day,
      date: dateOfDay(day),
      weekday: 'sunday',
      biome,
      name: typeof island['name'] === 'string' ? island['name'] : '',
      rows,
      inventory: stock,
      sourceColours: Array.isArray(colours)
        ? colours.filter(
            (colour): colour is PlayableIsland['sourceColours'][number] =>
              colour === 'white' ||
              colour === 'red' ||
              colour === 'green' ||
              colour === 'blue'
          )
        : [],
      par: Number(island['par']) || 0,
      solution: pieces(solution),
    },
    credit: {
      maker,
      makerId,
      makerAvatar: typeof makerAvatar === 'string' ? makerAvatar : '',
      label,
      ...(cleanPicture(picture) === ''
        ? {}
        : { picture: cleanPicture(picture) }),
    },
    creator: {
      rank: null,
      username: maker,
      snoovatar: typeof makerAvatar === 'string' ? makerAvatar : '',
      pieces: Number(creator['pieces']) || 0,
      timeMs: Number(creator['timeMs']) || 0,
      placements: pieces(placements),
    },
  };
}

/** The pick kept for a Sunday, or null when none has been made. */
export async function readPick(
  store: Store,
  day: number
): Promise<SundayPick | null> {
  const fields = await store.hGetAll(KEYS.sundayPick(day));
  const state = fields['state'];
  if (state !== 'community' && state !== 'generated') return null;
  const winner = state === 'community' ? readWinner(fields) : null;
  // A community pick that cannot be read back is no pick: the generated island is safer.
  if (state === 'community' && winner === null) return null;
  return {
    day,
    state,
    why: fields['why'] ?? '',
    pickedAt: Number(fields['pickedAt']) || 0,
    dev: fields['dev'] === '1',
    posted: fields['posted'] === '1',
    winner,
    comment: fields['comment'] ?? '',
    flaired: fields['flaired'] === '1',
  };
}

/**
 * The island behind a daily number, with Sunday's pick when there is one. The pick is served
 * while the community side is on, and always once Sunday's post was made from it (frozen).
 */
export async function islandOfDay(
  store: Store,
  day: number,
  enabled: boolean = COMMUNITY.enabled
): Promise<{ island: PlayableIsland; pick: SundayPick | null } | undefined> {
  const generated = islandForDay(day);
  if (generated === undefined) return undefined;
  if (!isSunday(day)) return { island: generated, pick: null };
  const pick = await readPick(store, day);
  if (
    pick?.winner !== null &&
    pick?.winner !== undefined &&
    (enabled || pick.posted)
  )
    return { island: pick.winner.island, pick };
  return { island: generated, pick: null };
}
