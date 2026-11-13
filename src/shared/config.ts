/**
 * Every tunable number in Lumen lives here, with a comment saying what it does.
 * After the Nov 16 freeze this is the only file that tuning should touch.
 * Nothing in this file may import from anywhere else.
 */

export const BOARD = {
  /** Smallest board edge the generator and the Island Builder may produce. */
  minSize: 4,
  /** Largest board edge. SPEC: 6x6 to 9x9 for daily islands; 4 and 5 are for tutorial islands. */
  maxSize: 9,
  /** Most sources a board may carry. Keeps the beam count readable on a phone. */
  maxSources: 4,
  /** Most lanterns a board may carry. */
  maxLanterns: 8,
} as const;

export const TRACE = {
  /**
   * Hard cap on beam steps: stepCapFactor x tiles x 4 directions x 4 colours (SPEC "Beam rules").
   * The loop guard already makes traces finite; this is a second belt.
   */
  stepCapFactor: 4,
} as const;

export const SOLVER = {
  /** Stop counting distinct minimum solutions here (SPEC: capped at 50). */
  solutionCap: 50,
  /**
   * Search nodes the solver may expand before it gives up and reports `limit`.
   * The engine may not read a clock, so the budget is counted in nodes, not milliseconds.
   * Measured Nov 12 on an M-series laptop: about 5 microseconds per node, so 400,000 nodes is
   * about 2 s. This default allows roughly 10 s, which is fine for offline generation.
   */
  nodeLimit: 2_000_000,
  /**
   * Tighter budget for the Island Builder's server check. About 2 s on a laptop; leaves a wide
   * margin inside the 30 s request limit on slower server hardware.
   */
  builderNodeLimit: 400_000,
} as const;

export const SCORING = {
  /** Pieces over par that still earn the top medal (Lamplighter). 0 means exactly par or better. */
  lamplighterOverPar: 0,
  /** Pieces over par that still earn the middle medal (Glow). Anything more is Spark. */
  glowOverPar: 1,
  /** Leaderboard score = pieces x pieceWeight + timeMs. Lower is better. */
  leaderboardPieceWeight: 10_000_000,
  /** timeMs is clamped to this so it can never spill into the pieces digit. */
  leaderboardMaxTimeMs: 9_999_999,
  /** Solves faster than this are recorded but shown without a rank (PROMPT W6). */
  minPlausibleMs: 3_000,
} as const;

export const RULES = {
  /**
   * false (decided Nov 12, PROMPT section 7, A1): lighting every lantern locks nothing. The
   * player sees the "all lit" line and chooses Lock in or Keep refining. Lock in is the single
   * ranked submission and starts nightfall. The timer runs until Lock in.
   * true: the first full light is submitted at once, as SPEC first described.
   */
  autoLockInOnSolve: false,
  /** A solve started before 00:00 UTC still counts as ranked if it lands within this window. */
  rolloverGraceMs: 10 * 60 * 1000,
} as const;

/**
 * Words the player reads. Calm, warm, short; no exclamation marks except on hitting par.
 * `{pieces}`, `{par}` and similar are filled in by the UI.
 */
export const COPY = {
  /** Shown with a soft glow the moment every lantern is lit, before anything is submitted. */
  allLit: 'All lit · {pieces} pieces (par {par})',
  /** Same line when exactly one piece is on the island. */
  allLitOnePiece: 'All lit · 1 piece (par {par})',
  /** Commits the ranked solve, then nightfall and the lantern release. */
  lockIn: 'Lock in',
  /** Dismisses the prompt so the player can remove or move pieces. */
  keepRefining: 'Keep refining',
  /** Island Builder, when the server cannot prove an island solvable inside its budget. */
  builderTooComplex: 'Too complex to verify. Try removing a piece.',
  /** Share button failure. Never blocks play. */
  shareFailed: 'Could not post. Try again from the Reddit app.',
} as const;

export const CALENDAR = {
  /**
   * The UTC date of day 1, the first public daily post. Weekdays, biomes and the whole content
   * file hang off this. Changing it means running `npm run gen` again and committing the result.
   * Nov 24, 2026 is a Tuesday.
   */
  dayOne: '2026-11-24',
  /** Days of islands kept in content/puzzles.json. */
  daysGenerated: 90,
} as const;

