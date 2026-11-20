import { describe, expect, it } from 'vitest';
import { flairFor } from '../../shared/streak';
import { readCommunity, setIslandActive, setIslandExcluded } from './community';
import { islandForDay } from './content';
import { devToolsRefusal } from './devtools';
import { communityShelf, refreshVotes } from './shelf';
import { fakeReddit, maker, publishFrom } from './islands-for-tests';
import { memoryStore } from './memory-store';
import { KEYS } from './store';
import {
  chooseWinner,
  cleanUpSundays,
  previewLine,
  dueSunday,
  ensurePick,
  islandOfDay,
  markPosted,
  pickTime,
  pickWindow,
  rankCandidates,
  readPick,
  runPick,
  runningFor,
  withdrawIfPicked,
  type Candidate,
  type PickReddit,
} from './sunday';

const never = new Set<string>();
const clock = () => 0;
const SUNDAY_6 = 6; // Sun Nov 29, 2026: the first pick.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Inside the first pick's window: Wed Nov 25, noon UTC. */
const MIDWEEK = Date.UTC(2026, 10, 25, 12);
const options = { daily: never, clock };

describe('the week and the clock', () => {
  it('the first pick is Sat Nov 28 20:00 UTC for Sun Nov 29, over the week before', () => {
    expect(pickTime(SUNDAY_6)).toBe(Date.UTC(2026, 10, 28, 20));
    expect(pickWindow(SUNDAY_6)).toEqual({
      from: Date.UTC(2026, 10, 21, 20),
      to: Date.UTC(2026, 10, 28, 20),
    });
  });

  it('a pick is due from Saturday 20:00 through Sunday, and not before', () => {
    expect(dueSunday(Date.UTC(2026, 10, 28, 19, 59))).toBeNull();
    expect(dueSunday(Date.UTC(2026, 10, 28, 20))).toBe(SUNDAY_6);
    expect(dueSunday(Date.UTC(2026, 10, 29, 0, 5))).toBe(SUNDAY_6);
    expect(dueSunday(Date.UTC(2026, 10, 30, 12))).toBeNull();
  });

  it('an island published after the pick runs for the next Sunday', () => {
    expect(runningFor(Date.UTC(2026, 10, 28, 19, 59))).toBe(SUNDAY_6);
    expect(runningFor(Date.UTC(2026, 10, 28, 20, 1))).toBe(SUNDAY_6 + 7);
    expect(runningFor(Date.UTC(2026, 10, 24))).toBe(SUNDAY_6);
  });
});

