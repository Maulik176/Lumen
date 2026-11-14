/**
 * A small picture of an island from its rows of text, seen from the same corner as the game:
 * land as pale tiles, water as gaps, a spark for each sun and a lantern for each lantern.
 * Used on the feed card (today's island) and on the Archipelago map (past islands). Canvas 2D only.
 */
import { UI } from '../shared/config';

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

  const lights: { x: number; y: number; sun: boolean }[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      const [cx, cy] = at(x, y);
      if (tile !== '~') {
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
      if ('WRGBMCY'.includes(tile)) lights.push({ x, y, sun: false });
      if ('^>v<'.includes(tile)) lights.push({ x, y, sun: true });
    });
  });
  for (const light of lights) {
    const [cx, top0] = at(light.x, light.y);
    const cy = top0 + rise - 1;
    pen.globalAlpha = 1;
    if (light.sun) {
      pen.fillStyle = UI.paper;
      pen.beginPath();
      pen.arc(cx, cy, 2.1, 0, Math.PI * 2);
      pen.fill();
      continue;
    }
    if (options.lit) {
      const glow = pen.createRadialGradient(cx, cy, 0, cx, cy, 8);
      glow.addColorStop(0, UI.amber);
      glow.addColorStop(1, 'transparent');
      pen.fillStyle = glow;
      pen.globalAlpha = 0.9;
      pen.fillRect(cx - 8, cy - 8, 16, 16);
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
