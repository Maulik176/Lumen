import { describe, expect, it } from 'vitest';
import { cleanPicture, readPostData } from './api';

const daily = {
  day: 3,
  name: 'Birch Steps',
  weekday: 'thursday',
  par: 3,
  lanterns: 2,
  rows: ['.W.', '>..', '...'],
};

describe("a post's data", () => {
  it('reads an old daily post, and a community one with its card snapshot', () => {
    expect(readPostData(daily)).toEqual(daily);
    expect(
      readPostData({
        ...daily,
        day: 1_000_007,
        kind: 'community',
        biome: 'snow',
        label: 'tricky',
        maker: 'ana',
        makerAvatar: 'https://example.com/a.png',
      })
    ).toMatchObject({ kind: 'community', maker: 'ana', makerAvatar: '' });
    expect(readPostData({ day: 0 })).toBeNull();
  });

  it("keeps a card picture only when Reddit hosts it (the card's CSP)", () => {
    const hosted = 'https://i.redd.it/abc123.webp';
    expect(readPostData({ ...daily, picture: hosted })).toMatchObject({
      picture: hosted,
    });
    expect(
      readPostData({ ...daily, picture: 'https://evil.com/x.png' })
    ).toEqual(daily);
    expect(cleanPicture('https://preview.redd.it/x.jpg?width=640')).toBe(
      'https://preview.redd.it/x.jpg?width=640'
    );
    expect(cleanPicture('http://i.redd.it/x.png')).toBe('');
    expect(cleanPicture('https://i.redd.it.evil.com/x.png')).toBe('');
    expect(cleanPicture('data:image/png;base64,AAAA')).toBe('');
  });
});