describe('who wins', () => {
  const candidate = (
    index: number,
    score: number,
    parHits = 0,
    plays = 0,
    created = 0
  ): Candidate => ({
    score,
    parHits,
    plays,
    record: {
      index,
      created,
      rows: [],
      inventory: { mirrors: 0, prisms: 0 },
      par: 4,
      label: 'tricky',
      name: `i${index}`,
      biome: 'moss',
      hash: '',
      maker: 'm',
      makerId: 't2_m',
      makerAvatar: '',
      postId: '',
      url: '',
      active: true,
      postedAs: 'app',
      solution: [],
      creator: { placements: [], pieces: 4, ms: 1 },
      excluded: '',
      sunday: 0,
    },
  });

  it('highest score, then par hits, then plays, then the earliest', () => {
    const order = rankCandidates([
      candidate(1, 5, 1, 9, 10),
      candidate(2, 7),
      candidate(3, 5, 2, 1, 20),
      candidate(4, 5, 2, 3, 30),
      candidate(5, 5, 2, 3, 25),
    ]).map((c) => c.record.index);
    expect(order).toEqual([2, 5, 4, 3, 1]);
  });

  it('picks the best live island of the week that fits Sunday, and freezes a copy', async () => {
    const store = memoryStore();
    const { reddit, scores, comments, flairs } = fakeReddit();
    const ana = await publishFrom(store, 2, maker('ana'), MIDWEEK);
    const ben = await publishFrom(store, 6, maker('ben'), MIDWEEK + HOUR);
    const cleo = await publishFrom(store, 8, maker('cleo'), MIDWEEK + 2 * HOUR);
    scores.set(ana.postId, 3).set(ben.postId, 9).set(cleo.postId, 5);
    const report = await runPick(
      store,
      reddit,
      SUNDAY_6,
      pickTime(SUNDAY_6),
      options
    );
    expect(report.outcome).toBe('community');
    expect(report.line).toContain('Isle 6 by u/ben (score 9, par 4');
    const pick = await readPick(store, SUNDAY_6);
    expect(pick?.winner).toMatchObject({
      index: ben.index,
      score: 9,
      credit: { maker: 'ben', makerId: 't2_ben' },
      island: { day: SUNDAY_6, weekday: 'sunday', date: '2026-11-29', par: 4 },
    });
    // The copy is the island as published, with Sunday's day, date and weekday.
    const record = await readCommunity(store, ben.index);
    expect(pick?.winner?.island.rows).toEqual(record?.rows);
    expect(record?.sunday).toBe(SUNDAY_6);
    // The comment on the winning post, naming the maker; Islandwright for the maker.
    expect([...comments.values()]).toEqual([
      {
        post: ben.postId,
        text: "Chosen as Sunday's island for r/lumen_game_dev ✨ Well built, u/ben.",
      },
    ]);
    expect(flairs).toEqual([['ben', 'Islandwright']]);
    // Sunday now serves the copy; every other day is untouched.
    const sunday = await islandOfDay(store, SUNDAY_6);
    expect(sunday?.island.name).toBe('Isle 6');
    for (let day = 1; day <= 90; day++)
      if (day !== SUNDAY_6)
        expect((await islandOfDay(store, day))?.island).toEqual(
          islandForDay(day)
        );
  });

  it('leaves out islands outside the week, below the score, outside the band, or gone', async () => {
    const store = memoryStore();
    const { reddit, scores, gone } = fakeReddit();
    const window = pickWindow(SUNDAY_6);
    const early = await publishFrom(store, 2, maker('a1'), window.from - 1);
    const first = await publishFrom(store, 6, maker('a2'), window.from);
    const late = await publishFrom(store, 8, maker('a3'), window.to);
    const easy = await publishFrom(store, 1, maker('a4'), MIDWEEK); // par 2
    const low = await publishFrom(store, 13, maker('a5'), MIDWEEK);
    const removed = await publishFrom(store, 17, maker('a6'), MIDWEEK);
    const unread = await publishFrom(store, 23, maker('a7'), MIDWEEK);
    const lastIn = await publishFrom(store, 30, maker('a8'), window.to - 1);
    for (const one of [early, first, late, easy, removed, lastIn])
      scores.set(one.postId, 20);
    scores.set(low.postId, 1);
    gone.add(removed.postId);
    // unread has no score: Reddit could not say.
    void unread;
    const report = await runPick(
      store,
      reddit,
      SUNDAY_6,
      pickTime(SUNDAY_6),
      options
    );
    // Two qualify (first and lastIn, both score 20): the earlier one wins.
    expect((await readPick(store, SUNDAY_6))?.winner?.index).toBe(first.index);
    expect(report.line).toContain('par outside 3-5');
    expect(report.line).toContain('below score 2');
    expect(report.line).toContain('taken down');
    expect(report.line).toContain('score unreadable');
  });

  it('keeps the generated island, and says why, when nothing qualifies', async () => {
    const store = memoryStore();
    const { reddit, scores, comments, flairs } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 1);
    const report = await runPick(
      store,
      reddit,
      SUNDAY_6,
      pickTime(SUNDAY_6),
      options
    );
    expect(report.outcome).toBe('generated');
    expect(report.line).toBe(
      'Sunday pick for day 6: generated island (1 islands considered; left out: 1 below score 2)'
    );
    expect((await readPick(store, SUNDAY_6))?.state).toBe('generated');
    expect((await islandOfDay(store, SUNDAY_6))?.island).toEqual(
      islandForDay(SUNDAY_6)
    );
    expect(comments.size).toBe(0);
    expect(flairs).toEqual([]);
  });

  it('a leader that no longer passes the check, or is too easy for Sunday, gives way to the next', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const top = await publishFrom(store, 2, maker('ana'), MIDWEEK);
    const easy = await publishFrom(store, 8, maker('ben'), MIDWEEK); // difficulty 59.5
    const next = await publishFrom(store, 6, maker('cleo'), MIDWEEK);
    scores.set(top.postId, 9).set(easy.postId, 8).set(next.postId, 7);
    // Stored with pieces the check would not give it now.
    await store.hSet(KEYS.community(top.index), {
      inventory: JSON.stringify({ mirrors: 9, prisms: 0 }),
    });
    const report = await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6), {
      ...options,
      minDifficulty: 60,
    });
    expect((await readPick(store, SUNDAY_6))?.winner?.index).toBe(next.index);
    expect(report.line).toContain('1 failed the re-check');
    expect(report.line).toContain('1 too easy for Sunday');
  });

  it('re-checks at most three leaders in one run', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    let score = 20;
    for (const [day, name] of [
      [2, 'a'],
      [6, 'b'],
      [17, 'c'],
      [23, 'd'],
    ] as const) {
      const one = await publishFrom(store, day, maker(name), MIDWEEK);
      scores.set(one.postId, score--);
      await store.hSet(KEYS.community(one.index), {
        inventory: JSON.stringify({ mirrors: 9, prisms: 0 }),
      });
    }
    const report = await runPick(
      store,
      reddit,
      SUNDAY_6,
      pickTime(SUNDAY_6),
      options
    );
    expect(report.outcome).toBe('generated');
    expect(report.line).toContain('3 failed the re-check');
  });

  it('an excluded island is out until a moderator lets it back in', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 5);
    await setIslandExcluded(store, one.index, 'mod');
    expect(
      (await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6), options))
        .outcome
    ).toBe('generated');
    await setIslandExcluded(store, one.index, '');
    const again = await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6), {
      ...options,
      force: true,
    });
    expect(again.outcome).toBe('community');
  });

  it('an island whose post was removed or deleted before the pick is out', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 5);
    await setIslandActive(store, one.postId, false);
    const report = await runPick(
      store,
      reddit,
      SUNDAY_6,
      pickTime(SUNDAY_6),
      options
    );
    expect(report.outcome).toBe('generated');
    expect(report.line).toContain('1 taken down');
  });
});

