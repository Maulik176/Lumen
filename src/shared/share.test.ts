import { describe, expect, it } from 'vitest';
import type { LockInResult } from './api';
import { clock, shareText } from './share';

const result: LockInResult = {
  day: 12,
  pieces: 5,
  par: 4,
  medal: 'glow',
  elapsedMs: 102_400,
  ranked: true,
  streak: 7,
  style: 'star',
  percentile: 60,
  rank: 3,
  skyCount: 40,
};

describe('shareText', () => {
  it('is two lines: the island, then the medal and streak', () => {
    expect(shareText(result, 4)).toBe(
      'Lumen #12 \u00b7 \u{1F3EE}\u{1F3EE}\u{1F3EE}\u{1F3EE} \u00b7 5 pieces (par 4) \u00b7 \u23f1 1:42\n\nGlow \u00b7 \u{1F525} 7-night streak'
    );
  });

  it('leaves the streak out on a first night and says "1 piece"', () => {
    const text = shareText(
      { ...result, pieces: 1, par: 1, medal: 'lamplighter', streak: 1 },
      1
    );
    expect(text).toContain('1 piece (par 1)');
    expect(text.endsWith('\n\nLamplighter')).toBe(true);
  });

  it('formats time as minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(61_999)).toBe('1:01');
  });
});
