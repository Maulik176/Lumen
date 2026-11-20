/**
 * The Archipelago: a night map of every island before tonight's. Each floats on its rock, glows
 * brighter the more players lit it, and carries the player's medal if they lit it on its night.
 * Tapping one opens it for practice. Plain DOM and canvas 2D over the paused game: no WebGL.
 */
import type {
  CommunityResponse,
  PastIsland,
  ShelfIsland,
} from '../../shared/api';
import { monthDay, weekdayLabel } from '../../shared/calendar';
import { BIOME_LOOK, COPY, MAP, OTHERS, UI } from '../../shared/config';
import type { Medal } from '../../shared/types';
import { drawIslandOutline } from '../outline';
import { portrait } from './board';
import { element } from './hud';
import { css, noise } from './kit';

/** The Community view's data, and how to open an island's post (Phase 3, E9). */
export type MapCommunity = {
  load: (after: number) => Promise<CommunityResponse | null>;
  open: (url: string) => void;
};

const MEDAL_NAME: Record<Medal, string> = {
  lamplighter: COPY.medalLamplighter,
  glow: COPY.medalGlow,
  spark: COPY.medalSpark,
};

export type Archipelago = { close: () => void };

/** Stars and a slanting milky-way band, drawn once behind the islands. */
function drawSky(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const pen = canvas.getContext('2d');
  if (pen === null) return;
  pen.scale(ratio, ratio);
  const stars = Math.round((MAP.starsPerScreen * height) / 700);
  for (let i = 0; i < stars; i++) {
    // More stars near the band that runs from the top right down to the left.
    const along = noise(i, 81);
    const spread = (noise(i, 82) + noise(i, 83) - 1) * (i % 3 === 0 ? 1 : 0.35);
    const x = width * (0.85 - along * 0.7 + spread * 0.9);
    const y = height * (along + spread * 0.25);
    pen.globalAlpha = 0.25 + noise(i, 84) * 0.65;
    pen.fillStyle = UI.light;
    pen.beginPath();
    pen.arc(x, y, 0.5 + noise(i, 85) * 0.9, 0, Math.PI * 2);
    pen.fill();
  }
}

