/**
 * The Builder's board: the island seen from straight above, painted in its biome's colours with
 * the game's own suns, lanterns (with their colour shapes), stone mirrors, rocks, trees and water,
 * and the light as the shared tracer sends it. Canvas 2D, redrawn only when something changes.
 * Square tiles from above are the easiest to tap: 44 px each on an 8x8 board at 360 px wide.
 */
import { draftPuzzleText, type IslandDraft } from '../../shared/builder';
import {
  BIOME_LOOK,
  BUILDER_VIEW,
  COLOUR_SHAPE,
  LOOK,
} from '../../shared/config';
import { puzzleFromText } from '../../shared/puzzle-text';
import { trace } from '../../shared/trace';
import type {
  BeamColour,
  BeamSegment,
  LanternColour,
} from '../../shared/types';
import { drawShape, partsOf } from '../game/shapes';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

const BEAM: Record<BeamColour, number> = {
  white: LOOK.beamWhite,
  red: LOOK.beamRed,
  green: LOOK.beamGreen,
  blue: LOOK.beamBlue,
};

const LANTERN: Record<LanternColour, number> = {
  white: LOOK.lanternPaper,
  red: LOOK.beamRed,
  green: LOOK.beamGreen,
  blue: LOOK.beamBlue,
  magenta: LOOK.lanternMagenta,
  cyan: LOOK.lanternCyan,
  yellow: LOOK.lanternYellow,
};

const LANTERN_CHAR: Record<string, LanternColour> = {
  W: 'white',
  R: 'red',
  G: 'green',
  B: 'blue',
  M: 'magenta',
  C: 'cyan',
  Y: 'yellow',
};

const SUN_TURN: Record<string, number> = { '^': -90, '>': 0, v: 90, '<': 180 };

export type Board = {
  /** Draw this draft, with its light, in a square of `side` CSS pixels. */
  draw: (draft: IslandDraft, side: number) => void;
  /** The tile under a point on the page, or null when it is off the board. */
  tileAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** A soft ring on one tile for a moment, where the last tap landed. */
  flash: (x: number, y: number) => void;
  lit: () => { lit: number; lanterns: number };
};

