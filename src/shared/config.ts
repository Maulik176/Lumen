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
   * A tap just off the island's edge goes to the nearest usable tile if one is within this many
   * tiles. On a 360 px phone an 8x8 island's tiles are about 36 px wide; this makes them easier
   * to hit.
   */
  tapSnapTiles: 0.45,
  /**
   * A tap on a tile nothing can be done with (rock, water, tree, a lantern) moves to the usable
   * tile beside it only when it lands this close to that tile's edge. Nov 20: at 0.45, a tap on
   * a rock or water on purpose put a mirror on the next tile.
   */
  tapSnapInside: 0.12,
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
  /** The Island Builder (BUILDER_PLAN.md). One line each, in the game's voice. */
  builderTitle: 'Island Builder',
  builderOpen: 'Build an island',
  builderName: 'Name your island',
  builderWorld: 'World',
  builderSize: 'Size',
  builderSpare: 'Spare mirrors',
  /** Opens the panel with world, size and spare mirrors, and closes it. */
  builderIsland: 'Island',
  builderDone: 'Done',
  builderTools: {
    sun: 'Sun',
    lantern: 'Lantern',
    rock: 'Rock',
    tree: 'Tree',
    water: 'Water',
    stone: 'Stone',
    eraser: 'Erase',
  },
  /** Spoken names for the tool buttons, where the short label is not enough. */
  builderToolNames: {
    sun: 'Sun crystal',
    lantern: 'Lantern',
    rock: 'Rock',
    tree: 'Tree',
    water: 'Water',
    stone: 'Stone mirror',
    eraser: 'Eraser',
  },
  builderBiomes: {
    moss: 'Moss',
    snow: 'Snow',
    blossom: 'Blossom',
    dune: 'Dune',
    autumn: 'Autumn',
  },
  builderUndo: 'Undo',
  builderRedo: 'Redo',
  builderClear: 'Clear',
  builderCheck: 'Check island',
  builderChecking: 'Checking\u2026',
  builderCheckingLine: 'Checking your island\u2026',
  builderTest: 'Test your island',
  builderNext: 'Next',
  builderSkip: 'Skip',
  builderClose: 'Close the Builder',
  builderHelp: 'Pick a tool and tap a tile. Tap again to turn it.',
  /** After a check: what players will get. {pieces} reads like "4 mirrors and 1 prism". */
  builderChecked: 'Par {par} \u00b7 {pieces} \u00b7 {label}',
  builderMirrors: '{count} mirrors',
  builderMirrorsOne: '1 mirror',
  builderPrisms: ' and {count} prisms',
  builderPrismsOne: ' and 1 prism',
  builderLabels: { gentle: 'Gentle', tricky: 'Tricky', fiendish: 'Fiendish' },
  /** After the maker's own test: {count} is the pieces they used. */
  builderTested:
    'Lit with {count} (par {par}) \u00b7 {label}. Ready to publish.',
  /** The tutorial's test step, once the check has said what the island is. */
  builderLessonTest: 'Par {par} \u00b7 {label}. Light it yourself',
  /** The main button once the maker has lit their island, while it is publishing elsewhere. */
  builderLit: 'Lit by you',
  builderTestLeft: 'Light every lantern yourself to finish the test.',
  /** The server no longer has this island's check (it expired, or another check replaced it). */
  builderTestRecheck: 'Check your island again, then test it.',
  builderTestFailed: 'The test could not start. Try again.',
  /** Shown while the name has a character it cannot use. */
  builderNameRule: "Names use letters, numbers, spaces, ' and -.",
  /** Publishing: the main button once the maker has lit their island, and its confirm panel. */
  builderPublish: 'Publish',
  builderPublishing: 'Publishing\u2026',
  builderNotYet: 'Not yet',
  builderConfirmTitle: 'Publish your island',
  /** True however Reddit shows the author: the title and the game always credit the maker. */
  builderConfirmLine: 'Posts to r/{sub} as an island by u/{name}',
  /** The name shown in the confirm panel when the maker left it blank: the island gets a number. */
  builderConfirmUnnamed: '{world} Island #\u2026',
  builderPublished: 'Your island is up.',
  builderPublishedButton: 'Published',
  builderPublishProblems: {
    'signed-out': 'Sign in to publish your island.',
    'not-tested': 'Light it yourself first, then publish.',
    'not-checked': 'Check your island again, then test it.',
    changed: 'Your island changed. Check and test it again.',
    name: 'Pick another name.',
    limit: 'Three islands a day. Publish this one tomorrow.',
    duplicate: 'That island is already out there. Change a tile or two.',
    busy: 'Still publishing\u2026',
    off: 'Publishing is resting. Try again later.',
    failed: 'Could not post. Your island is saved; try again in a moment.',
  },
  /** "Your islands" in the Builder. */
  builderYours: 'Your islands',
  builderYoursEmpty: 'Islands you publish will be here.',
  builderYoursRow: '{plays} \u00b7 {par} at par',
  builderYoursTakenDown: 'Taken down',
  builderYoursBack: 'Back to the Builder',
  /** Community islands: post title, fallback name, and the text Reddit keeps for the post. */
  communityTitle: 'Island by u/{maker} \u00b7 {name}',
  communityFallbackName: '{world} Island #{n}',
  communityPostText: '{name}: a Lumen island by u/{maker}. Par {par}.',
  /** In the game's top bar and on the feed card. */
  communityBy: 'by u/{maker}',
  communityKicker: 'Island by u/{maker}',
  communityCardLine: 'Par {par} \u00b7 {label} \u00b7 {lanterns}',
  communityLit: '{count} players lit it',
  communityLitOne: '1 player lit it',
  communityLitNone: 'Be the first to light it',
  communitySeeSky: 'See the sky',
  communityRank: '{time} \u00b7 #{rank} on this island',
  /** On the result card of a community island: the daily post. */
  communityTonight: "Tonight's Lumen",
  /** A community post whose island was removed, or while the community side is switched off. */
  communityTakenDown: 'This island was taken down.',
  communityResting: 'This island is resting.',
  /** "See others' islands" on a community island: the maker's own test, pinned first. */
  creatorBoard: "Creator's board",
  /** A row that stands for several players with exactly the same board. */
  samePlayers: '{count} players',
  /** The results comment on a community post. Emoji allowed: it is a Reddit comment. */
  communityResultsNone:
    'Results for {island} by u/{maker}. Be the first to light it, then share yours below \ud83d\udc47',
  communityResultsOne:
    'Results for {island} by u/{maker}: 1 player lit it{par}. Share yours below \ud83d\udc47',
  communityResultsMany:
    'Results for {island} by u/{maker}: {solves} players lit it{par}. Share yours below \ud83d\udc47',
  builderTestNote: 'Test \u00b7 {name}',
  builderTestBack: 'Back to the Builder',
  builderUnnamed: 'Your island',
  builderSaved: 'Saved',
  builderProblems: {
    'no-sun': 'Place a sun first.',
    'no-lantern': 'Place a lantern for the light to reach.',
    'already-lit': 'A lantern is lit already. Move it from the light.',
    'too-easy': 'One piece lights it. Block the easy way.',
    unsolvable: 'Six pieces cannot light it. Open a path.',
    'too-complex': 'Too complex to verify. Try removing a piece.',
    duplicate: 'Same as another island. Change a tile or two.',
    malformed: 'Something is off with this island. Try Clear.',
    'signed-out': 'Sign in to check and share your island.',
    'slow-down': 'One moment, then check again.',
    off: 'The Builder is resting. Try again later.',
    failed: 'Could not check it. Try again in a moment.',
    'too-many-suns': 'Three suns at most.',
    'too-many-lanterns': 'Six lanterns at most.',
  },
  /** The first-island tutorial: one line per step. */
  builderLessons: {
    biome: 'Pick a world for your island',
    sun: 'Tap a tile to place a sun',
    turn: 'Tap the sun again to turn its light',
    lantern: 'Place a lantern out of the light',
    colour: 'Tap the lantern to colour it',
    block: 'Block the easy way with a rock',
    spare: 'Spare mirrors: more makes it gentler',
    check: 'Check your island',
    test: 'Now light it yourself',
  },
  /** Feed card and expanded-view title. {day}, {name}, {weekday} are filled in. */
  postTitle: 'Lumen #{day} · {name} · {weekday}',
  /** Feed card, one line under the title. {lanterns} is the lantern count. */
  previewLine: '{lanterns} lanterns wait in the dusk.',
  previewLineOne: 'One lantern waits in the dusk.',
  /** The one big button on the feed card. */
  playButton: 'Light the lanterns',
  /** Feed card, top: number, weekday, par. */
  cardKicker: 'Lumen #{day} \u00b7 {weekday} \u00b7 par {par}',
  /** Feed card once the player has locked in: their night in one line, and the way back in. */
  cardSolved: 'Lit \u00b7 {pieces} (par {par})',
  cardRank: '#{rank} tonight',
  cardSeeSky: "See tonight's sky",
  cardSeeSkyPast: "See that night's sky",
  /** A post whose island is not tonight's: said on the feed card and in the game. */
  practicePast: "Practice \u00b7 this island's night has passed",
  practiceFuture: 'Practice \u00b7 not open yet',
  /** The same, short, under the island's number in the top bar. */
  practiceShort: 'Practice island',
  cardPractice: 'Play for practice',
  /** Leads from any other post to tonight's. */
  toTonight: "\u2190 Tonight's island",
  cardSkyPast: '{count} lit it on its night',
  cardNext: 'Next island in {time}',
  /** Feed card: how many players have lit this island. */
  cardSky: '{count} lanterns lit tonight',
  cardSkyOne: '1 lantern lit tonight',
  cardSkyNone: 'Be the first to light it tonight',
  /** Read by screen readers for the small outline of today's island. */
  cardOutline: "Today's island",
  /** First play only: shown until the first piece is placed. */
  hintPlace: 'Bend the light into the lantern',
  /** First play only: shown after the first piece, until a piece is turned. */
  hintTurn: 'Tap it again to turn it',
  /** First play only, on days with a prism: shown once a mirror has been turned. */
  hintPrism: 'A third tap makes a prism',
  /** Tutorial: the three small islands a first-time player meets. Title, then one hint each. */
  tutorialTitle: 'First light',
  tutorialMirror: 'Bend the light into the lantern',
  tutorialTurn: 'Tap it again to turn it',
  tutorialPrism: 'A third tap makes a prism: it splits light',
  tutorialSkip: 'Skip',
  /** The fourth tutorial island: no hints, no hand. */
  tutorialSolo: 'Your turn',
  /** Its line: mirrors left; then, once both are down and the lantern is still dark, the way back. */
  tutorialSoloLeft: 'Your turn · {count} mirrors to place',
  tutorialSoloLeftOne: 'Your turn · 1 mirror to place',
  tutorialSoloNone: 'Your turn · no mirrors left',
  tutorialSoloStuck: 'Tap a placed mirror to turn or lift it',
  tutorialAgain: 'Start again',
  /** One-time rule cards: one line each, the first time a player meets the thing. */
  ruleFixed: 'Stone mirrors are fixed. They turn the light, but never move.',
  ruleWater: 'Light crosses water. Pieces cannot stand on it.',
  ruleColour: 'A coloured lantern needs light of its own colour.',
  ruleMixed: 'A two-colour lantern needs both of its colours at once.',
  gotIt: 'Got it',
  /** A first-time player arriving on a hard day (Thursday to Saturday). */
  warmUpAsk: 'Warm up on an easier island first?',
  warmUpWhy: 'Tonight is one of the harder islands of the week.',
  warmUpYes: 'Warm up first',
  warmUpNo: 'Go straight to today',
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
  /** Result card: the streak line, and the note on a solve that does not count. */
  streakOne: 'First night of a new streak',
  streakMany: '{streak} nights in a row',
  /** Result card, a solve that was never ranked (signed out, or an island from another night). */
  unranked: 'Played for practice',
  /** Result card, time and place on tonight's board. */
  rankLine: '{time} · #{rank} tonight',
  /** The small label on the player's own lantern, and the name shown when a lantern is tapped. */
  you: 'You',
  skyName: 'u/{name}',
  /** The same, for a lantern from the night before, shown faintly on a quiet night. */
  skyNameLastNight: 'u/{name} \u00b7 last night',
  /** Shown once, as the player's first-ever lantern rises. */
  skyJoin: "Your lantern joins everyone who lit tonight's island.",
  /** While the lantern rises on a quiet night, when last night's lanterns are shown faintly. */
  skyQuietFirst: "First lantern tonight. The faint ones are last night's.",
  skyQuiet: "{count} lanterns tonight. The faint ones are last night's.",
  /** Top bar and feed card: runs the three first-light islands again. */
  howToPlay: 'How to play',
  /** Feed card: the whole game in one line. */
  previewGoal: 'Place mirrors. Bend the light into every lantern.',
  /** A quiet line when someone else's lantern rises. {name} is a username, {island} today's island. */
  skyLine: 'u/{name} just lit {island}',
  /** Result card footer. */
  comeBack: 'Come back at nightfall tomorrow.',
  /** Result card: replay without ranking. */
  playAgain: 'Play again for practice',
  /** Result card: opens the list of earlier islands, where practice lives. */
  explore: 'Explore past islands',
  /** Trailer mode (moderators only, for the demo video). */
  trailerStart: 'Tap to start trailer',
  trailerTitle: 'Lumen',
  trailerLine: 'A new island every night.',
  /** The Archipelago: the night map of past islands. */
  mapTitle: 'Archipelago',
  mapHint: 'Islands glow by how many lit them',
  mapDetail: '#{day} \u00b7 {weekday} \u00b7 {count} lit',
  mapUnlit: 'Not yet lit',
  pastEmpty: 'Earlier islands will gather here.',
  /** Tonight's board, opened from the time and place on the result card. */
  boardTitle: "Tonight's board",
  boardTonight: 'Tonight',
  boardAllTime: 'All time',
  boardEmpty: 'No lanterns yet tonight.',
  /** A row's detail. {pieces} and {time}; all time: {medals} nights at par. */
  boardRow: '{pieces} pieces · {time}',
  boardRowOne: '1 piece · {time}',
  allTimeRow: '{medals} nights at par',
  allTimeRowOne: '1 night at par',
  /** Result card: opens the night's top islands, each with its pieces as placed. */
  others: "See others' islands",
  /** {percent} of solves at par. Tonight, and for an island from an earlier night. */
  crowdPar: '{percent}% hit par tonight',
  crowdParPast: '{percent}% hit par that night',
  crowdFew: 'You are among the first tonight.',
  crowdFewPast: 'Only a few lit it that night.',
  /** The same lines on a community island, which has no nights. */
  crowdParIsland: '{percent}% hit par',
  crowdFewIsland: 'You are among the first to light it.',
  communityBoardTitle: "This island's board",
  communityBoardEmpty: 'No lanterns here yet.',
  othersHint: 'Tap an island to see how it was lit.',
  /** The player's own island, first in the list. */
  othersMine: 'Your island',
  othersEmpty: 'No other islands yet tonight.',
  /** Looking at one island: back to the list. */
  othersList: 'All islands',
  /** The par answer as a row of its own, on an earlier night's list. */
  othersPar: 'The par answer',
  othersParDetail: '{par} pieces',
  crowdLocked: 'Lock in first to see everyone else.',
  /** Closes a list and returns to the result card. */
  back: 'Back',
  /** Leaves a past island and returns to tonight's. */
  backToTonight: 'Back to tonight',
  /** Leaves an island opened from the map and returns to the map. */
  backToIslands: 'Back to islands',
  /** Top bar of an island opened from the map, and of a newcomer's warm-up island. */
  practiceNamed: 'Practice · {name}',
  warmUpNamed: 'Warm-up · {name}',
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
  /** Result card, after a ranked solve: posts the result as the player's own comment. */
  share: 'Share to comments',
  /** The app's stickied comment on each post, which shared results reply to. */
  resultsNone:
    "Tonight's results for Lumen #{day} \u00b7 {island}. Be the first to light it, then share yours below \ud83d\udc47",
  resultsOne:
    "Tonight's results: 1 player lit {island}{par}. Share yours below \ud83d\udc47",
  resultsMany:
    "Tonight's results: {solves} players lit {island}{par}. Share yours below \ud83d\udc47",
  /** The middle of that line: how many hit par. Left out when nobody has. */
  resultsPar: ', {hits} hit par',
  sharing: 'Posting\u2026',
  shared: 'Shared in the comments',
  /** After sharing, when the reply can be opened: a drawn tick comes before these words. */
  sharedView: 'Shared \u00b7 View comment',
  /** The comment itself. Emoji are allowed here: it is a Reddit comment, not game UI. */
  /**
   * The shared result's first line. It names the player: until the app is approved, Reddit posts
   * it from the app's own account for everyone but the owner (seen Nov 17), so without the name
   * nobody could tell whose result it was.
   */
  shareLine:
    'u/{name} \u00b7 Lumen #{day} \u00b7 {lanterns} \u00b7 {pieces} (par {par}) \u00b7 \u23f1 {time}',
  /** The same line on a community island: its name and maker instead of the day. */
  shareLineCommunity:
    'u/{name} \u00b7 {island} by u/{maker} \u00b7 {lanterns} \u00b7 {pieces} (par {par}) \u00b7 \u23f1 {time}',
  shareStreak: '{medal} \u00b7 \ud83d\udd25 {streak}-night streak',
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
  /**
   * Edge smoothing is used on screens with a pixel ratio below this. Phones' graphics chips
   * smooth edges cheaply, and without it the lantern's edges looked jagged on iPhone (ratio 3),
   * so it is on everywhere. Lower it to 2 only if a phone measures under 45 fps.
   */
  antialiasBelowRatio: 4,
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
  /**
   * Room always kept under the top bar for the one-line hint or notice, in CSS pixels, whether
   * or not a line is showing: the island must never move when a hint comes or goes.
   */
  hintRoomPx: 36,
  /** An unfinished board is saved this long after the last change, in ms. */
  saveAfterMs: 900,
  /**
   * A view at least this wide and this much wider than tall (a laptop) gets the landscape
   * layout: bars centred at `wideBarPx`, and the result card and lists in a column on the right,
   * `widePanelPx` wide and `wideGapPx` from the edge, with the island framed in the rest.
   */
  wideMinWidth: 760,
  wideMinAspect: 1.2,
  wideBarPx: 560,
  widePanelPx: 350,
  wideGapPx: 28,
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
  /** Colour of the daylight in the afternoon and at dusk. Snow uses a cooler light. */
  sunDay: Hex;
  sunDusk: Hex;
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
    sunDay: 0xffe6bd,
    sunDusk: 0xff9d6b,
  },
  snow: {
    skyTop: [0xc3d9ee, 0x56589a, 0x0a0d28],
    skyHorizon: [0xeef3f8, 0xeeb0a8, 0x27305e],
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
    sunDay: 0xf3f7ff,
    sunDusk: 0xf6c4c8,
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
    sunDay: 0xffe6c8,
    sunDusk: 0xff9d86,
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
    sunDay: 0xffe2ae,
    sunDusk: 0xff9458,
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
    sunDay: 0xffe0b0,
    sunDusk: 0xff9460,
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
  /** The night behind the feed card's words, solid and half-clear. */
  night: '#1a1430',
  nightSoft: 'rgba(26, 20, 48, 0.78)',
  /** Medal colours on paper. */
  medalLamplighter: '#a8530f',
  medalGlow: '#7a5a12',
  medalSpark: '#5f566b',
  /** The drawn emblems: gold for Lamplighter, silver for Glow, bronze for Spark. */
  emblemGold: '#e0a526',
  emblemSilver: '#aeb4c2',
  emblemBronze: '#b9743f',
  radiusPx: 14,
  gapPx: 10,
  /** Smallest tap target, in CSS pixels. */
  tapPx: 44,
} as const;

