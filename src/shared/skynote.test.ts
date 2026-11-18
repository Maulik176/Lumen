import { describe, expect, it } from 'vitest';
import { COPY, SKY } from './config';
import { releaseNotes } from './skynote';

const base = {
  ranked: true,
  firstEver: false,
  lastNightShown: false,
  tonight: 1,
};

describe('the lines while your lantern rises', () => {
  it('says nothing on an ordinary night, or after a practice solve', () => {
    expect(releaseNotes(base)).toEqual([]);
    expect(
      releaseNotes({
        ...base,
        ranked: false,
        firstEver: true,
        lastNightShown: true,
      })
    ).toEqual([]);
  });

  it('the first time ever, says what the sky is', () => {
    expect(releaseNotes({ ...base, firstEver: true })).toEqual([
      { text: COPY.skyJoin, ms: SKY.joinLineMs },
    ]);
  });

  it("on a quiet night, says whether you were first and that the faint ones are last night's", () => {
    // Nov 18: with last night's lanterns in the sky, the first player tonight thought others had
    // already solved it.
    expect(releaseNotes({ ...base, lastNightShown: true, tonight: 1 })).toEqual(
      [{ text: COPY.skyQuietFirst, ms: SKY.quietLineMs }]
    );
    expect(releaseNotes({ ...base, lastNightShown: true, tonight: 3 })).toEqual(
      [{ text: COPY.skyQuiet.replace('{count}', '3'), ms: SKY.quietLineMs }]
    );
  });

  it('a newcomer on a quiet night gets both, the first one short, with no tap needed', () => {
    const notes = releaseNotes({
      ...base,
      firstEver: true,
      lastNightShown: true,
      tonight: 1,
    });
    expect(notes).toEqual([
      { text: COPY.skyJoin, ms: SKY.joinLineQueuedMs },
      { text: COPY.skyQuietFirst, ms: SKY.quietLineMs },
    ]);
    expect(SKY.joinLineQueuedMs).toBe(2000);
  });
});
