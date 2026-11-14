/**
 * "Explore past islands": a list of earlier islands, newest first, with the medal the player
 * earned on each night they played. Tapping one opens it for practice over tonight's island.
 */
import type { PastIsland } from '../../shared/api';
import { weekdayLabel } from '../../shared/calendar';
import { COPY } from '../../shared/config';
import type { Medal } from '../../shared/types';
import { element } from './hud';

const MEDAL_NAME: Record<Medal, string> = {
  lamplighter: COPY.medalLamplighter,
  glow: COPY.medalGlow,
  spark: COPY.medalSpark,
};

export function pastSheet(
  islands: readonly PastIsland[] | null,
  onPick: (day: number) => void,
  onClose: () => void
): HTMLElement {
  const holder = element('div', 'sheet-body');
  holder.style.display = 'contents';
  const list = element('div', 'sheet-list');
  if (islands === null || islands.length === 0) {
    list.append(
      element(
        'p',
        'sheet-empty',
        islands === null ? COPY.loadFailed : COPY.pastEmpty
      )
    );
  }
  for (const island of islands ?? []) {
    const row = element('button', 'sheet-row');
    row.type = 'button';
    const main = element('span', 'sheet-main');
    main.append(
      element('span', 'sheet-name', island.name),
      element(
        'span',
        'sheet-detail',
        `Lumen #${island.day} · ${weekdayLabel(island.weekday)} · par ${island.par}`
      )
    );
    const side = element(
      'span',
      'sheet-side',
      island.medal === null ? '' : MEDAL_NAME[island.medal]
    );
    if (island.medal !== null) side.dataset['medal'] = island.medal;
    row.append(main, side);
    row.addEventListener('click', () => onPick(island.day));
    list.append(row);
  }
  const close = element('button', 'button button-quiet sheet-close', COPY.back);
  close.type = 'button';
  close.addEventListener('click', onClose);
  holder.append(element('h2', 'sheet-title', COPY.pastTitle), list, close);
  return holder;
}
