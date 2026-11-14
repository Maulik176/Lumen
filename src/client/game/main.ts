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
  type SkyLantern,
  type SkyResponse,
} from '../../shared/api';
import type { Biome } from '../../shared/calendar';
import { BIOMES, COPY } from '../../shared/config';
import {
  hintFor,
  keepRefining,
  lockedWith,
  lockIn,
  reset,
  startPlay,
  tapTile,
  undo,
  type PlayState,
  type PlayStep,
} from '../../shared/play';
import { puzzleFromText } from '../../shared/puzzle-text';
import { createSound, type Sound } from './audio';
import { createGhostHand } from './hand';
import { applyTheme, createHud, type HudActions } from './hud';
import { pastSheet } from './past';
import type { Rider } from './release';
import { createIslandView } from './scene';
import { onTap } from './taps';
import { runTutorial } from './tutorial';

const HINTS_KEY = 'lumen.hints.done';
const TUTORIAL_KEY = 'lumen.tutorial.done';

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

type Loaded = Extract<IslandResponse, { ok: true }>;

async function loadIsland(day: string | null): Promise<Loaded | null> {
  try {
    const response = await fetch(
      day === null
        ? '/api/island'
        : `/api/island?day=${encodeURIComponent(day)}`
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

async function sendLockIn(request: LockInRequest): Promise<LockInResponse> {
  try {
    const response = await fetch('/api/lock-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

type Shared = { rider: Rider; sound: Sound; calm: boolean };

type IslandOptions = {
  /** Tonight's island, or an earlier one opened for practice. */
  mode: 'tonight' | 'practice';
  /** Ask the server to rank a Lock in. It still decides for itself. */
  ranked: boolean;
  hints: boolean;
  hand: boolean;
  howToPlay?: () => void;
  openPast?: (day: number) => void;
  back?: () => void;
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

  const layout = (): void => {
    if (disposed) return;
    const { top, bottom } = hud.insets();
    view.resize(window.innerWidth, window.innerHeight, top, bottom);
  };

  const apply = (step: PlayStep): void => {
    state = step.state;
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
  };

  const commit = async (): Promise<void> => {
    if (busy || !state.light.solved || state.phase === 'locked') return;
    busy = true;
    hud.setBusy(true);
    const request: LockInRequest = {
      day: island.day,
      placements: state.placements,
      ranked: options.ranked,
    };
    if (rider.snoovatar !== null) request.snoovatar = rider.snoovatar;
    const outcome = await sendLockIn(request);
    if (!outcome.ok) {
      busy = false;
      hud.setBusy(false);
      hud.notice(COPY.lockInFailed);
      return;
    }
    apply(lockIn(state));
    if (tonight) store(HINTS_KEY);
    hud.quiet(true);
    layout();
    sound.nightPad();
    await view.nightfall((index) => sound.chime(index));
    // Only a ranked solve sends a lantern to the sky; anything else is a faint one that fades.
    await view.release(!outcome.ranked);
    hud.showResult(outcome);
    layout();
    busy = false;
    hud.setBusy(false);
  };

  const showPast = async (): Promise<void> => {
    const openPast = options.openPast;
    if (openPast === undefined) return;
    const past = await loadPast(island.day);
    hud.showSheet(
      pastSheet(
        past?.islands ?? null,
        (day) => {
          hud.hideSheet();
          layout();
          openPast(day);
        },
        () => {
          hud.hideSheet();
          layout();
        }
      )
    );
    layout();
  };

  const actions: HudActions = {
    undo: () => apply(undo(state)),
    reset: () => apply(reset(state)),
    rotate: () => view.rotate(),
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
  if (options.openPast !== undefined && island.day > 1)
    actions.explore = () => void showPast();

  const hud = createHud(root, island, actions, options.hints);
  hud.setMuted(sound.isMuted());
  window.addEventListener('resize', layout);

  // Sound wakes itself on every tap (finger up, not down: that is what iOS counts as a gesture).
  const stopTaps = onTap(canvas, (clientX, clientY) => {
    const tile =
      busy || state.phase === 'locked' ? null : view.pick(clientX, clientY);
    if (tile === null) {
      // Not the island: perhaps a lantern in the sky. Its player's name shows for a moment.
      const lantern = view.skyAt(clientX, clientY);
      if (lantern !== null)
        hud.nameTag(
          COPY.skyName.replace('{name}', lantern.name),
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
  } else {
    view.sync(state);
    hud.update(state);
  }
  layout();

  void joinSky(
    island.day,
    tonight,
    rider.username,
    (lanterns) => {
      if (!disposed) view.setSky(lanterns);
    },
    (lantern) => {
      if (disposed) return;
      view.addSky(lantern);
      hud.skyLine(
        COPY.skyLine
          .replace('{name}', lantern.u)
          .replace('{island}', island.name)
      );
    }
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

async function start(): Promise<void> {
  const root = byId('hud');
  const canvas = document.querySelector('canvas');
  const status = byId('status');
  if (canvas === null) throw new Error('missing canvas');
  applyTheme(document.documentElement);

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
  const shared: Shared = { rider, sound: createSound(), calm };

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
  if (wantTutorial) {
    const ended = await runTutorial(canvas, root, shared.sound, calm);
    handOn = firstVisit && ended === 'skipped';
    store(TUTORIAL_KEY);
    tell('/api/tutorial-done', {});
  }
  // The server's clock starts now, once today's island is the thing on screen.
  if (me.result === null) tell('/api/start', { day: island.day });

  let layerOpen = false;
  let tonight: Mounted | null = null;

  /** How to play, over tonight's island; the board is untouched underneath. */
  const howToPlay = async (): Promise<void> => {
    if (layerOpen) return;
    layerOpen = true;
    tonight?.pause(true);
    const layer = openLayer();
    await runTutorial(layer.canvas, layer.root, shared.sound, calm);
    layer.close();
    tonight?.pause(false);
    layerOpen = false;
  };

  /** A past island, for practice, over tonight's. */
  const openPast = async (day: number): Promise<void> => {
    if (layerOpen) return;
    layerOpen = true;
    const past = await loadIsland(String(day));
    if (past === null) {
      layerOpen = false;
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
      back: () => {
        practice?.dispose();
        layer.close();
        tonight?.pause(false);
        layerOpen = false;
      },
    });
  };

  tonight = mountIsland(canvas, root, loaded, shared, {
    mode: 'tonight',
    ranked: query.get('archive') !== '1',
    hints: !stored(HINTS_KEY),
    hand: handOn,
    howToPlay: () => void howToPlay(),
    openPast: (day) => void openPast(day),
  });
}

start().catch((error: unknown) => {
  const status = document.getElementById('status');
  if (status !== null) status.textContent = COPY.loadFailed;
  console.error(error);
});