describe('safe to run any number of times', () => {
  async function ready() {
    const store = memoryStore();
    const fake = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    fake.scores.set(one.postId, 5);
    return { store, ...fake, one };
  }

  it('twice, or the cron and the catch-up at once: one pick, one comment, one flair', async () => {
    const { store, reddit, comments, flairs } = await ready();
    const at = pickTime(SUNDAY_6);
    const both = await Promise.all([
      runPick(store, reddit, SUNDAY_6, at, options),
      runPick(store, reddit, SUNDAY_6, at + 1, options),
    ]);
    expect(both.map((r) => r.outcome).sort()).toEqual(['busy', 'community']);
    const again = await runPick(store, reddit, SUNDAY_6, at + HOUR, options);
    expect(again.outcome).toBe('kept');
    expect(comments.size).toBe(1);
    expect(flairs).toHaveLength(1);
  });

  it('a skipped 20:00 tick is caught up at 20:07; nothing runs before 20:00', async () => {
    const { store, reddit } = await ready();
    expect(
      await ensurePick(store, reddit, Date.UTC(2026, 10, 28, 19, 37), options)
    ).toBeNull();
    expect(await readPick(store, SUNDAY_6)).toBeNull();
    const caught = await ensurePick(
      store,
      reddit,
      Date.UTC(2026, 10, 28, 20, 7),
      options
    );
    expect(caught?.outcome).toBe('community');
    const later = await ensurePick(
      store,
      reddit,
      Date.UTC(2026, 10, 28, 20, 37),
      options
    );
    expect(later?.outcome).toBe('kept');
  });

  it('every Saturday tick skipped: the pick still runs on Sunday, before its post', async () => {
    const { store, reddit } = await ready();
    const report = await ensurePick(
      store,
      reddit,
      Date.UTC(2026, 10, 29, 0, 1),
      options
    );
    expect(report?.outcome).toBe('community');
  });

  it('a pick that failed to comment or flair tries again on the next run', async () => {
    const { store, reddit, comments, flairs } = await ready();
    const failing: PickReddit = {
      ...reddit,
      comment: async () => {
        throw new Error('rate limited');
      },
      flair: async () => {
        throw new Error('flair off');
      },
    };
    await runPick(store, failing, SUNDAY_6, pickTime(SUNDAY_6), options);
    expect(comments.size).toBe(0);
    await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6) + HOUR, options);
    expect(comments.size).toBe(1);
    // The flair counted its title before failing: the retry does not count it twice.
    expect((await store.hGetAll(KEYS.user('t2_ana')))['islandwright']).toBe(
      '1'
    );
    expect(flairs).toEqual([]);
  });
});

