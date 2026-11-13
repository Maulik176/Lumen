/**
 * Dev-only 2D viewer for content/puzzles.json. Never part of the Reddit build: it is not an
 * entry point in devvit.json. Run it with `npm run debug`.
 *
 * Shows any day's island, its par solution and its difficulty breakdown, and lets you place
 * pieces by clicking, using the same tracer the game uses.
 */
import { GENERATOR } from '../shared/config';
import {
  FACTOR_KEYS,
  puzzleOfDaily,
  readDailyFile,
  type DailyFile,
  type DailyIsland,
} from '../shared/daily';
import { trace } from '../shared/trace';
import type {
  BeamColour,
  Direction,
  LanternColour,
  Placement,
} from '../shared/types';
import { medalFor } from '../shared/validate';

const TILE = 56;
const SVG = 'http://www.w3.org/2000/svg';

const BEAM: Record<BeamColour, string> = {
  white: '#fff6d8',
  red: '#ff6b5e',
  green: '#6fe08a',
  blue: '#6fa8ff',
};
const LANTERN: Record<LanternColour, string> = {
  white: '#f3e9d2',
  red: '#ff6b5e',
  green: '#6fe08a',
  blue: '#6fa8ff',
  magenta: '#e36fe0',
  cyan: '#62d9e0',
  yellow: '#f0d552',
};
const TERRAIN: Record<string, string> = {
  '#': '#5b5868',
  T: '#2f6b46',
  '~': '#274a78',
};
const ARROW: Record<Direction, number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};
const STEP: Record<Direction, [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`missing #${id}`);
  return element;
}

