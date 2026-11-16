/**
 * Where the small lantern goes when another player lights tonight's island while you play.
 * It rises through the empty sky between the interface at the top and the island's far edge,
 * near one side, and never over the island: when that gap is too small, there is no lantern
 * (the line at the top still says who it was). Pure, so it can be tested.
 */
import { SKY } from './config';

export type ArrivalPath = {
  /** Centre of the lantern, in CSS pixels from the left. */
  x: number;
  /** Top of the lantern at the start and at the end of its rise, in CSS pixels. */
  from: number;
  to: number;
};

export function arrivalPath(
  viewWidth: number,
  /** The lowest edge of the interface at the top (bar and hint row). */
  interfaceBottom: number,
  /** The highest point of the island on screen, trees and rim included. */
  islandTop: number,
  /** Which side: true for the left, false for the right. Varies per player. */
  left: boolean
): ArrivalPath | null {
  const gap = islandTop - interfaceBottom;
  if (gap < SKY.arrivalMinGapPx) return null;
  const inset = viewWidth * SKY.arrivalSide;
  return {
    x: left ? inset : viewWidth - inset,
    from: islandTop - SKY.arrivalPx - SKY.arrivalClearPx,
    to: interfaceBottom + SKY.arrivalClearPx,
  };
}
