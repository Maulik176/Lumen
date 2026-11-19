/**
 * Everything on screen that is not the island: the two thin bars, the hint line, the
 * "All lit" prompt and the result card. Plain DOM over the canvas.
 *
 * The island is always framed in the space these leave free: `insets()` reports how much room
 * the interface is taking at the top and the bottom right now.
 */
import type { LockInResult, PublicIsland } from '../../shared/api';
import type { ArrivalPath } from '../../shared/arrival';
import { COPY, OTHERS, SKY, UI, VIEW } from '../../shared/config';
import type { SkyNote } from '../../shared/skynote';
import {
  canLockIn,
  hintFor,
  piecesLeft,
  type PlayState,
} from '../../shared/play';
import type { Medal } from '../../shared/types';
import { medalEmblem } from './emblem';
import { formatTime } from './fit';

export type HudActions = {
  undo: () => void;
  reset: () => void;
  rotate: () => void;
  toggleMute: () => boolean;
  lockIn: () => void;
  keepRefining: () => void;
  playAgain: () => void;
  /** Top bar, right: tonight's island offers How to play; a past island offers Back. */
  howToPlay?: () => void;
  back?: () => void;
  /** Where `back` leads, for its label. "Back to tonight" when left out. */
  backLabel?: string;
  /** Result card: the list of earlier islands. Left out on day 1, when there are none. */
  explore?: () => void;
  /** Opens the Island Builder (after a ranked Lock in, when the community side is on). */
  build?: () => void;
  /** Result card: tapping the time and place opens tonight's board. */
  board?: () => void;
  /** Result card: where everyone put their pieces. Only after a solve that allows it. */
  others?: () => void;
  /** Result card on a post that is not tonight's: go to tonight's island. */
  tonight?: () => void;
  /** Result card on a community island: tonight's daily post. */
  lumen?: () => void;
  /** Result card, ranked and signed in: post the result as the player's own comment. */
  share?: () => void;
  /** Open the player's shared reply. */
  openShared?: (url: string) => void;
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
  /**
   * The end screen. A ranked result finishes the island: no replay, only what comes after.
   * An unranked one (signed out, a past island) may be played again for practice.
   */
  showResult: (result: LockInResult) => void;
  /** A list in the result card's place; `hideSheet` returns to the card. */
  showSheet: (content: HTMLElement) => void;
  hideSheet: () => void;
  /** The share button's state: ready, posting, posted, or failed (ready again, with a note). */
  setShare: (
    state: 'idle' | 'busy' | 'done' | 'failed',
    /** Done, with the reply's address: the button opens it. */
    url?: string | null
  ) => void;
  /** The small "You" label on the player's own lantern; null hides it. */
  you: (spot: { x: number; y: number } | null) => void;
  /** A tapped lantern's name, shown beside it for a moment. */
  nameTag: (text: string, x: number, y: number) => void;
  hideResult: () => void;
  /**
   * Room the interface is taking at the top, the bottom and (landscape only) the right, in
   * pixels. Also switches between the phone layout and the landscape one to suit the view.
   */
  insets: () => { top: number; bottom: number; right: number };
  /**
   * A faint lantern rising through the empty sky above the island, for another player's solve.
   * Never over the island or the bars, never takes a tap.
   */
  arrival: (path: ArrivalPath) => void;
  /** "u/name lit Moss Steps": shown briefly, never more than one at a time. */
  skyLine: (text: string) => void;
  /**
   * Lines that show even while everything else is hidden, one after another: each for its own
   * time, then it goes, and after a short pause the next comes. No tap needed. A new call
   * replaces whatever was still to come.
   */
  say: (notes: readonly SkyNote[]) => void;
  /** Developer read-out, shown only with ?perf=1. */
  perf: (text: string) => void;
};

