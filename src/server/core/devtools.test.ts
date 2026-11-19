import { describe, expect, it } from 'vitest';
import { DEV } from '../../shared/config';
import { clockShift, devToolsOpen, devToolsRefusal } from './devtools';

const playtest = DEV.resetSubreddit;
const day = 86_400_000;

describe('dev tools before and after launch', () => {
  // Nov 19: r/lumen_game_dev is the playtest subreddit and also the one judges see, so once
  // Lumen launches, nothing may wipe data or move the clock there.
  it('before launch, open on the playtest subreddit only', () => {
    expect(devToolsOpen(playtest, false)).toBe(true);
    expect(devToolsOpen('LumenGame', false)).toBe(false);
    expect(devToolsOpen(undefined, false)).toBe(false);
    expect(devToolsRefusal(playtest, false)).toBeNull();
    expect(devToolsRefusal('LumenGame', false)).toBe(DEV.elsewhereToast);
  });

  it('after launch, closed everywhere, the playtest subreddit included', () => {
    expect(devToolsOpen(playtest, true)).toBe(false);
    expect(devToolsRefusal(playtest, true)).toBe(DEV.launchedToast);
    expect(devToolsRefusal('LumenGame', true)).toBe(DEV.launchedToast);
  });

  it('the clock is real time after launch, whatever shift was left stored', () => {
    expect(clockShift(playtest, String(3 * day), false)).toBe(3 * day);
    expect(clockShift(playtest, String(3 * day), true)).toBe(0);
    expect(clockShift('LumenGame', String(3 * day), false)).toBe(0);
    expect(clockShift(playtest, undefined, false)).toBe(0);
    expect(clockShift(playtest, 'not a number', false)).toBe(0);
  });
});
