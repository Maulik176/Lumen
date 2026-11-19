/**
 * The play screen. Tonight's island lives on the page's own canvas. "How to play" and past
 * islands open on a layer above it, and closing them returns to tonight's island exactly as it
 * was left. Once tonight's island is locked in it is finished: reopening the post shows the
 * result over the night sky, not a board to play again.
 */
import {
  cleanSnoovatar,
  type IslandResponse,
  type LockInRequest,
  type LockInResponse,
  type PastResponse,
  type BuilderTestResponse,
  type BuilderTestStartResponse,
  type ShareResponse,
  type SkyLantern,
  type SkyResponse,
  stylePreviewLanterns,
} from '../../shared/api';
import { arrivalPath } from '../../shared/arrival';
import { warmUpDay, type Biome } from '../../shared/calendar';
import {
  BIOMES,
  BUILDER_VIEW,
  COMMUNITY,
  COPY,
  DEV,
  SKY,
  VIEW,
} from '../../shared/config';
import type { Placement } from '../../shared/types';
import type { BuilderHost, TestIsland, TestResult } from '../builder/builder';
import {
  hintFor,
  keepRefining,
  lockedWith,
  lockIn,
  reset,
  resumeWith,
  snapTile,
  startPlay,
  tapTile,
  undo,
  type PlayState,
  type PlayStep,
} from '../../shared/play';
import { puzzleFromText } from '../../shared/puzzle-text';
import { RULE_KINDS, rulesOn, type RuleKind } from '../../shared/rules';
import { releaseNotes } from '../../shared/skynote';
import { validatePlacements } from '../../shared/validate';
import { rememberSolved } from '../card-cache';
import { createSound, type Sound } from './audio';
import { createGhostHand } from './hand';
import { createJourney, quietJourney, type Journey } from './journey';
import { applyTheme, createHud, fill, type HudActions } from './hud';
import { boardSheet } from './board';
import { askWarmUp, ruleCard } from './cards';
import { loadOthers, othersSheet } from './others';
import { openArchipelago } from './archipelago';
import type { Rider } from './release';
import { createIslandView } from './scene';
import { onTap } from './taps';
import { runTrailer } from './trailer';
import { runTutorial } from './tutorial';

const HINTS_KEY = 'lumen.hints.done';
const TUTORIAL_KEY = 'lumen.tutorial.done';
const RULE_KEY = 'lumen.rule.';

const query = new URLSearchParams(location.search);

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`missing #${id}`);
  return node;
}

function stored(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function store(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Storage may be unavailable; hints then show again next time, which is harmless.
  }
}

function forget(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing was stored.
  }
}

const progressKey = (day: number): string => `lumen.progress.${day}`;

/** The unfinished board this device remembers for a day, unchecked. */
function localProgress(day: number): unknown {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(progressKey(day)) ?? 'null'
    );
    return value;
  } catch {
    return null;
  }
}

type Loaded = Extract<IslandResponse, { ok: true }>;

async function loadIsland(day: string | null): Promise<Loaded | null> {
  try {
    // ?trailer=1 and ?styles=1 are honoured only by the local test server; Reddit's decides.
    const trailer =
      (query.get('trailer') === '1' ? '&trailer=1' : '') +
      (query.get('styles') === '1' ? '&styles=1' : '');
    const response = await fetch(
      day === null
        ? '/api/island'
        : `/api/island?day=${encodeURIComponent(day)}${trailer}`
    );
    const body: IslandResponse = await response.json();
    return body.ok ? body : null;
  } catch {
    return null;
  }
}

async function loadPast(before: number): Promise<PastResponse | null> {
  try {
    const response = await fetch(`/api/past?before=${before}`);
    const body: PastResponse = await response.json();
    return body.ok ? body : null;
  } catch {
    return null;
  }
}

