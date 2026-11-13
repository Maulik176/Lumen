/**
 * Shapes of everything that crosses between the client and the server.
 */
import type { Biome, Weekday } from './calendar';
import type { DailyIsland } from './daily';
import type { BeamColour, Inventory, Medal, Placement } from './types';
import type { PlacementProblem } from './validate';

/** What a player's device is told about an island. Never includes the solution. */
export type PublicIsland = {
  day: number;
  date: string;
  weekday: Weekday;
  biome: Biome;
  name: string;
  rows: string[];
  inventory: Inventory;
  sourceColours: BeamColour[];
  par: number;
};

/** The small payload attached to each daily post, so the feed card paints without a request. */
export type PostData = {
  day: number;
  name: string;
  weekday: Weekday;
  par: number;
  lanterns: number;
};

export type IslandResponse =
  { ok: true; island: PublicIsland } | { ok: false; reason: 'not-found' };

export type LockInRequest = {
  day: number;
  placements: Placement[];
  /** Milliseconds the player took. Milestone 5 replaces this with the server's own clock. */
  elapsedMs: number;
};

export type LockInResponse =
  | {
      ok: true;
      day: number;
      pieces: number;
      par: number;
      medal: Medal;
      elapsedMs: number;
    }
  | {
      ok: false;
      reason: 'not-found' | 'not-solved' | 'bad-request' | PlacementProblem;
    };

/** Strip everything a client must not see. */
export function toPublicIsland(island: DailyIsland): PublicIsland {
  return {
    day: island.day,
    date: island.date,
    weekday: island.weekday,
    biome: island.biome,
    name: island.name,
    rows: island.rows,
    inventory: island.inventory,
    sourceColours: island.sourceColours,
    par: island.par,
  };
}

export function toPostData(island: DailyIsland): PostData {
  const lanterns = island.rows.join('').replace(/[^WRGBMCY]/g, '').length;
  return {
    day: island.day,
    name: island.name,
    weekday: island.weekday,
    par: island.par,
    lanterns,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Read a post's data, or null if the post is not a Lumen daily post. */
export function readPostData(value: unknown): PostData | null {
  if (!isRecord(value)) return null;
  const { day, name, par, lanterns } = value;
  const weekday = WEEKDAYS.find((entry) => entry === value['weekday']);
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) return null;
  if (typeof name !== 'string' || weekday === undefined) return null;
  if (typeof par !== 'number' || typeof lanterns !== 'number') return null;
  return { day, name, weekday, par, lanterns };
}
