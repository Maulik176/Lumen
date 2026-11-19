/**
 * The Island Builder on the server: checking an island (the server is the authority; the editor
 * only prechecks), keeping each player's draft, and the proof that the maker lit their own island
 * before it may be published. No Reddit or Devvit calls in here, so every rule is tested.
 */
import {
  checkKey,
  draftProblem,
  draftPuzzleText,
  nameProblem,
  readDraft,
  type DifficultyLabel,
  type IslandDraft,
} from '../../shared/builder';
import {
  toCommunityPostData,
  type BuilderPublishResponse,
  type BuilderStatus,
  type CommunityCredit,
  type OtherIsland,
  type PostData,
  type PublishProblem,
  type YourIsland,
} from '../../shared/api';
import { dateOfDay, dayAt, weekdayOfDay } from '../../shared/calendar';
import {
  communityIndex,
  communityNumber,
  fallbackName,
  isCommunity,
  nameFiltered,
} from '../../shared/community';
import { COMMUNITY, COPY } from '../../shared/config';
import type { PlayableIsland } from '../../shared/daily';
import { puzzleFromText } from '../../shared/puzzle-text';
import { trace } from '../../shared/trace';
import type { Inventory, Placement } from '../../shared/types';
import { validatePlacements } from '../../shared/validate';
import { checkIsland, type CheckOutcome } from './check';
import { islandForDay } from './content';
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

// --- Publishing and community islands ------------------------------------------------------

/** One published community island, as kept in `cm:{k}`. */
export type CommunityRecord = {
  index: number;
  rows: string[];
  inventory: Inventory;
  par: number;
  label: DifficultyLabel;
  name: string;
  biome: IslandDraft['biome'];
  hash: string;
  maker: string;
  makerId: string;
  makerAvatar: string;
  postId: string;
  url: string;
  created: number;
  active: boolean;
  /** Who Reddit shows as the author: the maker, or the app (a playtest build, for non-owners). */
  postedAs: 'user' | 'app';
  solution: Placement[];
  /** The maker's own test solve: "Creator's board", never ranked. */
  creator: { placements: Placement[]; pieces: number; ms: number };
};

/** What publishing needs from Reddit; the route passes the real calls, tests pass fakes. */
export type Poster = {
  /** Make the island's post. `asUser` false posts from the app account. */
  post: (input: {
    title: string;
    text: string;
    postData: PostData;
    asUser: boolean;
  }) => Promise<{ id: string; permalink: string; author: string }>;
  /** The post's pinned results comment. Decoration: a failure is ignored. */
  results: (postId: string, number: number) => Promise<void>;
};

function json<T>(
  text: string | undefined,
  read: (value: unknown) => T | null
): T | null {
  if (text === undefined) return null;
  try {
    return read(JSON.parse(text));
  } catch {
    return null;
  }
}

const placementsOf = (value: unknown): Placement[] | null =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Placement =>
          typeof entry === 'object' && entry !== null && 'piece' in entry
      )
    : null;