/** Shape of one weekday's islands. Pairs are [fewest, most], both included. */
export type WeekdayTemplate = {
  /** Board edge lengths to choose from. */
  sizes: readonly number[];
  sources: readonly [number, number];
  /** Chance that a sun crystal is red, green or blue instead of white. */
  colouredSourceChance: number;
  fixedMirrors: readonly [number, number];
  /** Mirrors in the hidden path the island is built around. Par is often lower. */
  builtMirrors: readonly [number, number];
  /** Prisms in the hidden path. This is also how many prisms the player gets: prisms are scarce. */
  builtPrisms: readonly [number, number];
  lanterns: readonly [number, number];
  /** Chance that a lantern on a coloured beam asks for that colour instead of accepting any. */
  colouredLanternChance: number;
  /** Lanterns that need two colours at once (magenta, cyan, yellow). */
  mixedLanterns: readonly [number, number];
  /** Share of tiles off the hidden path that become rock, tree and water. */
  rockShare: number;
  treeShare: number;
  waterShare: number;
  /** Share of empty tiles on the hidden path that become water (light passes, no piece fits). */
  waterOnPathShare: number;
  /** Misleading paths: a clear line toward a lantern that a rock cuts off at the last tile. */
  decoys: readonly [number, number];
  /** Par must land in this band or the island is thrown away. */
  par: readonly [number, number];
  /** Difficulty score must land in this band too. */
  difficulty: readonly [number, number];
};

