/**
 * Small building blocks shared by the scene files: coloured low-poly geometry, merging,
 * soft sprites, and a list of things to dispose.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  type Object3D,
  RGBAFormat,
} from 'three';

export type Keeper = {
  keep: <T extends { dispose: () => void }>(thing: T) => T;
  dispose: () => void;
};

export function createKeeper(): Keeper {
  const things: { dispose: () => void }[] = [];
  return {
    keep(thing) {
      things.push(thing);
      return thing;
    },
    dispose() {
      for (const thing of things) thing.dispose();
      things.length = 0;
    },
  };
}

/** A repeatable number in 0..1 for an index, so props vary without randomness at run time. */
export function noise(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const scratchColour = new Color();

/** Give every vertex of a geometry one colour. Returns a non-indexed copy. */
export function paint(
  geometry: BufferGeometry,
  hex: number,
  shade = 1
): BufferGeometry {
  const flat =
    geometry.index === null ? geometry.clone() : geometry.toNonIndexed();
  const count = flat.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  scratchColour.setHex(hex).multiplyScalar(shade);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = scratchColour.r;
    colours[i * 3 + 1] = scratchColour.g;
    colours[i * 3 + 2] = scratchColour.b;
  }
  flat.setAttribute('color', new BufferAttribute(colours, 3));
  flat.deleteAttribute('uv');
  return flat;
}

/** Move, turn or scale a geometry in place and hand it back. */
export function place(
  geometry: BufferGeometry,
  matrix: Matrix4
): BufferGeometry {
  geometry.applyMatrix4(matrix);
  return geometry;
}

/** Join painted, non-indexed geometries into one, so a whole prop is a single draw call. */
export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  let total = 0;
  for (const part of parts) total += part.getAttribute('position').count;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const colours = new Float32Array(total * 3);
  let offset = 0;
  for (const part of parts) {
    const position = part.getAttribute('position');
    const normal = part.getAttribute('normal');
    const colour = part.getAttribute('color');
    for (let i = 0; i < position.count; i++) {
      const at = (offset + i) * 3;
      positions[at] = position.getX(i);
      positions[at + 1] = position.getY(i);
      positions[at + 2] = position.getZ(i);
      normals[at] = normal.getX(i);
      normals[at + 1] = normal.getY(i);
      normals[at + 2] = normal.getZ(i);
      colours[at] = colour.getX(i);
      colours[at + 1] = colour.getY(i);
      colours[at + 2] = colour.getZ(i);
    }
    offset += position.count;
    part.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setAttribute('normal', new BufferAttribute(normals, 3));
  merged.setAttribute('color', new BufferAttribute(colours, 3));
  return merged;
}

const shift = new Matrix4();

/** Shorthand: a translation matrix. The same matrix object is reused; use it at once. */
export function at(x: number, y: number, z: number): Matrix4 {
  return shift.makeTranslation(x, y, z);
}

/**
 * A soft round blob that fades to nothing at its edge, for glows, mist and light spill.
 *
 * Computed pixel by pixel, not drawn with a canvas gradient: Safari dithers canvas gradients,
 * and where alpha is near zero the browser's un-premultiply turns that dither into wild
 * per-channel colours, which showed as coloured speckle across the whole daytime sky on iPhone.
 * Here the colour is always white and only alpha changes, smoothly, so nothing can speckle.
 */
export function softDisc(size = 64, inner = 0.0, hold = 0.3): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      // The same stops the canvas gradient had: 1 at `inner`, 0.5 at `hold`, 0 at the edge.
      const t = Math.min(1, Math.max(0, (r - inner) / (1 - inner)));
      const alpha =
        t <= hold ? 1 - (0.5 * t) / hold : 0.5 * (1 - (t - hold) / (1 - hold));
      const at = (y * size + x) * 4;
      data[at] = 255;
      data[at + 1] = 255;
      data[at + 2] = 255;
      data[at + 3] = Math.round(Math.max(0, alpha) * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** A four-pointed sparkle, for the place where a prism splits the light. */
export function sparkle(size = 64): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const pen = canvas.getContext('2d');
  if (pen !== null) {
    const half = size / 2;
    pen.translate(half, half);
    pen.fillStyle = 'rgba(255,255,255,1)';
    for (let arm = 0; arm < 4; arm++) {
      pen.rotate(Math.PI / 2);
      pen.beginPath();
      pen.moveTo(0, -half);
      pen.quadraticCurveTo(half * 0.09, -half * 0.09, half * 0.3, 0);
      pen.quadraticCurveTo(half * 0.09, half * 0.09, 0, half * 0.3);
      pen.quadraticCurveTo(-half * 0.09, half * 0.09, -half * 0.3, 0);
      pen.quadraticCurveTo(-half * 0.09, -half * 0.09, 0, -half);
      pen.fill();
    }
  }
  return new CanvasTexture(canvas);
}

/** Thin rays of light around a bright point, long and short by turns, fading outward. */
export function rays(size = 128, count = 14): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const pen = canvas.getContext('2d');
  if (pen !== null) {
    const half = size / 2;
    pen.translate(half, half);
    for (let ray = 0; ray < count; ray++) {
      const reach = half * (ray % 2 === 0 ? 0.98 : 0.6 + noise(ray, 61) * 0.2);
      const fade = pen.createLinearGradient(0, 0, 0, -reach);
      fade.addColorStop(0, 'rgba(255,255,255,0.9)');
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      pen.fillStyle = fade;
      pen.beginPath();
      pen.moveTo(-half * 0.035, 0);
      pen.lineTo(0, -reach);
      pen.lineTo(half * 0.035, 0);
      pen.closePath();
      pen.fill();
      pen.rotate((Math.PI * 2) / count);
    }
  }
  return new CanvasTexture(canvas);
}

/** Remove an object and everything under it from its parent. Geometry is disposed elsewhere. */
export function detach(object: Object3D): void {
  object.parent?.remove(object);
}

/** "#rrggbb" for a 0xRRGGBB number, for drawing on a canvas. */
export function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
