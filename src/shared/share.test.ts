import { describe, expect, it } from 'vitest';
import type { LockInResult } from './api';
import {
  clock,
  commentUrl,
  communityResultsText,
  resultsText,
  shareText,
} from './share';

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
  it('is two lines: who and the island, then the medal and streak', () => {
    expect(shareText(result, 4, 'ana')).toBe(
      'u/ana \u00b7 Lumen #12 \u00b7 \u{1F3EE}\u{1F3EE}\u{1F3EE}\u{1F3EE} \u00b7 5 pieces (par 4) \u00b7 \u23f1 1:42\n\nGlow \u00b7 \u{1F525} 7-night streak'
    );
  });

  it('leaves the streak out on a first night and says "1 piece"', () => {
    const text = shareText(
      { ...result, pieces: 1, par: 1, medal: 'lamplighter', streak: 1 },
      1,
      'ana'
    );
    expect(text).toContain('1 piece (par 1)');
    expect(text.endsWith('\n\nLamplighter')).toBe(true);
  });

  it("names the player, because Reddit posts it from the app's account for everyone but the owner", () => {
    // Seen Nov 17: two friends' shares appeared as "lumen-game" replies with no name in them.
    expect(
      shareText(result, 4, 'Dry_Promotion2506').startsWith(
        'u/Dry_Promotion2506 \u00b7 '
      )
    ).toBe(true);
  });

  it('formats time as minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(61_999)).toBe('1:01');
  });
});

describe('resultsText', () => {
  it('invites the first player, then counts players and par', () => {
    expect(resultsText(12, 'Moss Steps', 0, 0)).toContain(
      'Lumen #12 \u00b7 Moss Steps. Be the first'
    );
    expect(resultsText(12, 'Moss Steps', 1, 0)).toBe(
      "Results: 1 player lit Moss Steps. Share yours below \u{1F447}"
    );
    expect(resultsText(12, 'Moss Steps', 1284, 231)).toBe(
      "Results: 1,284 players lit Moss Steps, 231 hit par. Share yours below \u{1F447}"
    );
  });
});

describe('on a community island', () => {
  const credit = { island: 'Frost Hollow', maker: 'maker' };

  it('the shared line names the island and its maker, not a day number', () => {
    const text = shareText(
      { ...result, day: 1_000_007, streak: 9 },
      2,
      'player',
      credit
    );
    expect(text).toContain('u/player');
    expect(text).toContain('Frost Hollow by u/maker');
    expect(text).not.toContain('#1000007');
    // No streak on a community island: it never advances there.
    expect(text).not.toContain('streak');
  });

  it('the results comment credits the maker', () => {
    expect(communityResultsText('Frost Hollow', 'maker', 0, 0)).toContain(
      'Results for Frost Hollow by u/maker'
    );
    expect(communityResultsText('Frost Hollow', 'maker', 3, 1)).toContain(
      '3 players lit it, 1 hit par'
    );
  });
});

describe('commentUrl', () => {
  it('links straight to the reply', () => {
    expect(commentUrl('t3_abc', 't1_xyz')).toBe(
      'https://www.reddit.com/comments/abc/comment/xyz'
    );
  });
});
