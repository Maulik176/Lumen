/** Everyone accounted for, from every seat: the nights of up to 40 players. Scale: accounted-scale.test.ts. */
import { describe, it } from 'vitest';
import { communityNumber } from '../../shared/community';
import { createRng } from '../../shared/rng';
import { checkNight, daily } from './accounted-support';

describe('everyone accounted for, on every list and count, from every seat', () => {
  const rng = createRng('accounted');
  const nights = Array.from({ length: 24 }, (_, i) => ({
    seed: `night-${i}`,
    players: rng.range(1, 16),
    resets: rng.int(3),
    tooFast: rng.chance(0.3),
  }));

  it('on a daily island, tonight', async () => {
    for (const night of nights)
      await checkNight({
        ...night,
        island: daily(1 + (night.players % 6)),
        maker: null,
        later: false,
      });
  });

  it('on a daily island, the next day (open to all, with the par answer)', async () => {
    for (const night of nights.slice(0, 8))
      await checkNight({
        ...night,
        island: daily(1 + (night.players % 6)),
        maker: null,
        later: true,
      });
  });

  it("on a community island, with the maker's test pinned", async () => {
    for (const night of nights.slice(0, 12))
      await checkNight({
        ...night,
        island: { ...daily(2), day: communityNumber(1 + (night.players % 3)) },
        maker: 'maker',
        later: false,
      });
  });

  it('on a busy night with more boards than the list shows', async () => {
    await checkNight({
      seed: 'busy',
      players: 40,
      resets: 2,
      tooFast: true,
      island: daily(5),
      maker: null,
      later: false,
    });
  });

  it('on a Sunday picked from the community, its maker playing it too (E5)', async () => {
    for (const night of nights.slice(0, 12))
      await checkNight({
        ...night,
        players: Math.max(2, night.players),
        island: daily(6),
        maker: 'p0',
        sundayMaker: true,
        later: false,
      });
  });

  it("Maulik's Nov 20 night: he is first, a stranger has his board, the maker plays too", async () => {
    await checkNight({
      seed: 'blossom-3',
      players: 3,
      resets: 0,
      tooFast: false,
      island: { ...daily(1), day: communityNumber(3) },
      maker: 'p2',
      later: false,
    });
  });
});
