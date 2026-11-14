/**
 * Everything on screen that is not the island: the two thin bars, the hint line, the
 * "All lit" prompt and the result card. Plain DOM over the canvas.
 *
 * The island is always framed in the space these leave free: `insets()` reports how much room
 * the interface is taking at the top and the bottom right now.
 */
import type { LockInResult, PublicIsland } from '../../shared/api';
import { COPY, SKY, UI, VIEW } from '../../shared/config';
import {
  canLockIn,
  hintFor,
  piecesLeft,
  type PlayState,
} from '../../shared/play';
import type { Medal } from '../../shared/types';
import { formatTime } from './fit';

export type HudActions = {
  undo: () => void;
  reset: () => void;
  rotate: () => void;
  toggleMute: () => boolean;
  lockIn: () => void;
  keepRefining: () => void;
  playAgain: () => void;
  howToPlay: () => void;
};

export type Hud = {
  /** Redraw counters, hint and prompt from the play state. */
  update: (state: PlayState) => void;
  /** Show a short line, such as "No pieces left". */
  notice: (text: string) => void;
  setBusy: (busy: boolean) => void;
  setMuted: (muted: boolean) => void;
  /** Hide everything but the island, for nightfall and the lantern's flight. */
  quiet: (quiet: boolean) => void;
  /** `replayed`: this is the player's real result for today, shown again after a replay. */
  showResult: (result: LockInResult, replayed: boolean) => void;
  /** The small "You" label on the player's own lantern; null hides it. */
  you: (spot: { x: number; y: number } | null) => void;
  /** A tapped lantern's name, shown beside it for a moment. */
  nameTag: (text: string, x: number, y: number) => void;
  hideResult: () => void;
  /** Room the interface is taking at the top and bottom, in pixels. */
  insets: () => { top: number; bottom: number };
  /** "u/name lit Moss Steps": shown briefly, never more than one at a time. */
  skyLine: (text: string) => void;
  /** Developer read-out, shown only with ?perf=1. */
  perf: (text: string) => void;
};

/** Hand-drawn style: single round strokes, slightly loose. Drawn on a 26 x 26 grid. */
const ICONS = {
  undo: 'M10.2 6.6 4.6 11.9l5.9 5M5 11.9c4.2-.5 8.4-.4 11.2.9 3.6 1.700 4.800 5.800 2.200 8.300',
  reset:
    'M5.200 5.400v6.100h6.200M5.600 11.300c1.400-3.600 5-6 9-5.400 4.700.7 7.900 5 7.200 9.700-.7 4.600-5 7.800-9.700 7.100-2.300-.3-4.300-1.500-5.600-3.200',
  rotate:
    'M3.800 13.400c0-4.200 4.200-7.200 9.300-7.200 4 0 7.500 1.900 8.700 4.700M21.900 5.900v5.100h-5.200M22.200 13c0 4.100-4.200 7-9.300 7-3.800 0-7.200-1.700-8.600-4.300M4.100 20.400v-5h5.100',
  soundOn:
    'M3.900 10.200v5.700h3.900l5.300 4.200V5.900L7.800 10.200H3.900zM16.700 9.800c1.500 1.800 1.500 4.800 0 6.600M19.600 7.300c2.900 3.300 2.900 8.300 0 11.600',
  soundOff:
    'M3.900 10.200v5.700h3.900l5.300 4.200V5.900L7.800 10.200H3.900zM17.200 10.300l5.200 5.600M22.400 10.300l-5.200 5.600',
} as const;

const MEDAL_NAME: Record<Medal, string> = {
  lamplighter: COPY.medalLamplighter,
  glow: COPY.medalGlow,
  spark: COPY.medalSpark,
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

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 26 26');
  svg.setAttribute('aria-hidden', 'true');
  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  stroke.setAttribute('d', path);
  svg.append(stroke);
  return svg;
}

function iconButton(
  label: string,
  path: string,
  onTap: () => void
): HTMLButtonElement {
  const button = element('button', 'icon-button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(icon(path));
  button.addEventListener('click', onTap);
  return button;
}

function fill(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    String(values[key] ?? whole)
  );
}

/** Hand the interface colours in config.ts to the stylesheet. */
export function applyTheme(root: HTMLElement): void {
  const set = (name: string, value: string): void =>
    root.style.setProperty(name, value);
  set('--paper', UI.paper);
  set('--paper-alpha', String(UI.paperAlpha));
  set('--ink', UI.ink);
  set('--ink-soft', UI.inkSoft);
  set('--amber', UI.amber);
  set('--amber-ink', UI.amberInk);
  set('--light', UI.light);
  set('--veil', UI.veil);
  set('--medal-lamplighter', UI.medalLamplighter);
  set('--medal-glow', UI.medalGlow);
  set('--medal-spark', UI.medalSpark);
  set('--radius', `${UI.radiusPx}px`);
  set('--gap', `${UI.gapPx}px`);
  set('--tap', `${UI.tapPx}px`);
}

