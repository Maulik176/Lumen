import { describe, expect, it } from 'vitest';
import { emptyDraft, islandHash, type IslandDraft } from '../../shared/builder';
import type { PostData } from '../../shared/api';
import { communityNumber } from '../../shared/community';
import { COMMUNITY } from '../../shared/config';
import type { Placement } from '../../shared/types';
import {
  checkIsland,
  checkKey,
  finishTest,
  islandStatus,
  listMine,
  loadDraft,
  lookUpIsland,
  postActivity,
  publishIsland,
  readCommunity,
  setIslandActive,
  type Poster,
  recordCheck,
  saveDraft,
  startTest,
  takeCheckTurn,
} from './community';
import { islandForDay } from './content';
import { memoryStore } from './memory-store';
import { resetPlayer, type Player } from './game';
import { KEYS } from './store';

const ana: Player = { userId: 't2_ana', username: 'ana' };

/**
 * A sun on the left shining east, a lantern below and to the right, and a rock that stops the
 * one-mirror answer down the right-hand column. Par 2: turn down, then turn right.
 */
function twoMirrors(spare = 1): IslandDraft {
  return {
    ...emptyDraft(6, 'snow'),
    spare,
    rows: ['......', '>.....', '......', '.....#', '.....W', '......'],
  };
}

const never = new Set<string>();
const clock = () => 0;

describe('checking an island on the server', () => {
  it('sets par, gives par plus the spare mirrors, and labels the difficulty', () => {
    const result = checkIsland(twoMirrors(2), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    expect(result.par).toBe(2);
    const prisms = result.solution.filter(
      (p) => p.piece.kind === 'prism'
    ).length;
    expect(result.inventory).toEqual({ mirrors: 2 - prisms + 2, prisms });
    expect(['gentle', 'tricky', 'fiendish']).toContain(result.label);
    expect(result.hash).toBe(islandHash(twoMirrors().rows));
  });

  it('refuses an island one piece can light', () => {
    const easy = {
      ...twoMirrors(),
      rows: twoMirrors().rows.map((row) => row.replace('#', '.')),
    };
    expect(checkIsland(easy, { daily: never, clock })).toMatchObject({
      ok: false,
      problem: 'too-easy',
    });
  });

  it('refuses an island nothing can light', () => {
    const walled = {
      ...twoMirrors(),
      rows: ['......', '>.....', '......', '....##', '....#W', '....##'],
    };
    expect(checkIsland(walled, { daily: never, clock })).toMatchObject({
      ok: false,
      problem: 'unsolvable',
    });
  });

  it('says "too complex" when the solver runs out of budget', () => {
    expect(
      checkIsland(twoMirrors(), { daily: never, clock, nodeLimit: 3 })
    ).toMatchObject({ ok: false, problem: 'too-complex' });
  });

  it('refuses what the editor would have refused', () => {
    expect(
      checkIsland(emptyDraft(6, 'moss'), { daily: never, clock })
    ).toMatchObject({
      ok: false,
      problem: 'no-sun',
    });
  });

  it('refuses an exact copy of a daily island', () => {
    const daily = islandForDay(1);
    if (daily === undefined) throw new Error('no day 1');
    const copy: IslandDraft = {
      ...twoMirrors(),
      size: daily.rows.length,
      rows: daily.rows,
    };
    const known = new Set([islandHash(daily.rows)]);
    expect(checkIsland(copy, { daily: known, clock })).toMatchObject({
      ok: false,
      problem: 'duplicate',
    });
  });

  it('records how many nodes and milliseconds each check took', () => {
    let now = 1000;
    const result = checkIsland(twoMirrors(), {
      daily: never,
      clock: () => (now += 40),
    });
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.ms).toBe(40);
  });
});

describe('"Reset my Lumen progress (dev)"', () => {
  it('also forgets the Builder: draft, check, test and the first-island tutorial', async () => {
    // Nov 19: after a dev reset the old island and a finished tutorial were still there.
    const store = memoryStore();
    await saveDraft(store, ana, twoMirrors());
    const result = checkIsland(twoMirrors(), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, ana, twoMirrors(), result);
    await store.hSet(KEYS.user('t2_ana'), { builderTutorial: '1' });
    await resetPlayer(store, ana, 1);
    expect(await loadDraft(store, ana)).toBeNull();
    expect(await startTest(store, ana, twoMirrors(), 0)).toBe('not-checked');
    expect((await store.hGetAll(KEYS.user('t2_ana')))['builderTutorial']).toBe(
      '0'
    );
  });
});

