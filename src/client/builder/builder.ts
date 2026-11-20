/**
 * The Island Builder screen. Pick a world, a size and spare mirrors; place suns, lanterns, rocks,
 * trees, water and stone mirrors with taps; see the light live; check the island on the server
 * (par, pieces, difficulty); then light it yourself in the real game. The first time, a hands-on
 * tutorial walks through making that first island. Signed-out players can build; checking and
 * testing need an account.
 *
 * Opened as a layer over the game (from the result card or the map) or as its own page
 * (builder.html, the Workshop post). The host supplies the 3D test and the way out.
 */
import type {
  BuilderCheckResponse,
  BuilderDraftResponse,
  BuilderMineResponse,
  BuilderPublishResponse,
  YourIsland,
} from '../../shared/api';
import {
  applyTool,
  BUILDER_TOOLS,
  builderStart,
  checkKey,
  draftProblem,
  emptyDraft,
  nameProblem,
  nextLesson,
  readDraft,
  redoEdit,
  resizeDraft,
  startHistory,
  undoEdit,
  withEdit,
  type BuilderHistory,
  type BuilderTool,
  type IslandDraft,
  type Lesson,
  type LessonAction,
} from '../../shared/builder';
import { monthDay, type Biome } from '../../shared/calendar';
import {
  BIOMES,
  BIOME_LOOK,
  BUILDER_VIEW,
  COMMUNITY,
  COPY,
} from '../../shared/config';
import type { Inventory } from '../../shared/types';
import { element, fill, icon, ICONS } from '../game/hud';
import { onTap } from '../game/taps';
import { drawIslandOutline } from '../outline';
import { createBoard } from './board';
import { delayedSave } from './saver';

export type TestIsland = {
  draft: IslandDraft;
  inventory: Inventory;
  par: number;
};

/**
 * How a test ended: lit (the server confirmed the solve and its pieces), left without lighting
 * it, or never started because the server no longer had the check, or could not be reached.
 */
export type TestResult =
  | { lit: true; pieces: number }
  | { lit: false; why: 'left' | 'not-checked' | 'failed' };

export type BuilderHost = {
  /** Open the island in the real game for the maker to light. */
  test: (island: TestIsland) => Promise<TestResult>;
  /** Leave the Builder. Absent on its own page, where there is nowhere else to go. */
  close?: () => void;
  click: () => void;
  /** One chime of the nightfall's rising run, for the lanterns ringing after a publish. */
  chime: (index: number) => void;
  /** Open a post (the island just published). */
  open: (url: string) => void;
  /** Reduce Motion: no rings travelling over the board, one soft glow instead. */
  calm: boolean;
  /** The player's own snoovatar address ('' for none) and where the island will be posted. */
  avatar: string;
  username: string | null;
  subreddit: string;
};

/** A publish attempt's token: 12 random bytes as hex. The same island keeps its token. */
function newToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const wait = (ms: number): Promise<void> =>
  new Promise((done) => window.setTimeout(done, ms));

const DRAFT_KEY = 'lumen.builder.draft';
const TUTORIAL_KEY = 'lumen.builder.tutorial';

/**
 * The last draft save sent to the server. Reopening the Builder waits for it, so the draft read
 * back is never older than the one just sent on closing.
 */
let lastSave: Promise<unknown> = Promise.resolve();

/** Tool icons, drawn in the same hand as the game's (26 x 26, stroked). */
const TOOL_ICON: Record<BuilderTool, string> = {
  sun: 'M13 4.5l5.5 8.5-5.5 8.5-5.5-8.5zM20.5 13h3',
  lantern: ICONS.lantern,
  rock: 'M5 18.5l2-8 6-4 7 3 1.5 8-6.5 3.5z',
  tree: 'M13 3.5l6.5 12h-13zM13 15.5v6',
  water:
    'M3.5 10c3-2.5 6.5-2.5 9.500 0s6.500 2.500 9.500 0M3.5 16c3-2.5 6.5-2.5 9.500 0s6.500 2.500 9.500 0',
  stone: 'M6.5 19.5l13-13M8.5 21.5l13-13',
  eraser: 'M5 16.5l8.5-8.5 6 6-5.500 5.500H10zM9 20.5h12',
};

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the server keeps a signed-in player's draft anyway.
  }
}

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function piecesText(inventory: Inventory): string {
  const mirrors =
    inventory.mirrors === 1
      ? COPY.builderMirrorsOne
      : fill(COPY.builderMirrors, { count: inventory.mirrors });
  const prisms =
    inventory.prisms === 0
      ? ''
      : inventory.prisms === 1
        ? COPY.builderPrismsOne
        : fill(COPY.builderPrisms, { count: inventory.prisms });
  return mirrors + prisms;
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const value: T = await response.json();
    return value;
  } catch {
    return null;
  }
}

