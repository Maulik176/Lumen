/**
 * "See others' islands": the top of the night's board, each with a small picture of the island
 * and the pieces as that player placed them, and the player's own island first to compare.
 * Tapping one lays those pieces on the real island, lit, to look at (nothing can be changed);
 * "All islands" goes back to the list.
 */
import type { OthersResponse } from '../../shared/api';
import type { Biome } from '../../shared/calendar';
import { BIOME_LOOK, COPY, OTHERS } from '../../shared/config';
import {
  crowdLine,
  emptyLine,
  othersRows,
  type Others,
  type Shown,
} from '../../shared/others';
import type { Placement } from '../../shared/types';
import { drawIslandOutline } from '../outline';
import { portrait } from './board';
import { element } from './hud';
import { css } from './kit';

export type { Others } from '../../shared/others';

export async function loadOthers(day: number): Promise<Others | null> {
  try {
    const response = await fetch(`/api/others?day=${day}`);
    const body: OthersResponse = await response.json();
    return body.ok ? body : null;
  } catch {
    return null;
  }
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
    const empty = emptyLine(others);
    if (empty !== null) list.append(element('p', 'sheet-empty', empty));
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
