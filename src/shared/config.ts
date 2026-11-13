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
  /** Feed card and expanded-view title. {day}, {name}, {weekday} are filled in. */
  postTitle: 'Lumen #{day} · {name} · {weekday}',
  /** Feed card, one line under the title. {lanterns} is the lantern count. */
  previewLine: '{lanterns} lanterns wait in the dusk.',
  previewLineOne: 'One lantern waits in the dusk.',
  /** The one big button on the feed card. */
  playButton: 'Light the lanterns',
  /** First play only: shown until the first piece is placed. */
  hintPlace: 'Tap the grass to place a mirror',
  /** First play only: shown after the first piece, until a piece is turned. */
  hintTurn: 'Tap it again to turn it',
  /** First play only, on days with a prism: shown once a mirror has been turned. */
  hintPrism: 'A third tap makes a prism: it splits white light in three',
  /** Shown briefly when the player taps empty grass with nothing left to place. */
  noPiecesLeft: 'No pieces left. Tap one to take it back.',
  /** Shown with a soft glow the moment every lantern is lit, before anything is submitted. */
  allLit: 'All lit · {pieces} pieces (par {par})',
  /** Same line when exactly one piece is on the island. */
  allLitOnePiece: 'All lit · 1 piece (par {par})',
  /** Commits the ranked solve, then nightfall and the lantern release. */
  lockIn: 'Lock in',
  /** Dismisses the prompt so the player can remove or move pieces. */
  keepRefining: 'Keep refining',
  /** Result card, first line. The exclamation mark is allowed only on par. */
  resultPar: 'Lit with {pieces}. That is par!',
  resultOverPar: 'Lit with {pieces}. Par is {par}.',
  /** Medal names as the player reads them. */
  medalLamplighter: 'Lamplighter',
  medalGlow: 'Glow',
  medalSpark: 'Spark',
  /** Result card footer. */
  comeBack: 'Come back at nightfall tomorrow.',
  /** Result card: replay without ranking. */
  playAgain: 'Play again, unranked',
  /** If the island cannot be loaded. */
  loadFailed: 'The island is hidden in mist. Try again in a moment.',
  /** If Lock in cannot reach the server. */
  lockInFailed: 'Could not lock in. Try again.',
  /** Labels read by screen readers for the icon buttons. */
  undo: 'Undo',
  reset: 'Reset',
  rotate: 'Rotate',
  mute: 'Mute',
  unmute: 'Sound on',
  /** Island Builder, when the server cannot prove an island solvable inside its budget. */
  builderTooComplex: 'Too complex to verify. Try removing a piece.',
  /** Share button failure. Never blocks play. */
  shareFailed: 'Could not post. Try again from the Reddit app.',
} as const;

/** The camera that looks at the island. Angles in degrees, times in milliseconds. */
export const CAMERA = {
  /** Tilt down from the horizon. Higher is flatter and easier to tap; lower is more scenic. */
  pitchDegrees: 52,
  /** Lens angle. Small keeps the island close to isometric. */
  fieldOfViewDegrees: 28,
  /** Each tap on Rotate turns the view this far. */
  rotateStepDegrees: 90,
  rotateMs: 400,
  /** Empty space kept around the island, as a share of the island's size. */
  margin: 0.08,
  /** How far the camera rises to follow the night, as a share of its distance. */
  nightLift: 0.06,
} as const;

/** Timings and sizes of the play screen. Times in milliseconds. */
export const VIEW = {
  /** Device pixel ratio is never above this. */
  maxPixelRatio: 2,
  /** If frames stay slower than `slowFrameMs` the pixel ratio drops to this. */
  lowPixelRatio: 1.25,
  slowFrameMs: 22,
  /** Slow frames in a row before the pixel ratio drops. */
  slowFramesBeforeDrop: 45,
  /** The sky drifts from afternoon to dusk over this long while the player thinks. */
  duskDriftMs: 180_000,
  /** How dark the sky is at the start of play (0 afternoon, 1 night) and where the drift ends. */
  duskStart: 0.1,
  duskEnd: 0.5,
  /** After Lock in: sky falls to night over this long. */
  nightfallMs: 1500,
  /** Then each lantern blooms this long after the one before. */
  lanternBloomGapMs: 420,
  /** A lantern's pop: scale goes 1 to `lanternPopScale` and back over `lanternPopMs`. */
  lanternPopScale: 1.15,
  lanternPopMs: 360,
  /** Pause after the last lantern before the result card rises. */
  resultDelayMs: 900,
  /** How long "No pieces left" stays on screen. */
  noticeMs: 2200,
  /** A piece drops in over this long. */
  pieceDropMs: 140,
  /** The island's slow float: height of the bob in tiles, and its period. */
  floatHeight: 0.05,
  floatPeriodMs: 7000,
  /** Reduced motion: nightfall and blooms use these gentler timings and no camera movement. */
  calmNightfallMs: 2400,
  calmBloomGapMs: 600,
} as const;

