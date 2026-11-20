/**
 * Shapes of everything that crosses between the client and the server.
 */
import type { Biome, Weekday } from './calendar';
import type { LanternStyle } from './config';
import type { PlayableIsland } from './daily';
import type { BeamColour, Inventory, Medal, Placement } from './types';
import type { RuleKind } from './rules';
import type { PlacementProblem } from './validate';
import type { CheckProblem, DifficultyLabel, IslandDraft } from './builder';

/** Who made a community island, and how hard the server judged it. */
export type CommunityCredit = {
  /** The maker's username, without "u/". Stored when they published, whoever Reddit shows. */
  maker: string;
  /** The maker's snoovatar on Reddit's image host, or ''. */
  makerAvatar: string;
  label: DifficultyLabel;
};

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
  /** Present on a community island (a number from COMMUNITY.numberBase up). */
  community?: CommunityCredit;
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
  /**
   * A community island's post: the card paints its world, maker and label from here without a
   * request. The server reads only `day` (the island's number) and loads the rest from Redis.
   */
  kind?: 'community';
  /**
   * A picture of this island for the card, uploaded to Reddit's media host (PHASE 4, being
   * tested). The stock picture of its world when absent, or if it fails to load.
   */
  picture?: string;
  biome?: Biome;
  label?: DifficultyLabel;
  maker?: string;
  makerAvatar?: string;
};

/** What the feed card asks for after it has painted: the crowd, and the player's own night. */
/** Where an island stands today: it is tonight's, its night has passed, or it is yet to come. */
export type Night = 'tonight' | 'past' | 'future';

export type CardResponse =
  CardOpen | { ok: false; reason: 'not-found' | 'taken-down' | 'resting' };

export type CardOpen = {
  ok: true;
  night: Night;
  /** Tonight's post, when this post is not it and tonight's exists. */
  tonightPost: string | null;
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
  /** Their shared reply's id (t1_...), when it is known, so it can be opened. */
  sharedComment: string | null;
  /** True once they have been told, on their first release, what the sky of lanterns is. */
  skyNoteSeen: boolean;
  /** The one-time rule cards they have already been shown. */
  rulesSeen: RuleKind[];
  /** An unfinished board they left on this island, to pick up again. Null once locked in. */
  progress: Placement[] | null;
};

export type ShareResponse =
  | {
      ok: true;
      /** The reply's address, to open it. */
      url: string | null;
    }
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

/**
 * One island in "See others' islands": a row of the board and the pieces as they were placed.
 * `placements` is null when they were never stored (solves locked in before v0.0.1.64): the
 * player is still named, without a picture.
 */
export type OtherIsland = BoardRow & {
  placements: Placement[] | null;
  /**
   * How many ranked players placed exactly this board (1 when only this player did). On the
   * viewer's own row it counts the viewer too: their board's whole group is folded into it.
   */
  same?: number;
  /** On the viewer's own row: another player who placed the same board, highest on the board. */
  sameAs?: string;
};

/**
 * "See others' islands": the top of the night's board with each player's pieces, and the
 * player's own island to compare. Tonight's opens only after the player's ranked Lock in.
 */
export type OthersResponse =
  | {
      ok: true;
      day: number;
      /**
       * The top of the board, one row per board. Boards the same as the viewer's are never
       * here: they are folded into `me` (its `same` and `sameAs`).
       */
      top: OtherIsland[];
      /** The player's own island, with everyone who placed the same board. */
      me: OtherIsland | null;
      solves: number;
      parHits: number;
      /** The par answer, only once the island's night is over. */
      parSolution: Placement[] | null;
      /** On a community island: the maker's own test solve, pinned first and never ranked. */
      creator: OtherIsland | null;
    }
  | { ok: false; reason: 'locked' | 'not-found' };

