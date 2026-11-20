/**
 * Everyone accounted for (rule added Nov 20, after a stranger went missing from "See others'
 * islands"). Realistic nights are played through the real Lock in (`crowd.ts`), then every list
 * and count a player can see is read from every seat, the way the phone shows it:
 *
 *   See others' islands   readOthers on the server, then othersRows/emptyLine/crowdLine (shared)
 *   the board             readLeaderboard
 *   the sky               readSky, then othersInSky (what the viewer's sky draws)
 *   the counts            skyCount (feed card, results comment, Archipelago, Your islands),
 *                         stats par hits, the player's own rank
 *
 * The rule: every ranked player is on each list exactly once (by name, inside "N players", or
 * folded into the viewer's own row), nobody who only practised is, and every count agrees.
 */
import { describe, expect, it } from 'vitest';
import { communityNumber, boardKey } from '../../shared/community';
import { LEADERBOARD, OTHERS } from '../../shared/config';
import type { DailyIsland, PlayableIsland } from '../../shared/daily';
import { createRng } from '../../shared/rng';
import { othersInSky } from '../../shared/skyspot';
import { crowdLine, emptyLine, othersRows } from '../../shared/others';
import type { OtherIsland } from '../../shared/api';
import { islandForDay, lastDay } from './content';
import { seedCrowd, type CrowdPlayer } from './crowd';
import {
  pastIslands,
  playerState,
  readLeaderboard,
  readOthers,
  readSky,
  skyCount,
  type Player,
} from './game';
import { memoryStore } from './memory-store';
import { KEYS } from './store';

const DAY = 86_400_000;

function daily(day: number): DailyIsland {
  const found = islandForDay(day);
  if (found === undefined) throw new Error(`no island ${day}`);
  return found;
}

type Seat = {
  name: string;
  player: Player;
  ranked: boolean;
  /** The server kept their Lock in (ranked, or the maker's own on a picked Sunday). */
  kept: boolean;
  maker: boolean;
};

/** Every seat at the night: each player who came, someone signed out, and the maker if any. */
function seats(players: CrowdPlayer[], maker: string | null): Seat[] {
  const list: Seat[] = players.map((p) => ({
    name: p.username,
    player: { userId: p.userId, username: p.username },
    ranked: p.ranked,
    kept: p.kept,
    maker: p.username === maker,
  }));
  list.push({
    name: 'signed out',
    player: null,
    ranked: false,
    kept: false,
    maker: false,
  });
  if (maker !== null && !players.some((p) => p.username === maker))
    list.push({
      name: maker,
      player: { userId: `t2_${maker}`, username: maker },
      ranked: false,
      kept: false,
      maker: true,
    });
  return list;
}

