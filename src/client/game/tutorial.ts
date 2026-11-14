/**
 * The first-time tutorial: three small islands, one idea each, shown rather than explained.
 * The sun pulses, the light travels and stops short, the lantern waits, and a ghost hand taps
 * the tile that matters. Skippable at any moment.
 */
import { COPY, ONBOARD, UI } from '../../shared/config';
import { startPlay, tapTile } from '../../shared/play';
import { puzzleFromText } from '../../shared/puzzle-text';
import { TUTORIAL, type TutorialHint } from '../../shared/tutorial';
import type { Sound } from './audio';
import { createGhostHand } from './hand';
import { createIslandView } from './scene';
import { onTap } from './taps';

const HINT_COPY: Record<TutorialHint, string> = {
  mirror: COPY.tutorialMirror,
  turn: COPY.tutorialTurn,
  prism: COPY.tutorialPrism,
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export type TutorialEnd = 'done' | 'skipped';

/** Run the tutorial. Resolves when the third island is lit, or the player skips. */
export function runTutorial(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  sound: Sound,
  calm: boolean
): Promise<TutorialEnd> {
  return new Promise((finish) => {
    const bar = element('header', 'panel lesson');
    const dots = element('div', 'lesson-dots');
    const dotList = TUTORIAL.map(() => dots.appendChild(element('i', '')));
    const skip = element(
      'button',
      'button button-quiet lesson-skip',
      COPY.tutorialSkip
    );
    skip.type = 'button';
    bar.append(element('span', 'lesson-title', COPY.tutorialTitle), dots, skip);
    const line = element('p', 'panel line visible');
    line.setAttribute('role', 'status');
    root.append(bar, line);
    const hand = createGhostHand(root, calm);

    let leave: (() => void) | null = null;
    let over = false;

    const end = (how: TutorialEnd): void => {
      if (over) return;
      over = true;
      leave?.();
      hand.hide();
      root.replaceChildren();
      finish(how);
    };
    skip.addEventListener('click', () => end('skipped'));

    const play = (index: number): void => {
      const step = TUTORIAL[index];
      if (step === undefined) {
        end('done');
        return;
      }
      dotList.forEach((dot, at) => dot.classList.toggle('done', at < index));
      const puzzle = puzzleFromText(step);
      const view = createIslandView(canvas, puzzle, {
        biome: 'moss',
        calm,
        rider: { snoovatar: null, username: null },
        teach: true,
      });
      let state = startPlay(puzzle);
      let taps = 0;
      let done = false;

      const frame = (): void => {
        view.resize(
          window.innerWidth,
          window.innerHeight,
          bar.offsetHeight + line.offsetHeight + UI.gapPx * 3,
          UI.gapPx * 2
        );
      };
      const point = (): void => {
        const spot = view.screenOf(step.tap.x, step.tap.y);
        hand.show(spot.x, spot.y, step.taps);
      };
      const refresh = (): void => {
        line.textContent =
          HINT_COPY[
            step.hints[Math.min(taps, step.hints.length - 1)] ?? 'mirror'
          ];
        view.sync(state);
        frame();
      };

      const stopTaps = onTap(canvas, (clientX, clientY) => {
        if (done) return;
        const tile = view.pick(clientX, clientY);
        // Only the tile the lesson is about answers, so nothing can go wrong in ten seconds.
        if (tile === null || tile.x !== step.tap.x || tile.y !== step.tap.y)
          return;
        state = tapTile(state, tile.x, tile.y).state;
        taps++;
        sound.click();
        refresh();
        if (!state.light.solved) return;
        done = true;
        hand.hide();
        state.light.lit.forEach((_lit, lantern) =>
          window.setTimeout(() => sound.chime(lantern), lantern * 160)
        );
        dotList[index]?.classList.add('done');
        window.setTimeout(() => {
          if (over) return;
          cleanUp();
          play(index + 1);
        }, ONBOARD.tutorialNextMs);
      });

      // The hand waits until the light has been seen to travel and stop.
      const follow = window.setInterval(() => {
        if (done || over || !hand.visible()) return;
        const spot = view.screenOf(step.tap.x, step.tap.y);
        hand.moveTo(spot.x, spot.y);
      }, 250);
      const firstPoint = window.setTimeout(point, calm ? 600 : 1900);
      window.addEventListener('resize', frame);

      const cleanUp = (): void => {
        stopTaps();
        window.clearInterval(follow);
        window.clearTimeout(firstPoint);
        window.removeEventListener('resize', frame);
        hand.hide();
        view.dispose();
        leave = null;
      };
      leave = cleanUp;
      refresh();
    };

    play(0);
  });
}
