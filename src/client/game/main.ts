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
import { applyTheme, createHud } from './hud';
import type { Rider } from './release';
import { createIslandView } from './scene';

const HINTS_KEY = 'lumen.hints.done';
/** A press that moves further than this many pixels is a drag, not a tap. */
const TAP_SLOP = 12;

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
  const view = createIslandView(canvas, puzzle, {
    biome: forcedBiome ?? island.biome,
    calm,
    rider,
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
    !stored(HINTS_KEY)
  );
  hud.setMuted(sound.isMuted());

  window.addEventListener('resize', layout);

  // A tap is a press and release in nearly the same place.
  let downX = 0;
  let downY = 0;
  let pressing = false;
  canvas.addEventListener('pointerdown', (event) => {
    pressing = true;
    downX = event.clientX;
    downY = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pressing) return;
    pressing = false;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > TAP_SLOP)
      return;
    if (busy || state.phase === 'locked') return;
    const tile = view.pick(event.clientX, event.clientY);
    if (tile === null) return;
    const step = tapTile(state, tile.x, tile.y);
    if (step.events.some((item) => item.type === 'not-placeable')) return;
    apply(step);
  });
  canvas.addEventListener('pointercancel', () => {
    pressing = false;
  });
  // Sound wakes itself on every tap (finger up, not down: that is what iOS counts as a gesture).

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