/**
 * The island as a floating diorama rather than a board: soft ground with no grid lines, rock
 * fading into mist underneath, small islets nearby, glowing suns, and a deep sky.
 */
export const ART = {
  /** How much of the two ground tones' difference survives (0 = one tone, 1 = full chequer). */
  chequer: 0.22,
  /** Each tile is this much lighter or darker than its neighbours at most, and this much higher or lower (tiles). */
  tileShade: 0.1,
  /**
   * Soft seams: each tile's top darkens to this share of its colour at its very edge, over this
   * much of a tile's width. Enough to see the squares, never a drawn line.
   */
  seam: 0.8,
  seamWidth: 0.1,
  tileLift: 0.09,
  /** Lanterns are drawn this many times their modelled size. */
  lanternScale: 1.45,
  /**
   * Sun crystals: halo size in tiles and its brightness, ray size, one slow pulse in ms, one turn
   * of the rays in ms. Rays were 3.1 tiles: two suns side by side merged into one flare.
   */
  sunHalo: 1.5,
  sunHaloOpacity: 0.7,
  sunRays: 2.4,
  sunPulseMs: 2800,
  sunTurnMs: 46_000,
  sunRayOpacity: 0.5,
  /** The rock under the island fades toward the mist colour this much at its lowest point. */
  undersideFade: 0.78,
  /** Small islets floating near the island, at its corners and below it. */
  islets: 4,
  /** Night sky: brightness of the milky-way band, and how many extra faint stars lie along it. */
  milkyWay: 0.5,
  bandStars: 700,
  /** Day and dusk sky: strength of the thin cloud wisps, and of the darkening below the island. */
  wisps: 0.2,
  deepSky: 0.7,
} as const;

