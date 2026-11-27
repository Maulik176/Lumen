/**
 * A small picture of an island from its rows of text, seen from the same corner as the game:
 * land as pale tiles, water as gaps, a spark for each sun and a lantern for each lantern.
 * Used on the feed card (today's island) and on the Archipelago map (past islands). Canvas 2D only.
 */
import { LOOK, OTHERS, UI } from '../shared/config';
import type { Placement } from '../shared/types';

export type OutlineOptions = {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Lanterns glow, as on an island the player has lit. */
  lit: boolean;
  /** Draw the rock the island hangs from, so it reads as floating. */
  rock?: boolean;
  /** The colour of the land, as "#rrggbb". Pale paper when left out. */
  land?: string;
  /** Pieces a player placed, drawn on their tiles ("See others' islands"). */
  pieces?: readonly Placement[];
  /**
   * Drawn large, as a feed card's picture (Nov 27: an island with no picture of its own): water
   * in its world's colour, rocks and trees as darker tiles, suns that glow, and each lantern in
   * its own colour, all sized to the tiles rather than to a thumbnail.
   */
  detail?: { water: string; rock: string };
};

const hexOf = (colour: number): string =>
  `#${colour.toString(16).padStart(6, '0')}`;

/** A lantern's colour by its letter in the rows. */
const LANTERN_HEX: Record<string, string> = {
  W: hexOf(LOOK.lanternWarm),
  R: hexOf(LOOK.beamRed),
  G: hexOf(LOOK.beamGreen),
  B: hexOf(LOOK.beamBlue),
  M: hexOf(LOOK.lanternMagenta),
  C: hexOf(LOOK.lanternCyan),
  Y: hexOf(LOOK.lanternYellow),
};