/** Sound. Frequencies in hertz, times in seconds, volumes 0 to 1. All synthesised. */
export const SOUND = {
  masterVolume: 0.5,
  /** The wooden click when a piece is placed or turned. */
  clickHz: 540,
  clickSeconds: 0.07,
  /** Lantern chimes: the first note, and the scale steps (in semitones) each later one climbs. */
  chimeBaseHz: 523.25,
  chimeSteps: [0, 2, 4, 7, 9, 12, 14, 16],
  chimeSeconds: 1.4,
  /** The low pad under nightfall. */
  padHz: 110,
  padSeconds: 4,
  padVolume: 0.18,
} as const;

/** Weekly look of the island. Same geometry, different palette and props. */
export const BIOMES = ['moss', 'snow', 'blossom', 'dune', 'autumn'] as const;

/** Colours as Three.js reads them (0xRRGGBB). */
export type Hex = number;

/** Colours that are the same in every biome: light, lanterns and the pieces the player places. */
export const LOOK = {
  beamWhite: 0xfff1c2,
  beamRed: 0xff6a5c,
  beamGreen: 0x63e08a,
  beamBlue: 0x6aa6ff,
  lanternMagenta: 0xee74dc,
  lanternCyan: 0x5fdbe2,
  lanternYellow: 0xf5d64e,
  /** Unlit lantern paper, and the warm colour a white lantern glows. */
  lanternPaper: 0xfbf0d8,
  lanternWarm: 0xffc66e,
  wood: 0x8a5a3a,
  woodDark: 0x5c3d2a,
  brass: 0xd9a441,
  /** The mirror's glass, and the sheen it shows toward the sky. */
  glass: 0xcfe6ee,
  glassSheen: 0xf4fbff,
  prismGlass: 0xdaf3ff,
  stone: 0x8d8b98,
  stoneDark: 0x6c6a78,
  crystal: 0xfff4c8,
  /** Stars and the sky lantern's flame. */
  star: 0xfff6e0,
  flame: 0xffb14a,
} as const;

/** Which low-poly shape a biome's "tree" tiles use. */
export type TreeShape = 'pine' | 'round' | 'cactus';

/**
 * One biome's palette and props. Geometry is the same everywhere; only these change.
 * Sky colours are [afternoon, dusk, night], for the top of the dome and for the horizon.
 */
export type BiomeLook = {
  skyTop: readonly [Hex, Hex, Hex];
  skyHorizon: readonly [Hex, Hex, Hex];
  /** Two tones of ground, laid like a quiet chequerboard. */
  groundA: Hex;
  groundB: Hex;
  /** The shaded sides of the tiles. */
  groundSide: Hex;
  /** The earth rim around the playable tiles, and the rock the island hangs from. */
  rim: Hex;
  underside: Hex;
  rock: Hex;
  water: Hex;
  waterEdge: Hex;
  tree: TreeShape;
  crown: Hex;
  /** Snow caps, blossom, cactus flowers, the lighter leaves. */
  crownAccent: Hex;
  trunk: Hex;
  /** Small tufts and pebbles on the rim. */
  tuft: Hex;
  /** The mist the underside fades into. */
  mist: Hex;
};

