/**
 * The play screen: load today's island, wire taps to the rules, the rules to the 3D view and
 * the interface, and Lock in to the server.
 */
import {
  cleanSnoovatar,
  type IslandResponse,
  type LockInRequest,
  type LockInResponse,
  type LockInResult,
  type SkyLantern,
  type SkyResponse,
} from '../../shared/api';
import type { Biome } from '../../shared/calendar';
import { BIOMES, COPY } from '../../shared/config';
import {
  hintFor,
  keepRefining,
  lockIn,
  reset,
  startPlay,
  tapTile,
  undo,
  type PlayState,
  type PlayStep,
} from '../../shared/play';
import { puzzleFromText } from '../../shared/puzzle-text';
import { createSound } from './audio';
import { createGhostHand } from './hand';
import { applyTheme, createHud } from './hud';
import type { Rider } from './release';
import { createIslandView } from './scene';
import { onTap } from './taps';
import { runTutorial } from './tutorial';

const HINTS_KEY = 'lumen.hints.done';
const TUTORIAL_KEY = 'lumen.tutorial.done';
const REPLAY_KEY = 'lumen.tutorial.again';

/** True once, right after the player asked for "How to play" and the page reloaded for it. */
function tutorialAsked(): boolean {
  if (document.documentElement.dataset['tutorial'] === '1') return true;
  try {
    const asked = sessionStorage.getItem(REPLAY_KEY) === '1';
    sessionStorage.removeItem(REPLAY_KEY);
    return asked;
  } catch {
    return false;
  }
}

/** Run the three first-light islands again: the page starts over with the tutorial first. */
function replayTutorial(): void {
  try {
    sessionStorage.setItem(REPLAY_KEY, '1');
    location.reload();
  } catch {
    query.set('tutorial', '1');
    location.search = query.toString();
  }
}

function forget(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing was stored.
  }
}

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

type Loaded = Extract<IslandResponse, { ok: true }>;

async function loadIsland(): Promise<Loaded | null> {
  try {
    const wanted = query.get('day');
    const response = await fetch(
      wanted === null
        ? '/api/island'
        : `/api/island?day=${encodeURIComponent(wanted)}`
    );
    const body: IslandResponse = await response.json();
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

/** Tonight's sky: everyone already there, then each new lantern as it rises. */
async function joinSky(
  day: number,
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

async function start(): Promise<void> {
  const root = byId('hud');
  const canvas = document.querySelector('canvas');
  const status = byId('status');
  if (canvas === null) throw new Error('missing canvas');
  applyTheme(document.documentElement);

  const [loaded, rider] = await Promise.all([loadIsland(), loadRider()]);
  if (loaded === null) {
    status.textContent = COPY.loadFailed;
    return;
  }
  status.remove();
  const { island, me } = loaded;
  const ranked = query.get('archive') !== '1';

  const puzzle = puzzleFromText(island);
  const forcedBiome: Biome | undefined = BIOMES.find(
    (name) => name === query.get('biome')
  );
  const calm =
    query.get('calm') === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = createSound();

  // First visit: three small islands teach the light before today's island appears.
  // ?tutorial=1 forces it and ?tutorial=0 skips it, for testing.
  // For a signed-in player the server remembers; the device's own note is for everyone else.
  const seenTutorial = me.loggedIn ? me.tutorialDone : stored(TUTORIAL_KEY);
  const firstVisit = !seenTutorial && query.get('tutorial') !== '0';
  const wantTutorial =
    query.get('tutorial') === '1' || tutorialAsked() || firstVisit;
  if (firstVisit) forget(HINTS_KEY);
  if (wantTutorial) {
    await runTutorial(canvas, root, sound, calm);
    store(TUTORIAL_KEY);
    tell('/api/tutorial-done', {});
  }
  // The server's clock starts now, once today's island is the thing on screen.
  tell('/api/start', { day: island.day });
  const showHints = !stored(HINTS_KEY);
  const hand = createGhostHand(root, calm);
  const view = createIslandView(canvas, puzzle, {
    biome: forcedBiome ?? island.biome,
    calm,
    rider,
    teach: showHints,
  });
  let state: PlayState = startPlay(puzzle);
  /** True once the player has locked in and chosen to play again: later solves are unranked. */
  let replaying = false;
  let busy = false;
  /** The player's real result for today, once there is one. A replay never replaces it. */
  let todays: LockInResult | null = me.result;

  const layout = (): void => {
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
      ranked: ranked && !replaying,
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
    store(HINTS_KEY);
    hud.quiet(true);
    layout();
    sound.nightPad();
    await view.nightfall((index) => sound.chime(index));
    // A replay gets a faint practice lantern that fades; it joins no sky.
    const replayed = !outcome.ranked && (replaying || todays !== null);
    await view.release(replayed);
    if (outcome.ranked) {
      todays = outcome;
      if (me.username !== null)
        view.addSky({
          u: me.username,
          s: outcome.style,
          a: cleanSnoovatar(rider.snoovatar),
        });
    }
    hud.showResult(replayed && todays !== null ? todays : outcome, replayed);
    layout();
    busy = false;
    hud.setBusy(false);
  };

  const hud = createHud(
    root,
    island,
    {
      undo: () => apply(undo(state)),
      reset: () => apply(reset(state)),
      rotate: () => view.rotate(),
      toggleMute: () => sound.toggleMute(),
      lockIn: () => void commit(),
      keepRefining: () => apply(keepRefining(state)),
      howToPlay: replayTutorial,
      playAgain: () => {
        hud.hideResult();
        hud.quiet(false);
        view.dawn();
        state = startPlay(puzzle);
        replaying = true;
        view.sync(state);
        hud.update(state);
        layout();
      },
    },
    showHints
  );
  hud.setMuted(sound.isMuted());

  window.addEventListener('resize', layout);

  // Sound wakes itself on every tap (finger up, not down: that is what iOS counts as a gesture).
  onTap(canvas, (clientX, clientY) => {
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
    if (!showHints || hintFor(state) !== 'turn' || last === undefined) {
      hand.hide();
      return;
    }
    const spot = view.screenOf(last.x, last.y);
    hand.show(spot.x, spot.y, 1);
  };
  window.setInterval(() => {
    if (hand.visible()) pointHand();
  }, 250);

  view.sync(state);
  hud.update(state);
  layout();
  void joinSky(
    island.day,
    me.username,
    (lanterns) => view.setSky(lanterns),
    (lantern) => {
      view.addSky(lantern);
      hud.skyLine(
        COPY.skyLine
          .replace('{name}', lantern.u)
          .replace('{island}', island.name)
      );
    }
  );

  // The "You" label rides the player's own lantern.
  const followYou = (): void => {
    hud.you(view.youAt());
    requestAnimationFrame(followYou);
  };
  requestAnimationFrame(followYou);

  // The display font changes the bars' height once it arrives.
  void document.fonts?.ready.then(layout);

  if (query.get('perf') === '1') {
    // Developer hook for scripted checks: place a piece by tile, without a pointer.
    Object.assign(window, {
      lumenTap: (x: number, y: number) => apply(tapTile(state, x, y)),
      lumenLockIn: () => void commit(),
    });
    window.setInterval(() => {
      const stats = view.stats();
      hud.perf(
        `${stats.fps.toFixed(0)} fps · ${stats.calls} calls · ${stats.triangles} tris · x${stats.pixelRatio}`
      );
    }, 500);
  }
}

start().catch((error: unknown) => {
  const status = document.getElementById('status');
  if (status !== null) status.textContent = COPY.loadFailed;
  console.error(error);
});
