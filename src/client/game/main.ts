/**
 * The play screen: load today's island, wire taps to the rules, the rules to the 3D view and
 * the interface, and Lock in to the server.
 */
import type {
  IslandResponse,
  LockInRequest,
  LockInResponse,
  PublicIsland,
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

async function loadIsland(): Promise<PublicIsland | null> {
  try {
    const wanted = query.get('day');
    const response = await fetch(
      wanted === null
        ? '/api/island'
        : `/api/island?day=${encodeURIComponent(wanted)}`
    );
    const body: IslandResponse = await response.json();
    return body.ok ? body.island : null;
  } catch {
    return null;
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

  const [island, rider] = await Promise.all([loadIsland(), loadRider()]);
  if (island === null) {
    status.textContent = COPY.loadFailed;
    return;
  }
  status.remove();

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
  const wantTutorial =
    query.get('tutorial') === '1' ||
    (!stored(TUTORIAL_KEY) && query.get('tutorial') !== '0');
  if (wantTutorial) {
    await runTutorial(canvas, root, sound, calm);
    store(TUTORIAL_KEY);
  }
  const showHints = !stored(HINTS_KEY);
  const hand = createGhostHand(root, calm);
  const view = createIslandView(canvas, puzzle, {
    biome: forcedBiome ?? island.biome,
    calm,
    rider,
    teach: showHints,
  });
  let state: PlayState = startPlay(puzzle);
  let startedAt = performance.now();
  let busy = false;

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
    const elapsedMs = performance.now() - startedAt;
    const outcome = await sendLockIn({
      day: island.day,
      placements: state.placements,
      elapsedMs,
    });
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
    await view.release();
    hud.showResult(outcome);
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
      playAgain: () => {
        hud.hideResult();
        hud.quiet(false);
        view.dawn();
        state = startPlay(puzzle);
        startedAt = performance.now();
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
    if (busy || state.phase === 'locked') return;
    const tile = view.pick(clientX, clientY);
    if (tile === null) return;
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