describe('once Sunday has its post, nothing changes it', () => {
  it('the copy stays when the source is deleted or edited, and no run replaces it', async () => {
    const store = memoryStore();
    const { reddit, scores, comments } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    const two = await publishFrom(store, 2, maker('ben'), MIDWEEK);
    scores.set(one.postId, 5).set(two.postId, 4);
    await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6), options);
    await markPosted(
      store,
      reddit,
      SUNDAY_6,
      'https://www.reddit.com/r/lumen_game_dev/comments/sun6/',
      () => undefined
    );
    // The comment now leads to Sunday's post.
    expect([...comments.values()][0]?.text).toContain('Play it: https://');
    const before = (await islandOfDay(store, SUNDAY_6))?.island;
    await store.del(KEYS.community(one.index));
    scores.set(two.postId, 50);
    const forced = await runPick(store, reddit, SUNDAY_6, DAY * 999, {
      ...options,
      force: true,
    });
    expect(forced.outcome).toBe('frozen');
    expect((await islandOfDay(store, SUNDAY_6))?.island).toEqual(before);
    // Even with the community side switched off.
    expect((await islandOfDay(store, SUNDAY_6, false))?.island).toEqual(before);
  });

  it('a moderator removing the winner before its post re-runs the pick without it', async () => {
    const store = memoryStore();
    const { reddit, scores, comments, flairs, deleted } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    const two = await publishFrom(store, 2, maker('ben'), MIDWEEK);
    scores.set(one.postId, 5).set(two.postId, 4);
    await store.hSet(KEYS.user('t2_ana'), {
      lastMedal: 'glow',
      streak: '3',
    });
    await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6), options);
    expect(flairs).toEqual([['ana', 'Glow 🔥3 · Islandwright']]);
    await setIslandActive(store, one.postId, false);
    const report = await withdrawIfPicked(
      store,
      reddit,
      one.index,
      pickTime(SUNDAY_6) + HOUR,
      options
    );
    expect(report?.outcome).toBe('community');
    expect((await readPick(store, SUNDAY_6))?.winner?.index).toBe(two.index);
    // Ana's comment is gone, her title too; Ben has both now.
    expect(deleted).toEqual(['t1_c1']);
    expect([...comments.values()].map((c) => c.post)).toEqual([two.postId]);
    expect(flairs.slice(1)).toEqual([
      ['ana', 'Glow 🔥3'],
      ['ben', 'Islandwright'],
    ]);
    expect((await readCommunity(store, one.index))?.sunday).toBe(0);
    // After Sunday's post a removal changes nothing.
    await markPosted(store, reddit, SUNDAY_6, 'https://x', () => undefined);
    await setIslandActive(store, two.postId, false);
    expect(
      await withdrawIfPicked(store, reddit, two.index, DAY * 999, options)
    ).toBeNull();
    expect((await readPick(store, SUNDAY_6))?.winner?.index).toBe(two.index);
  });
});

describe('the switch and the developer pick', () => {
  it('community off: no pick runs, and a pick not yet posted is not served', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 5);
    expect(
      await ensurePick(store, reddit, pickTime(SUNDAY_6), {
        ...options,
        enabled: false,
      })
    ).toBeNull();
    await runPick(store, reddit, SUNDAY_6, pickTime(SUNDAY_6), options);
    expect((await islandOfDay(store, SUNDAY_6, false))?.island).toEqual(
      islandForDay(SUNDAY_6)
    );
    expect((await islandOfDay(store, SUNDAY_6, true))?.pick).not.toBeNull();
  });

  it('a dev pick takes every island so far, and replaces an earlier dev pick', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    // Published long before the week: only a dev pick sees it.
    const old = await publishFrom(store, 6, maker('ana'), MIDWEEK - 30 * DAY);
    scores.set(old.postId, 5);
    const dev = await runPick(store, reddit, SUNDAY_6, MIDWEEK, {
      ...options,
      dev: true,
    });
    expect(dev.outcome).toBe('community');
    const fresh = await publishFrom(store, 2, maker('ben'), MIDWEEK + HOUR);
    scores.set(fresh.postId, 9);
    const again = await runPick(store, reddit, SUNDAY_6, MIDWEEK + 2 * HOUR, {
      ...options,
      dev: true,
      force: true,
    });
    expect(again.outcome).toBe('community');
    expect((await readPick(store, SUNDAY_6))?.winner?.index).toBe(fresh.index);
  });
});