/** Tell the server something happened. Never waits, never fails the game. */
function tell(path: string, body: Record<string, unknown>): void {
  void fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** A night's sky: everyone already there, then (tonight only) each new lantern as it rises. */
async function joinSky(
  day: number,
  live: boolean,
  self: string | null,
  onList: (lanterns: SkyLantern[]) => void,
  onNew: (lantern: SkyLantern) => void
): Promise<void> {
  try {
    const response = await fetch(`/api/sky?day=${day}`);
    const body: SkyResponse = await response.json();
    if (body.ok) onList(body.lanterns);
  } catch {
    // The sky is decoration; the island plays without it.
  }
  if (!live) return;
  try {
    const { connectRealtime } = await import('@devvit/web/client');
    connectRealtime<SkyLantern>({
      channel: `sky_${day}`,
      onMessage: (lantern) => {
        if (typeof lantern.u !== 'string' || lantern.u === self) return;
        onNew({ u: lantern.u, s: lantern.s, a: cleanSnoovatar(lantern.a) });
      },
    });
  } catch {
    // Not inside Reddit, or realtime is unavailable: late lanterns simply do not appear.
  }
}

async function sendLockIn(
  request: LockInRequest,
  headers: Record<string, string>
): Promise<LockInResponse> {
  try {
    const response = await fetch('/api/lock-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(request),
    });
    const body: LockInResponse = await response.json();
    return body;
  } catch {
    return { ok: false, reason: 'bad-request' };
  }
}

/**
 * Who rides the sky lantern. Inside Reddit this comes from the post's context; when the page is
 * opened on its own for testing, ?user= and ?avatar= stand in.
 */
async function loadRider(): Promise<Rider> {
  const rider: Rider = {
    snoovatar: query.get('avatar'),
    username: query.get('user'),
  };
  try {
    const { context } = await import('@devvit/web/client');
    rider.username = context.username ?? rider.username;
    rider.snoovatar = context.snoovatar ?? rider.snoovatar;
  } catch {
    // Not running inside Reddit.
  }
  return rider;
}

/** A layer over everything, with its own canvas and interface. */
function openLayer(): {
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  close: () => void;
} {
  const layer = document.createElement('div');
  layer.className = 'layer';
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  root.className = 'hud';
  layer.append(canvas, root);
  document.body.append(layer);
  return { canvas, root, close: () => layer.remove() };
}

type Shared = {
  rider: Rider;
  sound: Sound;
  calm: boolean;
  /** One-time rule cards already shown to this player, kept up to date as more are shown. */
  rulesSeen: Set<RuleKind>;
};

type IslandOptions = {
  /** Tonight's island, an earlier one opened for practice, or a Builder island its maker tests. */
  mode: 'tonight' | 'practice' | 'test';
  /** Ask the server to rank a Lock in. It still decides for itself. */
  ranked: boolean;
  hints: boolean;
  hand: boolean;
  /** This island's Devvit Journey. */
  journey: Journey;
  howToPlay?: () => void;
  /** Opens the Archipelago map of past islands. */
  explore?: () => void;
  /** Opens the Island Builder. */
  build?: () => void;
  back?: () => void;
  /** What the back arrow and the result card's back button say: where `back` goes. */
  backLabel?: string;
  /** Shown in the top bar in place of the island's name (e.g. "Practice · Name"). */
  note?: string;
  /**
   * Builder test: Lock in asks this instead of the server's daily Lock in. It returns the pieces
   * the server confirmed, or null; then night falls on the island and `tested` is called.
   */
  test?: (placements: Placement[]) => Promise<number | null>;
  tested?: (pieces: number) => void;
};

type Mounted = {
  pause: (paused: boolean) => void;
  dispose: () => void;
};