export function openArchipelago(
  islands: readonly PastIsland[] | null,
  calm: boolean,
  onPick: (day: number) => void,
  onClose: () => void,
  /** Opens the Island Builder; no button when absent. */
  onBuild?: () => void,
  /** The Community view; no "Nights · Community" switch when absent. */
  community?: MapCommunity
): Archipelago {
  const layer = element('div', calm ? 'layer map calm' : 'layer map');
  const sea = element('div', 'map-sea');
  const sky = element('canvas', 'map-sky');
  const list = islands ?? [];
  const tall = Math.max(
    window.innerHeight,
    MAP.topPx + list.length * MAP.rowPx + MAP.rowPx / 2
  );
  const wide = Math.min(window.innerWidth, MAP.maxWidthPx);
  sea.style.height = `${tall}px`;
  sea.style.width = `${wide}px`;
  drawSky(sky, wide, tall);
  sea.append(sky);

  // Where each island floats: newest at the top, winding down the map.
  const spots = list.map((_island, index) => ({
    // Left, right, left: each a little nearer or further than the last.
    x:
      wide / 2 +
      (index % 2 === 0 ? 1 : -1) *
        wide *
        MAP.sway *
        (0.55 + 0.45 * noise(index, 87)),
    y: MAP.topPx + index * MAP.rowPx,
  }));
  const busiest = Math.max(1, ...list.map((island) => island.solves));

  // A dotted route from island to island.
  if (spots.length > 1) {
    const route = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    route.setAttribute('class', 'map-route');
    route.setAttribute('width', String(wide));
    route.setAttribute('height', String(tall));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute(
      'd',
      spots
        .map((spot, index) => {
          const before = spots[index - 1];
          if (before === undefined) return `M${spot.x} ${spot.y}`;
          const middle = (before.y + spot.y) / 2;
          return `C${before.x} ${middle} ${spot.x} ${middle} ${spot.x} ${spot.y}`;
        })
        .join(' ')
    );
    route.append(line);
    sea.append(route);
  }

  list.forEach((island, index) => {
    const spot = spots[index];
    if (spot === undefined) return;
    const button = element('button', 'map-island');
    button.type = 'button';
    button.style.left = `${spot.x}px`;
    button.style.top = `${spot.y}px`;
    button.style.animationDelay = `${-noise(index, 86) * MAP.floatMs}ms`;
    // The glow: brighter and wider the more players lit this island.
    const share = Math.log(1 + island.solves) / Math.log(1 + busiest);
    const glow = element('i', 'map-glow');
    const reach = MAP.glowMinPx + (MAP.glowMaxPx - MAP.glowMinPx) * share;
    glow.style.width = `${reach}px`;
    glow.style.height = `${reach * 0.62}px`;
    glow.style.opacity = String(MAP.glowMin + (1 - MAP.glowMin) * share);
    const picture = element('canvas', 'map-picture');
    drawIslandOutline(picture, island.rows, {
      width: MAP.islandWidthPx,
      height: MAP.islandHeightPx,
      lit: island.medal !== null,
      rock: true,
      land: css(BIOME_LOOK[island.biome].groundA),
    });
    const medal = element(
      'span',
      'map-medal',
      island.medal === null ? COPY.mapUnlit : MEDAL_NAME[island.medal]
    );
    if (island.medal !== null) medal.dataset['medal'] = island.medal;
    const words = element('span', 'map-words');
    words.append(
      element('span', 'map-name', island.name),
      element(
        'span',
        'map-detail',
        COPY.mapDetail
          .replace('{day}', String(island.day))
          .replace('{weekday}', weekdayLabel(island.weekday).slice(0, 3))
          .replace('{count}', island.solves.toLocaleString('en'))
      )
    );
    // A Sunday picked from the community carries its maker (Phase 3).
    if (island.maker !== undefined)
      words.append(
        element(
          'span',
          'map-maker',
          COPY.mapMaker.replace('{maker}', island.maker)
        )
      );
    words.append(medal);
    button.append(glow, picture, words);
    button.addEventListener('click', () => onPick(island.day));
    sea.append(button);
  });

  if (list.length === 0)
    sea.append(
      element(
        'p',
        'map-empty',
        islands === null ? COPY.loadFailed : COPY.pastEmpty
      )
    );

  const bar = element('header', 'panel map-bar');
  const back = element('button', 'help-button', '←');
  back.type = 'button';
  back.setAttribute('aria-label', COPY.backToTonight);
  back.addEventListener('click', onClose);
  const title = element('div', 'title');
  title.append(
    element('span', 'title-number', COPY.mapTitle),
    element('span', 'title-name', COPY.mapHint)
  );
  bar.append(title, back);
  if (onBuild !== undefined) {
    const build = element(
      'button',
      'button button-quiet map-build',
      COPY.builderOpen
    );
    build.type = 'button';
    build.addEventListener('click', onBuild);
    layer.append(build);
  }

  const scroll = element('div', 'map-scroll');
  scroll.append(sea);
  if (onBuild !== undefined) scroll.append(element('div', 'map-foot'));
  layer.append(scroll, bar);
  if (community !== undefined) {
    layer.classList.add('with-tabs');
    layer.append(...communityView(scroll, community, onBuild !== undefined));
  }
  document.body.append(layer);
  return { close: () => layer.remove() };
}

/** "12 lit it · 5 votes": a community island's line. */
function shelfDetail(entry: ShelfIsland): string {
  const lit =
    entry.plays === 0
      ? COPY.communityLitNone
      : entry.plays === 1
        ? COPY.communityLitOne
        : COPY.communityLit.replace(
            '{count}',
            entry.plays.toLocaleString('en')
          );
  // An island picked for a Sunday says so instead of its own post's count.
  const words = COPY.shelfDetail
    .replace('{maker}', entry.maker)
    .replace(
      '{lit}',
      entry.chosenFor === undefined
        ? lit
        : COPY.sundayChosen.replace('{date}', monthDay(entry.chosenFor))
    );
  if (entry.score === null) return words;
  const votes =
    entry.score === 1
      ? COPY.shelfVote
      : COPY.shelfVotes.replace('{score}', entry.score.toLocaleString('en'));
  return `${words} \u00b7 ${votes}`;
}