function readRecord(
  index: number,
  fields: Record<string, string>
): CommunityRecord | null {
  const rows = json(fields['rows'], (value) =>
    Array.isArray(value) && value.every((row) => typeof row === 'string')
      ? value.map(String)
      : null
  );
  const inventory = json(fields['inventory'], (value) => {
    if (typeof value !== 'object' || value === null) return null;
    const stock: Record<string, unknown> = { ...value };
    const { mirrors, prisms } = stock;
    return typeof mirrors === 'number' && typeof prisms === 'number'
      ? { mirrors, prisms }
      : null;
  });
  const solution = json(fields['solution'], placementsOf);
  const creator = json(fields['creator'], (value) => {
    if (typeof value !== 'object' || value === null) return null;
    const proof: Record<string, unknown> = { ...value };
    const placements = placementsOf(proof['placements']);
    const { pieces, ms } = proof;
    return placements !== null &&
      typeof pieces === 'number' &&
      typeof ms === 'number'
      ? { placements, pieces, ms }
      : null;
  });
  const draft = readDraft({
    size: rows?.length,
    biome: fields['biome'],
    name: fields['name'] ?? '',
    spare: 0,
    rows,
  });
  const label = fields['label'];
  const par = Number(fields['par']);
  const created = Number(fields['created']);
  if (
    rows === null ||
    inventory === null ||
    solution === null ||
    creator === null ||
    draft === null ||
    (label !== 'gentle' && label !== 'tricky' && label !== 'fiendish') ||
    !Number.isInteger(par) ||
    !Number.isFinite(created)
  )
    return null;
  return {
    index,
    rows,
    inventory,
    par,
    label,
    name: fields['name'] ?? '',
    biome: draft.biome,
    hash: fields['hash'] ?? '',
    maker: fields['maker'] ?? '',
    makerId: fields['makerId'] ?? '',
    makerAvatar: fields['makerAvatar'] ?? '',
    postId: fields['postId'] ?? '',
    url: fields['url'] ?? '',
    created,
    active: fields['active'] !== '0',
    postedAs: fields['postedAs'] === 'app' ? 'app' : 'user',
    solution,
    creator,
  };
}

function writeRecord(record: CommunityRecord): Record<string, string> {
  return {
    rows: JSON.stringify(record.rows),
    inventory: JSON.stringify(record.inventory),
    par: String(record.par),
    label: record.label,
    name: record.name,
    biome: record.biome,
    hash: record.hash,
    maker: record.maker,
    makerId: record.makerId,
    makerAvatar: record.makerAvatar,
    postId: record.postId,
    url: record.url,
    created: String(record.created),
    active: record.active ? '1' : '0',
    postedAs: record.postedAs,
    solution: JSON.stringify(record.solution),
    creator: JSON.stringify(record.creator),
  };
}

export async function readCommunity(
  store: Store,
  index: number
): Promise<CommunityRecord | null> {
  if (!Number.isInteger(index) || index < 1) return null;
  return readRecord(index, await store.hGetAll(KEYS.community(index)));
}

/** The island as play sees it: the same shape as a daily island, with its own number. */
export function toPlayable(record: CommunityRecord): PlayableIsland {
  const day = dayAt(record.created);
  return {
    day: communityNumber(record.index),
    date: dateOfDay(day),
    weekday: weekdayOfDay(day),
    biome: record.biome,
    name: record.name,
    rows: record.rows,
    inventory: record.inventory,
    sourceColours: draftPuzzleText(
      {
        size: record.rows.length,
        biome: record.biome,
        name: record.name,
        spare: 0,
        rows: record.rows,
      },
      record.inventory
    ).sourceColours,
    par: record.par,
    solution: record.solution,
  };
}

export function creditOf(record: CommunityRecord): CommunityCredit {
  return {
    maker: record.maker,
    makerAvatar: record.makerAvatar,
    label: record.label,
  };
}

/** The maker's test solve as a row of "See others' islands". */
export function creatorRow(record: CommunityRecord): OtherIsland {
  return {
    rank: null,
    username: record.maker,
    snoovatar: record.makerAvatar,
    pieces: record.creator.pieces,
    timeMs: record.creator.ms,
    placements: record.creator.placements,
  };
}

export type IslandLookup =
  | { ok: true; island: PlayableIsland; record: CommunityRecord | null }
  | { ok: false; reason: 'not-found' | 'taken-down' | 'resting' };

/**
 * The island behind a number: a daily day from the content file, or a community island from
 * Redis. A community island is served only while the community side is on and its post stands.
 */
export async function lookUpIsland(
  store: Store,
  number: number,
  enabled: boolean = COMMUNITY.enabled
): Promise<IslandLookup> {
  if (!isCommunity(number)) {
    const island = islandForDay(number);
    return island === undefined
      ? { ok: false, reason: 'not-found' }
      : { ok: true, island, record: null };
  }
  if (!enabled) return { ok: false, reason: 'resting' };
  const record = await readCommunity(store, communityIndex(number));
  if (record === null) return { ok: false, reason: 'not-found' };
  if (!record.active) return { ok: false, reason: 'taken-down' };
  return { ok: true, island: toPlayable(record), record };
}

