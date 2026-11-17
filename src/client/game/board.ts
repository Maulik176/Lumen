/**
 * Tonight's board and the all-time board, in a paper sheet at the foot of the view. Each row has
 * the player's snoovatar, or a round seal with their first letter when there is none.
 */
import {
  cleanSnoovatar,
  type AllTimeRow,
  type BoardResponse,
  type BoardRow,
} from '../../shared/api';
import { COPY } from '../../shared/config';
import { formatTime } from './fit';
import { element } from './hud';

/** A repeatable hue (0 to 360) from a name, so each seal has its own colour. */
function hueOf(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++)
    sum = (sum * 31 + name.charCodeAt(i)) % 360;
  return sum;
}

export function portrait(username: string, snoovatar: string): HTMLElement {
  const address = cleanSnoovatar(snoovatar);
  if (address !== '') {
    const image = element('img', 'board-avatar');
    image.crossOrigin = 'anonymous';
    image.loading = 'lazy';
    image.alt = '';
    image.src = address;
    return image;
  }
  const seal = element(
    'span',
    'board-avatar board-seal',
    username.charAt(0).toUpperCase()
  );
  seal.style.borderColor = `hsl(${hueOf(username)} 55% 46%)`;
  return seal;
}

function row(
  rank: number | null,
  username: string,
  snoovatar: string,
  detail: string,
  mine: boolean
): HTMLElement {
  const line = element(
    'div',
    mine ? 'sheet-row board-row mine' : 'sheet-row board-row'
  );
  const main = element('span', 'sheet-main');
  main.append(
    element('span', 'sheet-name', `u/${username}`),
    element('span', 'sheet-detail', detail)
  );
  line.append(
    element('span', 'board-rank', rank === null ? '—' : String(rank)),
    portrait(username, snoovatar),
    main
  );
  return line;
}

export function dayDetail(entry: BoardRow): string {
  return (entry.pieces === 1 ? COPY.boardRowOne : COPY.boardRow)
    .replace('{pieces}', String(entry.pieces))
    .replace('{time}', formatTime(entry.timeMs));
}

function allTimeDetail(entry: AllTimeRow): string {
  return (entry.medals === 1 ? COPY.allTimeRowOne : COPY.allTimeRow).replace(
    '{medals}',
    String(entry.medals)
  );
}

async function load(
  day: number,
  scope: 'day' | 'alltime'
): Promise<BoardResponse | null> {
  try {
    const response = await fetch(`/api/leaderboard?day=${day}&scope=${scope}`);
    const body: BoardResponse = await response.json();
    return body.ok ? body : null;
  } catch {
    return null;
  }
}

/**
 * The sheet. `username` marks the player's own row. `onChange` is called when its height may
 * have changed, so the island can be reframed.
 */
export function boardSheet(
  day: number,
  username: string | null,
  onClose: () => void,
  onChange: () => void
): HTMLElement {
  const holder = element('div', 'sheet-body');
  holder.style.display = 'contents';
  const tabs = element('div', 'board-tabs');
  tabs.setAttribute('role', 'tablist');
  const list = element('div', 'sheet-list');
  const close = element('button', 'button button-quiet sheet-close', COPY.back);
  close.type = 'button';
  close.addEventListener('click', onClose);

  let shown: 'day' | 'alltime' = 'day';
  const show = async (scope: 'day' | 'alltime'): Promise<void> => {
    shown = scope;
    for (const tab of tabs.children)
      tab.setAttribute(
        'aria-selected',
        String(tab.getAttribute('data-scope') === scope)
      );
    const board = await load(day, scope);
    if (shown !== scope) return;
    const rows: HTMLElement[] = [];
    if (board?.scope === 'day') {
      for (const entry of board.top)
        rows.push(
          row(
            entry.rank,
            entry.username,
            entry.snoovatar,
            dayDetail(entry),
            entry.username === username
          )
        );
      if (board.me !== null)
        rows.push(
          row(
            board.me.rank,
            board.me.username,
            board.me.snoovatar,
            dayDetail(board.me),
            true
          )
        );
    } else if (board?.scope === 'alltime') {
      for (const entry of board.top)
        rows.push(
          row(
            entry.rank,
            entry.username,
            entry.snoovatar,
            allTimeDetail(entry),
            entry.username === username
          )
        );
      if (board.me !== null)
        rows.push(
          row(
            board.me.rank,
            board.me.username,
            board.me.snoovatar,
            allTimeDetail(board.me),
            true
          )
        );
    }
    list.replaceChildren(
      ...(rows.length > 0
        ? rows
        : [
            element(
              'p',
              'sheet-empty',
              board === null ? COPY.loadFailed : COPY.boardEmpty
            ),
          ])
    );
    onChange();
  };

  for (const [scope, label] of [
    ['day', COPY.boardTonight],
    ['alltime', COPY.boardAllTime],
  ] as const) {
    const tab = element('button', 'board-tab', label);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset['scope'] = scope;
    tab.addEventListener('click', () => void show(scope));
    tabs.append(tab);
  }
  list.append(element('p', 'sheet-empty', '…'));
  holder.append(
    element('h2', 'sheet-title', COPY.boardTitle),
    tabs,
    list,
    close
  );
  void show('day');
  return holder;
}
