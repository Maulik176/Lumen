/**
 * Shapes that stand for colours, so nobody has to tell red from green to play:
 * red is a triangle, green a circle, blue a square. A mixed lantern shows both of its shapes.
 */
import { CanvasTexture } from 'three';
import { COLOUR_SHAPE, LOOK } from '../../shared/config';
import type { BeamColour, LanternColour } from '../../shared/types';
import { css } from './kit';

export type Shape = (typeof COLOUR_SHAPE)[keyof typeof COLOUR_SHAPE];

/** Shape codes as the beam shader reads them. */
export const SHAPE_CODE: Record<BeamColour, number> = {
  white: 0,
  red: 1,
  green: 2,
  blue: 3,
};

const COLOUR_HEX: Record<'red' | 'green' | 'blue', number> = {
  red: LOOK.beamRed,
  green: LOOK.beamGreen,
  blue: LOOK.beamBlue,
};

/** The primary colours a lantern needs. White lanterns need none in particular. */
export function partsOf(colour: LanternColour): ('red' | 'green' | 'blue')[] {
  if (colour === 'red' || colour === 'green' || colour === 'blue')
    return [colour];
  if (colour === 'magenta') return ['red', 'blue'];
  if (colour === 'cyan') return ['green', 'blue'];
  if (colour === 'yellow') return ['red', 'green'];
  return [];
}

function draw(
  pen: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  radius: number
): void {
  pen.beginPath();
  if (shape === 'circle') {
    pen.arc(x, y, radius, 0, Math.PI * 2);
  } else if (shape === 'square') {
    pen.rect(
      x - radius * 0.86,
      y - radius * 0.86,
      radius * 1.72,
      radius * 1.72
    );
  } else {
    pen.moveTo(x, y - radius * 1.1);
    pen.lineTo(x + radius * 1.05, y + radius * 0.8);
    pen.lineTo(x - radius * 1.05, y + radius * 0.8);
    pen.closePath();
  }
}

/** A small badge for a lantern: its shape or shapes, filled in colour with a dark outline. */
export function badgeTexture(colour: LanternColour): CanvasTexture | null {
  const parts = partsOf(colour);
  if (parts.length === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const pen = canvas.getContext('2d');
  if (pen !== null) {
    pen.lineJoin = 'round';
    parts.forEach((part, index) => {
      const x = parts.length === 1 ? 64 : 38 + index * 52;
      draw(pen, COLOUR_SHAPE[part], x, 33, 17);
      pen.lineWidth = 9;
      pen.strokeStyle = 'rgba(26, 20, 40, 0.92)';
      pen.stroke();
      pen.fillStyle = css(COLOUR_HEX[part]);
      pen.fill();
    });
  }
  return new CanvasTexture(canvas);
}
