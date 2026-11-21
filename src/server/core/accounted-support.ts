/**
 * Test support for the "everyone accounted for" suites (accounted.test.ts, and the launch-scale
 * nights in accounted-scale.test.ts). Not a test file; never imported by the server.
 *
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
import { expect } from 'vitest';
import { boardId, boardKey } from '../../shared/community';
import { LEADERBOARD, OTHERS, SKY } from '../../shared/config';
import type { DailyIsland, PlayableIsland } from '../../shared/daily';
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

export function daily(day: number): DailyIsland {
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

export async function checkNight(input: {
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
  /** Share of players on the par answer (default 0.6), and boards on offer (default 4). */
  parShare?: number;
  boards?: number;
}): Promise<void> {
  const { island } = input;
  const store = memoryStore();
  const night = await seedCrowd(store, island, {
    players: input.players,
    seed: input.seed,
    resets: input.resets,
    tooFast: input.tooFast,
    lastDay: lastDay(),
    ...(input.parShare === undefined ? {} : { parShare: input.parShare }),
    ...(input.boards === undefined ? {} : { boards: input.boards }),
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
  // The shared sky draws the newest SKY.maxLanterns lanterns (one draw call): every one a ranked
  // player, each once; the count says how many lit it in all.
  const skyNames = sky.lanterns.map((l) => l.u);
  expect(skyNames.length, input.seed).toBe(
    Math.min(ranked.length, SKY.maxLanterns)
  );
  expect(new Set(skyNames).size, input.seed).toBe(skyNames.length);
  for (const name of skyNames)
    expect(boardOf.has(name), `${input.seed}: ${name} in the sky`).toBe(true);
  if (island.day < 900) {
    const [past] = await pastIslands(store, null, [daily(island.day)]);
    expect(past?.solves, input.seed).toBe(ranked.length);
  }

  // The boards in the order the list shows them: by each board's best player (lowest score).
  const boardRows = await store.zRange(
    KEYS.leaderboard(island.day),
    0,
    Math.max(0, ranked.length - 1)
  );
  const bestOf = new Map<string, { score: number; id: string }>();
  for (const row of boardRows) {
    const key = boardOf.get(row.member);
    if (key === undefined) continue;
    const known = bestOf.get(key);
    if (known === undefined || row.score < known.score)
      bestOf.set(key, { score: row.score, id: boardId(key) });
  }
  const boardOrder = [...bestOf.entries()]
    .sort((a, b) => a[1].score - b[1].score || a[1].id.localeCompare(b[1].id))
    .map(([key]) => key);
  const groupSize = (key: string): number =>
    ranked.filter((p) => boardOf.get(p.username) === key).length;
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
      skyNames.length - (skyNames.includes(seat.name) ? 1 : 0)
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
    // However many boards: the rows are exactly the best other boards, each with its true count.
    const otherRows = players.filter((row) => !row.mine);
    expect(
      otherRows.map((row) => boardKey(row.placements ?? [])),
      where(seat)
    ).toEqual(boardOrder.filter((key) => key !== myBoard).slice(0, OTHERS.top));
    for (const row of otherRows)
      expect(row.players, where(seat)).toBe(
        groupSize(boardKey(row.placements ?? []))
      );

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
