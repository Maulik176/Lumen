/**
 * The ghost hand: a drawn hand that taps a tile to show what a tap does. It demonstrates; it
 * never blocks a real tap (pointer events pass straight through it).
 */
import { ONBOARD } from '../../shared/config';

export type GhostHand = {
  /** Point at a place on the screen and tap `taps` times, over and over. */
  show: (x: number, y: number, taps: number) => void;
  /** Follow the place if the island moves. */
  moveTo: (x: number, y: number) => void;
  hide: () => void;
  visible: () => boolean;
};

/** A pointing hand in the same single-stroke style as the icons, fingertip at the top left. */
const HAND =
  'M13.500 21.500V7.800c0-1.700 1.200-2.900 2.700-2.900s2.700 1.200 2.700 2.900v9.400l1.300-.4c1.300-.4 2.600.2 3.200 1.300l.5-.2c1.400-.5 2.900.2 3.500 1.500l.6-.2c1.700-.5 3.400.7 3.600 2.500l.9 7.300c.5 4.300-2.400 8.200-6.700 9l-3.100.5c-3.300.6-6.600-.9-8.500-3.700l-5.200-7.900c-.8-1.200-.5-2.900.7-3.800 1.100-.8 2.600-.7 3.600.2l.2.200z';

export function createGhostHand(root: HTMLElement, calm: boolean): GhostHand {
  const holder = document.createElement('div');
  holder.className = 'ghost-hand';
  holder.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('i');
  ring.className = 'ghost-ring';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 44');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', HAND);
  svg.append(path);
  holder.append(ring, svg);
  root.append(holder);

  let shown = false;
  let timer = 0;

  const place = (x: number, y: number): void => {
    holder.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  /** One press: the hand dips and a ring spreads from the fingertip. */
  const press = (): void => {
    holder.classList.remove('tapping');
    // Reading a layout property restarts the animation when the class is added again.
    void holder.offsetWidth;
    holder.classList.add('tapping');
  };

  const stop = (): void => {
    window.clearTimeout(timer);
    timer = 0;
  };

  return {
    show(x, y, taps) {
      place(x, y);
      if (shown) return;
      shown = true;
      holder.classList.add('visible');
      holder.style.setProperty('--tap-ms', `${ONBOARD.handTapMs}ms`);
      if (calm) return;
      let done = 0;
      const next = (): void => {
        press();
        done++;
        const pause = done % Math.max(1, taps) === 0 ? ONBOARD.handPauseMs : 0;
        timer = window.setTimeout(next, ONBOARD.handTapMs + pause);
      };
      timer = window.setTimeout(next, 400);
    },
    moveTo: place,
    hide() {
      if (!shown) return;
      shown = false;
      stop();
      holder.classList.remove('visible', 'tapping');
    },
    visible: () => shown,
  };
}
