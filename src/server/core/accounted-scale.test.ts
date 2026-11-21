/**
 * Everyone accounted for at launch scale (Nov 21, the busy-night bug): nights of 10, 150 and 500
 * players, 60-90% on the par answer, every seat, daily, community and picked-Sunday islands.
 * `npm run checks` runs this file by name, so a release refuses to upload without it.
 */
import { describe, it } from 'vitest';
import { communityNumber } from '../../shared/community';
import { checkNight, daily } from './accounted-support';

describe('at launch scale (Nov 21: the busy-night bug)', () => {
  it("the video session's night: 141 players, most at par, nobody missing", async () => {
    await checkNight({
      seed: 'busy-141',
      players: 141,
      resets: 0,
      tooFast: false,
      island: daily(2),
      maker: null,
      later: false,
    });
  });

  // Nights of 10, 150 and 500 players, 60 to 90% on the par answer, every seat. Some offer few
  // boards (all fit the list: everyone accounted for), some many (the list shows exactly the
  // best ten others, with true counts).
  const scale = [
    { players: 10, parShare: 0.9, boards: 4 },
    { players: 150, parShare: 0.75, boards: 4 },
    { players: 150, parShare: 0.6, boards: 30 },
    { players: 500, parShare: 0.9, boards: 4 },
    { players: 500, parShare: 0.6, boards: 30 },
  ];
  for (const night of scale)
    it(`a daily night of ${night.players} players, ${night.parShare * 100}% at par, ${night.boards} boards`, async () => {
      await checkNight({
        ...night,
        seed: `scale-${night.players}-${night.boards}`,
        resets: 2,
        tooFast: true,
        island: daily(2),
        maker: null,
        later: false,
      });
    }, 120_000);

  it('a community island with 500 players, 80% at par, many boards, the maker pinned', async () => {
    await checkNight({
      seed: 'scale-community',
      players: 500,
      parShare: 0.8,
      boards: 30,
      resets: 1,
      tooFast: false,
      island: { ...daily(2), day: communityNumber(7) },
      maker: 'maker',
      later: false,
    });
  }, 120_000);

  it('a picked Sunday with 150 players, its maker among them', async () => {
    await checkNight({
      seed: 'scale-sunday',
      players: 150,
      parShare: 0.7,
      boards: 12,
      resets: 0,
      tooFast: false,
      island: daily(6),
      maker: 'p0',
      sundayMaker: true,
      later: false,
    });
  }, 120_000);
});
