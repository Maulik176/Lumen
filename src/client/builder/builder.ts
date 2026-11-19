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
} from '../../shared/api';
import {
  applyTool,
  BUILDER_TOOLS,
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
import type { Biome } from '../../shared/calendar';
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
import { createBoard } from './board';

export type TestIsland = {
  draft: IslandDraft;
  inventory: Inventory;
  par: number;
};

export type BuilderHost = {
  /**
   * Open the island in the real game for the maker to light. Resolves with how many pieces they
   * used once the server has confirmed it, or null if they left without lighting it.
   */
  test: (island: TestIsland) => Promise<{ pieces: number } | null>;
  /** Leave the Builder. Absent on its own page, where there is nowhere else to go. */
  close?: () => void;
  click: () => void;
};

const DRAFT_KEY = 'lumen.builder.draft';
const TUTORIAL_KEY = 'lumen.builder.tutorial';

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
  let history: BuilderHistory = startHistory(
    loaded?.draft ?? localDraft ?? emptyDraft(COMMUNITY.defaultSize, 'moss')
  );
  const tutorialDone =
    loaded?.tutorialDone === true || recall(TUTORIAL_KEY) === '1';
  let lesson: Lesson = tutorialDone ? 'done' : 'biome';
  let tool: BuilderTool = 'sun';
  let checked: {
    key: string;
    par: number;
    inventory: Inventory;
    label: keyof typeof COPY.builderLabels;
  } | null = null;
  let tested: { key: string; pieces: number } | null = null;
  let status = '';
  let busy = false;
  let saveTimer = 0;

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
  settings.append(worlds, sizes, spares, done);
  let settingsOpen = false;
  settings.hidden = true;
  const showSettings = (open: boolean): void => {
    settingsOpen = open;
    settings.hidden = !open;
    island.setAttribute('aria-expanded', String(open));
  };
  island.addEventListener('click', () => showSettings(!settingsOpen));
  done.addEventListener('click', () => {
    showSettings(false);
    learn({ type: 'next' });
  });

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
  const canvas = element('canvas', 'bd-canvas');
  wrap.append(canvas);
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
    if (checked !== null && checked.key === checkKey(history.draft))
      void test();
    else void check();
  });
  actions.append(undo, redo, clear, main);

  screen.append(top, settings, hint, wrap, tools, actions);
  root.append(screen);

  // --- Behaviour ----------------------------------------------------------------------------
  const save = (): void => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      remember(DRAFT_KEY, JSON.stringify(history.draft));
      if (loggedIn)
        void fetch('/api/builder/draft', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draft: history.draft }),
        }).catch(() => undefined);
    }, BUILDER_VIEW.saveAfterMs);
  };

  /** Anything that changes the tiles or spare mirrors makes the check and test stale. */
  const changed = (): void => {
    const key = checkKey(history.draft);
    if (checked !== null && checked.key !== key) checked = null;
    if (tested !== null && tested.key !== key) tested = null;
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
    save();
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
    status = COPY.builderChecking;
    render();
    const answer = await post<BuilderCheckResponse>('/api/builder/check', {
      draft,
    });
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
    const lit = await host.test(island);
    busy = false;
    if (lit === null) {
      status = COPY.builderTestLeft;
    } else {
      tested = { key, pieces: lit.pieces };
      status = '';
      learn({ type: 'tested' });
    }
    render();
    layout();
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
      ? COPY.builderChecking
      : isTested
        ? COPY.builderLit
        : isChecked
          ? COPY.builderTest
          : COPY.builderCheck;
    main.disabled = busy || isTested;

    let line = status;
    if (line === '' && isTested && tested !== null)
      line = fill(COPY.builderTested, {
        pieces: tested.pieces === 1 ? '1 piece' : `${tested.pieces} pieces`,
        par: checked?.par ?? tested.pieces,
      });
    if (line === '' && isChecked && checked !== null)
      line = fill(COPY.builderChecked, {
        par: checked.par,
        pieces: piecesText(checked.inventory),
        label: COPY.builderLabels[checked.label],
      });
    const teaching = lesson !== 'done';
    if (lesson !== 'done' && status === '') line = COPY.builderLessons[lesson];
    if (line === '') line = COPY.builderHelp;
    hintText.textContent = line;
    next.hidden = !(lesson === 'colour' || lesson === 'block');
    skip.hidden = !teaching;
    const problem = nameProblem(draft.name);
    name.classList.toggle(
      'bd-name-bad',
      problem === 'characters' || problem === 'too-long'
    );
    layout();
  }

  close.addEventListener('click', () => host.close?.());
  const resize = (): void => layout();
  window.addEventListener('resize', resize);
  render();
  requestAnimationFrame(layout);

  return {
    dispose() {
      window.clearTimeout(saveTimer);
      remember(DRAFT_KEY, JSON.stringify(history.draft));
      stopTaps();
      window.removeEventListener('resize', resize);
      screen.remove();
    },
  };
}