describe('drafts and the check turn', () => {
  it('keeps one draft per player and gives it back', async () => {
    const store = memoryStore();
    expect(await loadDraft(store, ana)).toBeNull();
    await saveDraft(store, ana, twoMirrors());
    expect(await loadDraft(store, ana)).toEqual(twoMirrors());
    expect(await loadDraft(store, null)).toBeNull();
  });

  it('allows one check every few seconds per player', async () => {
    const store = memoryStore();
    expect(await takeCheckTurn(store, ana)).toBe(true);
    expect(await takeCheckTurn(store, ana)).toBe(false);
    expect(await takeCheckTurn(store, null)).toBe(false);
    expect(COMMUNITY.checkGapSeconds).toBeGreaterThan(0);
  });
});

describe('test your island', () => {
  const answer: Placement[] = [
    { x: 2, y: 1, piece: { kind: 'mirror', orientation: 'backslash' } },
    { x: 2, y: 4, piece: { kind: 'mirror', orientation: 'backslash' } },
  ];

  async function checked() {
    const store = memoryStore();
    const result = checkIsland(twoMirrors(), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, ana, twoMirrors(), result);
    return store;
  }

  it('can only start on the island that was just checked', async () => {
    const store = memoryStore();
    expect(await startTest(store, ana, twoMirrors(), 0)).toBe('not-checked');
    const ready = await checked();
    expect(await startTest(ready, ana, twoMirrors(), 0)).toBe('started');
    const edited = {
      ...twoMirrors(),
      rows: twoMirrors().rows.map((row, y) => (y === 0 ? '#.....' : row)),
    };
    expect(await startTest(ready, ana, edited, 0)).toBe('not-checked');
  });

  it('passes only when the maker lights every lantern, timed by the server', async () => {
    const store = await checked();
    await startTest(store, ana, twoMirrors(), 10_000);
    expect(
      await finishTest(store, ana, twoMirrors(), answer.slice(0, 1), 20_000)
    ).toEqual({
      ok: false,
      problem: 'not-lit',
    });
    expect(await finishTest(store, ana, twoMirrors(), answer, 52_000)).toEqual({
      ok: true,
      pieces: 2,
      ms: 42_000,
    });
  });

  it('a solve for an older version of the island does not count', async () => {
    const store = await checked();
    await startTest(store, ana, twoMirrors(), 0);
    const changed = { ...twoMirrors(), spare: 0 };
    expect(await finishTest(store, ana, changed, answer, 1)).toEqual({
      ok: false,
      problem: 'changed',
    });
    expect(checkKey(changed)).not.toBe(checkKey(twoMirrors()));
  });

  it('reopening the Builder finds the unchanged island still checked, and lit', async () => {
    // Nov 19 review: after reopening, "Lit by you" went back to "Check island".
    const store = await checked();
    expect(await islandStatus(store, ana, twoMirrors())).toMatchObject({
      checked: { par: 2, label: expect.any(String) },
      tested: null,
    });
    await startTest(store, ana, twoMirrors(), 0);
    await finishTest(store, ana, twoMirrors(), answer, 30_000);
    expect(await islandStatus(store, ana, twoMirrors())).toMatchObject({
      checked: { par: 2 },
      tested: { pieces: 2 },
    });
    // Any other island, or nobody signed in: nothing to remember.
    const edited = { ...twoMirrors(), spare: 2 };
    expect(await islandStatus(store, ana, edited)).toEqual({
      checked: null,
      tested: null,
    });
    expect(await islandStatus(store, null, twoMirrors())).toEqual({
      checked: null,
      tested: null,
    });
  });

  it('pieces must fit the island and its inventory', async () => {
    const store = await checked();
    await startTest(store, ana, twoMirrors(), 0);
    const onRock: Placement[] = [
      ...answer,
      { x: 5, y: 3, piece: { kind: 'mirror', orientation: 'slash' } },
    ];
    expect(await finishTest(store, ana, twoMirrors(), onRock, 1)).toMatchObject(
      {
        ok: false,
      }
    );
  });
});

