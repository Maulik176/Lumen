/**
 * The Island Builder's rules, as pure functions so they run the same in the editor and on the
 * server, and are tested without a screen. An island being built is a draft: its size, biome,
 * name, how many spare mirrors players get, and its tiles as rows of text in the format of
 * puzzle-text.ts (suns are always white; players' pieces are never part of the island).
 */
import { BIOMES, COMMUNITY } from './config';
import type { Biome } from './calendar';
import { puzzleFromText, type PuzzleText } from './puzzle-text';
import { trace } from './trace';
import type { Inventory } from './types';

export type BuilderTool =
  'sun' | 'lantern' | 'rock' | 'tree' | 'water' | 'stone' | 'eraser';

export const BUILDER_TOOLS: readonly BuilderTool[] = [
  'sun',
  'lantern',
  'rock',
  'tree',
  'water',
  'stone',
  'eraser',
];

export type IslandDraft = {
  size: number;
  biome: Biome;
  name: string;
  /** Mirrors players get beyond what par needs. More is gentler; par never changes. */
  spare: number;
  rows: string[];
};

export type ToolEvent =
  | 'placed'
  | 'cycled'
  | 'removed'
  | 'nothing'
  | 'too-many-suns'
  | 'too-many-lanterns';

export type ToolStep = { draft: IslandDraft; event: ToolEvent };

const SUNS = '^>v<';
const LANTERNS = 'WRGBMCY';
const TILE_CHARS = new Set([...'.#T~/\\', ...SUNS, ...LANTERNS]);

/** What each simple tool puts on a tile. */
const PLAIN: Record<'rock' | 'tree' | 'water', string> = {
  rock: '#',
  tree: 'T',
  water: '~',
};

export function emptyDraft(size: number, biome: Biome): IslandDraft {
  return {
    size,
    biome,
    name: '',
    spare: COMMUNITY.defaultSpare,
    rows: Array.from({ length: size }, () => '.'.repeat(size)),
  };
}

function count(rows: readonly string[], chars: string): number {
  let found = 0;
  for (const row of rows)
    for (const char of row) if (chars.includes(char)) found++;
  return found;
}

function put(
  draft: IslandDraft,
  x: number,
  y: number,
  char: string
): IslandDraft {
  const rows = draft.rows.slice();
  const row = rows[y] ?? '';
  rows[y] = row.slice(0, x) + char + row.slice(x + 1);
  return { ...draft, rows };
}

/**
 * Tap a tile with a tool. A tile that already holds what the tool makes is cycled (sun direction,
 * lantern colour, stone mirror) or cleared (rock, tree, water). Anything else is replaced.
 */
export function applyTool(
  draft: IslandDraft,
  tool: BuilderTool,
  x: number,
  y: number
): ToolStep {
  const nothing: ToolStep = { draft, event: 'nothing' };
  if (x < 0 || y < 0 || x >= draft.size || y >= draft.size) return nothing;
  const here = draft.rows[y]?.[x] ?? '.';

  if (tool === 'eraser')
    return here === '.'
      ? nothing
      : { draft: put(draft, x, y, '.'), event: 'removed' };

  if (tool === 'sun') {
    const turn = SUNS.indexOf(here);
    if (turn >= 0)
      return {
        draft: put(draft, x, y, SUNS.charAt((turn + 1) % SUNS.length)),
        event: 'cycled',
      };
    if (count(draft.rows, SUNS) >= COMMUNITY.maxSuns)
      return { draft, event: 'too-many-suns' };
    // A new sun faces into the island, so its light is seen at once.
    return {
      draft: put(draft, x, y, x < draft.size / 2 ? '>' : '<'),
      event: 'placed',
    };
  }

  if (tool === 'lantern') {
    const colour = LANTERNS.indexOf(here);
    if (colour >= 0)
      return {
        draft: put(
          draft,
          x,
          y,
          LANTERNS.charAt((colour + 1) % LANTERNS.length)
        ),
        event: 'cycled',
      };
    if (count(draft.rows, LANTERNS) >= COMMUNITY.maxLanterns)
      return { draft, event: 'too-many-lanterns' };
    return { draft: put(draft, x, y, 'W'), event: 'placed' };
  }

  if (tool === 'stone') {
    if (here === '/') return { draft: put(draft, x, y, '\\'), event: 'cycled' };
    if (here === '\\') return { draft: put(draft, x, y, '/'), event: 'cycled' };
    return { draft: put(draft, x, y, '/'), event: 'placed' };
  }

  const char = PLAIN[tool];
  if (here === char) return { draft: put(draft, x, y, '.'), event: 'removed' };
  return { draft: put(draft, x, y, char), event: 'placed' };
}

/** A new size keeps what fits, measured from the top-left corner. */
export function resizeDraft(draft: IslandDraft, size: number): IslandDraft {
  const rows = Array.from({ length: size }, (_, y) => {
    const row = draft.rows[y] ?? '';
    return (row.slice(0, size) + '.'.repeat(size)).slice(0, size);
  });
  return { ...draft, size, rows };
}

/** Undo and redo: the whole draft is small, so each edit keeps the one before. */
export type BuilderHistory = {
  draft: IslandDraft;
  past: IslandDraft[];
  future: IslandDraft[];
};

export function startHistory(draft: IslandDraft): BuilderHistory {
  return { draft, past: [], future: [] };
}

export function withEdit(
  history: BuilderHistory,
  draft: IslandDraft
): BuilderHistory {
  if (draft === history.draft) return history;
  const past = [...history.past, history.draft].slice(-COMMUNITY.undoSteps);
  return { draft, past, future: [] };
}