export const GENERATOR = {
  /** Islands tried for one day before giving up. Each try is cheap; most are rejected early. */
  maxAttempts: 6000,
  /** Reject an island with more distinct minimum solutions than this: too loose to be a puzzle. */
  maxMinimumSolutions: 20,
  /**
   * Reject an island the solver needs more nodes than this to prove. Keeps every published day
   * under about a second to solve (about 5 microseconds per node), with a wide margin on 2 s.
   */
  maxSolveNodes: 150_000,
  /**
   * Each day first aims at one par picked evenly from its weekday's band, so a weekday does not
   * always sit at the bottom of its band. After this many tries any par in the band will do.
   */
  targetParAttempts: 2500,
  /**
   * In the par solution the light must travel at least this many tiles per piece, or the island
   * is thrown away. Stops solutions that huddle in one corner.
   */
  minTravelPerPiece: 2.4,
  /** Mirrors the player gets beyond par, so there is room to finish without finding par. */
  mirrorSlack: 2,
  /** A lantern is not placed closer than this many tiles to the piece that feeds it. */
  minLanternRun: 2,
  /** Tries at placing each hidden piece or lantern before the whole island is abandoned. */
  placementTries: 24,
  /**
   * Monday to Sunday. SPEC "Weekly ramp", with Saturday par capped at 6 (decided Nov 12).
   * Difficulty bands were set from `npm run report` so each day sits above the one before.
   */
  templates: {
    monday: {
      sizes: [6],
      sources: [1, 1],
      colouredSourceChance: 0,
      fixedMirrors: [0, 0],
      builtMirrors: [2, 4],
      builtPrisms: [0, 0],
      lanterns: [1, 1],
      colouredLanternChance: 0,
      mixedLanterns: [0, 0],
      rockShare: 0.16,
      treeShare: 0.08,
      waterShare: 0,
      waterOnPathShare: 0,
      decoys: [0, 1],
      par: [2, 3],
      difficulty: [30, 50],
    },
    tuesday: {
      sizes: [6, 7],
      sources: [2, 2],
      colouredSourceChance: 0,
      fixedMirrors: [0, 1],
      builtMirrors: [3, 5],
      builtPrisms: [0, 0],
      lanterns: [2, 2],
      colouredLanternChance: 0,
      mixedLanterns: [0, 0],
      rockShare: 0.14,
      treeShare: 0.08,
      waterShare: 0,
      waterOnPathShare: 0,
      decoys: [0, 1],
      par: [3, 4],
      difficulty: [48, 66],
    },
    wednesday: {
      sizes: [7],
      sources: [1, 2],
      colouredSourceChance: 0,
      fixedMirrors: [0, 1],
      builtMirrors: [2, 4],
      builtPrisms: [1, 1],
      lanterns: [2, 3],
      colouredLanternChance: 0.8,
      mixedLanterns: [0, 0],
      rockShare: 0.14,
      treeShare: 0.08,
      waterShare: 0,
      waterOnPathShare: 0,
      decoys: [0, 1],
      par: [3, 4],
      difficulty: [55, 76],
    },
    thursday: {
      sizes: [7, 8],
      sources: [2, 2],
      colouredSourceChance: 0,
      fixedMirrors: [0, 1],
      builtMirrors: [3, 5],
      builtPrisms: [1, 1],
      lanterns: [3, 3],
      colouredLanternChance: 0.6,
      mixedLanterns: [0, 0],
      rockShare: 0.1,
      treeShare: 0.06,
      waterShare: 0.12,
      waterOnPathShare: 0.3,
      decoys: [1, 3],
      par: [4, 5],
      difficulty: [70, 90],
    },
    friday: {
      sizes: [8],
      sources: [2, 3],
      colouredSourceChance: 0.35,
      fixedMirrors: [0, 1],
      builtMirrors: [3, 5],
      builtPrisms: [1, 1],
      lanterns: [3, 4],
      colouredLanternChance: 0.6,
      mixedLanterns: [1, 1],
      rockShare: 0.1,
      treeShare: 0.06,
      waterShare: 0.1,
      waterOnPathShare: 0.25,
      decoys: [1, 3],
      par: [4, 5],
      difficulty: [78, 98],
    },
    saturday: {
      sizes: [8, 9],
      sources: [2, 3],
      colouredSourceChance: 0.3,
      fixedMirrors: [1, 2],
      builtMirrors: [4, 7],
      builtPrisms: [1, 2],
      lanterns: [4, 4],
      colouredLanternChance: 0.6,
      mixedLanterns: [1, 1],
      rockShare: 0.1,
      treeShare: 0.06,
      waterShare: 0.12,
      waterOnPathShare: 0.3,
      decoys: [2, 3],
      par: [5, 6],
      difficulty: [94, 120],
    },
    sunday: {
      sizes: [7],
      sources: [2, 2],
      colouredSourceChance: 0,
      fixedMirrors: [0, 1],
      builtMirrors: [3, 4],
      builtPrisms: [1, 1],
      lanterns: [3, 3],
      colouredLanternChance: 0.5,
      mixedLanterns: [0, 0],
      rockShare: 0.12,
      treeShare: 0.08,
      waterShare: 0.06,
      waterOnPathShare: 0.15,
      decoys: [0, 2],
      par: [3, 5],
      difficulty: [60, 82],
    },
  } satisfies Record<string, WeekdayTemplate>,
} as const;

/**
 * Difficulty score = the sum of each factor times its weight. Every factor is logged per island
 * (`npm run report`) so these can be tuned from real solve data after playtests.
 */
export const DIFFICULTY = {
  /** Per piece of par. The main driver. */
  parWeight: 10,
  /** Per doubling of the number of first moves on offer (log2). More choice, harder to start. */
  branchingWeight: 3,
  /** Awarded in full when there is one minimum solution, fading to 0 at `uniqueFadeAt` or more. */
  uniquenessWeight: 8,
  uniqueFadeAt: 12,
  /** When the par solution needs a prism to make a colour. */
  prismWeight: 6,
  /** Per lantern that needs two colours at once. */
  mixedLanternWeight: 7,
  /** Per misleading path. */
  decoyWeight: 3,
  /** Per prism in the par solution that only bends light, where a mirror would not fit par. */
  prismAsTurnWeight: 5,
  /** Per lantern beyond the first. More to keep track of. */
  lanternWeight: 2,
  /** Per fixed mirror. They help as often as they hinder, so this is small. */
  fixedMirrorWeight: 1,
} as const;

/** Weekly look of the island. Same geometry, different palette and props. */
export const BIOMES = ['moss', 'snow', 'blossom', 'dune', 'autumn'] as const;
