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