export function createBoard(canvas: HTMLCanvasElement): Board {
  const pen = canvas.getContext('2d');
  let last: { draft: IslandDraft; side: number } | null = null;
  let flashAt: { x: number; y: number; until: number } | null = null;
  let litNow = { lit: 0, lanterns: 0 };

  const paint = (): void => {
    if (pen === null || last === null) return;
    const { draft, side } = last;
    const ratio = Math.min(
      BUILDER_VIEW.maxPixelRatio,
      window.devicePixelRatio || 1
    );
    if (canvas.width !== Math.round(side * ratio)) {
      canvas.width = Math.round(side * ratio);
      canvas.height = Math.round(side * ratio);
      canvas.style.width = `${side}px`;
      canvas.style.height = `${side}px`;
    }
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, side, side);
    const look = BIOME_LOOK[draft.biome];
    const n = draft.size;
    const tile = side / n;
    const centre = (i: number): number => (i + 0.5) * tile;

    // Ground: a quiet chequer, soft seams, water as its own colour.
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const char = draft.rows[y]?.[x] ?? '.';
        pen.fillStyle = css((x + y) % 2 === 0 ? look.groundA : look.groundB);
        if (char === '~') pen.fillStyle = css(look.water);
        pen.fillRect(x * tile, y * tile, tile, tile);
        if (char === '~') {
          pen.strokeStyle = css(look.waterEdge);
          pen.lineWidth = Math.max(1, tile * 0.05);
          pen.strokeRect(x * tile + 1, y * tile + 1, tile - 2, tile - 2);
        }
      }
    pen.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    pen.lineWidth = 1;
    for (let i = 1; i < n; i++) {
      pen.beginPath();
      pen.moveTo(i * tile, 0);
      pen.lineTo(i * tile, side);
      pen.moveTo(0, i * tile);
      pen.lineTo(side, i * tile);
      pen.stroke();
    }

    // Light first, under the pieces, as the game draws it.
    const puzzle = puzzleFromText(
      draftPuzzleText(draft, { mirrors: 0, prisms: 0 })
    );
    const light = trace(puzzle, []);
    litNow = { lit: light.litCount, lanterns: puzzle.lanterns.length };
    drawLight(light.segments, tile, n);

    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const char = draft.rows[y]?.[x] ?? '.';
        const cx = centre(x);
        const cy = centre(y);
        if (char === '#') drawRock(cx, cy, tile, look.rock);
        else if (char === 'T') drawTree(cx, cy, tile, look.tree, look);
        else if (char === '/' || char === '\\') drawStone(cx, cy, tile, char);
        else if (char in SUN_TURN) drawSun(cx, cy, tile, SUN_TURN[char] ?? 0);
        else if (char in LANTERN_CHAR) {
          const index = puzzle.lanterns.findIndex(
            (l) => l.x === x && l.y === y
          );
          drawLantern(
            cx,
            cy,
            tile,
            LANTERN_CHAR[char] ?? 'white',
            light.lit[index] === true
          );
        }
      }

    if (flashAt !== null && performance.now() < flashAt.until) {
      pen.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      pen.lineWidth = Math.max(2, tile * 0.06);
      pen.strokeRect(
        flashAt.x * tile + 2,
        flashAt.y * tile + 2,
        tile - 4,
        tile - 4
      );
    }
  };

  function drawLight(
    segments: readonly BeamSegment[],
    tile: number,
    n: number
  ): void {
    if (pen === null) return;
    pen.lineCap = 'round';
    for (const segment of segments) {
      const along =
        segment.direction === 'east' || segment.direction === 'west';
      const sign =
        segment.direction === 'east' || segment.direction === 'south' ? 1 : -1;
      // As in the game: run off the edge, stop at a rock's face, end inside a lantern.
      const extra =
        segment.end === 'edge'
          ? 0.5
          : segment.end === 'blocked'
            ? -0.42
            : segment.end === 'lantern'
              ? -0.12
              : 0;
      const fx = (segment.from.x + 0.5) * tile;
      const fy = (segment.from.y + 0.5) * tile;
      let tx = (segment.to.x + 0.5) * tile;
      let ty = (segment.to.y + 0.5) * tile;
      if (along) tx += sign * extra * tile;
      else ty += sign * extra * tile;
      tx = Math.min(Math.max(tx, 0), n * tile);
      ty = Math.min(Math.max(ty, 0), n * tile);
      const colour = css(BEAM[segment.colour]);
      pen.globalAlpha = 0.35;
      pen.strokeStyle = colour;
      pen.lineWidth = tile * BUILDER_VIEW.beamGlow;
      line(fx, fy, tx, ty);
      pen.globalAlpha = 1;
      // A thin dark lining, so white light reads on snow and sand too.
      pen.strokeStyle = 'rgba(40, 30, 50, 0.35)';
      pen.lineWidth = tile * BUILDER_VIEW.beamCore + 2;
      line(fx, fy, tx, ty);
      pen.strokeStyle = colour;
      pen.lineWidth = tile * BUILDER_VIEW.beamCore;
      line(fx, fy, tx, ty);
    }
  }

  function line(ax: number, ay: number, bx: number, by: number): void {
    if (pen === null) return;
    pen.beginPath();
    pen.moveTo(ax, ay);
    pen.lineTo(bx, by);
    pen.stroke();
  }

  function drawRock(
    cx: number,
    cy: number,
    tile: number,
    colour: number
  ): void {
    if (pen === null) return;
    const r = tile * 0.36;
    pen.fillStyle = css(colour);
    pen.strokeStyle = 'rgba(30, 24, 40, 0.45)';
    pen.lineWidth = Math.max(1, tile * 0.04);
    pen.beginPath();
    pen.moveTo(cx - r, cy + r * 0.5);
    pen.lineTo(cx - r * 0.7, cy - r * 0.6);
    pen.lineTo(cx + r * 0.1, cy - r);
    pen.lineTo(cx + r, cy - r * 0.3);
    pen.lineTo(cx + r * 0.8, cy + r * 0.7);
    pen.lineTo(cx - r * 0.2, cy + r);
    pen.closePath();
    pen.fill();
    pen.stroke();
    pen.fillStyle = 'rgba(255, 255, 255, 0.18)';
    pen.beginPath();
    pen.moveTo(cx - r * 0.6, cy - r * 0.45);
    pen.lineTo(cx + r * 0.1, cy - r * 0.85);
    pen.lineTo(cx + r * 0.2, cy - r * 0.1);
    pen.closePath();
    pen.fill();
  }

  function drawTree(
    cx: number,
    cy: number,
    tile: number,
    shape: 'pine' | 'round' | 'cactus',
    look: { crown: number; crownAccent: number; trunk: number }
  ): void {
    if (pen === null) return;
    const r = tile * 0.34;
    pen.strokeStyle = 'rgba(30, 24, 40, 0.4)';
    pen.lineWidth = Math.max(1, tile * 0.04);
    if (shape === 'cactus') {
      pen.fillStyle = css(look.crown);
      roundRect(cx - r * 0.28, cy - r, r * 0.56, r * 1.9, r * 0.28);
      roundRect(cx - r * 0.85, cy - r * 0.35, r * 0.42, r * 0.75, r * 0.2);
      roundRect(cx + r * 0.45, cy - r * 0.6, r * 0.42, r * 0.75, r * 0.2);
      return;
    }
    pen.fillStyle = css(look.trunk);
    pen.fillRect(cx - r * 0.12, cy + r * 0.35, r * 0.24, r * 0.6);
    pen.fillStyle = css(look.crown);
    pen.beginPath();
    if (shape === 'pine') {
      pen.moveTo(cx, cy - r);
      pen.lineTo(cx + r * 0.8, cy + r * 0.45);
      pen.lineTo(cx - r * 0.8, cy + r * 0.45);
      pen.closePath();
    } else {
      pen.arc(cx, cy - r * 0.1, r * 0.72, 0, Math.PI * 2);
    }
    pen.fill();
    pen.stroke();
    pen.fillStyle = css(look.crownAccent);
    pen.beginPath();
    pen.arc(cx - r * 0.2, cy - r * 0.3, r * 0.22, 0, Math.PI * 2);
    pen.fill();
  }

  function roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (pen === null) return;
    pen.beginPath();
    pen.roundRect(x, y, w, h, r);
    pen.fill();
    pen.stroke();
  }

  function drawStone(cx: number, cy: number, tile: number, char: string): void {
    if (pen === null) return;
    const r = tile * 0.38;
    const sx = char === '/' ? 1 : -1;
    pen.lineCap = 'round';
    pen.strokeStyle = css(LOOK.stoneDark);
    pen.lineWidth = tile * 0.2;
    line(cx - r * sx, cy + r, cx + r * sx, cy - r);
    pen.strokeStyle = css(LOOK.stone);
    pen.lineWidth = tile * 0.13;
    line(cx - r * sx, cy + r, cx + r * sx, cy - r);
    pen.strokeStyle = css(LOOK.glass);
    pen.lineWidth = tile * 0.04;
    line(cx - r * 0.8 * sx, cy + r * 0.8, cx + r * 0.8 * sx, cy - r * 0.8);
  }

  function drawSun(
    cx: number,
    cy: number,
    tile: number,
    degrees: number
  ): void {
    if (pen === null) return;
    const r = tile * 0.3;
    const glow = pen.createRadialGradient(cx, cy, 0, cx, cy, tile * 0.55);
    glow.addColorStop(0, 'rgba(255, 240, 190, 0.9)');
    glow.addColorStop(1, 'rgba(255, 240, 190, 0)');
    pen.fillStyle = glow;
    pen.fillRect(cx - tile / 2, cy - tile / 2, tile, tile);
    // Which way it shines: a small point on the side the light leaves from.
    pen.save();
    pen.translate(cx, cy);
    pen.rotate((degrees * Math.PI) / 180);
    pen.fillStyle = css(LOOK.brass);
    pen.beginPath();
    pen.moveTo(r * 1.45, 0);
    pen.lineTo(r * 0.75, -r * 0.42);
    pen.lineTo(r * 0.75, r * 0.42);
    pen.closePath();
    pen.fill();
    pen.restore();
    pen.fillStyle = css(LOOK.crystal);
    pen.strokeStyle = css(LOOK.brass);
    pen.lineWidth = Math.max(1.5, tile * 0.05);
    pen.beginPath();
    pen.moveTo(cx, cy - r);
    pen.lineTo(cx + r * 0.72, cy);
    pen.lineTo(cx, cy + r);
    pen.lineTo(cx - r * 0.72, cy);
    pen.closePath();
    pen.fill();
    pen.stroke();
  }

  function drawLantern(
    cx: number,
    cy: number,
    tile: number,
    colour: LanternColour,
    lit: boolean
  ): void {
    if (pen === null) return;
    const r = tile * 0.3;
    if (lit) {
      const glow = pen.createRadialGradient(cx, cy, 0, cx, cy, tile * 0.6);
      glow.addColorStop(0, 'rgba(255, 198, 110, 0.85)');
      glow.addColorStop(1, 'rgba(255, 198, 110, 0)');
      pen.fillStyle = glow;
      pen.fillRect(cx - tile * 0.6, cy - tile * 0.6, tile * 1.2, tile * 1.2);
    }
    pen.fillStyle = css(lit ? LOOK.lanternWarm : LOOK.lanternPaper);
    pen.strokeStyle = css(LOOK.woodDark);
    pen.lineWidth = Math.max(1.5, tile * 0.05);
    pen.beginPath();
    pen.ellipse(cx, cy, r * 0.92, r, 0, 0, Math.PI * 2);
    pen.fill();
    pen.stroke();
    // A band of the colour it wants, then its shapes, so colour is never the only clue.
    if (colour !== 'white') {
      pen.fillStyle = css(LANTERN[colour]);
      pen.fillRect(cx - r * 0.9, cy - r * 0.18, r * 1.8, r * 0.36);
      const parts = partsOf(colour);
      parts.forEach((part, i) => {
        const offset = (i - (parts.length - 1) / 2) * r * 0.85;
        drawShape(
          pen,
          COLOUR_SHAPE[part],
          cx + offset,
          cy - r * 1.35,
          r * 0.32
        );
        pen.fillStyle = css(BEAM[part]);
        pen.fill();
        pen.strokeStyle = css(LOOK.woodDark);
        pen.lineWidth = Math.max(1, tile * 0.03);
        pen.stroke();
      });
    }
    pen.fillStyle = css(LOOK.woodDark);
    pen.fillRect(cx - r * 0.45, cy - r * 1.08, r * 0.9, r * 0.2);
    pen.fillRect(cx - r * 0.45, cy + r * 0.88, r * 0.9, r * 0.2);
  }

  return {
    draw(draft, side) {
      last = { draft, side };
      paint();
    },
    tileAt(clientX, clientY) {
      if (last === null) return null;
      const box = canvas.getBoundingClientRect();
      const tile = box.width / last.draft.size;
      const x = Math.floor((clientX - box.left) / tile);
      const y = Math.floor((clientY - box.top) / tile);
      if (x < 0 || y < 0 || x >= last.draft.size || y >= last.draft.size)
        return null;
      return { x, y };
    },
    flash(x, y) {
      flashAt = { x, y, until: performance.now() + BUILDER_VIEW.flashMs };
      paint();
      window.setTimeout(paint, BUILDER_VIEW.flashMs + 20);
    },
    lit: () => litNow,
  };
}