function svg(
  name: string,
  attributes: Record<string, string | number>,
  text?: string
): SVGElement {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

let file: DailyFile = { version: 1, dayOne: '', days: [] };
let current = 0;
let pieces: Placement[] = [];
let notice = '';

function island(): DailyIsland {
  const found = file.days[current];
  if (found === undefined) throw new Error('no such day');
  return found;
}

/** Same cycle the game will use, limited by the day's inventory: / then \ then prism then empty. */
function cycle(x: number, y: number): void {
  const index = pieces.findIndex((piece) => piece.x === x && piece.y === y);
  const existing = pieces[index];
  const { inventory } = island();
  const mirrors = pieces.filter(
    (piece) => piece.piece.kind === 'mirror'
  ).length;
  const prismFree = pieces.length - mirrors < inventory.prisms;
  notice = '';
  if (existing === undefined) {
    if (mirrors < inventory.mirrors) {
      pieces.push({ x, y, piece: { kind: 'mirror', orientation: 'slash' } });
    } else if (prismFree) {
      pieces.push({ x, y, piece: { kind: 'prism' } });
    } else {
      notice = 'No pieces left. Tap one on the island to take it back.';
    }
  } else if (
    existing.piece.kind === 'mirror' &&
    existing.piece.orientation === 'slash'
  ) {
    pieces[index] = {
      x,
      y,
      piece: { kind: 'mirror', orientation: 'backslash' },
    };
  } else if (existing.piece.kind === 'mirror' && prismFree) {
    pieces[index] = { x, y, piece: { kind: 'prism' } };
  } else {
    pieces.splice(index, 1);
  }
  draw();
}

function draw(): void {
  const day = island();
  const puzzle = puzzleOfDaily(day);
  const size = puzzle.width;
  const result = trace(puzzle, pieces);
  const root = svg('svg', {
    width: size * TILE,
    height: size * TILE,
    viewBox: `0 0 ${size * TILE} ${size * TILE}`,
  });
  const centre = (n: number): number => n * TILE + TILE / 2;

  day.rows.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      const char = row.charAt(x);
      const free =
        puzzle.terrain[y * size + x] === 'grass' && '.'.includes(char);
      const tile = svg('rect', {
        x: x * TILE + 1,
        y: y * TILE + 1,
        width: TILE - 2,
        height: TILE - 2,
        rx: 6,
        fill: TERRAIN[char] ?? '#3f7d4f',
        opacity: TERRAIN[char] === undefined ? 0.55 : 1,
      });
      if (free) {
        tile.setAttribute('class', 'tile');
        tile.addEventListener('click', () => cycle(x, y));
      }
      root.append(tile);
    }
  });

  for (const segment of result.segments) {
    const [dx, dy] = STEP[segment.direction];
    // Run off the edge of the island; stop at the face of a rock, tree or sun crystal.
    const overshoot =
      segment.end === 'edge'
        ? TILE / 2
        : segment.end === 'blocked'
          ? -TILE / 2
          : 0;
    root.append(
      svg('line', {
        x1: centre(segment.from.x),
        y1: centre(segment.from.y),
        x2: centre(segment.to.x) + dx * overshoot,
        y2: centre(segment.to.y) + dy * overshoot,
        stroke: BEAM[segment.colour],
        'stroke-width': segment.colour === 'white' ? 5 : 4,
        'stroke-linecap': 'round',
        opacity: 0.9,
        'pointer-events': 'none',
      })
    );
  }

  puzzle.sources.forEach((source) => {
    const group = svg('g', {
      transform: `translate(${centre(source.x)} ${centre(source.y)}) rotate(${ARROW[source.direction]})`,
      'pointer-events': 'none',
    });
    group.append(
      svg('circle', {
        r: 17,
        fill: '#17132a',
        stroke: BEAM[source.colour],
        'stroke-width': 3,
      })
    );
    group.append(
      svg('path', { d: 'M0 -13 L8 3 L-8 3 Z', fill: BEAM[source.colour] })
    );
    root.append(group);
  });

  puzzle.lanterns.forEach((lantern, index) => {
    const lit = result.lit[index] === true;
    root.append(
      svg('rect', {
        x: centre(lantern.x) - 14,
        y: centre(lantern.y) - 17,
        width: 28,
        height: 34,
        rx: 9,
        fill: lit ? LANTERN[lantern.colour] : '#17132a',
        stroke: LANTERN[lantern.colour],
        'stroke-width': 3,
        'pointer-events': 'none',
      })
    );
    root.append(
      svg(
        'text',
        {
          x: centre(lantern.x),
          y: centre(lantern.y) + 5,
          'text-anchor': 'middle',
          'font-size': 13,
          'font-weight': 700,
          fill: lit ? '#17132a' : LANTERN[lantern.colour],
          'pointer-events': 'none',
        },
        lantern.colour.charAt(0).toUpperCase()
      )
    );
  });

  const mirrorLine = (
    x: number,
    y: number,
    slash: boolean,
    colour: string,
    width: number
  ): SVGElement =>
    svg('line', {
      x1: centre(x) - 17,
      y1: centre(y) + (slash ? 17 : -17),
      x2: centre(x) + 17,
      y2: centre(y) + (slash ? -17 : 17),
      stroke: colour,
      'stroke-width': width,
      'stroke-linecap': 'round',
      'pointer-events': 'none',
    });
  for (const mirror of puzzle.fixedMirrors) {
    root.append(
      mirrorLine(
        mirror.x,
        mirror.y,
        mirror.orientation === 'slash',
        '#9aa0b5',
        7
      )
    );
  }
  for (const piece of pieces) {
    if (piece.piece.kind === 'mirror') {
      root.append(
        mirrorLine(
          piece.x,
          piece.y,
          piece.piece.orientation === 'slash',
          '#f3e9d2',
          5
        )
      );
    } else {
      root.append(
        svg('path', {
          d: `M${centre(piece.x)} ${centre(piece.y) - 16} L${centre(piece.x) + 15} ${centre(piece.y) + 12} L${centre(piece.x) - 15} ${centre(piece.y) + 12} Z`,
          fill: 'rgba(255,255,255,0.25)',
          stroke: '#f3e9d2',
          'stroke-width': 3,
          'pointer-events': 'none',
        })
      );
    }
  }

  byId('board').replaceChildren(root);

  const template = GENERATOR.templates[day.weekday];
  byId('title').textContent =
    `Lumen #${day.day} · ${day.name} · ${day.weekday}`;
  byId('meta').textContent =
    `${day.date} · ${day.biome} · ${size}x${size} · par ${day.par} (band ${template.par[0]}–${template.par[1]}) · ` +
    `${day.inventory.mirrors} mirrors, ${day.inventory.prisms} prisms · ` +
    `difficulty ${day.difficulty.score} (band ${template.difficulty[0]}–${template.difficulty[1]}) · ` +
    `${day.attempts} tries · ${day.solveNodes} solver nodes` +
    (day.sourceColours.some((colour) => colour !== 'white')
      ? ` · suns: ${day.sourceColours.join(', ')}`
      : '');

  const status = byId('status');
  const mirrors = pieces.filter(
    (piece) => piece.piece.kind === 'mirror'
  ).length;
  const prisms = pieces.length - mirrors;
  const left = `${day.inventory.mirrors - mirrors} mirrors, ${day.inventory.prisms - prisms} prisms left`;
  status.className = result.solved ? 'solved' : '';
  status.textContent = result.solved
    ? `All lit · ${pieces.length} pieces (par ${day.par}) · ${medalFor(pieces.length, day.par)}`
    : `${result.litCount} of ${puzzle.lanterns.length} lit · ${left}${notice ? ` · ${notice}` : ''}`;

  const table = byId('factors');
  table.replaceChildren();
  const addRow = (cells: string[], className = ''): void => {
    const row = document.createElement('tr');
    row.className = className;
    cells.forEach((cell, index) => {
      const td = document.createElement(className === 'head' ? 'th' : 'td');
      td.textContent = cell;
      if (index > 0) td.className = 'n';
      row.append(td);
    });
    table.append(row);
  };
  addRow(['Difficulty factor', 'value', 'points'], 'head');
  for (const key of FACTOR_KEYS) {
    addRow([
      key,
      String(day.difficulty.factors[key]),
      String(day.difficulty.points[key]),
    ]);
  }
  addRow(['total', '', String(day.difficulty.score)], 'total');

  for (const button of byId('days').querySelectorAll('button')) {
    button.classList.toggle(
      'current',
      button.dataset['day'] === String(day.day)
    );
  }
}