/** A post was deleted or removed (active false), or approved again (true). */
export async function setIslandActive(
  store: Store,
  postId: string,
  active: boolean
): Promise<boolean> {
  const fields = await store.hMGet(KEYS.communityPosts, [postId]);
  const index = Number(fields[0]);
  if (!Number.isInteger(index) || index < 1) return false;
  await store.hSet(KEYS.community(index), { active: active ? '1' : '0' });
  return true;
}

const TOKEN = /^[A-Za-z0-9]{8,64}$/;

function publishDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Publish the maker's island as its own post. Nothing from the client is trusted: the island is
 * checked again here, the maker's test solve must be for exactly this board, and the name is
 * filtered. A retry with the same token returns the first answer, so a double tap or a retry
 * after a timeout never makes two posts.
 */
export async function publishIsland(
  store: Store,
  player: Player,
  input: { draft: unknown; token: unknown; avatar: string; nowMs: number },
  deps: {
    poster: Poster;
    daily: ReadonlySet<string>;
    clock: () => number;
    nodeLimit?: number;
  }
): Promise<BuilderPublishResponse> {
  const refuse = (problem: PublishProblem): BuilderPublishResponse => ({
    ok: false,
    problem,
  });
  if (player === null) return refuse('signed-out');
  if (!COMMUNITY.enabled) return refuse('off');
  const token = typeof input.token === 'string' ? input.token : '';
  if (!TOKEN.test(token)) return refuse('failed');
  const tokenKey = KEYS.publishToken(player.userId, token);
  const earlier = json(await store.get(tokenKey), (value) =>
    typeof value === 'object' && value !== null && 'ok' in value
      ? readPublished(value)
      : null
  );
  if (earlier !== null) return earlier;

  const draft = readDraft(input.draft);
  if (draft === null || draftProblem(draft) !== null) return refuse('changed');
  const name = draft.name.trim();
  if (name !== '' && (nameProblem(name) !== null || nameFiltered(name)))
    return refuse('name');

  // The maker's own solve, for exactly this board, from Phase 1's test.
  const checked = readChecked(
    await store.get(KEYS.builderCheck(player.userId))
  );
  if (checked === null || checked.key !== checkKey(draft))
    return refuse('not-checked');
  if (checked.test === undefined) return refuse('not-tested');

  // A fresh check of the board on the server, never the numbers the client holds.
  const fresh = checkIsland(draft, {
    daily: deps.daily,
    clock: deps.clock,
    ...(deps.nodeLimit === undefined ? {} : { nodeLimit: deps.nodeLimit }),
  });
  if (!fresh.ok)
    return refuse(fresh.problem === 'duplicate' ? 'duplicate' : 'changed');
  if (
    fresh.par !== checked.par ||
    fresh.inventory.mirrors !== checked.inventory.mirrors ||
    fresh.inventory.prisms !== checked.inventory.prisms
  )
    return refuse('changed');
  const [known] = await store.hMGet(KEYS.communityHashes, [fresh.hash]);
  if (known !== null && known !== undefined) return refuse('duplicate');

  // The day's limit: the slot is taken now and given back if the post fails.
  const day = KEYS.publishes(publishDate(input.nowMs));
  const taken = await store.hIncrBy(day, player.userId, 1);
  if (taken === 1) await store.expire(day, 2 * 86_400);
  const giveBack = (): Promise<number> => store.hIncrBy(day, player.userId, -1);
  if (taken > COMMUNITY.publishPerDay) {
    await giveBack();
    return refuse('limit');
  }
  const lock = KEYS.publishLock(fresh.hash);
  if ((await store.count(lock, COMMUNITY.publishLockSeconds)) !== 1) {
    await giveBack();
    return refuse('busy');
  }

  const index = await store.count(KEYS.communityNext);
  const record: CommunityRecord = {
    index,
    rows: draft.rows,
    inventory: fresh.inventory,
    par: fresh.par,
    label: fresh.label,
    name: name === '' ? fallbackName(draft.biome, index) : name,
    biome: draft.biome,
    hash: fresh.hash,
    maker: player.username,
    makerId: player.userId,
    makerAvatar: input.avatar,
    postId: '',
    url: '',
    created: input.nowMs,
    active: true,
    postedAs: 'user',
    solution: fresh.solution,
    creator: checked.test,
  };
  const island = toPlayable(record);
  const post = {
    title: COPY.communityTitle
      .replace('{maker}', record.maker)
      .replace('{name}', record.name),
    text: COPY.communityPostText
      .replace('{name}', record.name)
      .replace('{maker}', record.maker)
      .replace('{par}', String(record.par)),
    postData: toCommunityPostData(island, creditOf(record)),
  };
  let made: { id: string; permalink: string; author: string } | null = null;
  for (const asUser of [true, false]) {
    made = await deps.poster
      .post({ ...post, asUser })
      .catch((error: unknown) => {
        console.error(
          `Publish ${asUser ? 'as the player' : 'as the app'} failed: ${String(error)}`
        );
        return null;
      });
    if (made !== null) break;
  }
  if (made === null) {
    await giveBack();
    await store.del(lock);
    return refuse('failed');
  }

  const url = made.permalink.startsWith('http')
    ? made.permalink
    : `https://www.reddit.com${made.permalink}`;
  const published: CommunityRecord = {
    ...record,
    postId: made.id,
    url,
    postedAs:
      made.author.toLowerCase() === player.username.toLowerCase()
        ? 'user'
        : 'app',
  };
  await store.hSet(KEYS.community(index), writeRecord(published));
  await Promise.all([
    store.hSet(KEYS.communityPosts, { [made.id]: String(index) }),
    store.hSet(KEYS.communityHashes, { [fresh.hash]: String(index) }),
    store.zAdd(KEYS.communityAll, String(index), input.nowMs),
    store.zAdd(KEYS.communityMine(player.userId), String(index), input.nowMs),
    store.del(KEYS.draft(player.userId)),
    store.del(KEYS.builderCheck(player.userId)),
  ]);
  await deps.poster
    .results(made.id, communityNumber(index))
    .catch((error: unknown) =>
      console.error(`Results comment failed: ${String(error)}`)
    );
  const answer: BuilderPublishResponse = {
    ok: true,
    postId: made.id,
    permalink: made.permalink,
    url,
  };
  await store.set(tokenKey, JSON.stringify(answer), COMMUNITY.tokenSeconds);
  return answer;
}