export function drawIslandOutline(
  canvas: HTMLCanvasElement,
  rows: readonly string[],
  options: OutlineOptions
): void {
  const ratio = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.width = `${options.width}px`;
  canvas.style.height = `${options.height}px`;
  canvas.width = options.width * ratio;
  canvas.height = options.height * ratio;
  const pen = canvas.getContext('2d');
  if (pen === null) return;
  pen.scale(ratio, ratio);
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width === 0) return;
  // Each tile is a flat diamond; the whole island is fitted inside the canvas with a margin.
  const under = options.rock === true ? options.height * 0.3 : 0;
  const half = Math.min(
    (options.width - 14) / (width + height),
    ((options.height - under - 16) / (width + height)) * 2
  );
  const rise = half / 2;
  const left = options.width / 2 + ((height - width) * half) / 2;
  const top = (options.height - under - (width + height) * rise) / 2 + 2;
  const at = (x: number, y: number): [number, number] => [
    left + (x - y) * half,
    top + (x + y) * rise,
  ];

  if (options.rock === true) {
    // The hanging rock: from the island's left, front and right corners down to a point.
    const [leftX, leftY] = at(0, height);
    const [frontX, frontY] = at(width, height);
    const [rightX, rightY] = at(width, 0);
    pen.beginPath();
    pen.moveTo(leftX, leftY);
    pen.lineTo(frontX, frontY);
    pen.lineTo(rightX, rightY);
    pen.lineTo(frontX + half * 0.6, frontY + under * 0.55);
    pen.lineTo(frontX - half * 0.4, frontY + under * 0.95);
    pen.lineTo(frontX - half * 1.6, frontY + under * 0.45);
    pen.closePath();
    pen.fillStyle = UI.inkSoft;
    pen.globalAlpha = 0.85;
    pen.fill();
  }

  const lights: { x: number; y: number; sun: boolean; tile: string }[] = [];
  const detail = options.detail;
  rows.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      const [cx, cy] = at(x, y);
      if (detail !== undefined) {
        pen.beginPath();
        pen.moveTo(cx, cy);
        pen.lineTo(cx + half, cy + rise);
        pen.lineTo(cx, cy + rise * 2);
        pen.lineTo(cx - half, cy + rise);
        pen.closePath();
        pen.globalAlpha = 1;
        pen.fillStyle =
          tile === '~'
            ? detail.water
            : tile === '#' || tile === 'T'
              ? detail.rock
              : (options.land ?? UI.light);
        pen.fill();
        // A soft seam, so the squares read, as in the game.
        pen.globalAlpha = (x + y) % 2 ? 0.1 : 0.04;
        pen.fillStyle = UI.ink;
        pen.fill();
      } else if (tile !== '~') {
        pen.beginPath();
        pen.moveTo(cx, cy);
        pen.lineTo(cx + half, cy + rise);
        pen.lineTo(cx, cy + rise * 2);
        pen.lineTo(cx - half, cy + rise);
        pen.closePath();
        pen.globalAlpha =
          tile === '#' || tile === 'T' ? 0.5 : (x + y) % 2 ? 0.8 : 0.9;
        pen.fillStyle = options.land ?? UI.light;
        pen.fill();
      }
      if ('WRGBMCY'.includes(tile)) lights.push({ x, y, sun: false, tile });
      if ('^>v<'.includes(tile)) lights.push({ x, y, sun: true, tile });
    });
  });
  // Placed pieces: a mirror as a short bar along its diagonal, a prism as a small triangle.
  for (const placement of options.pieces ?? []) {
    const [cx, top0] = at(placement.x, placement.y);
    const cy = top0 + rise;
    pen.globalAlpha = 1;
    pen.lineCap = 'round';
    if (placement.piece.kind === 'prism') {
      const size = half * OTHERS.previewPrism;
      pen.beginPath();
      pen.moveTo(cx, cy - size);
      pen.lineTo(cx + size, cy + size * 0.7);
      pen.lineTo(cx - size, cy + size * 0.7);
      pen.closePath();
      pen.fillStyle = UI.paper;
      pen.fill();
      pen.lineWidth = 1;
      pen.strokeStyle = UI.ink;
      pen.stroke();
      continue;
    }
    // On screen a "/" mirror runs across the tile, a backslash mirror up and down it.
    const reach = (half * OTHERS.previewMirror) / 2;
    const across = placement.piece.orientation === 'slash';
    const dx = across ? reach : 0;
    const dy = across ? 0 : reach * 0.9;
    for (const [width, colour] of [
      [3.6, UI.ink],
      [2, UI.paper],
    ] as const) {
      pen.beginPath();
      pen.moveTo(cx - dx, cy - dy);
      pen.lineTo(cx + dx, cy + dy);
      pen.lineWidth = width;
      pen.strokeStyle = colour;
      pen.stroke();
    }
  }
  for (const light of lights) {
    const [cx, top0] = at(light.x, light.y);
    const cy = top0 + rise - 1;
    pen.globalAlpha = 1;
    if (detail !== undefined) {
      if (light.sun) {
        // A sun: a warm glow and a bright core.
        const reach = half * 1.1;
        const glow = pen.createRadialGradient(cx, cy, 0, cx, cy, reach);
        glow.addColorStop(0, 'rgba(255, 246, 214, 0.95)');
        glow.addColorStop(0.35, 'rgba(255, 214, 140, 0.55)');
        glow.addColorStop(1, 'rgba(255, 214, 140, 0)');
        pen.fillStyle = glow;
        pen.fillRect(cx - reach, cy - reach, reach * 2, reach * 2);
        pen.beginPath();
        pen.arc(cx, cy, half * 0.2, 0, Math.PI * 2);
        pen.fillStyle = '#fffdf3';
        pen.fill();
        continue;
      }
      // A paper lantern, banded in the colour it wants.
      const radius = half * 0.34;
      pen.beginPath();
      pen.arc(cx, cy - radius * 0.4, radius, 0, Math.PI * 2);
      pen.fillStyle = hexOf(LOOK.lanternPaper);
      pen.fill();
      pen.lineWidth = Math.max(1.2, radius * 0.28);
      pen.strokeStyle = LANTERN_HEX[light.tile] ?? UI.amber;
      pen.stroke();
      pen.beginPath();
      pen.arc(cx, cy - radius * 0.4, radius * 0.32, 0, Math.PI * 2);
      pen.fillStyle = UI.ink;
      pen.globalAlpha = 0.75;
      pen.fill();
      continue;
    }
    if (light.sun) {
      pen.fillStyle = UI.paper;
      pen.beginPath();
      pen.arc(cx, cy, 2.1, 0, Math.PI * 2);
      pen.fill();
      continue;
    }
    if (options.lit) {
      // With pieces drawn, the glow stays small so it never hides them.
      const reach =
        options.pieces === undefined ? 8 : half * OTHERS.previewGlow;
      const glow = pen.createRadialGradient(cx, cy, 0, cx, cy, reach);
      glow.addColorStop(0, UI.amber);
      glow.addColorStop(1, 'transparent');
      pen.fillStyle = glow;
      pen.globalAlpha = 0.9;
      pen.fillRect(cx - reach, cy - reach, reach * 2, reach * 2);
      pen.globalAlpha = 1;
    }
    pen.beginPath();
    pen.arc(cx, cy, 2.9, 0, Math.PI * 2);
    pen.fillStyle = options.lit ? UI.amber : UI.ink;
    pen.fill();
    pen.lineWidth = 1.3;
    pen.strokeStyle = UI.amber;
    pen.stroke();
  }
}
