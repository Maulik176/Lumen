/**
 * Where a lantern in the Shared Night Sky is, given the camera's view. Pure, so it can be
 * tested; the sky's shader (`client/game/skyfield.ts`) repeats exactly these formulas, and the
 * client uses this function to find a tapped lantern.
 *
 * Every lantern is placed inside what the camera can actually see. Its sideways place is a
 * share of the view's real half-width at its distance, so a narrow portrait phone and a wide
 * desktop both show every lantern. Once the camera is aloft (after the release), each lantern
 * rises through the band the camera sees at its distance; while playing, through a tall band
 * behind the island.
 */
import { SKY } from './config';

/** What the sky needs to know about the camera, as it is this frame. */
export type SkyView = {
  /** 0 while playing, 1 once the camera has followed the lantern up. */
  aloft: number;
  /** The height the camera looks at, and how steeply it looks down (tan of the angle). */
  aimY: number;
  dropTan: number;
  /** The camera's horizontal distance back from the island's centre. */
  camBack: number;
  /** tan of half the vertical and half the horizontal field of view. */
  halfV: number;
  halfH: number;
};

/** A repeatable number in 0..1 from a name. */
export function nameHash(name: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < name.length; i++)
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/** The fixed facts about one player's lantern, from their name. */
export type SkyLook = {
  /** -1..1: left edge to right edge of the view. */
  side: number;
  /** 0..1: where in its slow climb it starts. */
  phase: number;
  /** Distance beyond the island, in tiles. */
  depth: number;
  /** 0..1: its own speed and sway. */
  seed: number;
};

export function skyLook(name: string): SkyLook {
  return {
    side: (nameHash(name, 1) - 0.5) * 2,
    phase: nameHash(name, 4),
    depth: SKY.ringNear + nameHash(name, 2) * (SKY.ringFar - SKY.ringNear),
    seed: nameHash(name, 3),
  };
}

/** How far through its climb a lantern is, 0..1, at `seconds`. It wraps round at 1. */
export function climbAt(look: SkyLook, seconds: number): number {
  const span = SKY.heightHigh - SKY.heightLow;
  const rate = (SKY.riseSpeed * (0.6 + look.seed * 0.8)) / span;
  const t = look.phase + seconds * rate;
  return t - Math.floor(t);
}

/** The phase that puts a new arrival at the bottom of its climb right now. */
export function arrivalPhase(look: SkyLook, seconds: number): number {
  const span = SKY.heightHigh - SKY.heightLow;
  const rate = (SKY.riseSpeed * (0.6 + look.seed * 0.8)) / span;
  const t = SKY.arrivalClimb - seconds * rate;
  return t - Math.floor(t);
}

/** The lantern's place in the sky's own space (before it turns with the camera). */
export function skySpot(
  look: SkyLook,
  seconds: number,
  view: SkyView
): { x: number; y: number; z: number } {
  const t = climbAt(look, seconds);
  const reach = look.depth + view.camBack;
  const sway = Math.sin(seconds * 0.25 + look.seed * 40) * SKY.sway;
  const x = look.side * view.halfH * SKY.viewFill * reach + sway;
  const play = SKY.heightLow + t * (SKY.heightHigh - SKY.heightLow);
  const band = SKY.bandBelow + SKY.bandAbove;
  const aloft =
    view.aimY -
    view.dropTan * look.depth +
    (t * band - SKY.bandBelow) * view.halfV * SKY.viewFill * reach;
  return {
    x,
    y: play + (aloft - play) * view.aloft,
    z: -look.depth,
  };
}

/**
 * The lanterns to draw for a viewer: everyone but themselves (their own is the big lantern that
 * rose from their island), each name once.
 */
export function othersInSky<T extends { u: string }>(
  lanterns: readonly T[],
  self: string | null
): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const lantern of lanterns) {
    if (lantern.u === self || seen.has(lantern.u)) continue;
    seen.add(lantern.u);
    kept.push(lantern);
  }
  return kept;
}