function readPublished(value: object): BuilderPublishResponse | null {
  const fields: Record<string, unknown> = { ...value };
  const { ok, postId, permalink, url, problem } = fields;
  if (
    ok === true &&
    typeof postId === 'string' &&
    typeof permalink === 'string' &&
    typeof url === 'string'
  )
    return { ok: true, postId, permalink, url };
  if (ok === false && typeof problem === 'string') return null;
  return null;
}

/** "Your islands": the maker's published islands, newest first, with how they have been played. */
export async function listMine(
  store: Store,
  player: Player
): Promise<YourIsland[]> {
  if (player === null) return [];
  const members = await store.zRange(
    KEYS.communityMine(player.userId),
    0,
    COMMUNITY.yoursShown - 1,
    true
  );
  const islands: YourIsland[] = [];
  for (const { member } of members) {
    const record = await readCommunity(store, Number(member));
    if (record === null) continue;
    const number = communityNumber(record.index);
    const [plays, stats] = await Promise.all([
      store.zCard(KEYS.leaderboard(number)),
      store.hGetAll(KEYS.stats(number)),
    ]);
    islands.push({
      name: record.name,
      biome: record.biome,
      rows: record.rows,
      created: record.created,
      plays,
      parHits: Math.min(plays, Number(stats['parHits'] ?? 0) || 0),
      active: record.active,
      url: record.url,
    });
  }
  return islands;
}