export function createHud(
  root: HTMLElement,
  island: PublicIsland,
  actions: HudActions,
  showHints: boolean
): Hud {
  // Top bar: which island, what is left to place, and par.
  const top = element('header', 'panel bar bar-top');
  const title = element('div', 'title');
  title.append(
    element('span', 'title-number', `Lumen #${island.day}`),
    element('span', 'title-name', island.name)
  );
  const inventory = element('div', 'inventory');
  const mirrors = element('span', 'count');
  const mirrorCount = element('b', 'count-number');
  mirrors.append(element('i', 'glyph glyph-mirror'), mirrorCount);
  mirrors.setAttribute('aria-label', 'Mirrors left');
  const prisms = element('span', 'count');
  const prismCount = element('b', 'count-number');
  prisms.append(element('i', 'glyph glyph-prism'), prismCount);
  prisms.setAttribute('aria-label', 'Prisms left');
  inventory.append(mirrors);
  if (island.inventory.prisms > 0) inventory.append(prisms);
  const par = element('div', 'par');
  par.append(
    element('span', 'par-label', 'par'),
    element('b', 'par-number', String(island.par))
  );
  const help = element('button', 'help-button', '?');
  help.type = 'button';
  help.setAttribute('aria-label', COPY.howToPlay);
  help.addEventListener('click', actions.howToPlay);
  top.append(title, inventory, par, help);

  // One line under the top bar: a first-time hint, or a short notice.
  const line = element('p', 'panel line');
  line.setAttribute('role', 'status');

  // Bottom bar: the four controls, and Lock in once the player has chosen to keep refining.
  const bottom = element('footer', 'panel bar bar-bottom');
  const muteButton = iconButton(COPY.mute, ICONS.soundOn, () =>
    setMuted(actions.toggleMute())
  );
  const lockSmall = element(
    'button',
    'button button-main lock-small',
    COPY.lockIn
  );
  lockSmall.type = 'button';
  lockSmall.addEventListener('click', actions.lockIn);
  bottom.append(
    iconButton(COPY.undo, ICONS.undo, actions.undo),
    iconButton(COPY.reset, ICONS.reset, actions.reset),
    iconButton(COPY.rotate, ICONS.rotate, actions.rotate),
    muteButton,
    lockSmall
  );

  // The "All lit" prompt takes the bottom bar's place.
  const prompt = element('section', 'panel prompt');
  const promptText = element('p', 'prompt-text');
  const lockButton = element('button', 'button button-main', COPY.lockIn);
  lockButton.type = 'button';
  lockButton.addEventListener('click', actions.lockIn);
  const refineButton = element(
    'button',
    'button button-quiet',
    COPY.keepRefining
  );
  refineButton.type = 'button';
  refineButton.addEventListener('click', actions.keepRefining);
  const promptButtons = element('div', 'prompt-buttons');
  promptButtons.append(refineButton, lockButton);
  prompt.append(promptText, promptButtons);

  // The one end screen.
  const result = element('section', 'panel result');
  const resultMedal = element('h2', 'result-medal');
  const resultLine = element('p', 'result-line');
  const resultTime = element('p', 'result-time');
  const resultStreak = element('p', 'result-streak');
  const resultNote = element('p', 'result-note');
  const resultFooter = element('p', 'result-footer', COPY.comeBack);
  const againButton = element('button', 'button button-quiet', COPY.playAgain);
  againButton.type = 'button';
  againButton.addEventListener('click', actions.playAgain);
  result.append(
    resultMedal,
    resultLine,
    resultTime,
    resultStreak,
    resultNote,
    againButton,
    resultFooter
  );

  // A quiet line when someone else's lantern rises.
  const skyLine = element('p', 'sky-line');
  let skyUntil = 0;
  const perfLine = element('pre', 'perf');

  const youLabel = element('span', 'sky-tag sky-you', COPY.you);
  const nameLabel = element('span', 'sky-tag');
  let nameTimer = 0;

  root.append(
    youLabel,
    nameLabel,
    top,
    line,
    prompt,
    bottom,
    result,
    skyLine,
    perfLine
  );

  let noticeUntil = 0;
  let noticeTimer = 0;
  let lastHint = '';
  let promptShown = false;
  let resultShown = false;
  let hushed = false;

  function setMuted(muted: boolean): void {
    muteButton.replaceChildren(icon(muted ? ICONS.soundOff : ICONS.soundOn));
    muteButton.setAttribute('aria-label', muted ? COPY.unmute : COPY.mute);
  }

  const showLine = (text: string, kind: 'hint' | 'notice'): void => {
    line.textContent = text;
    line.dataset['kind'] = kind;
    line.classList.toggle('visible', text.length > 0);
  };

  return {
    update(state) {
      const left = piecesLeft(state);
      mirrorCount.textContent = String(left.mirrors);
      prismCount.textContent = String(left.prisms);
      mirrors.classList.toggle('empty', left.mirrors === 0);
      prisms.classList.toggle('empty', left.prisms === 0);

      const count = state.placements.length;
      promptText.textContent = fill(
        count === 1 ? COPY.allLitOnePiece : COPY.allLit,
        { pieces: count, par: island.par }
      );
      promptShown = state.phase === 'prompt';
      root.classList.toggle('prompting', promptShown);
      lockSmall.classList.toggle(
        'visible',
        state.phase === 'playing' && state.promptDismissed && canLockIn(state)
      );

      const hint = showHints ? hintFor(state) : null;
      lastHint =
        hint === 'place'
          ? COPY.hintPlace
          : hint === 'turn'
            ? COPY.hintTurn
            : hint === 'prism'
              ? COPY.hintPrism
              : '';
      if (performance.now() >= noticeUntil) showLine(lastHint, 'hint');
    },

    notice(text) {
      noticeUntil = performance.now() + VIEW.noticeMs;
      showLine(text, 'notice');
      inventory.classList.remove('shake');
      // Reading a layout property restarts the animation when the class is added again.
      void inventory.offsetWidth;
      inventory.classList.add('shake');
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(
        () => showLine(lastHint, 'hint'),
        VIEW.noticeMs
      );
    },

    setBusy(busy) {
      lockButton.disabled = busy;
      lockSmall.disabled = busy;
      refineButton.disabled = busy;
    },

    setMuted,

    quiet(quiet) {
      hushed = quiet;
      root.classList.toggle('quiet', quiet);
    },

    showResult(outcome, replayed) {
      resultMedal.textContent = MEDAL_NAME[outcome.medal];
      resultMedal.dataset['medal'] = outcome.medal;
      resultLine.textContent =
        outcome.pieces <= outcome.par
          ? fill(COPY.resultPar, { pieces: outcome.pieces })
          : fill(COPY.resultOverPar, {
              pieces: outcome.pieces,
              par: outcome.par,
            });
      resultTime.textContent = !outcome.ranked
        ? COPY.unranked
        : outcome.rank > 0
          ? fill(COPY.rankLine, {
              time: formatTime(outcome.elapsedMs),
              rank: outcome.rank,
            })
          : formatTime(outcome.elapsedMs);
      resultNote.textContent = replayed ? COPY.replayNote : '';
      resultStreak.textContent = !outcome.ranked
        ? ''
        : outcome.streak <= 1
          ? COPY.streakOne
          : fill(COPY.streakMany, { streak: outcome.streak });
      resultShown = true;
      root.classList.add('resulting');
    },

    hideResult() {
      resultShown = false;
      root.classList.remove('resulting');
    },

    insets() {
      const gap = UI.gapPx;
      if (resultShown)
        return { top: gap, bottom: result.offsetHeight + gap * 2 };
      if (hushed) return { top: gap, bottom: gap };
      const lineRoom = line.classList.contains('visible')
        ? line.offsetHeight + gap
        : gap;
      return {
        top: top.offsetHeight + gap + lineRoom,
        bottom:
          (promptShown ? prompt.offsetHeight : bottom.offsetHeight) + gap * 2,
      };
    },

    skyLine(text) {
      const now = performance.now();
      // One at a time, with a breath between them, so a busy night never becomes a ticker.
      if (now < skyUntil + SKY.lineGapMs || hushed || resultShown) return;
      skyUntil = now + SKY.lineMs;
      skyLine.textContent = text;
      skyLine.classList.add('visible');
      window.setTimeout(() => skyLine.classList.remove('visible'), SKY.lineMs);
    },

    you(spot) {
      youLabel.classList.toggle('visible', spot !== null);
      if (spot !== null)
        youLabel.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px)`;
    },

    nameTag(text, x, y) {
      nameLabel.textContent = text;
      nameLabel.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      nameLabel.classList.add('visible');
      window.clearTimeout(nameTimer);
      nameTimer = window.setTimeout(
        () => nameLabel.classList.remove('visible'),
        SKY.nameMs
      );
    },

    perf(text) {
      perfLine.textContent = text;
      perfLine.classList.add('visible');
    },
  };
}