/**
 * Light on pale ground (shared/glare.ts). Ground lighter than `paleFrom` (relative luminance,
 * 0 to 1) starts to get help, reaching full help at `paleTo`: beams get a soft shaded lining up
 * to `edgeMax` (share of the ground darkened beside the beam), and suns' halos and rays drop to
 * `sunMin` of their strength. Moss (0.36) gets nothing; snow (0.9) gets the most.
 */
export const GLARE = {
  paleFrom: 0.4,
  paleTo: 0.85,
  edgeMax: 0.5,
  sunMin: 0.5,
} as const;

/**
 * The Island Builder and community islands (BUILDER_PLAN.md). Players build an island, the
 * server proves it and sets par, the maker lights it themselves, then it is posted.
 */
export const COMMUNITY = {
  /** The whole community side: Builder buttons, menu item and endpoints. Off = the daily game only. */
  enabled: true,
  /** Board sizes on offer, and the one a new island starts at. 8 gives 44 px tiles at 360 px wide. */
  sizes: [6, 7, 8],
  defaultSize: 7,
  maxSuns: 3,
  maxLanterns: 6,
  /** Par must land in this range. Below: too easy to be a puzzle. Above: the solver stops looking. */
  minPar: 2,
  maxPar: 6,
  /**
   * The solver looks for par with up to maxPar mirrors and this many prisms. The island then
   * gets par's own mirrors plus the creator's spare mirrors, and exactly par's prisms.
   */
  searchPrisms: 2,
  /** Spare mirrors the creator may give players, and the default. More is gentler. */
  spareChoices: [0, 1, 2],
  defaultSpare: 1,
  /**
   * Search nodes for the server's check, and the time it must stay under. Nodes, because the
   * engine cannot read a clock; each check logs nodes and milliseconds so this can be set from
   * Devvit's real speed (BUILDER_PLAN.md 1.6). Over the limit: "too complex to verify".
   * Nov 19: 400,000 nodes took 1.12 s on Reddit's server, so doubled (Maulik): about 2.3 s at
   * worst there, about 7 s on a laptop.
   */
  solveNodes: 800_000,
  solveBudgetMs: 8000,
  /** One check per player every this many seconds. */
  checkGapSeconds: 3,
  /** Difficulty score bands for the labels (daily Sunday runs 60–82, Saturday 94–120). */
  trickyFrom: 70,
  fiendishFrom: 94,
  nameMax: 24,
  /** Edits the Builder can undo. */
  undoSteps: 100,
  /** How long a draft and a passing test are kept, in seconds. */
  draftSeconds: 30 * 86_400,
  testSeconds: 86_400,
  /**
   * Community islands share every day-keyed system (board, sky, pieces, others' islands) by
   * taking island numbers from here up; daily days are 1-90 and the hero island 900-904.
   */
  numberBase: 1_000_000,
  /** Islands one player may publish in a UTC day. */
  publishPerDay: 3,
  /** "Your islands" lists this many, newest first. */
  yoursShown: 60,
  /** "Dev: clean up this subreddit" and the dev reset read at most this many islands. */
  cleanUpMax: 500,
  /** A publish attempt's answer is kept this long, so a retry with the same token gets it again. */
  tokenSeconds: 86_400,
  /** One publish of the same island at a time; a claim older than this may be retried. */
  publishLockSeconds: 60,
  /**
   * Island names are refused when a word, or letters spaced or swapped to hide one, is on this
   * list. Short on purpose: Reddit's own filters see every post too.
   */
  blockedWords: [
    'fuck',
    'fucker',
    'fucking',
    'shit',
    'shitty',
    'cunt',
    'cock',
    'dick',
    'pussy',
    'bitch',
    'bastard',
    'whore',
    'slut',
    'piss',
    'wank',
    'twat',
    'porn',
    'sex',
    'nazi',
    'hitler',
    'rape',
    'nigger',
    'nigga',
    'faggot',
    'fag',
    'retard',
    'spic',
    'kike',
    'chink',
    'tranny',
  ],
} as const;

