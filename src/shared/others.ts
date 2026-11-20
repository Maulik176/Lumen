/**
 * What "See others' islands" shows a viewer, as plain data: the rows in order, what each says,
 * how many players each stands for, and the lines around them. Pure, so the server's list can be
 * run through exactly what the phone shows in one test (tests/accounted, src/server/core).
 */
import type { BoardRow, OtherIsland, OthersResponse } from './api';
import { isCommunity } from './community';
import { COPY, OTHERS } from './config';
import type { Placement } from './types';

export type Others = Extract<OthersResponse, { ok: true }>;

/** Minutes and seconds, rounded, as 1:42 (the board and the result card). */
export function formatTime(elapsedMs: number): string {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "4 pieces · 0:17": one row of a board. */
export function dayDetail(entry: BoardRow): string {
  return (entry.pieces === 1 ? COPY.boardRowOne : COPY.boardRow)
    .replace('{pieces}', String(entry.pieces))
    .replace('{time}', formatTime(entry.timeMs));
}

/** The one line: how many hit par, or something gentler while there are only a few. */
export function crowdLine(others: Others, tonight: boolean): string {
  // A community island has no nights to speak of. (A Sunday picked from the community has a
  // maker's row too, but it is a daily island with a night.)
  const island = isCommunity(others.day);
  if (others.solves < OTHERS.fewSolves)
    return island
      ? COPY.crowdFewIsland
      : tonight
        ? COPY.crowdFew
        : COPY.crowdFewPast;
  // Never above 100: par hits are counted apart from solves, and a count can lag.
  const percent = Math.round(
    (Math.min(others.parHits, others.solves) / others.solves) * 100
  );
  return (
    island ? COPY.crowdParIsland : tonight ? COPY.crowdPar : COPY.crowdParPast
  ).replace('{percent}', String(percent));
}

export type Shown = {
  rank: number | null;
  name: string;
  /** Whose portrait: a username, or null for the par answer (no portrait). */
  username: string | null;
  snoovatar: string;
  detail: string;
  /** Null for a solve whose pieces were never stored: named, but with nothing to show. */
  placements: Placement[] | null;
  mine: boolean;
  /**
   * Ranked players this row stands for: everyone who placed its board (the viewer's own row
   * counts the viewer too). 0 for the maker's test and the par answer, which are not Lock ins.
   */
  players: number;
};

/** "same as u/ana and 2 others": who else placed exactly the viewer's board. */
export function sameAsLine(name: string | undefined, others: number): string {
  if (name === undefined)
    return others === 1
      ? COPY.othersSameCountOne
      : COPY.othersSameCount.replace('{count}', String(others));
  if (others <= 1) return COPY.othersSameAs.replace('{name}', name);
  if (others === 2) return COPY.othersSameAsOne.replace('{name}', name);
  return COPY.othersSameAsMany
    .replace('{name}', name)
    .replace('{count}', String(others - 1));
}

function shownOf(entry: OtherIsland, name: string, mine: boolean): Shown {
  const same = Math.max(1, entry.same ?? 1);
  // The viewer's row names who else placed the same board; any other row that stands for
  // several players says how many.
  const extra = mine
    ? same > 1
      ? sameAsLine(entry.sameAs, same - 1)
      : null
    : same > 1
      ? COPY.samePlayers.replace('{count}', String(same))
      : null;
  return {
    rank: entry.rank,
    name,
    username: entry.username,
    snoovatar: entry.snoovatar,
    detail:
      extra === null ? dayDetail(entry) : `${dayDetail(entry)} \u00b7 ${extra}`,
    placements: entry.placements,
    mine,
    players: same,
  };
}

/**
 * The line under the list when it has no other rows: nobody else yet, or everyone else placed
 * exactly the viewer's board (they are counted on the viewer's row). Null when there are rows.
 */
export function emptyLine(others: Others): string | null {
  if (others.top.length > 0 || others.parSolution !== null) return null;
  return (others.me?.same ?? 1) > 1 ? COPY.othersAllSame : COPY.othersEmpty;
}

/**
 * Everything in the list, in order: on a community island the maker's own test first, then the
 * player's own island, the par answer (an earlier night only), then the top of the board.
 */
export function othersRows(others: Others, par: number): Shown[] {
  const rows: Shown[] = [];
  const creator = others.creator;
  if (creator !== null)
    rows.push({
      ...shownOf(
        creator,
        isCommunity(others.day) ? COPY.creatorBoard : COPY.makerBoard,
        false
      ),
      detail: `u/${creator.username} \u00b7 ${dayDetail(creator)}`,
      players: 0,
    });
  const own = others.me;
  if (own !== null) rows.push(shownOf(own, COPY.othersMine, true));
  if (others.parSolution !== null)
    rows.push({
      rank: null,
      name: COPY.othersPar,
      username: null,
      snoovatar: '',
      detail: COPY.othersParDetail.replace('{par}', String(par)),
      placements: others.parSolution,
      mine: false,
      players: 0,
    });
  // The server leaves out every board the same as the viewer's (folded into their row above).
  for (const entry of others.top)
    rows.push(shownOf(entry, `u/${entry.username}`, false));
  return rows;
}