describe('Islandwright flair', () => {
  it('follows the medal and streak, or stands alone before the first medal', () => {
    expect(flairFor('Lamplighter', 12, true)).toBe(
      'Lamplighter 🔥12 · Islandwright'
    );
    expect(flairFor(null, 0, true)).toBe('Islandwright');
    expect(flairFor('Glow', 2, false)).toBe('Glow 🔥2');
    expect(flairFor(null, 0, false)).toBe('');
  });
});

describe('the dev tools (r/lumen_game_dev, before launch)', () => {
  it('the preview names who would win without writing anything', async () => {
    const store = memoryStore();
    const { reddit, scores, comments } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    const two = await publishFrom(store, 2, maker('ben'), MIDWEEK);
    scores.set(one.postId, 7).set(two.postId, 3);
    const choice = await chooseWinner(
      store,
      reddit,
      SUNDAY_6,
      { from: 0, to: MIDWEEK + 1 },
      options
    );
    expect(previewLine(choice)).toBe(
      'Isle 6 by u/ana, score 7, par 4. 1 more in the running.'
    );
    expect(await readPick(store, SUNDAY_6)).toBeNull();
    expect(comments.size).toBe(0);
    const none = await chooseWinner(
      memoryStore(),
      reddit,
      SUNDAY_6,
      { from: 0, to: MIDWEEK },
      options
    );
    expect(previewLine(none)).toBe(
      'No island would win: the generated Sunday stays'
    );
  });

  it('clean-up removes every Sunday pick and pin record, so a test pick never becomes the real Sunday', async () => {
    const store = memoryStore();
    const { reddit, scores } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 7);
    await runPick(store, reddit, SUNDAY_6, MIDWEEK, { ...options, dev: true });
    await store.set(KEYS.pinned(SUNDAY_6), '1');
    await store.set(KEYS.pinnedLast, 't3_x');
    await cleanUpSundays(store, 90);
    expect(await readPick(store, SUNDAY_6)).toBeNull();
    expect((await islandOfDay(store, SUNDAY_6))?.island).toEqual(
      islandForDay(SUNDAY_6)
    );
    expect(await store.get(KEYS.pinned(SUNDAY_6))).toBeUndefined();
    expect(await store.get(KEYS.pinnedLast)).toBeUndefined();
  });
});

describe('behind the switches (PHASE3_PLAN.md item 7)', () => {
  it('community off: no pick, no scores, no Community view, no pick served, nothing written', async () => {
    const store = memoryStore();
    const { reddit, scores, comments, flairs } = fakeReddit();
    const one = await publishFrom(store, 6, maker('ana'), MIDWEEK);
    scores.set(one.postId, 9);
    const off = { ...options, enabled: false };
    expect(await ensurePick(store, reddit, pickTime(SUNDAY_6), off)).toBeNull();
    expect(await refreshVotes(store, reddit, MIDWEEK, false)).toBe(0);
    expect(await communityShelf(store, MIDWEEK, 0, false)).toEqual({
      ok: false,
      reason: 'resting',
    });
    const choice = await chooseWinner(
      store,
      reddit,
      SUNDAY_6,
      pickWindow(SUNDAY_6),
      off
    );
    expect(choice.winner).toBeNull();
    expect(choice.reasons).toBe('community off');
    expect(await readPick(store, SUNDAY_6)).toBeNull();
    expect(comments.size).toBe(0);
    expect(flairs).toEqual([]);
    expect((await islandOfDay(store, SUNDAY_6, false))?.island).toEqual(
      islandForDay(SUNDAY_6)
    );
  });

  it('launched: the dev pick and preview refuse; the mod tools have no such gate', () => {
    expect(devToolsRefusal('lumen_game_dev', true)).not.toBeNull();
    expect(devToolsRefusal('lumen_game_dev', false)).toBeNull();
    expect(devToolsRefusal('somewhere_else', false)).not.toBeNull();
  });
});