export type IslandResponse =
  | {
      ok: true;
      island: PublicIsland;
      me: PlayerState;
      /** True when a solve of this island today would count for boards and streaks. */
      rankedOpen: boolean;
      skyCount: number;
      night: Night;
      /** Tonight's post, when this island is not tonight's and that post exists. */
      tonightPost: string | null;
      /** The player's shared reply on this post, to open it again. */
      sharedUrl: string | null;
      /**
       * Trailer mode: present only for a moderator who has just armed it from the menu. It
       * carries the island's answer, so it is never sent to anyone else.
       */
      trailer?: { solution: Placement[] };
      /**
       * Playtest subreddit only: a moderator asked to see one lantern of each streak style in
       * the sky. They are labelled as a preview, never shown as players.
       */
      stylePreview?: boolean;
    }
  | { ok: false; reason: 'not-found' | 'taken-down' | 'resting' };

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
export function toPublicIsland(
  island: PlayableIsland,
  community?: CommunityCredit
): PublicIsland {
  return {
    ...(community === undefined ? {} : { community }),
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

export function toPostData(island: PlayableIsland): PostData {
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

/** A community island's post data: the day fields plus what its card shows. Under 1 KB. */
export function toCommunityPostData(
  island: PlayableIsland,
  credit: CommunityCredit
): PostData {
  return {
    ...toPostData(island),
    kind: 'community',
    biome: island.biome,
    label: credit.label,
    maker: credit.maker,
    makerAvatar: credit.makerAvatar,
  };
}

const BIOME_NAMES: readonly Biome[] = [
  'moss',
  'snow',
  'blossom',
  'dune',
  'autumn',
];
const LABELS: readonly DifficultyLabel[] = ['gentle', 'tricky', 'fiendish'];

/** Read a post's data, or null if the post is not a Lumen post (daily or community). */
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
  ) {
    const picture = cleanPicture(value['picture']);
    const data: PostData =
      picture === ''
        ? { day, name, weekday, par, lanterns, rows }
        : { day, name, weekday, par, lanterns, rows, picture };
    if (value['kind'] !== 'community') return data;
    const biome = BIOME_NAMES.find((entry) => entry === value['biome']);
    const label = LABELS.find((entry) => entry === value['label']);
    const maker = value['maker'];
    if (biome === undefined || label === undefined || typeof maker !== 'string')
      return data;
    return {
      ...data,
      kind: 'community',
      biome,
      label,
      maker,
      makerAvatar: cleanSnoovatar(value['makerAvatar']),
    };
  }
  return { day, name, weekday, par, lanterns };
}

/**
 * A card picture must be on one of Reddit's own hosts (an app may show only media Reddit hosts),
 * over https. Anything else is dropped and the card shows its stock picture.
 */
export function cleanPicture(value: unknown): string {
  if (typeof value !== 'string' || value.length > 500) return '';
  return /^https:\/\/([a-z0-9-]+\.)*(redd\.it|redditmedia\.com|redditstatic\.com)\//.test(
    value
  )
    ? value
    : '';
}

/** Reddit's own image host is the only place a snoovatar may come from. */
export function cleanSnoovatar(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300) return '';
  return /^https:\/\/i\.redd\.it\/snoovatar\/[\w\-./]+\.png$/.test(value)
    ? value
    : '';
}

/** The lanterns shown by "Dev: preview lantern styles": one per style, named as a preview. */
export function stylePreviewLanterns(): SkyLantern[] {
  return (['plain', 'paper', 'star', 'koi', 'comet'] as const).map((style) => ({
    u: `${style} (preview)`,
    s: style,
    a: '',
  }));
}

/** The Island Builder (BUILDER_PLAN.md). */
/** What the server remembers about one island of the player's: its check, and the maker's solve. */
export type BuilderStatus = {
  checked: { par: number; inventory: Inventory; label: DifficultyLabel } | null;
  tested: { pieces: number } | null;
};

export type BuilderDraftResponse = {
  ok: true;
  loggedIn: boolean;
  draft: IslandDraft | null;
  /** For the draft above, so reopening the Builder does not ask for work already done. */
  status: BuilderStatus;
  /** The first-island tutorial was finished or skipped. */
  tutorialDone: boolean;
};

export type BuilderTestStartResponse =
  { ok: true } | { ok: false; problem: 'signed-out' | 'not-checked' };

export type BuilderRefusal = CheckProblem | 'signed-out' | 'slow-down' | 'off';

export type BuilderCheckResponse =
  | {
      ok: true;
      par: number;
      inventory: Inventory;
      difficulty: number;
      label: DifficultyLabel;
    }
  | { ok: false; problem: BuilderRefusal };

export type BuilderTestResponse =
  | { ok: true; pieces: number; ms: number }
  | {
      ok: false;
      problem:
        'signed-out' | 'not-checked' | 'changed' | 'bad-pieces' | 'not-lit';
    };

export type PublishProblem =
  | 'signed-out'
  | 'not-tested'
  | 'not-checked'
  | 'changed'
  | 'name'
  | 'limit'
  | 'duplicate'
  | 'busy'
  | 'off'
  | 'failed';

export type BuilderPublishResponse =
  | {
      ok: true;
      postId: string;
      /** The new post's own address on Reddit (no "t3_" in it), to open it. */
      permalink: string;
      url: string;
    }
  | { ok: false; problem: PublishProblem };

/** One row of "Your islands". */
export type YourIsland = {
  name: string;
  biome: Biome;
  rows: string[];
  created: number;
  /** Ranked players who lit it, and how many of them at par. */
  plays: number;
  parHits: number;
  active: boolean;
  url: string;
};

export type BuilderMineResponse = {
  ok: true;
  loggedIn: boolean;
  islands: YourIsland[];
};