export const BIOME_LOOK: Record<(typeof BIOMES)[number], BiomeLook> = {
  moss: {
    skyTop: [0xf1c282, 0x63468c, 0x0c0a24],
    skyHorizon: [0xfbe6b8, 0xf2876a, 0x2b2459],
    groundA: 0x80b05e,
    groundB: 0x74a454,
    groundSide: 0x577a41,
    rim: 0x8c6b4b,
    underside: 0x6a5146,
    rock: 0x8d8b98,
    water: 0x5aa6cc,
    waterEdge: 0x3f7fa6,
    tree: 'pine',
    crown: 0x3f8250,
    crownAccent: 0x5fa565,
    trunk: 0x6b4a32,
    tuft: 0x97c86c,
    mist: 0xf3d6b0,
  },
  snow: {
    skyTop: [0xc9dcec, 0x56589a, 0x0a0d28],
    skyHorizon: [0xf7ead9, 0xf0a48c, 0x27305e],
    groundA: 0xf1f5f8,
    groundB: 0xe3ebf1,
    groundSide: 0xb4c3d0,
    rim: 0x9fb0c0,
    underside: 0x6d7a8c,
    rock: 0x8f9cb2,
    water: 0xa6d8ea,
    waterEdge: 0x7fb6cf,
    tree: 'pine',
    crown: 0x2f6c5c,
    crownAccent: 0xffffff,
    trunk: 0x5a4636,
    tuft: 0xffffff,
    mist: 0xe8eef6,
  },
  blossom: {
    skyTop: [0xf4c6a0, 0x7a4a8e, 0x100a26],
    skyHorizon: [0xfde3cf, 0xf590a2, 0x34245a],
    groundA: 0x9ccb7c,
    groundB: 0x8fbf70,
    groundSide: 0x6c9856,
    rim: 0x9c7c6a,
    underside: 0x705449,
    rock: 0xa49ba8,
    water: 0x7cc4d8,
    waterEdge: 0x579fb6,
    tree: 'round',
    crown: 0xf3a6c2,
    crownAccent: 0xffd6e4,
    trunk: 0x6b4a3a,
    tuft: 0xf8c2d5,
    mist: 0xfbdcd6,
  },
  dune: {
    skyTop: [0xf5c474, 0x7b487a, 0x120b22],
    skyHorizon: [0xfee8b2, 0xf3814c, 0x3a2450],
    groundA: 0xe5c68b,
    groundB: 0xdcb87a,
    groundSide: 0xb69254,
    rim: 0xab854f,
    underside: 0x8b6a48,
    rock: 0xc28c5c,
    water: 0x50b6aa,
    waterEdge: 0x358f86,
    tree: 'cactus',
    crown: 0x5c9c64,
    crownAccent: 0xf3d26c,
    trunk: 0x5c9c64,
    tuft: 0xcfb26c,
    mist: 0xf8dcae,
  },
  autumn: {
    skyTop: [0xf0b672, 0x6c4280, 0x0e0a22],
    skyHorizon: [0xfbdfae, 0xf07a4a, 0x30224f],
    groundA: 0xbcaa5a,
    groundB: 0xae9c4e,
    groundSide: 0x847438,
    rim: 0x7c5b3e,
    underside: 0x5f4638,
    rock: 0x8c828a,
    water: 0x5c95b2,
    waterEdge: 0x40718c,
    tree: 'round',
    crown: 0xda6a2e,
    crownAccent: 0xf2a53c,
    trunk: 0x5a3e2c,
    tuft: 0xe28c3a,
    mist: 0xf4cfa2,
  },
};

/**
 * Colours and sizes of the interface, as CSS reads them. One palette, one corner radius.
 * `ink` on `paper` and `amberInk` on `amber` both pass WCAG AA (checked by a test).
 */
export const UI = {
  paper: '#faf0dc',
  /** Panel fill: paper with a little of the sky showing through. */
  paperAlpha: 0.9,
  ink: '#2a2233',
  inkSoft: '#5f566b',
  amber: '#f0a94a',
  amberInk: '#2a2233',
  /** Text laid straight on the sky, with a dark veil behind it. */
  light: '#fbeed2',
  veil: 'rgba(30, 22, 50, 0.6)',
  /** Medal colours on paper. */
  medalLamplighter: '#a8530f',
  medalGlow: '#7a5a12',
  medalSpark: '#5f566b',
  radiusPx: 14,
  gapPx: 10,
  /** Smallest tap target, in CSS pixels. */
  tapPx: 44,
} as const;

/** Which shape stands for which colour, for players who cannot tell the colours apart. */
export const COLOUR_SHAPE = {
  red: 'triangle',
  green: 'circle',
  blue: 'square',
} as const;

/** The sky lantern release after Lock in. Times in milliseconds, distances in tiles. */
export const RELEASE = {
  /** Pause after the last island lantern blooms before the sky lantern lifts. */
  delayMs: 500,
  /** How long the camera follows the lantern up. */
  riseMs: 5200,
  /** How high the lantern climbs while the camera follows. */
  riseHeight: 9,
  /** The lantern keeps drifting up at this speed (tiles per second) behind the result card. */
  driftSpeed: 0.35,
  /** Gentle sideways sway: width in tiles and period in milliseconds. */
  swayWidth: 0.25,
  swayPeriodMs: 3600,
  /** Reduced motion: the camera stays put and the lantern fades up over this long. */
  calmRiseMs: 4200,
  /** Size of the snoovatar or glyph on the lantern, in tiles. */
  portraitSize: 0.62,
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
   * Monday to Sunday. SPEC "Weekly ramp", with two changes: Saturday par capped at 6 (decided
   * Nov 12), and Monday has two suns and two lanterns (decided Nov 13) because one sun with
   * mirrors only can light a single lantern, which makes a thin nightfall. Tuesday's new idea
   * is therefore the fixed mirror, on a slightly larger island.
   * Difficulty bands were set from `npm run report` so each day sits above the one before.
   */
  templates: {
    monday: {
      sizes: [6],
      sources: [2, 2],
      colouredSourceChance: 0,
      fixedMirrors: [0, 0],
      builtMirrors: [2, 4],
      builtPrisms: [0, 0],
      lanterns: [2, 2],
      colouredLanternChance: 0,
      mixedLanterns: [0, 0],
      rockShare: 0.16,
      treeShare: 0.08,
      waterShare: 0,
      waterOnPathShare: 0,
      decoys: [0, 1],
      par: [2, 3],
      difficulty: [34, 56],
    },
    tuesday: {
      sizes: [7],
      sources: [2, 2],
      colouredSourceChance: 0,
      fixedMirrors: [1, 1],
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
      difficulty: [50, 70],
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