export async function openBuilder(
  root: HTMLElement,
  host: BuilderHost
): Promise<{ dispose: () => void }> {
  await lastSave;
  const loaded = await fetch('/api/builder/draft')
    .then((response): Promise<BuilderDraftResponse> => response.json())
    .catch(() => null);
  const loggedIn = loaded?.loggedIn === true;
  const localDraft = ((): IslandDraft | null => {
    try {
      return readDraft(JSON.parse(recall(DRAFT_KEY) ?? 'null'));
    } catch {
      return null;
    }
  })();
  // Signed in, the server's copy decides; the device's copy is only for signed-out players.
  const start = builderStart({
    loggedIn,
    serverDraft: loaded?.draft ?? null,
    serverTutorialDone: loaded?.tutorialDone === true,
    deviceDraft: localDraft,
    deviceTutorialDone: recall(TUTORIAL_KEY) === '1',
  });
  let history: BuilderHistory = startHistory(
    start.draft ?? emptyDraft(COMMUNITY.defaultSize, 'moss')
  );
  let lesson: Lesson = start.tutorialDone ? 'done' : 'biome';
  let tool: BuilderTool = 'sun';
  let checked: {
    key: string;
    par: number;
    inventory: Inventory;
    label: keyof typeof COPY.builderLabels;
  } | null = null;
  let tested: { key: string; pieces: number } | null = null;
  // The server's check and solve for the draft it kept: reopening keeps work already done.
  const serverDraft = loaded?.draft ?? null;
  if (start.draft !== null && start.draft === serverDraft) {
    const key = checkKey(start.draft);
    const known = loaded?.status;
    if (known?.checked) checked = { key, ...known.checked };
    if (known?.tested) tested = { key, pieces: known.tested.pieces };
  }
  let status = '';
  let busy = false;
  let publishing = false;
  /** The island is up and the lanterns are ringing: the button says so until the post opens. */
  let published = false;
  /** Kept for one version of the island, so a retry after a lost answer finds the first post. */
  let publishToken: { key: string; token: string } | null = null;

  // --- The screen ---------------------------------------------------------------------------
  const screen = element('div', 'bd');
  const top = element('header', 'panel bd-top');
  const close = element('button', 'icon-button bd-close');
  close.type = 'button';
  close.setAttribute('aria-label', COPY.builderClose);
  close.append(icon('M7 7l12 12M19 7L7 19'));
  const title = element('span', 'bd-title', COPY.builderTitle);
  const name = element('input', 'bd-name');
  name.type = 'text';
  name.maxLength = COMMUNITY.nameMax;
  name.placeholder = COPY.builderName;
  name.setAttribute('aria-label', COPY.builderName);
  name.autocomplete = 'off';
  // World, size and spare mirrors live in a panel opened from here, so the board keeps its room
  // (an 8x8 board needs the full width and most of the height for 44 px tiles).
  const island = element(
    'button',
    'button button-quiet bd-island',
    COPY.builderIsland
  );
  island.type = 'button';
  island.setAttribute('aria-expanded', 'false');
  if (host.close !== undefined) top.append(close);
  top.append(title, name, island);

  const settings = element('div', 'panel bd-settings');
  const worlds = element('div', 'bd-group');
  worlds.append(element('span', 'bd-label', COPY.builderWorld));
  const worldButtons = new Map<Biome, HTMLButtonElement>();
  for (const biome of BIOMES) {
    const button = element('button', 'bd-world');
    button.type = 'button';
    button.setAttribute('aria-label', COPY.builderBiomes[biome]);
    button.title = COPY.builderBiomes[biome];
    const look = BIOME_LOOK[biome];
    button.style.background = `linear-gradient(135deg, #${look.groundA.toString(16).padStart(6, '0')} 50%, #${look.crown.toString(16).padStart(6, '0')} 50%)`;
    button.addEventListener('click', () => {
      edit({ ...history.draft, biome });
      if (lesson === 'biome') showSettings(false);
      learn({ type: 'biome' });
    });
    worldButtons.set(biome, button);
    worlds.append(button);
  }
  const sizes = element('div', 'bd-group');
  sizes.append(element('span', 'bd-label', COPY.builderSize));
  const sizeButtons = new Map<number, HTMLButtonElement>();
  for (const size of COMMUNITY.sizes) {
    const button = element('button', 'bd-chip', String(size));
    button.type = 'button';
    button.addEventListener('click', () => {
      if (size !== history.draft.size) edit(resizeDraft(history.draft, size));
    });
    sizeButtons.set(size, button);
    sizes.append(button);
  }
  const spares = element('div', 'bd-group bd-spares');
  spares.append(element('span', 'bd-label', COPY.builderSpare));
  const spareButtons = new Map<number, HTMLButtonElement>();
  for (const spare of COMMUNITY.spareChoices) {
    const button = element('button', 'bd-chip', String(spare));
    button.type = 'button';
    button.addEventListener('click', () => {
      edit({ ...history.draft, spare });
      if (lesson === 'spare') showSettings(false);
      learn({ type: 'spare' });
    });
    spareButtons.set(spare, button);
    spares.append(button);
  }
  const done = element(
    'button',
    'button button-quiet bd-done',
    COPY.builderDone
  );
  done.type = 'button';
  // The maker's published islands, from the same panel (the top bar has no room to spare).
  const yoursButton = element(
    'button',
    'button button-quiet bd-yours-open',
    COPY.builderYours
  );
  yoursButton.type = 'button';
  const settingsFoot = element('div', 'bd-settings-foot');
  if (loggedIn) settingsFoot.append(yoursButton);
  settingsFoot.append(done);
  settings.append(worlds, sizes, spares, settingsFoot);
  let settingsOpen = false;
  settings.hidden = true;
  const showSettings = (open: boolean): void => {
    settingsOpen = open;
    settings.hidden = !open;
    if (open) yours.hidden = true;
    island.setAttribute('aria-expanded', String(open));
  };
  island.addEventListener('click', () => showSettings(!settingsOpen));
  done.addEventListener('click', () => {
    showSettings(false);
    learn({ type: 'next' });
  });

  // Publishing: a confirm panel over the board, with the island's picture and who it credits.
  const confirm = element('div', 'panel bd-confirm');
  confirm.hidden = true;
  const confirmTitle = element(
    'p',
    'bd-confirm-title',
    COPY.builderConfirmTitle
  );
  const picture = element('canvas', 'bd-confirm-picture');
  picture.setAttribute('role', 'img');
  const confirmName = element('p', 'bd-confirm-name');
  const confirmFacts = element('p', 'bd-confirm-facts');
  const confirmCredit = element('p', 'bd-confirm-credit');
  const notYet = element('button', 'button button-quiet', COPY.builderNotYet);
  notYet.type = 'button';
  const publishButton = element(
    'button',
    'button button-main',
    COPY.builderPublish
  );
  publishButton.type = 'button';
  const confirmButtons = element('div', 'bd-confirm-buttons');
  confirmButtons.append(notYet, publishButton);
  confirm.append(
    confirmTitle,
    picture,
    confirmName,
    confirmFacts,
    confirmCredit,
    confirmButtons
  );

  // "Your islands": every island this player has published, newest first. Tap one to open it.
  const yours = element('div', 'panel bd-yours');
  yours.hidden = true;
  const yoursList = element('div', 'bd-yours-list');
  const yoursBack = element(
    'button',
    'button button-quiet',
    COPY.builderYoursBack
  );
  yoursBack.type = 'button';
  yours.append(
    element('p', 'bd-confirm-title', COPY.builderYours),
    yoursList,
    yoursBack
  );
  yoursBack.addEventListener('click', () => {
    yours.hidden = true;
  });
  yoursButton.addEventListener('click', () => void showYours());

  const yourRow = (entry: YourIsland): HTMLElement => {
    const row = element(
      entry.active ? 'button' : 'div',
      entry.active ? 'bd-yours-row' : 'bd-yours-row bd-yours-down'
    );
    if (row instanceof HTMLButtonElement) {
      row.type = 'button';
      row.addEventListener('click', () => host.open(entry.url));
    }
    const picture = element('canvas', 'bd-yours-picture');
    const look = BIOME_LOOK[entry.biome];
    drawIslandOutline(picture, entry.rows, {
      width: BUILDER_VIEW.yoursPictureWidth,
      height: BUILDER_VIEW.yoursPictureHeight,
      lit: entry.plays > 0,
      land: `#${look.groundA.toString(16).padStart(6, '0')}`,
    });
    const words = element('span', 'bd-yours-words');
    const when = new Date(entry.created).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
    });
    const plays =
      entry.plays === 0
        ? COPY.communityLitNone
        : entry.plays === 1
          ? COPY.communityLitOne
          : fill(COPY.communityLit, { count: entry.plays });
    words.append(
      element('span', 'bd-yours-name', entry.name),
      element(
        'span',
        'bd-yours-detail',
        !entry.active
          ? `${when} \u00b7 ${COPY.builderYoursTakenDown}`
          : entry.plays === 0
            ? `${when} \u00b7 ${plays}`
            : `${when} \u00b7 ${fill(COPY.builderYoursRow, { plays, par: entry.parHits })}`
      )
    );
    // Picked for a Sunday: said under the rest (Phase 3).
    if (entry.chosenFor !== undefined)
      words.append(
        element(
          'span',
          'bd-yours-detail bd-yours-chosen',
          fill(COPY.sundayChosen, { date: monthDay(entry.chosenFor) })
        )
      );
    row.append(picture, words);
    return row;
  };

  async function showYours(): Promise<void> {
    showSettings(false);
    yours.hidden = false;
    yoursList.replaceChildren(element('p', 'bd-yours-empty', '\u2026'));
    const answer = await fetch('/api/builder/mine')
      .then((response): Promise<BuilderMineResponse> => response.json())
      .catch(() => null);
    const islands = answer?.islands ?? [];
    yoursList.replaceChildren(
      ...(answer === null
        ? [element('p', 'bd-yours-empty', COPY.loadFailed)]
        : islands.length === 0
          ? [element('p', 'bd-yours-empty', COPY.builderYoursEmpty)]
          : islands.map(yourRow))
    );
  }

  const hint = element('div', 'panel bd-hint');
  hint.setAttribute('role', 'status');
  const hintText = element('span', 'bd-hint-text');
  const next = element('button', 'bd-link', COPY.builderNext);
  next.type = 'button';
  next.addEventListener('click', () => learn({ type: 'next' }));
  const skip = element('button', 'bd-link', COPY.builderSkip);
  skip.type = 'button';
  skip.addEventListener('click', () => finishTutorial());
  hint.append(hintText, next, skip);

  const wrap = element('div', 'bd-board');
  // The frame hugs the board, so the light that sweeps it during a check stays on the island.
  const frame = element('div', 'bd-frame');
  frame.style.setProperty('--bd-sweep', `${BUILDER_VIEW.checkSweepMs}ms`);
  const canvas = element('canvas', 'bd-canvas');
  frame.append(canvas);
  wrap.append(frame);
  const board = createBoard(canvas);

  const tools = element('div', 'panel bd-tools');
  tools.setAttribute('role', 'toolbar');
  const toolButtons = new Map<BuilderTool, HTMLButtonElement>();
  for (const each of BUILDER_TOOLS) {
    const button = element('button', 'bd-tool');
    button.type = 'button';
    button.setAttribute('aria-label', COPY.builderToolNames[each]);
    button.append(
      icon(TOOL_ICON[each]),
      element('span', '', COPY.builderTools[each])
    );
    button.addEventListener('click', () => {
      tool = each;
      host.click();
      render();
    });
    toolButtons.set(each, button);
    tools.append(button);
  }

  const actions = element('div', 'panel bd-actions');
  const undo = element('button', 'icon-button', undefined);
  undo.type = 'button';
  undo.setAttribute('aria-label', COPY.builderUndo);
  undo.append(icon(ICONS.undo));
  undo.addEventListener('click', () => {
    history = undoEdit(history);
    changed();
  });
  const redo = element('button', 'icon-button bd-redo');
  redo.type = 'button';
  redo.setAttribute('aria-label', COPY.builderRedo);
  redo.append(icon(ICONS.undo));
  redo.addEventListener('click', () => {
    history = redoEdit(history);
    changed();
  });
  const clear = element('button', 'icon-button');
  clear.type = 'button';
  clear.setAttribute('aria-label', COPY.builderClear);
  clear.append(icon(ICONS.reset));
  clear.addEventListener('click', () => {
    const { size, biome, name: title, spare } = history.draft;
    edit({ ...emptyDraft(size, biome), name: title, spare });
  });
  const main = element(
    'button',
    'button button-main bd-main',
    COPY.builderCheck
  );
  main.type = 'button';
  main.addEventListener('click', () => {
    const key = checkKey(history.draft);
    if (tested !== null && tested.key === key) showConfirm(true);
    else if (checked !== null && checked.key === key) void test();
    else void check();
  });
  notYet.addEventListener('click', () => showConfirm(false));
  publishButton.addEventListener('click', () => void publish());
  actions.append(undo, redo, clear, main);

  screen.append(top, settings, confirm, yours, hint, wrap, tools, actions);
  root.append(screen);

  // --- Behaviour ----------------------------------------------------------------------------
  const saver = delayedSave(
    () => {
      remember(DRAFT_KEY, JSON.stringify(history.draft));
      if (loggedIn)
        // keepalive lets the save finish even when the page is going away.
        lastSave = fetch('/api/builder/draft', {
          method: 'PUT',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draft: history.draft }),
        }).catch(() => undefined);
    },
    BUILDER_VIEW.saveAfterMs,
    {
      set: (run, ms) => window.setTimeout(run, ms),
      clear: (id) => window.clearTimeout(id),
    }
  );
  const save = (): void => saver.change();
  // Closing the app or switching away may never come back to this page: save first.
  const away = (): void => {
    if (document.visibilityState === 'hidden') saver.flush();
  };
  const leaving = (): void => saver.flush();
  document.addEventListener('visibilitychange', away);
  window.addEventListener('pagehide', leaving);

  /**
   * The check and the test belong to one version of the island (render compares keys), so
   * undoing back to a checked island needs no second check.
   */
  const changed = (): void => {
    save();
    render();
  };

  const edit = (draft: IslandDraft): void => {
    history = withEdit(history, draft);
    status = '';
    changed();
  };

  const learn = (action: LessonAction): void => {
    if (lesson === 'done') return;
    const after = nextLesson(lesson, action);
    if (after === lesson) return;
    lesson = after;
    if (lesson === 'done') finishTutorial();
    else render();
  };

  function finishTutorial(): void {
    lesson = 'done';
    // Skipping on the first step would otherwise leave the Island panel open.
    showSettings(false);
    remember(TUTORIAL_KEY, '1');
    if (loggedIn)
      void fetch('/api/builder/tutorial-done', { method: 'POST' }).catch(
        () => undefined
      );
    render();
  }

  name.value = history.draft.name;
  name.addEventListener('input', () => {
    // The name is not an edit to undo, and does not change the island's check.
    history = { ...history, draft: { ...history.draft, name: name.value } };
    status = '';
    save();
    render();
  });

  const stopTaps = onTap(canvas, (clientX, clientY) => {
    if (busy) return;
    const tile = board.tileAt(clientX, clientY);
    if (tile === null) return;
    const step = applyTool(history.draft, tool, tile.x, tile.y);
    if (step.event === 'too-many-suns' || step.event === 'too-many-lanterns') {
      status = COPY.builderProblems[step.event];
      render();
      return;
    }
    if (step.event === 'nothing') return;
    host.click();
    edit(step.draft);
    board.flash(tile.x, tile.y);
    learn({ type: 'tool', tool, event: step.event });
  });

  async function check(): Promise<void> {
    if (busy) return;
    const early = draftProblem(history.draft);
    if (early !== null) {
      status = COPY.builderProblems[early];
      render();
      return;
    }
    if (!loggedIn) {
      status = COPY.builderProblems['signed-out'];
      render();
      return;
    }
    busy = true;
    const draft = history.draft;
    status = COPY.builderCheckingLine;
    frame.classList.add('bd-checking');
    render();
    const began = performance.now();
    const answer = await post<BuilderCheckResponse>('/api/builder/check', {
      draft,
    });
    // A quick answer still lets the light finish its pass, so the check reads as one.
    const rest = BUILDER_VIEW.checkMinMs - (performance.now() - began);
    if (rest > 0) await new Promise((done) => window.setTimeout(done, rest));
    frame.classList.remove('bd-checking');
    busy = false;
    if (answer === null) status = COPY.builderProblems.failed;
    else if (!answer.ok) status = COPY.builderProblems[answer.problem];
    else {
      checked = {
        key: checkKey(draft),
        par: answer.par,
        inventory: answer.inventory,
        label: answer.label,
      };
      status = '';
      learn({ type: 'checked' });
    }
    render();
  }

  async function test(): Promise<void> {
    if (busy || checked === null) return;
    busy = true;
    const draft = history.draft;
    const island = { draft, inventory: checked.inventory, par: checked.par };
    const key = checkKey(draft);
    const result = await host.test(island);
    busy = false;
    if (result.lit) {
      tested = { key, pieces: result.pieces };
      status = '';
      learn({ type: 'tested' });
    } else if (result.why === 'not-checked') {
      checked = null;
      status = COPY.builderTestRecheck;
    } else {
      status =
        result.why === 'left' ? COPY.builderTestLeft : COPY.builderTestFailed;
    }
    render();
    layout();
  }

  function showConfirm(open: boolean): void {
    confirm.hidden = !open;
    if (!open || checked === null) return;
    showSettings(false);
    const draft = history.draft;
    const look = BIOME_LOOK[draft.biome];
    drawIslandOutline(picture, draft.rows, {
      width: BUILDER_VIEW.confirmPictureWidth,
      height: BUILDER_VIEW.confirmPictureHeight,
      lit: true,
      rock: true,
      land: `#${look.groundA.toString(16).padStart(6, '0')}`,
    });
    const named = draft.name.trim();
    confirmName.textContent =
      named === ''
        ? fill(COPY.builderConfirmUnnamed, {
            world: COPY.builderBiomes[draft.biome],
          })
        : named;
    confirmName.classList.toggle('bd-confirm-unnamed', named === '');
    picture.setAttribute('aria-label', confirmName.textContent);
    confirmFacts.textContent = fill(COPY.builderChecked, {
      par: checked.par,
      pieces: piecesText(checked.inventory),
      label: COPY.builderLabels[checked.label],
    });
    confirmCredit.textContent = fill(COPY.builderConfirmLine, {
      sub: host.subreddit,
      name: host.username ?? '',
    });
    render();
  }

  /** The one tap that posts: from the confirm panel's Publish button, never anything else. */
  async function publish(): Promise<void> {
    if (busy) return;
    const draft = history.draft;
    const key = checkKey(draft);
    if (publishToken === null || publishToken.key !== key)
      publishToken = { key, token: newToken() };
    busy = true;
    publishing = true;
    status = '';
    render();
    const answer = await post<BuilderPublishResponse>('/api/builder/publish', {
      draft,
      token: publishToken.token,
      snoovatar: host.avatar,
    });
    publishing = false;
    showConfirm(false);
    if (answer === null || !answer.ok) {
      busy = false;
      const problem = answer === null ? 'failed' : answer.problem;
      // The server no longer has this island's proof: start the check and test again.
      if (problem === 'not-checked' || problem === 'changed') {
        checked = null;
        tested = null;
      }
      if (problem === 'not-tested') tested = null;
      status = COPY.builderPublishProblems[problem];
      render();
      return;
    }
    await celebrate(draft);
    // The island is out; the Builder starts a fresh one in the same world and size.
    remember(DRAFT_KEY, 'null');
    history = startHistory(emptyDraft(draft.size, draft.biome));
    name.value = '';
    checked = null;
    tested = null;
    publishToken = null;
    busy = false;
    render();
    host.open(answer.url);
  }

  /**
   * The island is up: night falls over the board, each lantern blooms with a rising chime, motes
   * of light drift up and one sky lantern lifts away, as at the end of a night in the game.
   */
  async function celebrate(draft: IslandDraft): Promise<void> {
    status = COPY.builderPublished;
    published = true;
    render();
    const party = element('div', 'bd-party');
    const dusk = element('div', 'bd-dusk');
    party.append(dusk);
    frame.append(party);
    // Start each fade from its first style at once (reading a size flushes it), rather than on
    // the next animation frame, which a hidden or busy page may hold back.
    void dusk.offsetWidth;
    dusk.classList.add('on');
    await wait(BUILDER_VIEW.celebrateDuskMs);

    const tile = canvas.clientWidth / draft.size;
    const lanterns: { x: number; y: number }[] = [];
    draft.rows.forEach((row, y) =>
      [...row].forEach((spot, x) => {
        if ('WRGBMCY'.includes(spot)) lanterns.push({ x, y });
      })
    );
    const place = (node: HTMLElement, x: number, y: number): void => {
      node.style.left = `${(x + 0.5) * tile}px`;
      node.style.top = `${(y + 0.5) * tile}px`;
    };
    for (const [index, spot] of lanterns.entries()) {
      const bloom = element('div', 'bd-bloom');
      place(bloom, spot.x, spot.y);
      bloom.style.setProperty(
        '--bloom',
        `${tile * BUILDER_VIEW.celebrateBloomTiles}px`
      );
      party.append(bloom);
      void bloom.offsetWidth;
      bloom.classList.add('on');
      host.chime(index);
      if (!host.calm)
        for (let mote = 0; mote < BUILDER_VIEW.celebrateMotes; mote++) {
          const light = element('div', 'bd-mote');
          place(light, spot.x, spot.y);
          light.style.setProperty(
            '--drift',
            `${(Math.random() - 0.5) * tile * 3}px`
          );
          light.style.setProperty(
            '--rise',
            `${canvas.clientHeight * (0.5 + Math.random() * 0.5)}px`
          );
          light.style.animationDelay = `${Math.round(Math.random() * BUILDER_VIEW.celebrateStepMs * 2)}ms`;
          light.style.animationDuration = `${BUILDER_VIEW.celebrateRiseMs}ms`;
          party.append(light);
        }
      await wait(BUILDER_VIEW.celebrateStepMs);
    }
    // One lantern lifts from the first lantern into the sky above the board.
    const first = lanterns[0];
    if (first !== undefined && !host.calm) {
      const lift = element('div', 'bd-sky-lantern');
      place(lift, first.x, first.y);
      lift.style.setProperty('--rise', `${canvas.clientHeight}px`);
      lift.style.animationDuration = `${BUILDER_VIEW.celebrateRiseMs}ms`;
      party.append(lift);
      host.chime(lanterns.length);
    }
    await wait(BUILDER_VIEW.celebrateHoldMs);
    party.remove();
    published = false;
  }

  // --- Drawing --------------------------------------------------------------------------------
  const layout = (): void => {
    const side = Math.max(
      0,
      Math.min(wrap.clientWidth, wrap.clientHeight) - BUILDER_VIEW.gutterPx * 2
    );
    board.draw(history.draft, Math.floor(side));
  };

  function render(): void {
    const draft = history.draft;
    // The tutorial picks the tool its step is about.
    if (lesson === 'sun') tool = 'sun';
    if (lesson === 'lantern' || lesson === 'colour') tool = 'lantern';
    for (const [biome, button] of worldButtons)
      button.setAttribute('aria-pressed', String(biome === draft.biome));
    for (const [size, button] of sizeButtons)
      button.setAttribute('aria-pressed', String(size === draft.size));
    for (const [spare, button] of spareButtons)
      button.setAttribute('aria-pressed', String(spare === draft.spare));
    for (const [each, button] of toolButtons)
      button.setAttribute('aria-pressed', String(each === tool));
    undo.disabled = history.past.length === 0;
    redo.disabled = history.future.length === 0;

    // The tutorial points at the part of the screen its step is about, and opens the panel for
    // the two steps that happen there.
    screen.dataset['lesson'] = lesson;
    if ((lesson === 'biome' || lesson === 'spare') && !settingsOpen)
      showSettings(true);
    island.classList.toggle(
      'bd-glow',
      lesson === 'biome' || lesson === 'spare'
    );
    worlds.classList.toggle('bd-glow', lesson === 'biome');
    spares.classList.toggle('bd-glow', lesson === 'spare');
    toolButtons.get('sun')?.classList.toggle('bd-glow', lesson === 'sun');
    toolButtons
      .get('lantern')
      ?.classList.toggle(
        'bd-glow',
        lesson === 'lantern' || lesson === 'colour'
      );
    toolButtons.get('rock')?.classList.toggle('bd-glow', lesson === 'block');
    toolButtons.get('tree')?.classList.toggle('bd-glow', lesson === 'block');
    main.classList.toggle('bd-glow', lesson === 'check' || lesson === 'test');

    const current = checkKey(draft);
    const isChecked = checked !== null && checked.key === current;
    const isTested = tested !== null && tested.key === current;
    main.textContent = busy
      ? published
        ? COPY.builderPublishedButton
        : publishing
          ? COPY.builderPublishing
          : COPY.builderChecking
      : isTested
        ? COPY.builderPublish
        : isChecked
          ? COPY.builderTest
          : COPY.builderCheck;
    main.disabled = busy;
    publishButton.textContent = publishing
      ? COPY.builderPublishing
      : COPY.builderPublish;
    publishButton.disabled = busy;
    notYet.disabled = busy;

    const problem = nameProblem(draft.name);
    const badName = problem === 'characters' || problem === 'too-long';
    name.classList.toggle('bd-name-bad', badName);
    let line = status;
    if (line === '' && badName && lesson === 'done')
      line = COPY.builderNameRule;
    if (line === '' && isTested && tested !== null)
      line = fill(COPY.builderTested, {
        count: tested.pieces,
        par: checked?.par ?? tested.pieces,
        label: COPY.builderLabels[checked?.label ?? 'gentle'],
      });
    if (line === '' && isChecked && checked !== null)
      line = fill(COPY.builderChecked, {
        par: checked.par,
        pieces: piecesText(checked.inventory),
        label: COPY.builderLabels[checked.label],
      });
    const teaching = lesson !== 'done';
    if (lesson !== 'done' && status === '')
      // Once checked, the test step also says what the check found: par and how hard.
      line =
        lesson === 'test' && isChecked && checked !== null
          ? fill(COPY.builderLessonTest, {
              par: checked.par,
              label: COPY.builderLabels[checked.label],
            })
          : COPY.builderLessons[lesson];
    if (line === '') line = COPY.builderHelp;
    hintText.textContent = line;
    next.hidden = !(lesson === 'colour' || lesson === 'block');
    skip.hidden = !teaching;
    layout();
  }

  close.addEventListener('click', () => host.close?.());
  const resize = (): void => layout();
  window.addEventListener('resize', resize);
  render();
  requestAnimationFrame(layout);

  return {
    dispose() {
      saver.flush();
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('pagehide', leaving);
      stopTaps();
      window.removeEventListener('resize', resize);
      screen.remove();
    },
  };
}
