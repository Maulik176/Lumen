/**
 * Camera framing maths, kept free of Three.js so it can be tested.
 *
 * World layout: one tile is one unit. The island is centred on the origin, x runs east,
 * z runs south, y is up. The camera orbits the origin at a fixed pitch.
 */

export type Frame = {
  /** Island size in tiles. */
  width: number;
  height: number;
  /** Tallest thing standing on the island, in tiles, so trees and lanterns are not clipped. */
  tallest: number;
  /** Camera tilt down from the horizon, in radians. */
  pitch: number;
  /** Camera turn around the island, in radians. 0 looks north. */
  yaw: number;
  /** Tangent of half the vertical lens angle for the area the island may use. */
  tanHalfVertical: number;
  /** Width over height of that area. */
  aspect: number;
  /** Share of the area kept empty around the island. */
  margin: number;
};

/** Where the camera sits for a given distance, pitch and yaw. */
export function cameraPosition(
  distance: number,
  pitch: number,
  yaw: number
): [number, number, number] {
  const flat = Math.cos(pitch) * distance;
  return [
    Math.sin(yaw) * flat,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * flat,
  ];
}

/** Largest |x| and |y| any corner of the island's bounding box reaches on screen, in -1..1 units. */
function reach(frame: Frame, distance: number): number {
  const [cx, cy, cz] = cameraPosition(distance, frame.pitch, frame.yaw);
  // Camera axes for a camera at (cx, cy, cz) looking at the origin with y up.
  const length = Math.hypot(cx, cy, cz);
  const fx = -cx / length;
  const fy = -cy / length;
  const fz = -cz / length;
  // right = forward x up
  let rx = fy * 0 - fz * 1;
  let ry = fz * 0 - fx * 0;
  let rz = fx * 1 - fy * 0;
  const rightLength = Math.hypot(rx, ry, rz);
  rx /= rightLength;
  ry /= rightLength;
  rz /= rightLength;
  // up = right x forward
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  let worst = 0;
  const halfW = frame.width / 2;
  const halfH = frame.height / 2;
  for (const x of [-halfW, halfW]) {
    for (const z of [-halfH, halfH]) {
      for (const y of [0, frame.tallest]) {
        const px = x - cx;
        const py = y - cy;
        const pz = z - cz;
        const depth = px * fx + py * fy + pz * fz;
        if (depth <= 0.01) return Number.POSITIVE_INFINITY;
        const sx =
          (px * rx + py * ry + pz * rz) /
          depth /
          (frame.tanHalfVertical * frame.aspect);
        const sy =
          (px * ux + py * uy + pz * uz) / depth / frame.tanHalfVertical;
        worst = Math.max(worst, Math.abs(sx), Math.abs(sy));
      }
    }
  }
  return worst;
}

/** The closest camera distance at which the whole island fits inside the area, margin included. */
export function fitDistance(frame: Frame): number {
  const limit = 1 - frame.margin;
  let near = 1;
  let far = 400;
  for (let i = 0; i < 40; i++) {
    const middle = (near + far) / 2;
    if (reach(frame, middle) > limit) near = middle;
    else far = middle;
  }
  return far;
}

/** Tile under a point on the ground plane, or null when the point is off the island. */
export function tileAt(
  worldX: number,
  worldZ: number,
  width: number,
  height: number
): { x: number; y: number } | null {
  const x = Math.floor(worldX + width / 2);
  const y = Math.floor(worldZ + height / 2);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}

/** Centre of a tile in world units. */
export function tileCentre(
  x: number,
  y: number,
  width: number,
  height: number
): [number, number] {
  return [x - (width - 1) / 2, y - (height - 1) / 2];
}

/** Smooth start and stop for camera turns and nightfall. */
export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Minutes and seconds, as 1:42. */
export function formatTime(elapsedMs: number): string {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
