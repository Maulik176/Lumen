/**
 * Everything on screen that is not the island: the two thin bars, the hint line, the
 * "All lit" prompt and the result card. Plain DOM over the canvas.
 */
import type { LockInResponse, PublicIsland } from '../../shared/api';
import { COPY, VIEW } from '../../shared/config';
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
};

export type Hud = {
  /** Redraw counters, hint and prompt from the play state. */
  update: (state: PlayState) => void;
  /** Show a short line, such as "No pieces left". */
  notice: (text: string) => void;
  setBusy: (busy: boolean) => void;
  setMuted: (muted: boolean) => void;
  /** Hide everything but the island, for nightfall. */
  quiet: (quiet: boolean) => void;
  showResult: (result: Extract<LockInResponse, { ok: true }>) => void;
  hideResult: () => void;
  /** Heights of the bars in pixels, so the island can be framed between them. */
  insets: () => { top: number; bottom: number };
};

const ICONS = {
  undo: 'M9 7 4 12l5 5M4.5 12H14a5.5 5.5 0 0 1 0 11h-2',
  reset: 'M5 6v6h6M5.6 12A8 8 0 1 1 8 19.6',
  rotate:
    'M4 14a8 8 0 0 0 15.5 2.5M20 10A8 8 0 0 0 4.5 7.5M20 4v6h-6M4 20v-6h6',
  soundOn: 'M4 10v6h4l5 4V6L8 10H4zM16.5 9.5a4 4 0 0 1 0 7M19 7a8 8 0 0 1 0 12',
  soundOff: 'M4 10v6h4l5 4V6L8 10H4zM17 10l5 6M22 10l-5 6',
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

export function createHud(
  root: HTMLElement,
  island: PublicIsland,
  actions: HudActions,
  showHints: boolean
): Hud {
  // Top bar: which island, what is left to place, and par.
  const top = element('header', 'bar bar-top');
  const title = element('div', 'title');
  title.append(
    element('span', 'title-number', `Lumen #${island.day}`),
    element('span', 'title-name', island.name)
  );
  const inventory = element('div', 'inventory');
  const mirrors = element('span', 'count');
  const mirrorCount = element('b', 'count-number');
  mirrors.append(element('i', 'glyph glyph-mirror'), mirrorCount);
  const prisms = element('span', 'count');
  const prismCount = element('b', 'count-number');
  prisms.append(element('i', 'glyph glyph-prism'), prismCount);
  inventory.append(mirrors);
  if (island.inventory.prisms > 0) inventory.append(prisms);
  const par = element('div', 'par');
  par.append(
    element('span', 'par-label', 'par'),
    element('b', 'par-number', String(island.par))
  );
  top.append(title, inventory, par);

  // One line under the top bar: a first-time hint, or a short notice.
  const line = element('p', 'line');
  line.setAttribute('role', 'status');

  // Bottom bar: the four controls.
  const bottom = element('footer', 'bar bar-bottom');
  const muteButton = iconButton(COPY.mute, ICONS.soundOn, () => {
    const muted = actions.toggleMute();
    setMuted(muted);
  });
  bottom.append(
    iconButton(COPY.undo, ICONS.undo, actions.undo),
    iconButton(COPY.reset, ICONS.reset, actions.reset),
    iconButton(COPY.rotate, ICONS.rotate, actions.rotate),
    muteButton
  );

  // The "All lit" prompt, and the smaller Lock in that stays after Keep refining.
  const prompt = element('section', 'prompt');
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

  const lockPill = element(
    'button',
    'button button-main lock-pill',
    COPY.lockIn
  );
  lockPill.type = 'button';
  lockPill.addEventListener('click', actions.lockIn);

  // The one end screen.
  const result = element('section', 'result');
  const resultMedal = element('h2', 'result-medal');
  const resultLine = element('p', 'result-line');
  const resultTime = element('p', 'result-time');
  const resultFooter = element('p', 'result-footer', COPY.comeBack);
  const againButton = element('button', 'button button-quiet', COPY.playAgain);
  againButton.type = 'button';
  againButton.addEventListener('click', actions.playAgain);
  result.append(resultMedal, resultLine, resultTime, againButton, resultFooter);

  root.append(top, line, prompt, lockPill, bottom, result);

  let noticeUntil = 0;
  let noticeTimer = 0;
  let lastHint = '';

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
      prompt.classList.toggle('visible', state.phase === 'prompt');
      lockPill.classList.toggle(
        'visible',
        state.phase === 'playing' && state.promptDismissed && canLockIn(state)
      );
      root.classList.toggle(
        'all-lit',
        state.light.solved && state.phase !== 'locked'
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
      lockPill.disabled = busy;
      refineButton.disabled = busy;
    },

    setMuted,

    quiet(quiet) {
      root.classList.toggle('quiet', quiet);
    },

    showResult(outcome) {
      resultMedal.textContent = MEDAL_NAME[outcome.medal];
      resultMedal.dataset['medal'] = outcome.medal;
      resultLine.textContent =
        outcome.pieces <= outcome.par
          ? fill(COPY.resultPar, { pieces: outcome.pieces })
          : fill(COPY.resultOverPar, {
              pieces: outcome.pieces,
              par: outcome.par,
            });
      resultTime.textContent = formatTime(outcome.elapsedMs);
      result.classList.add('visible');
    },

    hideResult() {
      result.classList.remove('visible');
    },

    insets() {
      return { top: top.offsetHeight + 28, bottom: bottom.offsetHeight + 8 };
    },
  };
}