async function checkNight(input: {
  island: PlayableIsland;
  seed: string;
  players: number;
  resets: number;
  tooFast: boolean;
  /** A community island: the maker's test is pinned first. */
  maker: string | null;
  /** Read the lists the next day, when the night is over (daily islands only). */
  later: boolean;
  /**
   * A daily Sunday picked from the community whose maker (one of the crowd) plays it too: kept,
   * not ranked, streak continued (PHASE3_PLAN.md E5).
   */
  sundayMaker?: boolean;
}): Promise<void> {
  const { island } = input;
  const store = memoryStore();
  const night = await seedCrowd(store, island, {
    players: input.players,
    seed: input.seed,
    resets: input.resets,
    tooFast: input.tooFast,
    lastDay: lastDay(),
    ...(input.sundayMaker === true && input.maker !== null
      ? { maker: input.maker }
      : {}),
  });
  const nowMs = night.nowMs + (input.later ? DAY : 0);
  const ranked = night.players.filter((p) => p.ranked);
  const boardOf = new Map(ranked.map((p) => [p.username, boardKey(p.board)]));
  const distinct = new Set(boardOf.values()).size;
  const atPar = ranked.filter((p) => p.board.length <= island.par).length;
  const creator: OtherIsland | null =
    input.maker === null
      ? null
      : {
          rank: null,
          username: input.maker,
          snoovatar: '',
          pieces: island.par,
          timeMs: 30_000,
          placements: island.solution,
        };
  const where = (seat: Seat) =>
    `${input.seed} (${input.players} players, ${distinct} boards), seat ${seat.name}`;

  // The counts every surface shows agree with the night itself.
  expect(await skyCount(store, island.day), input.seed).toBe(ranked.length);
  const stats = await store.hGetAll(KEYS.stats(island.day));
  expect(Number(stats['solves'] ?? 0), input.seed).toBe(ranked.length);
  expect(Number(stats['parHits'] ?? 0), input.seed).toBe(atPar);
  const sky = await readSky(store, island.day);
  expect(sky.count, input.seed).toBe(ranked.length);
  expect(sky.lanterns.map((l) => l.u).sort(), input.seed).toEqual(
    ranked.map((p) => p.username).sort()
  );
  if (island.day < 900) {
    const [past] = await pastIslands(store, null, [daily(island.day)]);
    expect(past?.solves, input.seed).toBe(ranked.length);
  }

  const keptBoard = new Map(
    night.players
      .filter((p) => p.kept)
      .map((p) => [p.username, boardKey(p.board)])
  );
  for (const seat of seats(night.players, input.maker)) {
    const me = seat.player;
    const myBoard = seat.kept ? keptBoard.get(seat.name) : undefined;
    const sameAsMine = ranked.filter(
      (p) => boardOf.get(p.username) === myBoard
    );

    // The board: each ranked player once, the viewer once, nobody who only practised.
    const board = await readLeaderboard(
      store,
      island.day,
      me?.username ?? null
    );
    expect(board.total, where(seat)).toBe(ranked.length);
    expect(board.top.length, where(seat)).toBe(
      Math.min(LEADERBOARD.top, ranked.length)
    );
    const onBoard = [...board.top, ...(board.me === null ? [] : [board.me])];
    const names = onBoard.map((row) => row.username);
    expect(new Set(names).size, where(seat)).toBe(names.length);
    for (const name of names)
      expect(boardOf.has(name), `${where(seat)}: ${name}`).toBe(true);
    if (seat.ranked)
      expect(
        names.filter((n) => n === seat.name),
        where(seat)
      ).toHaveLength(1);
    board.top.forEach((row, index) =>
      expect([null, index + 1], where(seat)).toContain(row.rank)
    );
    const myBoardRow = onBoard.find((row) => row.username === seat.name);

    // The maker's own Sunday: kept, never ranked, no place, but the streak goes on (E5).
    if (seat.kept && !seat.ranked) {
      const state = await playerState(store, me, island.day);
      expect(state.result, where(seat)).toMatchObject({
        ranked: false,
        maker: true,
        rank: 0,
      });
      expect(state.streak, where(seat)).toBeGreaterThanOrEqual(1);
      expect(names, where(seat)).not.toContain(seat.name);
    }
    // The player's own result says the same place as the board.
    if (seat.ranked) {
      const state = await playerState(store, me, island.day);
      expect(state.result?.ranked, where(seat)).toBe(true);
      // No place on the board (a time too fast to believe) is 0: no place on the card either.
      expect(state.result?.rank, where(seat)).toBe(myBoardRow?.rank ?? 0);
    }

    // The sky draws every other ranked player once, never the viewer twice.
    const drawn = othersInSky(sky.lanterns, me?.username ?? null).map(
      (l) => l.u
    );
    expect(new Set(drawn).size, where(seat)).toBe(drawn.length);
    expect(drawn.length, where(seat)).toBe(
      ranked.length - (seat.ranked ? 1 : 0)
    );

    // See others' islands.
    const others = await readOthers(
      store,
      me,
      island,
      nowMs,
      lastDay(),
      creator
    );
    const over = input.later && island.day < 900;
    const opens = seat.ranked || seat.maker || over;
    expect(others.ok, where(seat)).toBe(opens);
    if (!others.ok) continue;
    expect(others.solves, where(seat)).toBe(ranked.length);
    expect(others.parHits, where(seat)).toBe(atPar);
    const line = crowdLine({ ...others, day: island.day }, !input.later);
    if (ranked.length >= OTHERS.fewSolves)
      expect(line, where(seat)).toContain(
        `${Math.round((atPar / ranked.length) * 100)}%`
      );

    const rows = othersRows({ ...others, day: island.day }, island.par);
    const players = rows.filter((row) => row.players > 0);
    const shown = players.map((row) => boardKey(row.placements ?? []));
    // No board twice; the viewer's own board only on their own row.
    expect(new Set(shown).size, where(seat)).toBe(shown.length);
    const own = rows.find((row) => row.mine);
    expect(own !== undefined, where(seat)).toBe(seat.kept);
    // The maker's own row counts the maker, who is on no board.
    const extra = own !== undefined && !seat.ranked ? 1 : 0;
    if (own !== undefined && myBoard !== undefined) {
      expect(boardKey(own.placements ?? []), where(seat)).toBe(myBoard);
      expect(own.players, where(seat)).toBe(sameAsMine.length + extra);
      const named = /same as u\/(\S+)/.exec(own.detail)?.[1];
      if (sameAsMine.length + extra > 1) {
        expect(own.detail, where(seat)).toContain('same as');
        if (named !== undefined) {
          expect(named, where(seat)).not.toBe(seat.name);
          expect(boardOf.get(named), where(seat)).toBe(myBoard);
        }
      } else expect(own.detail, where(seat)).not.toContain('same as');
    }
    // Everyone accounted for, exactly once, while the list has room for every board.
    const room = OTHERS.top + (own === undefined ? 0 : 1);
    const counted = players.reduce((sum, row) => sum + row.players, 0);
    if (distinct <= room) {
      expect(counted, where(seat)).toBe(ranked.length + extra);
      for (const player of ranked)
        expect(
          shown.includes(boardOf.get(player.username) ?? ''),
          `${where(seat)}: ${player.username} missing`
        ).toBe(true);
    } else
      expect(counted, where(seat)).toBeLessThanOrEqual(ranked.length + extra);

    // The empty line only when nobody else is on the list at all.
    const others2 = players.filter((row) => !row.mine);
    const empty = emptyLine({ ...others, day: island.day });
    if (others2.length > 0 || others.parSolution !== null)
      expect(empty, where(seat)).toBeNull();
    else if (ranked.length + extra > (seat.kept ? 1 : 0))
      expect(empty, where(seat)).toContain('just as you');
    else expect(empty, where(seat)).toContain('No other');
  }
}

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
