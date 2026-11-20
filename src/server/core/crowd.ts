/**
 * A realistic night on one island, played through the real Lock in on any store. Used by the
 * "everyone accounted for" tests and by the local stand-in's crowd mode, so both look at what a
 * busy post really holds, never at hand-made rows.
 *
 * What makes it realistic (Nov 20, after a stranger went missing from "See others' islands"):
 * most players place exactly the par answer, so identical boards are the common case; others add
 * a spare mirror or two; some only practise; one may be too fast to believe; a moderator may
 * reset and play again.
 */
import { CALENDAR, SCORING } from '../../shared/config';
import { puzzleOfDaily, type PlayableIsland } from '../../shared/daily';
import { createRng } from '../../shared/rng';
import { trace } from '../../shared/trace';
import type { Placement } from '../../shared/types';
import { lockIn, recordStart, resetPlayer, type Effects } from './game';
import type { Store } from './store';

const MS_PER_DAY = 86_400_000;

export type CrowdPlayer = {
  userId: string;
  username: string;
  /** The board they locked in, as it was stored (the last one, after a reset and replay). */
  board: Placement[];
  /** A ranked Lock in (not a practice solve). */
  ranked: boolean;
};

export type CrowdNight = {
  players: CrowdPlayer[];
  /** A moment inside the island's own night, for reading lists as the players would. */
  nowMs: number;
};

export type CrowdOptions = {
  players: number;
  seed: string;
  /** Share of players who place exactly the par answer (default 0.6). */
  parShare?: number;
  /** Share who only practise (default 0.1). */
  practiceShare?: number;
  /** One player locks in faster than anyone could (default false). */
  tooFast?: boolean;
  /** Ranked players reset by a moderator who then play again (default 0). */
  resets?: number;
  /** Prefix for made-up usernames (default "p"). */
  prefix?: string;
  /** The number the post is for (default the island's own). */
  lastDay: number;
};

/**
 * Boards that light the island: the par answer, then the same with one or two spare mirrors on
 * tiles the light never needs. At most `count`.
 */
export function crowdBoards(
  island: PlayableIsland,
  count: number
): Placement[][] {
  const puzzle = puzzleOfDaily(island);
  const boards: Placement[][] = [island.solution];
  const spare: Placement[] = [];
  island.rows.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      if (tile !== '.') return;
      if (island.solution.some((p) => p.x === x && p.y === y)) return;
      for (const orientation of ['slash', 'backslash'] as const) {
        const extra: Placement = {
          x,
          y,
          piece: { kind: 'mirror', orientation },
        };
        if (trace(puzzle, [...island.solution, extra]).solved) {
          spare.push(extra);
          return;
        }
      }
    })
  );
  const stock =
    island.inventory.mirrors -
    island.solution.filter((p) => p.piece.kind === 'mirror').length;
  for (const extra of spare) {
    if (boards.length >= count || stock < 1) break;
    boards.push([...island.solution, extra]);
  }
  for (let i = 0; i + 1 < spare.length && stock >= 2; i += 2) {
    if (boards.length >= count) break;
    const one = spare[i];
    const two = spare[i + 1];
    if (one === undefined || two === undefined) continue;
    const board = [...island.solution, one, two];
    if (trace(puzzle, board).solved) boards.push(board);
  }
  return boards;
}

/** The start of an island's night (a community island has none: any moment is its own). */
export function nightStart(island: PlayableIsland): number {
  const [year, month, date] = CALENDAR.dayOne.split('-').map(Number);
  const dayOne = Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1);
  return island.day < 900 ? dayOne + (island.day - 1) * MS_PER_DAY : dayOne;
}

const quiet: Effects = { onRanked: async () => undefined };

/** Play a night: every player starts, then locks in, in board order of their time. */
export async function seedCrowd(
  store: Store,
  island: PlayableIsland,
  options: CrowdOptions
): Promise<CrowdNight> {
  const rng = createRng(options.seed);
  const boards = crowdBoards(island, 4);
  const parShare = options.parShare ?? 0.6;
  const practiceShare = options.practiceShare ?? 0.1;
  const prefix = options.prefix ?? 'p';
  const start = nightStart(island) + 60_000;
  const players: CrowdPlayer[] = [];
  const play = async (
    player: CrowdPlayer,
    startedMs: number,
    nowMs: number
  ): Promise<void> => {
    await recordStart(store, player, island.day, startedMs);
    await lockIn(
      store,
      player,
      {
        island,
        placements: player.board,
        snoovatar: undefined,
        wantsRanked: player.ranked,
        postDay: island.day,
        lastDay: options.lastDay,
        nowMs,
      },
      quiet
    );
  };
  for (let i = 0; i < options.players; i++) {
    const board =
      rng.chance(parShare) || boards.length === 1
        ? island.solution
        : (boards[1 + rng.int(boards.length - 1)] ?? island.solution);
    const player: CrowdPlayer = {
      userId: `t2_${prefix}${i}`,
      username: `${prefix}${i}`,
      board,
      ranked: !rng.chance(practiceShare),
    };
    players.push(player);
    const fast = options.tooFast === true && i === 1;
    const took = fast
      ? SCORING.minPlausibleMs - 1_000
      : 20_000 + rng.int(240_000);
    const startedMs = start + i * 30_000;
    await play(player, startedMs, startedMs + took);
  }
  // A moderator's dev reset, then the same player again, perhaps with another board.
  const ranked = players.filter((player) => player.ranked);
  for (let r = 0; r < (options.resets ?? 0) && ranked.length > 0; r++) {
    const player = rng.pick(ranked);
    await resetPlayer(store, player, island.day);
    player.board = rng.pick(boards);
    const startedMs = start + options.players * 30_000 + r * 60_000;
    await play(player, startedMs, startedMs + 30_000 + rng.int(60_000));
  }
  return {
    players,
    nowMs: start + options.players * 30_000 + 3_600_000,
  };
}