/** The Builder's flat board and its timings. */
export const BUILDER_VIEW = {
  /** Gap between the board and the screen's edge, in CSS pixels (4 keeps 8x8 tiles at 44 px on a 360 px phone). */
  gutterPx: 4,
  /** Drawn at no more than this many device pixels per CSS pixel. */
  maxPixelRatio: 3,
  /** The light's glow and its bright core, as a share of a tile's width. */
  beamGlow: 0.42,
  beamCore: 0.12,
  /** The ring on a tile just tapped. */
  flashMs: 380,
  /** A draft is saved this long after the last change. */
  saveAfterMs: 900,
  /**
   * While the server checks an island, a band of light sweeps across the board, once per this
   * many ms; the sweep shows for at least checkMinMs, so a quick answer still reads as a check.
   */
  checkSweepMs: 1100,
  checkMinMs: 900,
  /**
   * After publishing (Nov 20: the first version was too quick to feel): night falls over the
   * board in celebrateDuskMs, the lanterns bloom one after another celebrateStepMs apart with a
   * rising chime, motes of light drift up from each (celebrateMotes, over celebrateRiseMs) and
   * one sky lantern lifts away, then the board holds for celebrateHoldMs before the new post
   * opens. Reduce Motion: the same night and blooms, nothing rising.
   */
  celebrateDuskMs: 600,
  celebrateStepMs: 380,
  celebrateHoldMs: 2000,
  celebrateMotes: 12,
  celebrateRiseMs: 2400,
  /** A bloom's size, in tiles. */
  celebrateBloomTiles: 2.4,
  /** The island's picture in the confirm panel, in CSS pixels. */
  confirmPictureWidth: 168,
  confirmPictureHeight: 112,
  /** Each island's picture in "Your islands". */
  yoursPictureWidth: 64,
  yoursPictureHeight: 44,
  /** After the maker lights their island in the test, night falls; the Builder returns after this. */
  testDoneMs: 1400,
  /**
   * The longest line the hint row shows on one row, in characters. Measured Nov 19 at 360 px wide
   * (13 px system font, about 6 px a letter): 320 px for a line on its own, 263 beside Skip, 205
   * beside Next and Skip. Kept a little under, since letters vary in width.
   */
  lineChars: 50,
  lessonChars: 38,
  lessonNextChars: 30,
} as const;

