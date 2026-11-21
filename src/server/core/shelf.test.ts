import { describe, expect, it } from 'vitest';
import { communityNumber } from '../../shared/community';
import { SUNDAY } from '../../shared/config';
import {
  lookUpIsland,
  readCommunity,
  setIslandActive,
  setIslandExcluded,
} from './community';
import { lastDay } from './content';
import { lockIn, recordStart, skyCount } from './game';
import { fakeReddit, maker, publishFrom } from './islands-for-tests';
import { memoryStore } from './memory-store';
import { seedCrowd } from './crowd';
import { communityShelf, refreshVotes } from './shelf';
import { KEYS, type Store } from './store';
import {
  islandOfDay,
  markPosted,
  pickTime,
  pickWindow,
  runPick,
} from './sunday';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Inside the first pick's window (for Sun Nov 29, day 6). */
const MIDWEEK = Date.UTC(2026, 10, 25, 12);
const options = { daily: new Set<string>(), clock: () => 0 };
const DAYS = [2, 6, 8, 13, 17, 23, 30];

/** Published islands, each a different daily layout (a copy would be refused as a duplicate). */
async function publishMany(
  store: Store,
  count: number,
  skip: readonly number[],
  name: (i: number) => string,
  created: (i: number) => number
): Promise<{ index: number; postId: string }[]> {
  const made: { index: number; postId: string }[] = [];
  for (let day = 1; day <= 90 && made.length < count; day++) {
    if (skip.includes(day)) continue;
    const weekday = new Date(Date.UTC(2026, 10, 23 + day)).getUTCDay();
    // Fridays and Saturdays are slow to check; the rest are plenty.
    if (weekday === 5 || weekday === 6) continue;
    try {
      const i = made.length;
      made.push(await publishFrom(store, day, maker(name(i)), created(i)));
    } catch {
      // Not an island the Builder accepts (too easy, too big): the next day.
    }
  }
  return made;
}

/** Every island the view lists, over all its pages. */
async function everything(store: Store, nowMs: number) {
  const first = await communityShelf(store, nowMs);
  if (!first.ok) throw new Error('resting');
  const older = [...first.older];
  let next = first.next;
  while (next !== null) {
    const page = await communityShelf(store, nowMs, next);
    if (!page.ok) throw new Error('resting');
    older.push(...page.older);
    next = page.next;
  }
  return { first, older };
}

