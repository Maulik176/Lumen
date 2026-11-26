/**
 * Trailer mode: one take for the demo video. Dusk, the island solved by unseen hands, nightfall,
 * the lantern's release into a sky of lanterns, then the title. No interface. It begins on the
 * first tap (sound needs one) and plays once. Only ever offered by the server to a moderator who
 * armed it from the menu.
 */
import type { PublicIsland, SkyLantern } from '../../shared/api';
import type { Biome } from '../../shared/calendar';
import { COPY, TRAILER } from '../../shared/config';
import { lockedWith, startPlay, tapTile } from '../../shared/play';
import { puzzleFromText } from '../../shared/puzzle-text';
import { trailerSteps } from '../../shared/trailer';
import type { Placement } from '../../shared/types';
import type { Sound } from './audio';
import { element } from './hud';
import type { Rider } from './release';
import { createIslandView } from './scene';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export async function runTrailer(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  island: PublicIsland,
  solution: Placement[],
  options: {
    biome: Biome;
    calm: boolean;
    rider: Rider;
    sound: Sound;
    /** Tonight's real lanterns; in the trailer they carry no names. */
    sky: readonly SkyLantern[];
    /**
     * The ending (REVIEW P1-7): the map of every night so far, opened on top. Answers how to
     * scroll it; absent, the take ends on the title.
     */
    archipelago?: () => Promise<HTMLElement | null>;
  }
): Promise<void> {
  const puzzle = puzzleFromText(island);
  const view = createIslandView(canvas, puzzle, {
    biome: options.biome,
    calm: options.calm,
    rider: options.rider,
    teach: false,
  });
  let state = startPlay(puzzle);
  const frame = (): void =>
    view.resize(window.innerWidth, window.innerHeight, 0, 0);
  window.addEventListener('resize', frame);
  view.sync(state);
  view.setSky(options.sky);
  frame();

  // A quiet start screen, so the recording can begin before the first frame of the take.
  const begin = element('div', 'trailer-begin');
  begin.append(
    element('h1', 'trailer-name', COPY.trailerTitle),
    element('p', 'trailer-tap', COPY.trailerStart)
  );
  root.append(begin);
  await new Promise<void>((resolve) =>
    window.addEventListener('click', () => resolve(), { once: true })
  );
  begin.remove();

  const started = performance.now();
  const until = (atMs: number): Promise<void> =>
    wait(Math.max(0, started + atMs - performance.now()));

  await until(TRAILER.rotateAtMs);
  view.rotate();
  for (const tap of trailerSteps(puzzle, solution)) {
    await until(tap.atMs);
    state = tapTile(state, tap.x, tap.y).state;
    options.sound.click();
    view.sync(state);
  }
  options.sound.chime(0);
  await wait(TRAILER.litHoldMs);
  state = lockedWith(puzzle, state.placements);
  view.sync(state);
  options.sound.nightPad();
  await view.nightfall((index) => options.sound.chime(index));
  await view.release(false);
  await wait(TRAILER.skyHoldMs);

  const title = element('div', 'trailer-title');
  title.append(
    element('h1', 'trailer-name', COPY.trailerTitle),
    element('p', 'trailer-line', COPY.trailerLine)
  );
  root.append(title);
  // Reading a layout property lets the fade begin from clear.
  void title.offsetWidth;
  title.classList.add('shown');
  if (options.archipelago === undefined) return;

  // The ending: the camera "pulls back" from tonight's sky to the map of every night, which
  // drifts slowly down through the islands before the title line comes back over it.
  await wait(TRAILER.titleHoldMs);
  const scroller = await options.archipelago();
  if (scroller === null) return;
  const map = scroller.closest('.layer');
  map?.classList.add('trailer-end');
  void map?.clientHeight;
  map?.classList.add('shown');
  title.classList.remove('shown');
  await wait(TRAILER.mapFadeMs);
  title.remove();
  if (!options.calm) await glide(scroller, TRAILER.mapGlideMs);
  else await wait(TRAILER.mapGlideMs / 2);
  const last = element('div', 'trailer-title trailer-over-map');
  last.append(
    element('h1', 'trailer-name', COPY.trailerTitle),
    element('p', 'trailer-line', COPY.trailerLine)
  );
  map?.append(last);
  void last.offsetWidth;
  last.classList.add('shown');
}

/** Scroll the map down a share of its length, easing in and out, over `ms`. */
function glide(scroller: HTMLElement, ms: number): Promise<void> {
  const from = scroller.scrollTop;
  const to = Math.max(
    from,
    (scroller.scrollHeight - scroller.clientHeight) * TRAILER.mapGlideShare
  );
  const began = performance.now();
  return new Promise((resolve) => {
    const step = (time: number): void => {
      const t = Math.min(1, (time - began) / ms);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      scroller.scrollTop = from + (to - from) * eased;
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