/** First-time teaching: the goal shown before any words. Times in milliseconds. */
export const ONBOARD = {
  /** How fast light visibly travels when it first appears, in tiles per second. */
  introLightSpeed: 4.5,
  /** How fast it travels after a piece is placed or turned. Quick, but seen. */
  playLightSpeed: 16,
  /** The sun crystal's pulse while the player has not placed anything: size and period. */
  sunPulse: 0.16,
  sunPulseMs: 1500,
  /** An unlit lantern's slow breathing while it waits: brightness and period. */
  lanternBreath: 0.22,
  lanternBreathMs: 2600,
  /** The ghost hand: one tap takes this long, with this pause before the next. */
  handTapMs: 620,
  handPauseMs: 900,
  /** Wait this long after a tutorial island is lit before the next one arrives. */
  tutorialNextMs: 1500,
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
  riseMs: 7000,
  /** Once aloft it hovers, in view, this long before the result card comes. */
  hoverMs: 2600,
  /** The camera looks this far below the lantern (tiles), so it floats in the upper part of the view. */
  lookBelow: 0.35,
  /** How high the lantern climbs while the camera follows. */
  riseHeight: 9,
  /** The lantern keeps drifting up at this speed (tiles per second) behind the result card. */
  driftSpeed: 0.16,
  /** Gentle sideways sway: width in tiles and period in milliseconds. */
  swayWidth: 0.25,
  swayPeriodMs: 3600,
  /**
   * Reduced motion: the camera stays put. The lantern climbs this far, slowly, staying in view
   * above the island, then fades into the stars.
   */
  calmRiseMs: 6000,
  calmRiseHeight: 3.4,
  /** Height of the snoovatar or glyph printed on the lantern's paper, in tiles (the shade is 0.78). */
  portraitSize: 0.46,
  /** The snoovatar is redrawn this tall (pixels) before it reaches the graphics card. */
  portraitPx: 512,
  /** Sharper picture when seen at an angle (the graphics card caps it at its own limit). */
  portraitAnisotropy: 8,
  /** Sides of the lantern's round paper shade: more is smoother at its edge. */
  shadeSides: 40,
  /** After rising, the lantern keeps drifting up at `driftSpeed`, easing to stop this far higher. */
  driftHeight: 0.8,
  /** Reopening a solved post in calm mode: how far up its climb the lantern is shown. */
  calmHoldRise: 0.7,
  /** A practice lantern: how long it rises before it is gone, and how faint it is. */
  practiceMs: 2600,
  practiceOpacity: 0.4,
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
   * Reject an island the solver needs more nodes than this to prove. Measured Nov 16 on a laptop
   * running on battery: 8x8 and 9x9 islands cost 13 to 20 microseconds per node, so 66,000 nodes
   * is about 1.3 s, inside the 2 s check even off the mains. (It was 150,000, assuming 5 us per
   * node; days 26, 47 and 89 were regenerated under the new limit. Day 46, at 65,648 nodes, is
   * the costliest day kept, so the limit must not go below that without regenerating it too.)
   */
  maxSolveNodes: 66_000,
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

/** Streaks. A streak counts days in a row with a ranked solve. */
export const STREAK = {
  /** Missed days forgiven per week (Monday to Sunday, UTC). A forgiven day adds nothing. */
  graceDaysPerWeek: 1,
  /**
   * Sky-lantern styles, by the streak that unlocks them. Everyone starts with the plain one.
   * Listed from the longest streak down.
   */
  styles: [
    { days: 30, style: 'comet' },
    { days: 14, style: 'koi' },
    { days: 7, style: 'star' },
    { days: 3, style: 'paper' },
    { days: 0, style: 'plain' },
  ],
  /** User flair in the game's subreddit: "{medal} 🔥{streak}". Emoji is allowed in flair only. */
  flair: '{medal} 🔥{streak}',
} as const;

export type LanternStyle = (typeof STREAK.styles)[number]['style'];

/** The Shared Night Sky. Distances in tiles, times in milliseconds. */
export const SKY = {
  /** Lanterns kept and drawn for one night. More than this shows only as the count. */
  maxLanterns: 300,
  /** How many of the nearest lanterns carry their player's snoovatar. The rest are small lights. */
  portraits: 8,
  /**
   * Far lanterns float between these distances beyond the island, across the slice of sky the
   * camera faces, between these heights while playing (see `viewFill` and the bands below).
   */
  ringNear: 18,
  ringFar: 44,
  heightLow: -32,
  heightHigh: 18,
  /**
   * Every lantern stays inside the camera's picture: its sideways place uses this share of the
   * view's real half-width at its distance, whatever the screen's shape. Once the camera is
   * aloft, each lantern climbs through the band the camera sees at its distance, from this
   * share of the half-height below the line of sight to this share above it (the result card
   * covers the lower part of the picture). A lantern sways this many tiles side to side.
   */
  viewFill: 0.85,
  bandBelow: 0.45,
  bandAbove: 0.9,
  sway: 0.4,
  /**
   * About this many lanterns are in view at once. With more, the band they climb through grows
   * taller in proportion, so the extra ones are above or below the picture at any moment and a
   * busy night never smothers the player's own lantern. With fewer, every one is always in view.
   */
  comfortable: 28,
  /** A new arrival starts this far (0..1) into its climb, so it rises into view. */
  arrivalClimb: 0.04,
  /** They drift upward this fast, in tiles per second, and wrap around at the top. */
  riseSpeed: 0.22,
  /** Size of a far lantern in pixels at pixel ratio 1, and how much brighter it is at night. */
  pointSize: 42,
  /** A lantern is drawn at that size when this far from the camera (tiles); nearer ones larger. */
  fullSizeAt: 34,
  /** Each lantern's picture is painted into a square cell of one shared sheet: cell size in
   *  pixels, and cells per row. */
  cellPx: 72,
  sheetColumns: 20,
  /** Snoovatars are fetched for at most this many lanterns a night; the rest show a letter seal. */
  snoovatarLoads: 60,
  dayOpacity: 0.3,
  /** Portrait lanterns: ring distance, heights, size in tiles. */
  portraitRing: 13,
  portraitLow: 2,
  portraitHigh: 12,
  portraitSize: 1.5,
  /** How long "u/name lit Moss Steps" stays on screen, and the least time between two of them. */
  lineMs: 3000,
  lineGapMs: 1500,
  /**
   * While you play, another player's solve also sends a small faint lantern up through the
   * empty sky above the island: its height and how faint (CSS pixels, 0..1), how long it takes,
   * how far in from the side (share of the width), the space kept clear above and below it, and
   * the least gap that has room for it. Reduced motion: no lantern, the line only.
   */
  arrivalPx: 22,
  arrivalOpacity: 0.55,
  arrivalMs: 5200,
  arrivalSide: 0.1,
  arrivalClearPx: 6,
  arrivalMinGapPx: 64,
  /** At most this many such lanterns in the air at once. */
  arrivalMax: 3,
  /** A tapped lantern shows its player's name for this long; a tap counts within this many pixels. */
  nameMs: 2000,
  /**
   * A quiet night: with fewer lanterns than this, last night's are shown too, at this share of
   * full brightness and named "last night" when tapped. Real players only, never invented ones.
   */
  quietBelow: 10,
  lastNightOpacity: 0.45,
  /** How long the once-only line about the player's first lantern stays, in ms. */
  joinLineMs: 5200,
  /** The same line when the quiet-night line follows it: short, then it goes by itself. */
  joinLineQueuedMs: 2000,
  /** The quiet-night line (you were first, or how many tonight; the faint ones are last night's). */
  quietLineMs: 5200,
  /**
   * The pause between one of these lines going and the next appearing. Longer than the line's
   * 600 ms fade (game.css .sky-line), so the first has fully closed before the next opens.
   */
  noteGapMs: 700,
  tapReachPx: 30,
  /** Seconds of other players' lanterns a late joiner's request may be cached for. */
  cacheSeconds: 5,
} as const;

/** How long things are kept in Redis, in seconds. */
export const KEEP = {
  startSeconds: 2 * 86_400,
  submissionSeconds: 45 * 86_400,
  /** An unfinished board is kept this long, so a post reopened the same night picks up where it was. */
  progressSeconds: 2 * 86_400,
  skySeconds: 45 * 86_400,
} as const;

/** "See others' islands": the top of the night's board, each island with its pieces as placed. */
export const OTHERS = {
  /** Islands listed, in the board's order, besides the player's own. */
  top: 10,
  /**
   * Identical boards are listed once, with how many players placed them; the list reads this
   * many rows down the board to find `top` different ones.
   */
  scan: 40,
  /** Below this many solves the share at par is not shown; a gentler line is. */
  fewSolves: 5,
  /** How long the camera takes to come down to the island, or go back up, in ms. */
  cameraMs: 1500,
  /** The small picture of each island in the list, in CSS pixels. */
  previewWidth: 92,
  previewHeight: 54,
  /**
   * Placed pieces in that picture: mirror length and prism size, against half a tile's width.
   * Lantern glow is kept small there (also against half a tile) so the pieces stay readable.
   */
  previewMirror: 1.5,
  previewPrism: 0.62,
  previewGlow: 1.3,
} as const;

/** The app's stickied results comment. */
export const COMMENT = {
  /** It is rewritten with the latest counts at most once in this many seconds. */
  minGapSeconds: 60,
} as const;

/** The feed card. */
export const CARD = {
  /**
   * With nothing remembered on this device, the main button waits this long for the server to
   * say whether the island is already solved, so "Light the lanterns" never flashes first.
   */
  holdMs: 450,
  /** The countdown to the next island is redrawn this often. */
  tickMs: 30_000,
  /** Today's island outline: canvas size in CSS pixels. */
  outlineWidth: 92,
  outlineHeight: 62,
} as const;

/** Tonight's board and the all-time board. */
export const LEADERBOARD = {
  /** Rows shown above the player's own. */
  top: 10,
} as const;

/** "Explore past islands": how many earlier islands the map shows, newest first. */
export const PAST = {
  max: 30,
} as const;

/** The Archipelago map. Sizes in CSS pixels. */
export const MAP = {
  /** Where the first island floats, and the distance down to each next one. */
  topPx: 150,
  rowPx: 168,
  /** The map is never wider than this; islands wind this share of its width either side. */
  maxWidthPx: 560,
  sway: 0.24,
  /** Each island's picture. */
  islandWidthPx: 132,
  islandHeightPx: 104,
  /** The glow behind an island: its width at no solves and at the most, and its least opacity. */
  glowMinPx: 110,
  glowMaxPx: 250,
  glowMin: 0.18,
  /** Stars per 700 px of map height, and one slow rise and fall of an island in ms. */
  starsPerScreen: 150,
  floatMs: 6000,
} as const;

/** Trailer mode: one unattended take for the demo video. Times in milliseconds. */
export const TRAILER = {
  /** After the first tap: the camera turns once, then the first piece goes down. */
  rotateAtMs: 900,
  startMs: 3000,
  /** From one piece to the next, and between the taps that turn one piece. */
  stepMs: 800,
  tapGapMs: 260,
  /** Held on the lit island before night, and on the sky before the title. */
  litHoldMs: 1400,
  skyHoldMs: 4000,
  /** A moderator who arms the trailer has this many seconds to open the game. */
  armedSeconds: 600,
} as const;

/**
 * Launch day. r/lumen_game_dev is both the playtest subreddit and the one players and judges
 * use (the app is never published during the hackathon), so on launch day this flips to true:
 * every dev tool that wipes data, posts test islands or moves the clock stops working there, the
 * clock ignores any shift left stored, and `npm run dev` refuses to start a playtest watcher
 * (every save would go live). Releases then go through `npm run release` (docs/LAUNCH.md).
 */
export const LAUNCH = {
  launched: false,
};

/** Developer tools that exist only on the playtest subreddit, and only until launch. */
export const DEV = {
  /** "Reset my Lumen progress" works in this subreddit and nowhere else. */
  resetSubreddit: 'lumen_game_dev',
  /** What a moderator sees when a dev tool is refused. */
  elsewhereToast: 'Only on the playtest subreddit',
  launchedToast: 'Dev tools are off: Lumen has launched.',
  /** "Dev: preview lantern styles" lasts this long (seconds) for the moderator who turned it on. */
  previewSeconds: 1800,
} as const;