/**
 * The "Nights · Community" switch and the Community view (E9): the latest Sunday pick on a larger
 * card, this week's islands by score, then older ones a page at a time. Tapping one opens its
 * post. Paper rows, like See others' islands. Loaded the first time it is shown.
 */
function communityView(
  nights: HTMLElement,
  community: MapCommunity,
  withBuild: boolean
): HTMLElement[] {
  const tabs = element('div', 'panel map-tabs board-tabs');
  tabs.setAttribute('role', 'tablist');
  const shelf = element('div', 'panel map-shelf');
  const list = element('div', 'sheet-list');
  shelf.append(list);
  if (withBuild) shelf.classList.add('with-build');
  shelf.hidden = true;

  const row = (entry: ShelfIsland, kicker?: string): HTMLElement => {
    const node = element(
      'button',
      kicker === undefined
        ? 'sheet-row board-row map-row'
        : 'sheet-row board-row map-row map-pick'
    );
    node.setAttribute('type', 'button');
    const main = element('span', 'sheet-main');
    if (kicker !== undefined)
      main.append(element('span', 'sheet-detail map-pick-kicker', kicker));
    main.append(
      element('span', 'sheet-name', entry.name),
      element('span', 'sheet-detail', shelfDetail(entry))
    );
    const picture = element('canvas', 'others-preview');
    if (picture instanceof HTMLCanvasElement)
      drawIslandOutline(picture, entry.rows, {
        width: kicker === undefined ? OTHERS.previewWidth : MAP.pickWidthPx,
        height: kicker === undefined ? OTHERS.previewHeight : MAP.pickHeightPx,
        lit: entry.plays > 0,
        land: css(BIOME_LOOK[entry.biome].groundA),
      });
    node.append(portrait(entry.maker, entry.makerAvatar), main, picture);
    node.addEventListener('click', () => community.open(entry.url));
    return node;
  };

  const more = element(
    'button',
    'button button-quiet map-more',
    COPY.shelfMore
  );
  more.setAttribute('type', 'button');
  let next: number | null = null;
  const load = async (after: number): Promise<void> => {
    more.remove();
    const answer = await community.load(after);
    if (answer === null || !answer.ok) {
      if (after === 0)
        list.replaceChildren(
          element(
            'p',
            'sheet-empty',
            answer === null ? COPY.loadFailed : COPY.communityResting
          )
        );
      return;
    }
    if (after === 0) {
      const top: HTMLElement[] = [];
      if (answer.pick !== null)
        top.push(
          row(
            answer.pick,
            COPY.shelfPick.replace('{date}', monthDay(answer.pick.sunday))
          )
        );
      top.push(
        element('h3', 'map-heading', COPY.shelfWeek),
        element('p', 'sheet-empty map-hint', COPY.shelfWeekHint)
      );
      if (answer.week.length === 0)
        top.push(element('p', 'sheet-empty', COPY.shelfEmptyWeek));
      top.push(...answer.week.map((entry) => row(entry)));
      if (answer.older.length > 0)
        top.push(element('h3', 'map-heading', COPY.shelfEarlier));
      list.replaceChildren(...top);
    }
    list.append(...answer.older.map((entry) => row(entry)));
    next = answer.next;
    if (next !== null) list.append(more);
  };
  more.addEventListener('click', () => {
    if (next !== null) void load(next);
  });

  let loaded = false;
  const show = (which: 'nights' | 'community'): void => {
    for (const tab of tabs.children)
      tab.setAttribute(
        'aria-selected',
        String(tab.getAttribute('data-view') === which)
      );
    nights.hidden = which !== 'nights';
    shelf.hidden = which !== 'community';
    if (which === 'community' && !loaded) {
      loaded = true;
      list.replaceChildren(element('p', 'sheet-empty', '\u2026'));
      void load(0);
    }
  };
  for (const [view, label] of [
    ['nights', COPY.mapNights],
    ['community', COPY.mapCommunity],
  ] as const) {
    const tab = element('button', 'board-tab', label);
    tab.setAttribute('type', 'button');
    tab.setAttribute('role', 'tab');
    tab.dataset['view'] = view;
    tab.addEventListener('click', () => show(view));
    tabs.append(tab);
  }
  show('nights');
  return [tabs, shelf];
}