export function undoEdit(history: BuilderHistory): BuilderHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    draft: previous,
    past: history.past.slice(0, -1),
    future: [history.draft, ...history.future],
  };
}

export function redoEdit(history: BuilderHistory): BuilderHistory {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    draft: next,
    past: [...history.past, history.draft],
    future: history.future.slice(1),
  };
}

/** The island as puzzle text, with the inventory the check gave it. Suns are white. */
export function draftPuzzleText(
  draft: IslandDraft,
  inventory: Inventory
): PuzzleText {
  return {
    rows: draft.rows,
    inventory,
    sourceColours: Array.from(
      { length: count(draft.rows, SUNS) },
      () => 'white'
    ),
  };
}

export type DraftProblem = 'no-sun' | 'no-lantern' | 'already-lit';

/** Why the server's check refused an island. */
export type CheckProblem =
  | DraftProblem
  | 'malformed'
  | 'too-easy'
  | 'unsolvable'
  | 'too-complex'
  | 'duplicate';

/**
 * What must change before the island can be checked, known without the solver, so the editor
 * can say it at once and the server never solves an island that cannot pass.
 */
export function draftProblem(draft: IslandDraft): DraftProblem | null {
  if (count(draft.rows, SUNS) === 0) return 'no-sun';
  if (count(draft.rows, LANTERNS) === 0) return 'no-lantern';
  const light = trace(
    puzzleFromText(draftPuzzleText(draft, { mirrors: 0, prisms: 0 })),
    []
  );
  return light.litCount > 0 ? 'already-lit' : null;
}

export type NameProblem = 'empty' | 'too-long' | 'characters';

export function nameProblem(name: string): NameProblem | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'empty';
  if (trimmed.length > COMMUNITY.nameMax) return 'too-long';
  if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) return 'characters';
  return null;
}

/**
 * A fingerprint of the island's tiles (size included), for spotting exact copies. Two 32-bit
 * FNV-1a hashes with different seeds, as 16 hex digits.
 */
export function islandHash(rows: readonly string[]): string {
  const text = `${rows.length}:${rows.join('/')}`;
  const half = (seed: number): string => {
    let hash = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };
  return half(0x811c9dc5) + half(0x050c5d1f);
}

/** What a check and a test belong to: the tiles and the spare mirrors (not the name or biome). */
export function checkKey(draft: IslandDraft): string {
  return `${islandHash(draft.rows)}:${draft.spare}`;
}

export type DifficultyLabel = 'gentle' | 'tricky' | 'fiendish';

export function difficultyLabel(score: number): DifficultyLabel {
  if (score >= COMMUNITY.fiendishFrom) return 'fiendish';
  if (score >= COMMUNITY.trickyFrom) return 'tricky';
  return 'gentle';
}

/** A draft as stored (server or device), checked before it is believed. */
export function readDraft(value: unknown): IslandDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const fields: Record<string, unknown> = { ...value };
  const { size, biome, name, spare, rows } = fields;
  if (typeof size !== 'number' || !COMMUNITY.sizes.some((one) => one === size))
    return null;
  const knownBiome = BIOMES.find((one) => one === biome);
  if (knownBiome === undefined) return null;
  if (typeof name !== 'string' || name.length > COMMUNITY.nameMax) return null;
  if (
    typeof spare !== 'number' ||
    !COMMUNITY.spareChoices.some((one) => one === spare)
  )
    return null;
  if (!Array.isArray(rows) || rows.length !== size) return null;
  const clean: string[] = [];
  for (const row of rows) {
    if (typeof row !== 'string' || row.length !== size) return null;
    if (![...row].every((char) => TILE_CHARS.has(char))) return null;
    clean.push(row);
  }
  if (count(clean, SUNS) > COMMUNITY.maxSuns) return null;
  if (count(clean, LANTERNS) > COMMUNITY.maxLanterns) return null;
  return { size, biome: knownBiome, name, spare, rows: clean };
}

/** The first-island tutorial: each step names what completes it. */
export type Lesson =
  | 'biome'
  | 'sun'
  | 'turn'
  | 'lantern'
  | 'colour'
  | 'block'
  | 'spare'
  | 'check'
  | 'test'
  | 'done';

export type LessonAction =
  | { type: 'biome' }
  | { type: 'tool'; tool: BuilderTool; event: ToolEvent }
  | { type: 'spare' }
  | { type: 'next' }
  | { type: 'checked' }
  | { type: 'tested' };

export function nextLesson(lesson: Lesson, action: LessonAction): Lesson {
  const tool = (wanted: BuilderTool, events: readonly ToolEvent[]): boolean =>
    action.type === 'tool' &&
    action.tool === wanted &&
    events.includes(action.event);
  switch (lesson) {
    case 'biome':
      return action.type === 'biome' ? 'sun' : lesson;
    case 'sun':
      return tool('sun', ['placed']) ? 'turn' : lesson;
    case 'turn':
      return tool('sun', ['cycled']) ? 'lantern' : lesson;
    case 'lantern':
      return tool('lantern', ['placed']) ? 'colour' : lesson;
    case 'colour':
      return action.type === 'next' || tool('lantern', ['cycled'])
        ? 'block'
        : lesson;
    case 'block':
      return tool('rock', ['placed']) ||
        tool('tree', ['placed']) ||
        action.type === 'next'
        ? 'spare'
        : lesson;
    case 'spare':
      return action.type === 'spare' || action.type === 'next'
        ? 'check'
        : lesson;
    case 'check':
      return action.type === 'checked' ? 'test' : lesson;
    case 'test':
      return action.type === 'tested' ? 'done' : lesson;
    case 'done':
      return lesson;
  }
}
