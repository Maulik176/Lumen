/**
 * "See others' islands": the top of the night's board, each with a small picture of the island
 * and the pieces as that player placed them, and the player's own island first to compare.
 * Tapping one lays those pieces on the real island, lit, to look at (nothing can be changed);
 * "All islands" goes back to the list.
 */
import type { OtherIsland, OthersResponse } from '../../shared/api';
import type { Biome } from '../../shared/calendar';
import { BIOME_LOOK, COPY, OTHERS } from '../../shared/config';
import type { Placement } from '../../shared/types';
import { drawIslandOutline } from '../outline';
import { dayDetail, portrait } from './board';
import { element } from './hud';
import { css } from './kit';

export type Others = Extract<OthersResponse, { ok: true }>;

export async function loadOthers(day: number): Promise<Others | null> {
  try {
    const response = await fetch(`/api/others?day=${day}`);
    const body: OthersResponse = await response.json();
    return body.ok ? body : null;
  } catch {
    return null;
  }
}

/** The one line: how many hit par, or something gentler while there are only a few. */
export function crowdLine(others: Others, tonight: boolean): string {
  if (others.solves < OTHERS.fewSolves)
    return tonight ? COPY.crowdFew : COPY.crowdFewPast;
  const percent = Math.round((others.parHits / others.solves) * 100);
  return (tonight ? COPY.crowdPar : COPY.crowdParPast).replace(
    '{percent}',
    String(percent)
  );
}

type Shown = {
  rank: number | null;
  name: string;
  /** Whose portrait: a username, or null for the par answer (no portrait). */
  username: string | null;
  snoovatar: string;
  detail: string;
  /** Null for a solve whose pieces were never stored: named, but with nothing to show. */
  placements: Placement[] | null;
  mine: boolean;
};

function shownOf(entry: OtherIsland, name: string, mine: boolean): Shown {
  return {
    rank: entry.rank,
    name,
    username: entry.username,
    snoovatar: entry.snoovatar,
    detail: dayDetail(entry),
    placements: entry.placements,
    mine,
  };
}

/** Everything in the list, in order: the player's own island, the par answer, then the top. */
export function othersRows(others: Others, par: number): Shown[] {
  const rows: Shown[] = [];
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
    });
  for (const entry of others.top)
    rows.push(
      shownOf(
        entry,
        `u/${entry.username}`,
        own !== null && entry.username === own.username
      )
    );
  return rows;
}

export type OthersSheet = {
  /** Show one island's pieces on the real island; null puts the player's own back. */
  look: (placements: Placement[] | null) => void;
  /** Leave the list: back to the result card. */
  close: () => void;
  /** The sheet's height may have changed: reframe the island. */
  change: () => void;
};

export function othersSheet(
  others: Others | null,
  tonight: boolean,
  island: { rows: readonly string[]; biome: Biome; par: number },
  on: OthersSheet
): HTMLElement {
  const holder = element('div', 'sheet-body');
  holder.style.display = 'contents';
  const close = element('button', 'button button-quiet sheet-close', COPY.back);
  close.type = 'button';
  close.addEventListener('click', on.close);

  const line = (row: Shown, tappable: boolean): HTMLElement => {
    const node = element(
      tappable ? 'button' : 'div',
      row.mine
        ? 'sheet-row board-row others-row mine'
        : 'sheet-row board-row others-row'
    );
    const main = element('span', 'sheet-main');
    main.append(
      element('span', 'sheet-name', row.name),
      element('span', 'sheet-detail', row.detail)
    );
    // No stored pieces: an empty night tile keeps the column straight, and the row is not a button.
    const picture =
      row.placements === null
        ? element('span', 'others-preview others-missing')
        : element('canvas', 'others-preview');
    if (picture instanceof HTMLCanvasElement)
      drawIslandOutline(picture, island.rows, {
        width: OTHERS.previewWidth,
        height: OTHERS.previewHeight,
        lit: true,
        land: css(BIOME_LOOK[island.biome].groundA),
        pieces: row.placements ?? [],
      });
    node.append(
      element('span', 'board-rank', row.rank === null ? '' : String(row.rank)),
      row.username === null
        ? element('span', 'board-avatar others-par')
        : portrait(row.username, row.snoovatar),
      main,
      picture
    );
    return node;
  };

  const showList = (): void => {
    on.look(null);
    if (others === null) {
      holder.replaceChildren(
        element('h2', 'sheet-title', COPY.crowdLocked),
        close
      );
      on.change();
      return;
    }
    const rows = othersRows(others, island.par);
    const list = element('div', 'sheet-list');
    for (const row of rows) {
      const placements = row.placements;
      const node = line(row, placements !== null);
      if (placements !== null)
        node.addEventListener('click', () => showOne(row, placements));
      list.append(node);
    }
    const own = others.me?.username;
    if (
      others.top.every((entry) => entry.username === own) &&
      others.parSolution === null
    )
      list.append(element('p', 'sheet-empty', COPY.othersEmpty));
    holder.replaceChildren(
      element('h2', 'sheet-title', crowdLine(others, tonight)),
      element('p', 'sheet-empty crowd-hint', COPY.othersHint),
      list,
      close
    );
    on.change();
  };

  const showOne = (row: Shown, placements: Placement[]): void => {
    on.look(placements);
    const back = element('button', 'button button-main', COPY.othersList);
    back.type = 'button';
    back.addEventListener('click', showList);
    holder.replaceChildren(line(row, false), back, close);
    on.change();
  };

  showList();
  return holder;
}