/** Hand-drawn style: single round strokes, slightly loose. Drawn on a 26 x 26 grid. */
export const ICONS = {
  /** A small paper sky lantern: crown, shade, hoop. */
  lantern:
    'M7.200 9.400q5.800-5.200 11.600 0l-1.700 11.400H8.900zM8.900 20.800h8.200M13 13.600c1.300-1 1.400-2.700 0-4.400-1.400 1.700-1.300 3.400 0 4.400z',
  tick: 'M6.2 13.6l4.6 4.600 9-9.900',
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

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function icon(path: string): SVGSVGElement {
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

export function fill(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    String(values[key] ?? whole)
  );
}

/** True when the view is wide enough for the landscape layout (a laptop, not a phone). */
export function wideView(): boolean {
  return (
    window.innerWidth >= VIEW.wideMinWidth &&
    window.innerWidth / window.innerHeight >= VIEW.wideMinAspect
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
  set('--night', UI.night);
  set('--preview-width', String(OTHERS.previewWidth));
  set('--preview-height', String(OTHERS.previewHeight));
  set('--medal-lamplighter', UI.medalLamplighter);
  set('--medal-glow', UI.medalGlow);
  set('--medal-spark', UI.medalSpark);
  set('--radius', `${UI.radiusPx}px`);
  set('--gap', `${UI.gapPx}px`);
  set('--tap', `${UI.tapPx}px`);
  set('--wide-bar', `${VIEW.wideBarPx}px`);
  set('--wide-panel', `${VIEW.widePanelPx}px`);
  set('--wide-gap', `${VIEW.wideGapPx}px`);
}

export function createHud(
  root: HTMLElement,
  island: PublicIsland,
  actions: HudActions,
  showHints: boolean,
  /** Shown in place of the island's name, e.g. that this is practice on a night that has passed. */
  note?: string
): Hud {
  // Top bar: which island, what is left to place, and par.
  const top = element('header', 'panel bar bar-top');
  const title = element('div', 'title');
  title.append(
    // A community island names its maker; a Builder island being tested has no number yet.
    element(
      'span',
      'title-number',
      island.community !== undefined
        ? fill(COPY.communityBy, { maker: island.community.maker })
        : island.day > 0
          ? `Lumen #${island.day}`
          : COPY.builderTitle
    ),
    element('span', 'title-name', note ?? island.name)
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
  top.append(title, inventory, par);
  const corner = actions.back ?? actions.howToPlay;
  if (corner !== undefined) {
    const help = element(
      'button',
      'help-button',
      actions.back === undefined ? '?' : '\u2190'
    );
    help.type = 'button';
    help.setAttribute(
      'aria-label',
      actions.back === undefined
        ? COPY.howToPlay
        : (actions.backLabel ?? COPY.backToTonight)
    );
    help.addEventListener('click', corner);
    top.append(help);
  }

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
  const resultTime = element('button', 'result-time');
  resultTime.type = 'button';
  resultTime.disabled = true;
  if (actions.board !== undefined)
    resultTime.addEventListener('click', actions.board);
  const resultStreak = element('p', 'result-streak');
  const resultFooter = element('p', 'result-footer', COPY.comeBack);
  const resultButtons = element('div', 'result-buttons');
  const button = (
    text: string,
    kind: 'main' | 'quiet',
    onTap: (() => void) | undefined
  ): HTMLButtonElement | null => {
    if (onTap === undefined) return null;
    const node = element('button', `button button-${kind}`, text);
    node.type = 'button';
    node.addEventListener('click', onTap);
    return node;
  };
  const againButton = button(COPY.playAgain, 'quiet', actions.playAgain);
  const exploreButton = button(COPY.explore, 'quiet', actions.explore);
  const buildButton = button(COPY.builderOpen, 'quiet', actions.build);
  const othersButton = button(COPY.others, 'main', actions.others);
  /** Once shared, the reply's address: the share button then opens it instead of posting. */
  let sharedAt: string | null = null;
  const share = actions.share;
  const shareButton = button(
    COPY.share,
    'quiet',
    share === undefined
      ? undefined
      : () => {
          if (sharedAt !== null) actions.openShared?.(sharedAt);
          else share();
        }
  );
  let footerTimer = 0;
  const backButton = button(
    actions.backLabel ?? COPY.backToTonight,
    'quiet',
    actions.back
  );
  const tonightButton = button(COPY.toTonight, 'main', actions.tonight);
  const lumenButton = button(COPY.communityTonight, 'quiet', actions.lumen);
  const community = island.community !== undefined;
  result.append(
    resultMedal,
    resultLine,
    resultTime,
    resultStreak,
    resultButtons,
    resultFooter
  );
  // Past islands have no "tomorrow", and a community island has no nights at all.
  if (actions.back !== undefined || community) resultFooter.remove();

  const sheet = element('section', 'panel sheet');
  let sheetShown = false;

  // A quiet line when someone else's lantern rises.
  const skyLine = element('p', 'sky-line');
  let skyUntil = 0;
  let sayTimer = 0;
  const perfLine = element('pre', 'perf');

  const youLabel = element('span', 'sky-tag sky-you', COPY.you);
  const nameLabel = element('span', 'sky-tag');
  let nameTimer = 0;
  let youX = -2;
  let youY = -2;

  root.append(
    youLabel,
    nameLabel,
    top,
    line,
    prompt,
    bottom,
    result,
    sheet,
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

  const showLine = (text: string, kind: 'hint' | 'notice' | 'sky'): void => {
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

    showResult(outcome) {
      resultMedal.replaceChildren(
        medalEmblem(outcome.medal),
        document.createTextNode(MEDAL_NAME[outcome.medal])
      );
      resultMedal.dataset['medal'] = outcome.medal;
      resultLine.textContent =
        outcome.pieces <= outcome.par
          ? fill(COPY.resultPar, { pieces: outcome.pieces })
          : fill(COPY.resultOverPar, {
              pieces: outcome.pieces,
              par: outcome.par,
            });
      resultTime.disabled = !outcome.ranked || actions.board === undefined;
      resultTime.textContent = !outcome.ranked
        ? COPY.unranked
        : outcome.rank > 0
          ? fill(community ? COPY.communityRank : COPY.rankLine, {
              time: formatTime(outcome.elapsedMs),
              rank: outcome.rank,
            })
          : formatTime(outcome.elapsedMs);
      // A ranked result is final; anything else can be played again.
      // Tonight's islands open after a ranked solve; an earlier night's are open after any solve.
      const shown = community
        ? outcome.ranked
          ? [othersButton, shareButton, lumenButton, buildButton]
          : [againButton, lumenButton]
        : outcome.ranked
          ? [othersButton, shareButton, exploreButton, buildButton]
          : backButton !== null
            ? [othersButton, againButton, backButton]
            : [tonightButton, againButton, exploreButton];
      const buttons = shown.filter(
        (node): node is HTMLButtonElement => node !== null
      );
      resultButtons.replaceChildren(...buttons);
      // Quiet buttons sit two to a row; an odd one out takes the whole row, never half of it.
      const quiet = buttons.filter((node) =>
        node.classList.contains('button-quiet')
      );
      quiet.forEach((node, index) =>
        node.classList.toggle(
          'wide',
          quiet.length % 2 === 1 && index === quiet.length - 1
        )
      );
      // Streaks belong to the daily islands only.
      resultStreak.textContent =
        !outcome.ranked || community
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

    setShare(state, url) {
      if (shareButton === null) return;
      sharedAt = state === 'done' && url != null ? url : null;
      shareButton.disabled =
        state === 'busy' || (state === 'done' && sharedAt === null);
      if (state === 'done' && sharedAt !== null) {
        // A drawn tick, then the words: the button now opens the reply.
        shareButton.replaceChildren(
          icon(ICONS.tick),
          document.createTextNode(COPY.sharedView)
        );
        shareButton.classList.add('with-icon');
      } else {
        shareButton.classList.remove('with-icon');
        shareButton.textContent =
          state === 'busy'
            ? COPY.sharing
            : state === 'done'
              ? COPY.shared
              : COPY.share;
      }
      if (state !== 'failed') return;
      resultFooter.textContent = COPY.shareFailed;
      window.clearTimeout(footerTimer);
      footerTimer = window.setTimeout(() => {
        resultFooter.textContent = COPY.comeBack;
      }, VIEW.noticeMs * 2);
    },

    showSheet(content) {
      sheet.replaceChildren(content);
      sheetShown = true;
      root.classList.add('sheeting');
    },

    hideSheet() {
      sheetShown = false;
      root.classList.remove('sheeting');
    },

    insets() {
      const gap = UI.gapPx;
      const wide = wideView();
      root.classList.toggle('wide', wide);
      // Landscape: the card or list stands in a column on the right, beside the island.
      if (wide && (sheetShown || resultShown))
        return {
          top: VIEW.wideGapPx * 2,
          bottom: VIEW.wideGapPx * 2,
          right: VIEW.widePanelPx + VIEW.wideGapPx * 2,
        };
      if (sheetShown)
        return { top: gap, bottom: sheet.offsetHeight + gap * 2, right: 0 };
      if (resultShown)
        return { top: gap, bottom: result.offsetHeight + gap * 2, right: 0 };
      if (hushed) return { top: gap, bottom: gap, right: 0 };
      // The hint line's room is kept whether a line shows or not, so the island never shifts.
      return {
        top: top.offsetHeight + gap * 2 + VIEW.hintRoomPx,
        bottom:
          (promptShown ? prompt.offsetHeight : bottom.offsetHeight) + gap * 2,
        right: 0,
      };
    },

    say(notes) {
      window.clearTimeout(sayTimer);
      const total = notes.reduce(
        (sum, note) => sum + note.ms + SKY.noteGapMs,
        0
      );
      skyUntil = performance.now() + total;
      const show = (index: number): void => {
        const note = notes[index];
        if (note === undefined) return;
        skyLine.textContent = note.text;
        skyLine.classList.add('visible');
        sayTimer = window.setTimeout(() => {
          skyLine.classList.remove('visible');
          sayTimer = window.setTimeout(() => show(index + 1), SKY.noteGapMs);
        }, note.ms);
      };
      show(0);
    },

    skyLine(text) {
      const now = performance.now();
      // One at a time, with a breath between them, so a busy night never becomes a ticker. It
      // never interrupts a notice, and only shows while the island is being played.
      if (now < skyUntil + SKY.lineGapMs || hushed || resultShown) return;
      if (now < noticeUntil) return;
      skyUntil = now + SKY.lineMs;
      // It borrows the hint row, which is always kept free, so the island never moves; the hint
      // comes back after.
      noticeUntil = now + SKY.lineMs;
      showLine(text, 'sky');
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(
        () => showLine(lastHint, 'hint'),
        SKY.lineMs
      );
    },

    arrival(path) {
      if (hushed || resultShown) return;
      if (root.querySelectorAll('.arrival').length >= SKY.arrivalMax) return;
      const lantern = element('div', 'arrival');
      lantern.setAttribute('aria-hidden', 'true');
      lantern.append(icon(ICONS.lantern));
      lantern.style.width = `${SKY.arrivalPx}px`;
      lantern.style.height = `${SKY.arrivalPx}px`;
      lantern.style.left = `${path.x}px`;
      lantern.style.top = `${path.from}px`;
      root.append(lantern);
      const rise = path.to - path.from;
      const travel = lantern.animate(
        [
          { transform: 'translate(-50%, 0)', opacity: 0 },
          { opacity: SKY.arrivalOpacity, offset: 0.2 },
          { opacity: SKY.arrivalOpacity, offset: 0.75 },
          { transform: `translate(-50%, ${rise}px)`, opacity: 0 },
        ],
        { duration: SKY.arrivalMs, easing: 'ease-in-out', fill: 'forwards' }
      );
      travel.onfinish = () => lantern.remove();
    },

    you(spot) {
      // Called every frame: touch the page only when the label has really moved.
      const x = spot === null ? -1 : Math.round(spot.x * 2);
      const y = spot === null ? -1 : Math.round(spot.y * 2);
      if (x === youX && y === youY) return;
      youX = x;
      youY = y;
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