function mountIsland(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  loaded: Loaded,
  shared: Shared,
  options: IslandOptions
): Mounted {
  const { island, me } = loaded;
  const { rider, sound, calm } = shared;
  const tonight = options.mode === 'tonight';
  const puzzle = puzzleFromText(island);
  const forcedBiome: Biome | undefined = BIOMES.find(
    (name) => name === query.get('biome')
  );
  const hand = createGhostHand(root, calm);
  const view = createIslandView(canvas, puzzle, {
    biome: forcedBiome ?? island.biome,
    calm,
    rider,
    teach: options.hints,
  });
  let state: PlayState = startPlay(puzzle);
  let busy = false;
  let paused = false;
  let disposed = false;
  /** Last night's lanterns are in the sky (a quiet night), so the rise says which are which. */
  let lastNightShown = false;

  const layout = (): void => {
    if (disposed) return;
    const { top, bottom, right } = hud.insets();
    view.resize(window.innerWidth, window.innerHeight, top, bottom, right);
  };

  const { journey } = options;
  const skyNoteSeen = (): boolean =>
    me.loggedIn ? me.skyNoteSeen : stored(RULE_KEY + 'sky');
  const apply = (step: PlayStep): void => {
    state = step.state;
    journey.play(step.events);
    for (const event of step.events) {
      if (
        event.type === 'placed' ||
        event.type === 'turned' ||
        event.type === 'cleared'
      )
        sound.click();
      if (event.type === 'undone' || event.type === 'reset') sound.click();
      if (event.type === 'no-pieces-left') hud.notice(COPY.noPiecesLeft);
      if (event.type === 'all-lit') sound.chime(0);
    }
    view.sync(state);
    hud.update(state);
    layout();
    pointHand();
    saveSoon();
  };

  // An unfinished board on tonight's island is saved a moment after each change, and at once
  // when the page is hidden, so reopening the post picks up exactly where it was.
  let saveTimer = 0;
  const saveNow = (): void => {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    if (!tonight || state.phase === 'locked' || me.result !== null) return;
    // Kept on the device too: the only copy a signed-out player has.
    try {
      localStorage.setItem(
        progressKey(island.day),
        JSON.stringify(state.placements)
      );
    } catch {
      // The server's copy is enough.
    }
    void fetch('/api/progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ day: island.day, placements: state.placements }),
    }).catch(() => undefined);
  };
  const saveSoon = (): void => {
    if (!tonight || state.phase === 'locked') return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, VIEW.saveAfterMs);
  };

  const commit = async (): Promise<void> => {
    if (busy || !state.light.solved || state.phase === 'locked') return;
    busy = true;
    hud.setBusy(true);
    // A Builder test: the server checks the maker's solve, night falls, and the Builder returns.
    if (options.test !== undefined) {
      const pieces = await options.test(state.placements);
      if (pieces === null) {
        busy = false;
        hud.setBusy(false);
        hud.notice(COPY.builderProblems.failed);
        return;
      }
      apply(lockIn(state));
      hud.quiet(true);
      layout();
      sound.nightPad();
      await view.nightfall((index) => sound.chime(index));
      options.tested?.(pieces);
      return;
    }
    const request: LockInRequest = {
      day: island.day,
      placements: state.placements,
      ranked: options.ranked,
    };
    if (rider.snoovatar !== null) request.snoovatar = rider.snoovatar;
    const outcome = await sendLockIn(request, journey.lockInHeaders());
    if (!outcome.ok) {
      busy = false;
      hud.setBusy(false);
      hud.notice(COPY.lockInFailed);
      return;
    }
    // The server ended this journey as completed; another go here would be a new one.
    journey.locked(tonight ? 'replay' : 'archive');
    apply(lockIn(state));
    // A rule card still open has had its say: nothing may sit over the night or the result.
    lessons.length = 0;
    hud.hideSheet();
    if (tonight) store(HINTS_KEY);
    if (tonight && outcome.ranked) rememberSolved(island.day, outcome);
    if (tonight) forget(progressKey(island.day));
    hud.quiet(true);
    layout();
    sound.nightPad();
    await view.nightfall((index) => sound.chime(index));
    // Only a ranked solve sends a lantern to the sky; anything else is a faint one that fades.
    // The first time ever, one line says what the sky of lanterns is; on a quiet night, one line
    // says whether the player was first and that the faint lanterns are last night's.
    const firstEver = outcome.ranked && !skyNoteSeen();
    if (firstEver) {
      store(RULE_KEY + 'sky');
      tell('/api/rule-seen', { rule: 'sky' });
    }
    hud.say(
      releaseNotes({
        ranked: outcome.ranked,
        firstEver,
        lastNightShown,
        tonight: outcome.skyCount,
      })
    );
    await view.release(!outcome.ranked);
    hud.showResult(outcome);
    layout();
    busy = false;
    hud.setBusy(false);
  };

  const showBoard = (): void => {
    hud.showSheet(
      boardSheet(
        island.day,
        rider.username,
        () => {
          hud.hideSheet();
          layout();
        },
        layout
      )
    );
    layout();
  };

  const share = async (): Promise<void> => {
    hud.setShare('busy');
    let answer: ShareResponse = { ok: false, reason: 'failed' };
    try {
      const response = await fetch('/api/share', { method: 'POST' });
      answer = await response.json();
    } catch {
      // Shown as a failure; the button is ready again.
    }
    hud.setShare(
      answer.ok || answer.reason === 'already-shared' ? 'done' : 'failed',
      answer.ok ? answer.url : loaded.sharedUrl
    );
  };

  const showOthers = async (): Promise<void> => {
    const others = await loadOthers(island.day);
    const own = state;
    if (others !== null) view.inspect(true);
    hud.showSheet(
      othersSheet(others, tonight, island, {
        look: (placements) =>
          view.sync(placements === null ? own : lockedWith(puzzle, placements)),
        close: () => {
          view.sync(own);
          view.inspect(false);
          hud.hideSheet();
          layout();
        },
        change: layout,
      })
    );
    layout();
  };

  const actions: HudActions = {
    undo: () => apply(undo(state)),
    reset: () => apply(reset(state)),
    rotate: () => {
      journey.tap('rotate');
      view.rotate();
    },
    toggleMute: () => sound.toggleMute(),
    lockIn: () => void commit(),
    keepRefining: () => apply(keepRefining(state)),
    playAgain: () => {
      hud.hideResult();
      hud.quiet(false);
      view.dawn();
      state = startPlay(puzzle);
      view.sync(state);
      hud.update(state);
      layout();
    },
  };
  if (options.howToPlay !== undefined) actions.howToPlay = options.howToPlay;
  if (options.back !== undefined) actions.back = options.back;
  if (options.build !== undefined) actions.build = options.build;
  if (options.backLabel !== undefined) actions.backLabel = options.backLabel;
  if (options.explore !== undefined && island.day > 1)
    actions.explore = options.explore;
  if (tonight) actions.board = showBoard;
  actions.others = () => void showOthers();
  // Sharing is the player's own comment: only signed in, and only on its own tap.
  if (tonight && me.loggedIn) {
    actions.share = () => void share();
    actions.openShared = (url) => {
      void import('@devvit/web/client')
        .then(({ navigateTo }) => navigateTo(url))
        .catch(() => undefined);
    };
  }

  // A post that is not tonight's says so, and always offers the way to tonight's island.
  const elsewhere = tonight && loaded.night !== 'tonight';
  const there = loaded.tonightPost;
  if (elsewhere && there !== null)
    actions.tonight = () => {
      void import('@devvit/web/client')
        .then(({ navigateTo }) =>
          navigateTo(
            `https://www.reddit.com/comments/${there.replace(/^t3_/, '')}`
          )
        )
        .catch(() => undefined);
    };
  const hud = createHud(
    root,
    island,
    actions,
    options.hints,
    elsewhere ? COPY.practiceShort : options.note
  );
  if (elsewhere)
    hud.notice(
      loaded.night === 'past' ? COPY.practicePast : COPY.practiceFuture
    );
  hud.setMuted(sound.isMuted());
  window.addEventListener('resize', layout);
  // Leaving before Lock in ends the journey as abandoned.
  const hidden = (): void => {
    if (document.visibilityState !== 'hidden') return;
    if (saveTimer !== 0) saveNow();
    if (!paused) journey.leave();
  };
  document.addEventListener('visibilitychange', hidden);

  // Sound wakes itself on every tap (finger up, not down: that is what iOS counts as a gesture).
  const stopTaps = onTap(canvas, (clientX, clientY) => {
    const point =
      busy || state.phase === 'locked' ? null : view.pick(clientX, clientY);
    // A near miss still counts: the tap goes to the nearest tile that can take a piece.
    const tile = point === null ? null : snapTile(puzzle, point.x, point.y);
    if (tile === null) {
      // Not the island: perhaps a lantern in the sky. Its player's name shows for a moment.
      const lantern = view.skyAt(clientX, clientY);
      if (lantern !== null)
        hud.nameTag(
          (lantern.past ? COPY.skyNameLastNight : COPY.skyName).replace(
            '{name}',
            lantern.name
          ),
          lantern.x,
          lantern.y
        );
      return;
    }
    const step = tapTile(state, tile.x, tile.y);
    if (step.events.some((item) => item.type === 'not-placeable')) return;
    apply(step);
  });

  // While the "turn it" hint is up, the ghost hand taps the piece just placed, to show how.
  const pointHand = (): void => {
    const last = state.placements[state.placements.length - 1];
    if (!options.hand || hintFor(state) !== 'turn' || last === undefined) {
      hand.hide();
      return;
    }
    const spot = view.screenOf(last.x, last.y);
    hand.show(spot.x, spot.y, 1);
  };
  const handTimer = window.setInterval(() => {
    if (hand.visible() && !paused) pointHand();
  }, 250);

  // A finished island is shown as it was left: night, lanterns bloomed, the player's lantern up.
  if (tonight && me.result !== null && me.placements !== null) {
    state = lockedWith(puzzle, me.placements);
    view.sync(state);
    view.settle();
    hud.update(state);
    hud.quiet(true);
    hud.showResult(me.result);
    if (me.shared) hud.setShare('done', loaded.sharedUrl);
    rememberSolved(island.day, me.result);
  } else {
    const left = tonight ? (me.progress ?? localProgress(island.day)) : null;
    const check = left === null ? null : validatePlacements(puzzle, left);
    if (check?.ok === true) state = resumeWith(puzzle, check.placements);
    view.sync(state);
    hud.update(state);
  }
  layout();
  if (tonight) journey.ready();

  // One-time rule cards: anything on this island the player has never met, one card at a time.
  const lessons =
    state.phase === 'locked'
      ? []
      : rulesOn(island.rows).filter((kind) => !shared.rulesSeen.has(kind));
  const nextLesson = (): void => {
    const kind = lessons.shift();
    if (kind === undefined) {
      hud.hideSheet();
      layout();
      return;
    }
    shared.rulesSeen.add(kind);
    store(RULE_KEY + kind);
    tell('/api/rule-seen', { rule: kind });
    hud.showSheet(ruleCard(kind, nextLesson));
    layout();
  };
  if (lessons.length > 0) nextLesson();

  /** Another player has just lit tonight's island. */
  const welcome = (lantern: SkyLantern): void => {
    if (disposed) return;
    view.addSky(lantern);
    // While the island is being played: a quiet line at the top and, with motion allowed, a
    // faint lantern rising through the empty sky above the island.
    if (state.phase === 'locked' || paused) return;
    hud.skyLine(
      COPY.skyLine.replace('{name}', lantern.u).replace('{island}', island.name)
    );
    if (calm) return;
    const path = arrivalPath(
      window.innerWidth,
      hud.insets().top,
      view.islandTop(),
      lantern.u.length % 2 === 0
    );
    if (path !== null) hud.arrival(path);
  };

  void joinSky(
    island.day,
    tonight,
    rider.username,
    (lanterns) => {
      if (disposed) return;
      view.setSky(lanterns);
      // Playtest subreddit, moderator's preview: one lantern of each streak style.
      if (tonight && loaded.stylePreview === true)
        view.setSky(stylePreviewLanterns());
      // A quiet night: last night's lanterns keep tonight's company, faintly.
      if (tonight && lanterns.length < SKY.quietBelow && island.day > 1)
        void joinSky(
          island.day - 1,
          false,
          rider.username,
          (earlier) => {
            if (disposed) return;
            view.setSky(earlier, true);
            if (earlier.length > 0) lastNightShown = true;
          },
          () => undefined
        );
    },
    welcome
  );

  // The "You" label rides the player's own lantern.
  let youFrame = 0;
  const followYou = (): void => {
    hud.you(view.youAt());
    youFrame = requestAnimationFrame(followYou);
  };
  youFrame = requestAnimationFrame(followYou);

  // The display font changes the bars' height once it arrives.
  void document.fonts?.ready.then(layout);

  let perfTimer = 0;
  if (tonight && query.get('perf') === '1') {
    // Developer hook for scripted checks: place a piece by tile, without a pointer.
    Object.assign(window, {
      lumenTap: (x: number, y: number) => apply(tapTile(state, x, y)),
      lumenLockIn: () => void commit(),
      // Stands in for a realtime message: another player has just lit the island.
      lumenArrive: (name: string) => welcome({ u: name, s: 'plain', a: '' }),
      // Where a tile's centre is on screen, for measuring tap sizes.
      lumenScreen: (x: number, y: number) => view.screenOf(x, y),
    });
    perfTimer = window.setInterval(() => {
      const stats = view.stats();
      hud.perf(
        `${stats.fps.toFixed(0)} fps · ${stats.calls} calls · ${stats.triangles} tris · x${stats.pixelRatio}`
      );
    }, 500);
  }

  return {
    pause(wanted) {
      if (wanted === paused || disposed) return;
      paused = wanted;
      view.pause(wanted);
      if (wanted) {
        cancelAnimationFrame(youFrame);
        hand.hide();
        return;
      }
      youFrame = requestAnimationFrame(followYou);
      layout();
      pointHand();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      journey.leave();
      document.removeEventListener('visibilitychange', hidden);
      stopTaps();
      window.removeEventListener('resize', layout);
      window.clearInterval(handTimer);
      window.clearInterval(perfTimer);
      cancelAnimationFrame(youFrame);
      view.dispose();
      root.replaceChildren();
    },
  };
}

