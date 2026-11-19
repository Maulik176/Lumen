/**
 * The Island Builder on the server: checking an island (the server is the authority; the editor
 * only prechecks), keeping each player's draft, and the proof that the maker lit their own island
 * before it may be published. No Reddit or Devvit calls in here, so every rule is tested.
 */
import {
  checkKey,
  draftPuzzleText,
  readDraft,
  type DifficultyLabel,
  type IslandDraft,
} from '../../shared/builder';
import type { BuilderStatus } from '../../shared/api';
import { COMMUNITY } from '../../shared/config';
import { puzzleFromText } from '../../shared/puzzle-text';
import { trace } from '../../shared/trace';
import type { Inventory, Placement } from '../../shared/types';
import { validatePlacements } from '../../shared/validate';
import type { CheckOutcome } from './check';
import type { Player } from './game';
import { KEYS, type Store } from './store';

export { checkKey } from '../../shared/builder';
export { checkIsland, dailyHashes, type CheckOutcome } from './check';

export async function saveDraft(
  store: Store,
  player: Player,
  draft: IslandDraft
): Promise<boolean> {
  if (player === null) return false;
  const clean = readDraft(draft);
  if (clean === null) return false;
  await store.set(
    KEYS.draft(player.userId),
    JSON.stringify(clean),
    COMMUNITY.draftSeconds
  );
  return true;
}

export async function loadDraft(
  store: Store,
  player: Player
): Promise<IslandDraft | null> {
  if (player === null) return null;
  const text = await store.get(KEYS.draft(player.userId));
  if (text === undefined) return null;
  try {
    return readDraft(JSON.parse(text));
  } catch {
    return null;
  }
}

/** One check per player every COMMUNITY.checkGapSeconds; signed-out players cannot check. */
export async function takeCheckTurn(
  store: Store,
  player: Player
): Promise<boolean> {
  if (player === null) return false;
  const turn = await store.count(
    KEYS.builderTurn(player.userId),
    COMMUNITY.checkGapSeconds
  );
  return turn === 1;
}

type Checked = {
  key: string;
  par: number;
  inventory: Inventory;
  difficulty: number;
  label: DifficultyLabel;
  hash: string;
  solution: Placement[];
  /** When the maker's test began (server clock), once it has. */
  testStart?: number;
  /** The maker's own solve, once it passes. */
  test?: { placements: Placement[]; pieces: number; ms: number };
};

function readChecked(text: string | undefined): Checked | null {
  if (text === undefined) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const fields: Record<string, unknown> = { ...value };
    const { key, par, inventory, difficulty, label, hash, solution } = fields;
    if (typeof key !== 'string' || typeof hash !== 'string') return null;
    if (typeof par !== 'number' || typeof difficulty !== 'number') return null;
    if (label !== 'gentle' && label !== 'tricky' && label !== 'fiendish')
      return null;
    if (typeof inventory !== 'object' || inventory === null) return null;
    const stock: Record<string, unknown> = { ...inventory };
    if (
      typeof stock['mirrors'] !== 'number' ||
      typeof stock['prisms'] !== 'number'
    )
      return null;
    if (!Array.isArray(solution)) return null;
    const checked: Checked = {
      key,
      par,
      inventory: { mirrors: stock['mirrors'], prisms: stock['prisms'] },
      difficulty,
      label,
      hash,
      solution: solution.filter(
        (entry): entry is Placement =>
          typeof entry === 'object' && entry !== null && 'piece' in entry
      ),
    };
    const testStart = fields['testStart'];
    if (typeof testStart === 'number') checked.testStart = testStart;
    const test = fields['test'];
    if (typeof test === 'object' && test !== null) {
      const proof: Record<string, unknown> = { ...test };
      const { placements, pieces, ms } = proof;
      if (
        Array.isArray(placements) &&
        typeof pieces === 'number' &&
        typeof ms === 'number'
      )
        checked.test = {
          placements: placements.filter(
            (entry): entry is Placement =>
              typeof entry === 'object' && entry !== null && 'piece' in entry
          ),
          pieces,
          ms,
        };
    }
    return checked;
  } catch {
    return null;
  }
}

/** Remember a passing check, so the test and the publish that follow belong to it. */
export async function recordCheck(
  store: Store,
  player: Player,
  draft: IslandDraft,
  outcome: Extract<CheckOutcome, { ok: true }>
): Promise<void> {
  if (player === null) return;
  const checked: Checked = {
    key: checkKey(draft),
    par: outcome.par,
    inventory: outcome.inventory,
    difficulty: outcome.difficulty,
    label: outcome.label,
    hash: outcome.hash,
    solution: outcome.solution,
  };
  await store.set(
    KEYS.builderCheck(player.userId),
    JSON.stringify(checked),
    COMMUNITY.testSeconds
  );
}

export async function startTest(
  store: Store,
  player: Player,
  draft: IslandDraft,
  nowMs: number
): Promise<'started' | 'not-checked'> {
  if (player === null) return 'not-checked';
  const checked = readChecked(
    await store.get(KEYS.builderCheck(player.userId))
  );
  if (checked === null || checked.key !== checkKey(draft)) return 'not-checked';
  // A new test replaces any earlier solve.
  const fresh: Checked = { ...checked, testStart: nowMs };
  delete fresh.test;
  await store.set(
    KEYS.builderCheck(player.userId),
    JSON.stringify(fresh),
    COMMUNITY.testSeconds
  );
  return 'started';
}

/** The check and the maker's solve the server holds for exactly this island, if any. */
export async function islandStatus(
  store: Store,
  player: Player,
  draft: IslandDraft
): Promise<BuilderStatus> {
  const none: BuilderStatus = { checked: null, tested: null };
  if (player === null) return none;
  const checked = readChecked(
    await store.get(KEYS.builderCheck(player.userId))
  );
  if (checked === null || checked.key !== checkKey(draft)) return none;
  return {
    checked: {
      par: checked.par,
      inventory: checked.inventory,
      label: checked.label,
    },
    tested: checked.test === undefined ? null : { pieces: checked.test.pieces },
  };
}

export type TestOutcome =
  | { ok: true; pieces: number; ms: number }
  | {
      ok: false;
      problem: 'not-checked' | 'changed' | 'bad-pieces' | 'not-lit';
    };

/** The maker's own solve: re-traced here, for exactly the island that was checked. */
export async function finishTest(
  store: Store,
  player: Player,
  draft: IslandDraft,
  placements: unknown,
  nowMs: number
): Promise<TestOutcome> {
  if (player === null) return { ok: false, problem: 'not-checked' };
  const checked = readChecked(
    await store.get(KEYS.builderCheck(player.userId))
  );
  if (checked === null || checked.testStart === undefined)
    return { ok: false, problem: 'not-checked' };
  const clean = readDraft(draft);
  if (clean === null || checkKey(clean) !== checked.key)
    return { ok: false, problem: 'changed' };
  const puzzle = puzzleFromText(draftPuzzleText(clean, checked.inventory));
  const check = validatePlacements(puzzle, placements);
  if (!check.ok) return { ok: false, problem: 'bad-pieces' };
  if (!trace(puzzle, check.placements).solved)
    return { ok: false, problem: 'not-lit' };
  const test = {
    placements: check.placements,
    pieces: check.placements.length,
    ms: Math.max(0, nowMs - checked.testStart),
  };
  await store.set(
    KEYS.builderCheck(player.userId),
    JSON.stringify({ ...checked, test }),
    COMMUNITY.testSeconds
  );
  return { ok: true, pieces: test.pieces, ms: test.ms };
}
