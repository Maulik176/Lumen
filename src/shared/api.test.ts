import { describe, expect, it } from 'vitest';
import { cleanPicture, readPostData, toSundayPostData } from './api';
import type { PlayableIsland } from './daily';

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

describe('a Sunday picked from the community (Phase 3)', () => {
  it("is a daily post with its maker's world and credit, read back as such, under 1 KB", () => {
    const island: PlayableIsland = {
      day: 6,
      date: '2026-11-29',
      weekday: 'sunday',
      biome: 'blossom',
      name: 'Ember Bend',
      rows: ['>...', '....', '...W', '....'],
      inventory: { mirrors: 2, prisms: 0 },
      sourceColours: ['white'],
      par: 2,
      solution: [],
    };
    const data = toSundayPostData(island, {
      maker: 'mohak2605',
      makerAvatar: 'https://i.redd.it/snoovatar/avatars/abc.png',
      label: 'tricky',
    });
    expect(data).toMatchObject({
      kind: 'sunday',
      day: island.day,
      biome: 'blossom',
      maker: 'mohak2605',
    });
    expect(readPostData(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(JSON.stringify(data).length).toBeLessThan(1024);
  });
});
