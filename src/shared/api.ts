/**
 * Shapes of everything that crosses between the client and the server.
 */
import type { Biome, Weekday } from './calendar';
import type { LanternStyle } from './config';
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
  /** The island's rows (see puzzle-text.ts), so the card can draw its outline. Newer posts only. */
  rows?: string[];
};

/** What the feed card asks for after it has painted: the crowd, and the player's own night. */
export type CardResponse = {
  ok: true;
  /** The post's own data again, for a card whose post carried none. */
  post: PostData;
  /** Ranked solves of this island so far. */
  skyCount: number;
  /** Milliseconds until the next island, or null when this post is not today's. */
  nextInMs: number | null;
  streak: number;
  /** The player's ranked result here, if they have locked in. */
  result: CardResult | null;
};

export type CardResult = {
  pieces: number;
  par: number;
  rank: number;
  streak: number;
};

/** One lantern in tonight's sky. Short names keep realtime messages and Redis small. */
export type SkyLantern = {
  /** Username. */
  u: string;
  /** Lantern style earned by streak. */
  s: LanternStyle;
  /** Snoovatar address on Reddit's image host, or '' when the player has none. */
  a: string;
};

export type SkyResponse = {
  ok: true;
  day: number;
  count: number;
  lanterns: SkyLantern[];
};

/** What the server knows about the player asking. */
export type PlayerState = {
  loggedIn: boolean;
  username: string | null;
  streak: number;
  style: LanternStyle;
  tutorialDone: boolean;
  /** Their ranked result for this island, if they already locked in. */
  result: LockInResult | null;
  /** The pieces of that result, to show the island as they left it. */
  placements: Placement[] | null;
  /** True once they have shared that result in the comments. */
  shared: boolean;
};

export type ShareResponse =
  | { ok: true }
  | {
      ok: false;
      reason: 'signed-out' | 'nothing-to-share' | 'already-shared' | 'failed';
    };

/** One earlier island, for "Explore past islands". */
export type PastIsland = {
  day: number;
  name: string;
  weekday: Weekday;
  biome: Biome;
  par: number;
  /** The player's medal on its night, if they played it then. */
  medal: Medal | null;
  /** Its rows of text, for drawing it on the map. */
  rows: string[];
  /** How many players lit it. */
  solves: number;
};

export type PastResponse = { ok: true; islands: PastIsland[] };

/** Where everyone put their pieces on one island. Only after the player has locked in. */
export type HeatResponse =
  | {
      ok: true;
      day: number;
      /** Pieces placed on each tile (index y * width + x) across all ranked solves. */
      tiles: number[];
      solves: number;
      parHits: number;
      /** The par answer, only once the island's night is over. */
      parSolution: Placement[] | null;
    }
  | { ok: false; reason: 'locked' | 'not-found' };

/** One row of tonight's board. `rank` is null for a time too fast to be believed. */
export type BoardRow = {
  rank: number | null;
  username: string;
  /** Snoovatar address on Reddit's image host, or ''. */
  snoovatar: string;
  pieces: number;
  timeMs: number;
};

/** One row of the all-time board: nights the player hit par. */
export type AllTimeRow = {
  rank: number;
  username: string;
  snoovatar: string;
  medals: number;
};

export type BoardResponse =
  | {
      ok: true;
      scope: 'day';
      top: BoardRow[];
      /** The player's own row when it is not already in `top`. */
      me: BoardRow | null;
      total: number;
    }
  | {
      ok: true;
      scope: 'alltime';
      top: AllTimeRow[];
      me: AllTimeRow | null;
      total: number;
    };

export type IslandResponse =
  | {
      ok: true;
      island: PublicIsland;
      me: PlayerState;
      /** True when a solve of this island today would count for boards and streaks. */
      rankedOpen: boolean;
      skyCount: number;
    }
  | { ok: false; reason: 'not-found' };

export type StartRequest = { day: number };

export type LockInRequest = {
  day: number;
  placements: Placement[];
  /** The player's own snoovatar address, from the post context. Checked by the server. */
  snoovatar?: string;
  /** False for archive and replay: the server then records nothing. */
  ranked?: boolean;
};

export type LockInResult = {
  day: number;
  pieces: number;
  par: number;
  medal: Medal;
  /** Milliseconds from the server's own start record to Lock in. */
  elapsedMs: number;
  /** True when this solve counted for the leaderboard, streak and sky. */
  ranked: boolean;
  streak: number;
  style: LanternStyle;
  /** Share of ranked players this result beat or equalled on pieces and time, 0 to 100. */
  percentile: number;
  /** Place on tonight's board, 1 first. 0 when the solve is not ranked. */
  rank: number;
  skyCount: number;
};

export type LockInResponse =
  | ({ ok: true } & LockInResult)
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
    rows: island.rows,
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
  const rows = value['rows'];
  if (
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every((row): row is string => typeof row === 'string')
  )
    return { day, name, weekday, par, lanterns, rows };
  return { day, name, weekday, par, lanterns };
}

/** Reddit's own image host is the only place a snoovatar may come from. */
export function cleanSnoovatar(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300) return '';
  return /^https:\/\/i\.redd\.it\/snoovatar\/[\w\-./]+\.png$/.test(value)
    ? value
    : '';
}