function go(index: number): void {
  if (index < 0 || index >= file.days.length) return;
  current = index;
  pieces = [];
  location.hash = String(island().day);
  draw();
  byId('days').querySelector('.current')?.scrollIntoView({ block: 'nearest' });
}

async function start(): Promise<void> {
  const response = await fetch('/puzzles.json');
  file = readDailyFile(await response.json());
  const list = byId('days');
  file.days.forEach((day, index) => {
    const button = document.createElement('button');
    button.dataset['day'] = String(day.day);
    const number = document.createElement('span');
    number.className = 'num';
    number.textContent = `#${day.day}`;
    const name = document.createElement('span');
    name.textContent = day.name;
    const info = document.createElement('span');
    info.className = 'weekday';
    info.textContent = `${day.weekday.slice(0, 3)} · par ${day.par} · ${day.difficulty.score.toFixed(0)}`;
    button.append(number, name, info);
    button.addEventListener('click', () => go(index));
    list.append(button);
  });
  byId('prev').addEventListener('click', () => go(current - 1));
  byId('next').addEventListener('click', () => go(current + 1));
  byId('clear').addEventListener('click', () => {
    pieces = [];
    draw();
  });
  byId('show-solution').addEventListener('click', () => {
    pieces = island().solution.slice();
    draw();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') go(current - 1);
    if (event.key === 'ArrowRight') go(current + 1);
  });
  const fromHash = Number(location.hash.slice(1));
  go(
    Number.isInteger(fromHash) && fromHash >= 1 && fromHash <= file.days.length
      ? fromHash - 1
      : 0
  );
}

start().catch((error: unknown) => {
  byId('title').textContent = `Could not load puzzles.json: ${String(error)}`;
});