/**
 * A Builder island, opened in the real game for its maker to light. The server starts the test
 * clock first, and confirms the solve; then night falls on the island and the Builder returns.
 */
async function testIsland(
  island: TestIsland,
  shared: Shared
): Promise<TestResult> {
  const send = (path: string, body: unknown): Promise<Response> =>
    fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  // The server must have this island's check before the maker spends time solving it.
  const started = await send('/api/builder/test-start', { draft: island.draft })
    .then((response): Promise<BuilderTestStartResponse> => response.json())
    .catch(() => null);
  if (started === null) return { lit: false, why: 'failed' };
  if (!started.ok) return { lit: false, why: 'not-checked' };
  const { draft, inventory, par } = island;
  const name =
    draft.name.trim() === '' ? COPY.builderUnnamed : draft.name.trim();
  const loaded: Loaded = {
    ok: true,
    island: {
      day: 0,
      date: '',
      weekday: 'sunday',
      biome: draft.biome,
      name,
      rows: draft.rows,
      inventory,
      sourceColours: puzzleFromText({
        rows: draft.rows,
        inventory,
        sourceColours: [],
      }).sources.map(() => 'white'),
      par,
    },
    me: {
      loggedIn: true,
      username: shared.rider.username,
      streak: 0,
      style: 'plain',
      tutorialDone: true,
      result: null,
      placements: null,
      shared: false,
      sharedComment: null,
      skyNoteSeen: true,
      rulesSeen: [...shared.rulesSeen],
      progress: null,
    },
    rankedOpen: false,
    skyCount: 0,
    night: 'tonight',
    tonightPost: null,
    sharedUrl: null,
  };
  return new Promise((resolve) => {
    const layer = openLayer();
    let mounted: Mounted | null = null;
    const finish = (value: TestResult): void => {
      mounted?.dispose();
      layer.close();
      resolve(value);
    };
    mounted = mountIsland(layer.canvas, layer.root, loaded, shared, {
      mode: 'test',
      ranked: false,
      hints: false,
      hand: false,
      journey: quietJourney(),
      note: fill(COPY.builderTestNote, { name }),
      backLabel: COPY.builderTestBack,
      back: () => finish({ lit: false, why: 'left' }),
      test: async (placements) => {
        try {
          const response = await send('/api/builder/test-solve', {
            draft,
            placements,
          });
          const body: BuilderTestResponse = await response.json();
          return body.ok ? body.pieces : null;
        } catch {
          return null;
        }
      },
      tested: (pieces) =>
        window.setTimeout(
          () => finish({ lit: true, pieces }),
          BUILDER_VIEW.testDoneMs
        ),
    });
  });
}

