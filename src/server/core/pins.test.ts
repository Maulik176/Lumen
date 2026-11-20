import { describe, expect, it } from 'vitest';
import { memoryStore } from './memory-store';
import { pinDaily, type PinReddit } from './pins';
import { KEYS } from './store';

function fakeReddit(failSticky = false) {
  const calls: string[] = [];
  const reddit: PinReddit = {
    async sticky(postId, top) {
      if (failSticky) throw new Error('rate limited');
      calls.push(`pin ${postId}${top ? ' top' : ''}`);
    },
    async unsticky(postId) {
      calls.push(`unpin ${postId}`);
    },
  };
  return { reddit, calls };
}

const on = { enabled: true, top: true };

describe('pinning the daily post (E8)', () => {
  it("pins today's post on top and unpins the daily post it pinned before, nothing else", async () => {
    const store = memoryStore();
    const { reddit, calls } = fakeReddit();
    await store.set(KEYS.postForDay(6), 't3_six');
    expect(await pinDaily(store, reddit, 6, on)).toBe('pinned');
    await store.set(KEYS.postForDay(7), 't3_seven');
    expect(await pinDaily(store, reddit, 7, on)).toBe('pinned');
    // How to play (pinned by a moderator, never by the app) is never unpinned.
    expect(calls).toEqual([
      'pin t3_six top',
      'unpin t3_six',
      'pin t3_seven top',
    ]);
  });

  it('asked again the same day, it does nothing', async () => {
    const store = memoryStore();
    const { reddit, calls } = fakeReddit();
    await store.set(KEYS.postForDay(6), 't3_six');
    await pinDaily(store, reddit, 6, on);
    expect(await pinDaily(store, reddit, 6, on)).toBe('already');
    expect(calls).toHaveLength(1);
  });

  it('a failed pin is not remembered, so the next run tries again; a missed day is caught up', async () => {
    const store = memoryStore();
    await store.set(KEYS.postForDay(6), 't3_six');
    await pinDaily(store, fakeReddit().reddit, 6, on);
    await store.set(KEYS.postForDay(7), 't3_seven');
    expect(await pinDaily(store, fakeReddit(true).reddit, 7, on)).toBe(
      'failed'
    );
    // Day 8: day 6's post is still the last pinned, so it is the one unpinned.
    await store.set(KEYS.postForDay(8), 't3_eight');
    const { reddit, calls } = fakeReddit();
    expect(await pinDaily(store, reddit, 8, on)).toBe('pinned');
    expect(calls).toEqual(['unpin t3_six', 'pin t3_eight top']);
  });

  it('switched off it does nothing; with no post yet it waits', async () => {
    const store = memoryStore();
    const { reddit, calls } = fakeReddit();
    expect(await pinDaily(store, reddit, 6, on)).toBe('no-post');
    await store.set(KEYS.postForDay(6), 't3_six');
    expect(
      await pinDaily(store, reddit, 6, { enabled: false, top: true })
    ).toBe('off');
    expect(calls).toEqual([]);
    expect(
      await pinDaily(store, reddit, 6, { enabled: true, top: false })
    ).toBe('pinned');
    expect(calls).toEqual(['pin t3_six']);
  });
});