describe('publishing an island', () => {
  const answer: Placement[] = [
    { x: 2, y: 1, piece: { kind: 'mirror', orientation: 'backslash' } },
    { x: 2, y: 4, piece: { kind: 'mirror', orientation: 'backslash' } },
  ];
  /** The same puzzle with the sun on another row (and so another fingerprint). */
  const onRow = (row: number, name = ''): IslandDraft => ({
    ...twoMirrors(),
    name,
    rows: twoMirrors().rows.map((line, y) =>
      y === row ? '>' + line.slice(1) : y === 1 ? '.' + line.slice(1) : line
    ),
  });
  const solveFor = (row: number): Placement[] =>
    answer.map((p, i) => (i === 0 ? { ...p, y: row } : p));

  /** Check, test and light the island, as the Builder does before Publish. */
  async function ready(
    store: ReturnType<typeof memoryStore>,
    draft: IslandDraft,
    row = 1,
    who: Player = ana
  ): Promise<void> {
    const result = checkIsland(draft, { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, who, draft, result);
    await startTest(store, who, draft, 0);
    const lit = await finishTest(store, who, draft, solveFor(row), 20_000);
    if (!lit.ok) throw new Error(lit.problem);
  }

  function poster(author = 'ana', fail: 'never' | 'user' | 'always' = 'never') {
    const posts: { title: string; asUser: boolean; postData: PostData }[] = [];
    const results: string[] = [];
    const fake: Poster = {
      async post(input) {
        if (fail === 'always' || (fail === 'user' && input.asUser))
          throw new Error('refresh token does not exist');
        posts.push(input);
        return {
          id: `t3_post${posts.length}`,
          permalink: `/r/lumen_game_dev/comments/post${posts.length}/x/`,
          author: input.asUser ? author : 'lumen-game',
        };
      },
      async results(postId) {
        results.push(postId);
      },
    };
    return { fake, posts, results };
  }

  const publish = (
    store: ReturnType<typeof memoryStore>,
    draft: IslandDraft,
    fake: Poster,
    token = 'token0001',
    who: Player = ana
  ) =>
    publishIsland(
      store,
      who,
      { draft, token, avatar: '', nowMs: Date.UTC(2026, 10, 25, 12) },
      { poster: fake, daily: never, clock }
    );

  it('refuses until the maker has checked and lit exactly this island', async () => {
    const store = memoryStore();
    const { fake, posts } = poster();
    expect(await publish(store, twoMirrors(), fake, 'token0001', null)).toEqual(
      { ok: false, problem: 'signed-out' }
    );
    expect(await publish(store, twoMirrors(), fake)).toEqual({
      ok: false,
      problem: 'not-checked',
    });
    const result = checkIsland(twoMirrors(), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, ana, twoMirrors(), result);
    expect(await publish(store, twoMirrors(), fake)).toEqual({
      ok: false,
      problem: 'not-tested',
    });
    await ready(store, twoMirrors());
    // A board other than the one tested: the client cannot swap it in.
    expect(await publish(store, { ...twoMirrors(), spare: 2 }, fake)).toEqual({
      ok: false,
      problem: 'not-checked',
    });
    expect(posts).toHaveLength(0);
  });

  it('posts once, credits the maker everywhere, and clears the draft', async () => {
    const store = memoryStore();
    await saveDraft(store, ana, onRow(1, 'Frost Hollow'));
    await ready(store, onRow(1, 'Frost Hollow'));
    const { fake, posts, results } = poster();
    const done = await publish(store, onRow(1, 'Frost Hollow'), fake);
    expect(done).toMatchObject({
      ok: true,
      postId: 't3_post1',
      url: 'https://www.reddit.com/r/lumen_game_dev/comments/post1/x/',
    });
    expect(posts[0]?.title).toBe('Island by u/ana · Frost Hollow');
    expect(posts[0]?.asUser).toBe(true);
    const data = posts[0]?.postData;
    expect(data).toMatchObject({
      kind: 'community',
      day: communityNumber(1),
      name: 'Frost Hollow',
      maker: 'ana',
      biome: 'snow',
    });
    // The post's data stays far under Reddit's 2 KB.
    expect(JSON.stringify(data).length).toBeLessThan(1024);
    expect(results).toEqual(['t3_post1']);
    const record = await readCommunity(store, 1);
    expect(record).toMatchObject({
      name: 'Frost Hollow',
      maker: 'ana',
      postedAs: 'user',
      par: 2,
      creator: { pieces: 2 },
    });
    expect(await loadDraft(store, ana)).toBeNull();
  });

  it('a double tap or a retry with the same token gives the same post, never two', async () => {
    const store = memoryStore();
    await ready(store, twoMirrors());
    const { fake, posts } = poster();
    const first = await publish(store, twoMirrors(), fake);
    const again = await publish(store, twoMirrors(), fake);
    expect(again).toEqual(first);
    expect(posts).toHaveLength(1);
  });

  it('the same island cannot be published twice, even by a new attempt', async () => {
    const store = memoryStore();
    const { fake, posts } = poster();
    await ready(store, twoMirrors());
    await publish(store, twoMirrors(), fake, 'token0001');
    await ready(store, twoMirrors());
    expect(await publish(store, twoMirrors(), fake, 'token0002')).toEqual({
      ok: false,
      problem: 'duplicate',
    });
    expect(posts).toHaveLength(1);
  });

  it('an exact copy of a daily island is refused', async () => {
    const store = memoryStore();
    await ready(store, twoMirrors());
    const { fake } = poster();
    const daily = new Set([islandHash(twoMirrors().rows)]);
    expect(
      await publishIsland(
        store,
        ana,
        { draft: twoMirrors(), token: 'token0001', avatar: '', nowMs: 0 },
        { poster: fake, daily, clock }
      )
    ).toEqual({ ok: false, problem: 'duplicate' });
  });

  it(`allows ${COMMUNITY.publishPerDay} islands a day per player, and a failed post gives the slot back`, async () => {
    const store = memoryStore();
    const failing = poster('ana', 'always');
    await ready(store, onRow(0), 0);
    expect(await publish(store, onRow(0), failing.fake, 'tokenfail1')).toEqual({
      ok: false,
      problem: 'failed',
    });
    const { fake } = poster();
    for (const row of [0, 1, 2]) {
      await ready(store, onRow(row), row);
      expect(
        await publish(store, onRow(row), fake, `token000${row}`)
      ).toMatchObject({
        ok: true,
      });
    }
    const fourth = {
      ...onRow(2),
      rows: onRow(2).rows.map((r, y) => (y === 5 ? 'T' + r.slice(1) : r)),
    };
    await ready(store, fourth, 2);
    expect(await publish(store, fourth, fake, 'token0009')).toEqual({
      ok: false,
      problem: 'limit',
    });
  });

  it('filters names, and names a blank island after its world', async () => {
    const store = memoryStore();
    const { fake, posts } = poster();
    await ready(store, onRow(1, 'Sh1t Hollow'));
    expect(await publish(store, onRow(1, 'Sh1t Hollow'), fake)).toEqual({
      ok: false,
      problem: 'name',
    });
    await ready(store, onRow(1, '   '));
    await publish(store, onRow(1, '   '), fake, 'token0002');
    expect(posts[0]?.title).toBe('Island by u/ana · Snow Island #1');
  });

  it('when Reddit posts it from the app account, the maker is still credited', async () => {
    const store = memoryStore();
    await ready(store, twoMirrors());
    const asApp = poster('lumen-game');
    await publish(store, twoMirrors(), asApp.fake);
    const record = await readCommunity(store, 1);
    expect(record).toMatchObject({ maker: 'ana', postedAs: 'app' });
    expect(asApp.posts[0]?.title).toContain('u/ana');
    expect(asApp.posts[0]?.postData.maker).toBe('ana');
  });

  it('if posting as the player fails, it posts once from the app, credited', async () => {
    const store = memoryStore();
    await ready(store, twoMirrors());
    const flaky = poster('ana', 'user');
    expect(await publish(store, twoMirrors(), flaky.fake)).toMatchObject({
      ok: true,
    });
    expect(flaky.posts).toHaveLength(1);
    expect(flaky.posts[0]?.asUser).toBe(false);
    expect(await readCommunity(store, 1)).toMatchObject({ postedAs: 'app' });
  });
});

describe('community islands after publishing', () => {
  async function published() {
    const store = memoryStore();
    const result = checkIsland(twoMirrors(), { daily: never, clock });
    if (!result.ok) throw new Error(result.problem);
    await recordCheck(store, ana, twoMirrors(), result);
    await startTest(store, ana, twoMirrors(), 0);
    await finishTest(
      store,
      ana,
      twoMirrors(),
      [
        { x: 2, y: 1, piece: { kind: 'mirror', orientation: 'backslash' } },
        { x: 2, y: 4, piece: { kind: 'mirror', orientation: 'backslash' } },
      ],
      1
    );
    await publishIsland(
      store,
      ana,
      { draft: twoMirrors(), token: 'token0001', avatar: '', nowMs: 0 },
      {
        poster: {
          post: async () => ({
            id: 't3_abc',
            permalink: '/r/x/comments/abc/',
            author: 'ana',
          }),
          results: async () => undefined,
        },
        daily: never,
        clock,
      }
    );
    return store;
  }

  it('a daily day comes from the content file, a community number from Redis', async () => {
    const store = await published();
    const daily = await lookUpIsland(store, 1);
    expect(daily).toMatchObject({ ok: true, record: null });
    const island = await lookUpIsland(store, communityNumber(1));
    if (!island.ok) throw new Error(island.reason);
    expect(island.island.day).toBe(communityNumber(1));
    expect(island.island.par).toBe(2);
    expect(island.record?.maker).toBe('ana');
    expect(await lookUpIsland(store, communityNumber(2))).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('a deleted or removed post takes its island down, and approval brings it back', async () => {
    const store = await published();
    expect(await setIslandActive(store, 't3_abc', false)).toBe(true);
    expect(await lookUpIsland(store, communityNumber(1))).toEqual({
      ok: false,
      reason: 'taken-down',
    });
    expect((await listMine(store, ana))[0]?.active).toBe(false);
    await setIslandActive(store, 't3_abc', true);
    expect(await lookUpIsland(store, communityNumber(1))).toMatchObject({
      ok: true,
    });
    expect(await setIslandActive(store, 't3_other', false)).toBe(false);
  });

  it('with the community side switched off, an island rests', async () => {
    const store = await published();
    expect(await lookUpIsland(store, communityNumber(1), false)).toEqual({
      ok: false,
      reason: 'resting',
    });
    // Daily islands are untouched by the switch.
    expect(await lookUpIsland(store, 1, false)).toMatchObject({ ok: true });
  });

  it("lists the maker's islands with plays and par hits", async () => {
    const store = await published();
    expect(await listMine(store, ana)).toEqual([
      expect.objectContaining({
        name: 'Snow Island #1',
        plays: 0,
        parHits: 0,
        active: true,
        url: 'https://www.reddit.com/r/x/comments/abc/',
      }),
    ]);
    expect(await listMine(store, null)).toEqual([]);
  });
});

describe("what Reddit's triggers say about an island's post", () => {
  it('a deleted post, or one a moderator removes or marks as spam, takes the island down', () => {
    expect(postActivity({ postId: 't3_abc', reason: 'AUTHOR' })).toEqual({
      postId: 't3_abc',
      active: false,
    });
    expect(postActivity({ postId: 'abc' })).toEqual({
      postId: 't3_abc',
      active: false,
    });
    for (const action of ['removelink', 'spamlink'])
      expect(postActivity({ action, targetPost: { id: 't3_abc' } })).toEqual({
        postId: 't3_abc',
        active: false,
      });
  });

  it('approving it again brings it back; anything else changes nothing', () => {
    expect(
      postActivity({ action: 'approvelink', targetPost: { id: 't3_abc' } })
    ).toEqual({ postId: 't3_abc', active: true });
    expect(
      postActivity({ action: 'removecomment', targetPost: { id: 't3_abc' } })
    ).toBeNull();
    expect(postActivity({ action: 'removelink' })).toBeNull();
    expect(postActivity(null)).toBeNull();
  });
});