/** The Island Builder on `root`. Its code is loaded only when it is first opened. */
async function startBuilder(
  root: HTMLElement,
  shared: Shared,
  close: BuilderHost['close']
): Promise<{ dispose: () => void }> {
  const { openBuilder } = await import('../builder/builder');
  const subreddit = await import('@devvit/web/client')
    .then(({ context }) => context.subredditName)
    .catch(() => undefined);
  const host: BuilderHost = {
    click: () => shared.sound.click(),
    chime: (index) => shared.sound.chime(index),
    test: (island) => testIsland(island, shared),
    open: (url) => {
      void import('@devvit/web/client')
        .then(({ navigateTo }) => navigateTo(url))
        .catch(() => undefined);
    },
    calm: shared.calm,
    avatar: cleanSnoovatar(shared.rider.snoovatar),
    username: shared.rider.username,
    subreddit: subreddit ?? DEV.resetSubreddit,
  };
  if (close !== undefined) host.close = close;
  return openBuilder(root, host);
}

async function start(): Promise<void> {
  const root = byId('hud');
  const canvas = document.querySelector('canvas');
  const status = byId('status');
  if (canvas === null) throw new Error('missing canvas');
  applyTheme(document.documentElement);

  // builder.html: this page as the Island Builder, on its own (the Workshop post).
  if (
    document.documentElement.dataset['builder'] === '1' &&
    COMMUNITY.enabled
  ) {
    status.remove();
    const rider = await loadRider();
    const calm =
      query.get('calm') === '1' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await startBuilder(
      root,
      { rider, sound: createSound(), calm, rulesSeen: new Set(RULE_KINDS) },
      undefined
    );
    return;
  }

  const [loaded, rider] = await Promise.all([
    loadIsland(query.get('day')),
    loadRider(),
  ]);
  if (loaded === null) {
    status.textContent = COPY.loadFailed;
    return;
  }
  status.remove();
  const { island, me } = loaded;
  // The server's name for the player is the one their sky entries carry.
  if (me.username !== null) rider.username = me.username;
  const calm =
    query.get('calm') === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shared: Shared = {
    rider,
    sound: createSound(),
    calm,
    // For a signed-in player the server remembers; the device's note is for everyone else.
    rulesSeen: new Set(
      me.loggedIn
        ? me.rulesSeen
        : RULE_KINDS.filter((kind) => stored(RULE_KEY + kind))
    ),
  };

  // Trailer mode, armed by a moderator from the menu: the island plays itself, once.
  if (loaded.trailer !== undefined) {
    const lanterns: SkyLantern[] = [];
    await joinSky(
      island.day,
      false,
      null,
      (list) => lanterns.push(...list),
      () => undefined
    );
    await runTrailer(canvas, root, island, loaded.trailer.solution, {
      biome: island.biome,
      calm,
      rider,
      sound: shared.sound,
      sky: lanterns,
    });
    return;
  }

  // First visit: three small islands teach the light before today's island appears.
  // ?tutorial=1 forces it and ?tutorial=0 skips it, for testing. The feed card's "How to play"
  // opens howto.html, which is this page marked data-tutorial="1".
  // For a signed-in player the server remembers; the device's own note is for everyone else.
  const seenTutorial = me.loggedIn ? me.tutorialDone : stored(TUTORIAL_KEY);
  const firstVisit =
    !seenTutorial && me.result === null && query.get('tutorial') !== '0';
  const wantTutorial =
    query.get('tutorial') === '1' ||
    document.documentElement.dataset['tutorial'] === '1' ||
    firstVisit;
  if (firstVisit) forget(HINTS_KEY);
  // The ghost hand shows only in the tutorial, and on a first island whose tutorial was skipped.
  let handOn = false;
  const log = query.get('perf') === '1';
  const journey = createJourney(
    loaded.rankedOpen && query.get('archive') !== '1' ? 'ranked' : 'replay',
    log
  );
  if (wantTutorial) {
    const ended = await runTutorial(canvas, root, shared.sound, calm);
    if (ended === 'skipped') journey.tap('tutorial_skip');
    handOn = firstVisit && ended === 'skipped';
    store(TUTORIAL_KEY);
    tell('/api/tutorial-done', {});
  }
  // A newcomer arriving on one of the week's harder days is offered an easier island first.
  // Tonight's clock has not started yet, so warming up costs nothing.
  const easier = firstVisit ? warmUpDay(island.day) : null;
  if (easier !== null && (await askWarmUp(root)) === 'warm') {
    const warm = await loadIsland(String(easier));
    if (warm !== null)
      await new Promise<void>((resolve) => {
        const layer = openLayer();
        let practice: Mounted | null = null;
        practice = mountIsland(layer.canvas, layer.root, warm, shared, {
          mode: 'practice',
          ranked: false,
          hints: true,
          hand: false,
          journey: createJourney('archive', log),
          note: COPY.warmUpNamed.replace('{name}', warm.island.name),
          back: () => {
            practice?.dispose();
            layer.close();
            resolve();
          },
        });
      });
  }

  // The server's clock starts now, once today's island is the thing on screen.
  if (me.result === null) tell('/api/start', { day: island.day });

  let layerOpen = false;
  let tonight: Mounted | null = null;

  /** The Island Builder, over tonight's island; closing it returns to tonight unchanged. */
  const openBuilderLayer = async (): Promise<void> => {
    if (layerOpen) return;
    layerOpen = true;
    tonight?.pause(true);
    const layer = openLayer();
    let opened: { dispose: () => void } | null = null;
    opened = await startBuilder(layer.root, shared, () => {
      opened?.dispose();
      layer.close();
      layerOpen = false;
      tonight?.pause(false);
    });
  };

  /** How to play, over tonight's island; the board is untouched underneath. */
  const howToPlay = async (): Promise<void> => {
    if (layerOpen) return;
    layerOpen = true;
    tonight?.pause(true);
    const layer = openLayer();
    const ended = await runTutorial(
      layer.canvas,
      layer.root,
      shared.sound,
      calm
    );
    if (ended === 'skipped') journey.tap('tutorial_skip');
    layer.close();
    tonight?.pause(false);
    layerOpen = false;
  };

  /** The Archipelago: the night map of past islands, over tonight's. */
  const openMap = async (): Promise<void> => {
    if (layerOpen) return;
    layerOpen = true;
    tonight?.pause(true);
    const past = await loadPast(island.day);
    const map = openArchipelago(
      past?.islands ?? null,
      calm,
      (day) => {
        map.close();
        layerOpen = false;
        void openPast(day);
      },
      () => {
        map.close();
        tonight?.pause(false);
        layerOpen = false;
      },
      COMMUNITY.enabled
        ? () => {
            map.close();
            layerOpen = false;
            void openBuilderLayer();
          }
        : undefined
    );
  };

  /** A past island, for practice. Leaving it returns to the map. */
  const openPast = async (day: number): Promise<void> => {
    if (layerOpen) return;
    layerOpen = true;
    const past = await loadIsland(String(day));
    if (past === null) {
      layerOpen = false;
      void openMap();
      return;
    }
    tonight?.pause(true);
    const layer = openLayer();
    let practice: Mounted | null = null;
    practice = mountIsland(layer.canvas, layer.root, past, shared, {
      mode: 'practice',
      ranked: false,
      hints: false,
      hand: false,
      journey: createJourney('archive', log),
      // An island from the map says it is practice, and its way back leads to the map.
      note: COPY.practiceNamed.replace('{name}', past.island.name),
      backLabel: COPY.backToIslands,
      back: () => {
        practice?.dispose();
        layer.close();
        layerOpen = false;
        void openMap();
      },
    });
  };

  tonight = mountIsland(canvas, root, loaded, shared, {
    mode: 'tonight',
    ranked: query.get('archive') !== '1',
    hints: !stored(HINTS_KEY),
    hand: handOn,
    journey,
    howToPlay: () => void howToPlay(),
    explore: () => void openMap(),
    ...(COMMUNITY.enabled ? { build: () => void openBuilderLayer() } : {}),
  });
}

start().catch((error: unknown) => {
  const status = document.getElementById('status');
  if (status !== null) status.textContent = COPY.loadFailed;
  console.error(error);
});