describe("the Archipelago's Community view (E9)", () => {
  it('lists every live island exactly once: this week by score, then older ones, page by page', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const made: { index: number; postId: string; created: number }[] = [];
    // Seven this week, and more than a page of older ones (published weeks before).
    for (const [i, day] of DAYS.entries()) {
      const created = MIDWEEK + i * HOUR;
      made.push({
        ...(await publishFrom(store, day, maker(`w${i}`), created)),
        created,
      });
    }
    const olderOnes = await publishMany(
      store,
      SUNDAY.olderPage + 5,
      DAYS,
      (i) => `o${i}`,
      (i) => MIDWEEK - 14 * DAY - i * HOUR
    );
    expect(olderOnes).toHaveLength(SUNDAY.olderPage + 5);
    made.push(
      ...olderOnes.map((one, i) => ({
        ...one,
        created: MIDWEEK - 14 * DAY - i * HOUR,
      }))
    );
    made.forEach((one, i) => scores.set(one.postId, (i * 7) % 11));
    // One removed, one excluded: never listed.
    const removed = made[1];
    const excluded = made[DAYS.length + 2];
    if (removed === undefined || excluded === undefined)
      throw new Error('setup');
    await setIslandActive(store, removed.postId, false);
    await setIslandExcluded(store, excluded.index, 'mod');
    const now = MIDWEEK + 12 * HOUR;
    expect(await refreshVotes(store, reddit, now)).toBe(DAYS.length - 1);
    const { first, older } = await everything(store, now);
    const listed = [...first.week, ...older].map((row) => row.number);
    const expected = made
      .filter((one) => one !== removed && one !== excluded)
      .map((one) => communityNumber(one.index));
    // Exactly once each, nothing else.
    expect([...listed].sort()).toEqual([...expected].sort());
    expect(new Set(listed).size).toBe(listed.length);
    // This week: only this week's, highest score first.
    expect(first.week).toHaveLength(DAYS.length - 1);
    const weekScores = first.week.map((row) => row.score ?? -1);
    expect(weekScores).toEqual([...weekScores].sort((a, b) => b - a));
    for (const row of first.week)
      expect(row.number).toBeGreaterThanOrEqual(communityNumber(1));
    // Older: newest first.
    expect(older.length).toBe(SUNDAY.olderPage + 5 - 1);
    // Plays agree with the island's own board.
    for (const row of [...first.week, ...older])
      expect(row.plays).toBe(await skyCount(store, row.number));
  });

  it("an island's plays are its board's count, and a removed post leaves the week's scores", async () => {
    const store = memoryStore();
    const { reddit, scores, gone } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    const two = await publishFrom(store, 2, maker('ben'), MIDWEEK + HOUR);
    scores.set(one.postId, 3).set(two.postId, 5);
    const ben = maker('ben');
    if (ben === null) throw new Error('setup');
    const number = communityNumber(one.index);
    const found = await lookUpIsland(store, number);
    if (!found.ok) throw new Error('not found');
    await recordStart(store, ben, number, MIDWEEK);
    await lockIn(
      store,
      ben,
      {
        island: found.island,
        placements: found.island.solution,
        snoovatar: undefined,
        wantsRanked: true,
        postDay: number,
        lastDay: lastDay(),
        nowMs: MIDWEEK + 2 * HOUR,
      },
      { onRanked: async () => undefined }
    );
    await refreshVotes(store, reddit, MIDWEEK + 3 * HOUR);
    let shelf = await communityShelf(store, MIDWEEK + 3 * HOUR);
    if (!shelf.ok) throw new Error('resting');
    expect(shelf.week.map((row) => [row.name, row.plays, row.score])).toEqual([
      ['Isle 2', 0, 5],
      ['Isle 6', 1, 3],
    ]);
    gone.add(two.postId);
    await refreshVotes(store, reddit, MIDWEEK + 4 * HOUR);
    shelf = await communityShelf(store, MIDWEEK + 4 * HOUR);
    if (!shelf.ok) throw new Error('resting');
    // Its post is gone on Reddit: scored no more (listed unscored until the trigger takes it down).
    expect(
      shelf.week.find((row) => row.name === 'Isle 2')?.score ?? null
    ).toBeNull();
  });

  it("highlights the latest Sunday pick, leading to Sunday's post once it exists", async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 5);
    const before = await communityShelf(store, MIDWEEK);
    expect(before.ok && before.pick).toBeNull();
    await runPick(store, reddit, 6, pickTime(6), options);
    const after = await communityShelf(store, pickTime(6) + HOUR);
    expect(after.ok && after.pick).toMatchObject({
      sunday: 6,
      name: 'Isle 6',
      maker: 'ana',
      // Until Sunday's post exists, the island's own post.
      url: (await readCommunity(store, one.index))?.url,
    });
    await store.set(KEYS.postForDay(6), 't3_sun6');
    await markPosted(store, reddit, 6, 'x', () => undefined);
    const posted = await communityShelf(store, pickTime(6) + 30 * HOUR);
    expect(posted.ok && posted.pick?.url).toBe(
      'https://www.reddit.com/comments/sun6'
    );
    // After the pick, this week's islands run for the next Sunday.
    expect(posted.ok && posted.week).toEqual([]);
    expect(pickWindow(13).from).toBe(pickTime(6));
  });

  it("the picked island is listed once, as the pick, with Sunday's players and its own post's together", async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const picked = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    const other = await publishFrom(store, 2, maker('ben'), MIDWEEK + HOUR);
    scores.set(picked.postId, 9).set(other.postId, 4);
    await runPick(store, reddit, 6, pickTime(6), options);
    // Two players lit its own post during the week; three lit it as Sunday's island.
    const own = await lookUpIsland(store, communityNumber(picked.index));
    if (!own.ok) throw new Error('not found');
    await seedCrowd(store, own.island, {
      players: 2,
      seed: 'own',
      practiceShare: 0,
      prefix: 'w',
      lastDay: lastDay(),
    });
    const sunday = await islandOfDay(store, 6);
    if (sunday === undefined) throw new Error('no Sunday');
    await seedCrowd(store, sunday.island, {
      players: 3,
      seed: 'sun',
      practiceShare: 0,
      prefix: 's',
      lastDay: lastDay(),
    });
    const { first, older } = await everything(store, pickTime(6) + 30 * HOUR);
    expect(first.pick).toMatchObject({ name: 'Isle 6', plays: 5 });
    const rows = [...first.week, ...older].map((row) => row.number);
    // Once: never again under This week or Earlier.
    expect(rows).not.toContain(communityNumber(picked.index));
    expect(rows).toEqual([communityNumber(other.index)]);
  });

  it('a busy week: the best ten show under This week, and every other island still appears once', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const made = await publishMany(
      store,
      SUNDAY.weekShown + 4,
      [],
      (i) => `b${i}`,
      (i) => MIDWEEK - i * 60_000
    );
    expect(made).toHaveLength(SUNDAY.weekShown + 4);
    made.forEach((one, i) => scores.set(one.postId, 100 - i));
    await refreshVotes(store, reddit, MIDWEEK + HOUR);
    const { first, older } = await everything(store, MIDWEEK + HOUR);
    expect(first.week).toHaveLength(SUNDAY.weekShown);
    const listed = [...first.week, ...older].map((row) => row.number);
    expect([...listed].sort()).toEqual(
      made.map((one) => communityNumber(one.index)).sort()
    );
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('switched off it rests', async () => {
    expect(await communityShelf(memoryStore(), MIDWEEK, 0, false)).toEqual({
      ok: false,
      reason: 'resting',
    });
  });
});
