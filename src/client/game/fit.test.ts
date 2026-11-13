import { describe, expect, it } from 'vitest';
import {
  cameraPosition,
  easeInOut,
  fitDistance,
  formatTime,
  tileAt,
  tileCentre,
  type Frame,
} from './fit';

const DEGREES = Math.PI / 180;

function frame(
  size: number,
  viewWidth: number,
  viewHeight: number,
  yaw = 0
): Frame {
  return {
    width: size,
    height: size,
    tallest: 1,
    pitch: 52 * DEGREES,
    yaw,
    tanHalfVertical: Math.tan(14 * DEGREES),
    aspect: viewWidth / viewHeight,
    margin: 0.08,
  };
}

describe('fitDistance', () => {
  it.each([
    [6, 360, 410],
    [9, 360, 410],
    [6, 430, 701],
    [9, 430, 701],
    [7, 375, 596],
  ])('fits a %ix%i island in a %ix%i area', (size, width, height) => {
    const distance = fitDistance(frame(size, width, height));
    expect(distance).toBeGreaterThan(size);
    expect(distance).toBeLessThan(200);
  });

  it('needs more distance for a bigger island and for a narrower screen', () => {
    expect(fitDistance(frame(9, 430, 701))).toBeGreaterThan(
      fitDistance(frame(6, 430, 701))
    );
    expect(fitDistance(frame(9, 360, 640))).toBeGreaterThan(
      fitDistance(frame(9, 430, 640))
    );
  });

  it('gives the same framing after a quarter turn of a square island', () => {
    const straight = fitDistance(frame(8, 430, 701, 0));
    const turned = fitDistance(frame(8, 430, 701, 90 * DEGREES));
    expect(turned).toBeCloseTo(straight, 3);
  });

  it('is as close as it can be: a little nearer would not fit', () => {
    const base = frame(9, 360, 410);
    const distance = fitDistance(base);
    const tighter = fitDistance({ ...base, margin: 0 });
    expect(tighter).toBeLessThan(distance);
  });
});

describe('cameraPosition', () => {
  it('sits south of and above the island at yaw 0', () => {
    const [x, y, z] = cameraPosition(10, 52 * DEGREES, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(10, 6);
  });
});

describe('tiles', () => {
  it('maps the ground to tiles and back', () => {
    expect(tileAt(-2.9, -2.9, 6, 6)).toEqual({ x: 0, y: 0 });
    expect(tileAt(2.9, 2.9, 6, 6)).toEqual({ x: 5, y: 5 });
    expect(tileAt(0.1, -0.1, 6, 6)).toEqual({ x: 3, y: 2 });
    expect(tileAt(3.01, 0, 6, 6)).toBeNull();
    expect(tileAt(0, -3.01, 6, 6)).toBeNull();
    for (const [x, y] of [
      [0, 0],
      [5, 5],
      [3, 2],
    ] as const) {
      const [wx, wz] = tileCentre(x, y, 6, 6);
      expect(tileAt(wx, wz, 6, 6)).toEqual({ x, y });
    }
  });

  it('centres odd and even islands on the origin', () => {
    expect(tileCentre(3, 3, 7, 7)).toEqual([0, 0]);
    expect(tileCentre(0, 0, 6, 6)).toEqual([-2.5, -2.5]);
  });
});

describe('small helpers', () => {
  it('eases smoothly between 0 and 1', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });

  it('formats time as minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(102_400)).toBe('1:42');
    expect(formatTime(59_600)).toBe('1:00');
    expect(formatTime(605_000)).toBe('10:05');
  });
});
