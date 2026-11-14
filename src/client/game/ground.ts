/**
 * The island itself: chunky tiles, the earth rim around them, the rock it hangs from, water,
 * rocks and trees, and a few small props on the rim. Everything is built from primitives and
 * coloured per biome; nothing here is loaded from a file.
 */
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferGeometry,
  type Texture,
} from 'three';
import { HEAT, type BiomeLook } from '../../shared/config';
import type { Puzzle } from '../../shared/types';
import { tileCentre } from './fit';
import { at, merge, noise, paint, place, type Keeper } from './kit';

/** How far the earth rim reaches beyond the outer tiles, in tiles. */
export const RIM = 0.42;

const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();
const up = new Vector3(0, 1, 0);
const colour = new Color();

function treeGeometry(look: BiomeLook): BufferGeometry {
  if (look.tree === 'pine') {
    return merge([
      place(
        paint(new CylinderGeometry(0.06, 0.08, 0.24, 6), look.trunk),
        at(0, 0.12, 0)
      ),
      place(paint(new ConeGeometry(0.34, 0.5, 7), look.crown), at(0, 0.44, 0)),
      place(
        paint(new ConeGeometry(0.26, 0.42, 7), look.crown, 1.08),
        at(0, 0.7, 0)
      ),
      place(
        paint(new ConeGeometry(0.17, 0.32, 7), look.crownAccent),
        at(0, 0.92, 0)
      ),
    ]);
  }
  if (look.tree === 'cactus') {
    return merge([
      place(
        paint(new CylinderGeometry(0.13, 0.15, 0.7, 8), look.crown),
        at(0, 0.35, 0)
      ),
      place(paint(new IcosahedronGeometry(0.13, 0), look.crown), at(0, 0.7, 0)),
      place(
        paint(new CylinderGeometry(0.07, 0.07, 0.26, 6), look.crown, 0.92),
        at(0.2, 0.42, 0)
      ),
      place(
        paint(new CylinderGeometry(0.07, 0.07, 0.2, 6), look.crown, 0.92),
        at(-0.19, 0.3, 0)
      ),
      place(
        paint(new IcosahedronGeometry(0.06, 0), look.crownAccent),
        at(0, 0.84, 0)
      ),
    ]);
  }
  return merge([
    place(
      paint(new CylinderGeometry(0.06, 0.09, 0.4, 6), look.trunk),
      at(0, 0.2, 0)
    ),
    place(paint(new IcosahedronGeometry(0.33, 1), look.crown), at(0, 0.62, 0)),
    place(
      paint(new IcosahedronGeometry(0.2, 0), look.crownAccent),
      at(0.16, 0.8, 0.08)
    ),
    place(
      paint(new IcosahedronGeometry(0.17, 0), look.crown, 0.9),
      at(-0.2, 0.5, -0.1)
    ),
  ]);
}

function tuftGeometry(look: BiomeLook): BufferGeometry {
  return merge([
    place(paint(new ConeGeometry(0.05, 0.2, 4), look.tuft), at(0, 0.1, 0)),
    place(
      paint(new ConeGeometry(0.04, 0.15, 4), look.tuft, 0.9),
      at(0.07, 0.075, 0.03)
    ),
    place(
      paint(new ConeGeometry(0.04, 0.13, 4), look.tuft, 1.08),
      at(-0.06, 0.065, -0.04)
    ),
  ]);
}

/** Top of a tile, in world height. Water sits lower than grass. */
export function tileTop(ground: string): number {
  return ground === 'water' ? -0.07 : 0;
}

export type Ground = {
  group: Group;
  /** Mist follows the sky's horizon colour and thins at night. */
  update: (horizon: Color, dusk: number) => void;
  /** Warm each tile by its share of the busiest one; null puts the colours back. */
  tint: (counts: readonly number[] | null) => void;
};

export function createGround(
  puzzle: Puzzle,
  look: BiomeLook,
  blob: Texture,
  keeper: Keeper
): Ground {
  const { width, height } = puzzle;
  const group = new Group();
  const lit = keeper.keep(
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    })
  );

  // --- Tiles. The box is painted lighter on top than on its sides, then tinted per tile. -----
  const tileBox = new BoxGeometry(0.94, 0.34, 0.94).toNonIndexed();
  const tileNormals = tileBox.getAttribute('normal');
  const tilePaint = new Float32Array(tileNormals.count * 3);
  for (let i = 0; i < tileNormals.count; i++) {
    const shade = tileNormals.getY(i) > 0.5 ? 1 : 0.7;
    tilePaint[i * 3] = shade;
    tilePaint[i * 3 + 1] = shade;
    tilePaint[i * 3 + 2] = shade;
  }
  const tileGeometry = keeper.keep(paint(tileBox, 0xffffff));
  tileGeometry.getAttribute('color').array.set(tilePaint);
  tileBox.dispose();
  const tiles = new InstancedMesh(tileGeometry, lit, width * height);
  const rockTiles: number[] = [];
  const treeTiles: number[] = [];
  for (let tile = 0; tile < width * height; tile++) {
    const x = tile % width;
    const y = Math.floor(tile / width);
    const [worldX, worldZ] = tileCentre(x, y, width, height);
    const ground = puzzle.terrain[tile] ?? 'grass';
    const lift = ground === 'water' ? 0 : (noise(tile, 1) - 0.5) * 0.035;
    position.set(worldX, tileTop(ground) - 0.17 + lift, worldZ);
    matrix.compose(position, turn.identity(), scale.set(1, 1, 1));
    tiles.setMatrixAt(tile, matrix);
    if (ground === 'water') colour.setHex(look.water);
    else
      colour
        .setHex(x % 2 === y % 2 ? look.groundA : look.groundB)
        .multiplyScalar(0.97 + noise(tile, 2) * 0.06);
    tiles.setColorAt(tile, colour);
    if (ground === 'rock') rockTiles.push(tile);
    if (ground === 'tree') treeTiles.push(tile);
  }
  group.add(tiles);
  // The painted colours, kept so a tint can always be taken off again.
  const tileColours = Float32Array.from(tiles.instanceColor?.array ?? []);
  const heat = new Color(HEAT.colour);

  // --- The earth rim and the rock underneath, as one painted shape. --------------------------
  const span = Math.max(width, height) + RIM * 2;
  const rimWidth = width + RIM * 2;
  const rimDepth = height + RIM * 2;
  const squash = new Matrix4();
  const quarter = new Matrix4().makeRotationY(Math.PI / 4);
  /** A four-sided block whose top is the rim's own rectangle, narrowing as it goes down. */
  const slab = (
    top: number,
    bottom: number,
    tall: number,
    y: number,
    shade: number
  ) => {
    const block = paint(
      new CylinderGeometry(
        top * Math.SQRT1_2,
        bottom * Math.SQRT1_2,
        tall,
        4,
        1
      ),
      look.underside,
      shade
    );
    block.applyMatrix4(quarter);
    block.applyMatrix4(squash.makeScale(rimWidth / span, 1, rimDepth / span));
    return place(block, at(0, y, 0));
  };
  /** A hanging point of rock, somewhere under the island. */
  const spike = (
    radius: number,
    tall: number,
    x: number,
    y: number,
    z: number,
    shade: number
  ) =>
    place(
      paint(new ConeGeometry(radius, tall, 6), look.underside, shade),
      new Matrix4().makeRotationX(Math.PI).setPosition(x, y, z)
    );
  const deep = -0.56 - span * 0.36;
  const base = keeper.keep(
    merge([
      place(
        paint(new BoxGeometry(rimWidth, 0.3, rimDepth), look.rim),
        at(0, -0.29, 0)
      ),
      slab(span * 0.99, span * 0.72, 0.34, -0.61, 0.92),
      slab(span * 0.72, span * 0.3, span * 0.36, -0.78 - span * 0.18, 0.8),
      spike(
        span * 0.17,
        span * 0.5,
        span * 0.03,
        deep - span * 0.2,
        -span * 0.02,
        0.72
      ),
      spike(
        span * 0.1,
        span * 0.3,
        -span * 0.16,
        deep - span * 0.1,
        span * 0.06,
        0.66
      ),
      spike(
        span * 0.08,
        span * 0.24,
        span * 0.17,
        deep - span * 0.08,
        span * 0.08,
        0.7
      ),
    ])
  );
  group.add(new Mesh(base, lit));

  // --- Rocks and trees stand on their own tiles, never on a tile the player can use. ----------
  if (rockTiles.length > 0) {
    const geometry = keeper.keep(
      merge([
        place(paint(new DodecahedronGeometry(0.32), look.rock), at(0, 0.22, 0)),
        place(
          paint(new DodecahedronGeometry(0.19), look.rock, 0.88),
          at(0.22, 0.12, 0.16)
        ),
        place(
          paint(new DodecahedronGeometry(0.13), look.rock, 1.1),
          at(-0.2, 0.09, 0.2)
        ),
      ])
    );
    const rocks = new InstancedMesh(geometry, lit, rockTiles.length);
    rockTiles.forEach((tile, index) => {
      const [worldX, worldZ] = tileCentre(
        tile % width,
        Math.floor(tile / width),
        width,
        height
      );
      const size = 0.9 + noise(tile, 3) * 0.3;
      position.set(worldX, 0, worldZ);
      turn.setFromAxisAngle(
        up,
        Math.floor(noise(tile, 4) * 4) * (Math.PI / 2) + noise(tile, 5) * 0.5
      );
      matrix.compose(
        position,
        turn,
        scale.set(size, size * (0.85 + noise(tile, 6) * 0.35), size)
      );
      rocks.setMatrixAt(index, matrix);
    });
    group.add(rocks);
  }

  if (treeTiles.length > 0) {
    const trees = new InstancedMesh(
      keeper.keep(treeGeometry(look)),
      lit,
      treeTiles.length
    );
    treeTiles.forEach((tile, index) => {
      const [worldX, worldZ] = tileCentre(
        tile % width,
        Math.floor(tile / width),
        width,
        height
      );
      const size = 0.88 + noise(tile, 7) * 0.26;
      position.set(worldX, 0, worldZ);
      turn.setFromAxisAngle(up, noise(tile, 8) * Math.PI * 2);
      matrix.compose(position, turn, scale.set(size, size, size));
      trees.setMatrixAt(index, matrix);
    });
    group.add(trees);
  }

  // --- Small things on the rim: tufts, pebbles and two fence posts. ---------------------------
  const tufts: [number, number][] = [];
  const pebbles: [number, number][] = [];
  const edge = RIM * 0.55;
  const around = (width + height) * 2;
  for (let i = 0; i < around; i++) {
    // Walk the rim clockwise; keep about one prop every second tile.
    const side =
      i < width ? 0 : i < width + height ? 1 : i < width * 2 + height ? 2 : 3;
    const along =
      side === 0
        ? i
        : side === 1
          ? i - width
          : side === 2
            ? i - width - height
            : i - width * 2 - height;
    const lengthHere = side % 2 === 0 ? width : height;
    const offset = along - (lengthHere - 1) / 2 + (noise(i, 11) - 0.5) * 0.6;
    const out =
      (side % 2 === 0 ? height : width) / 2 +
      edge +
      (noise(i, 12) - 0.5) * 0.12;
    const spot: [number, number] =
      side === 0
        ? [offset, -out]
        : side === 1
          ? [out, offset]
          : side === 2
            ? [-offset, out]
            : [-out, -offset];
    const pick = noise(i, 13);
    if (pick < 0.42) tufts.push(spot);
    else if (pick < 0.6) pebbles.push(spot);
  }
  if (tufts.length > 0) {
    const mesh = new InstancedMesh(
      keeper.keep(tuftGeometry(look)),
      lit,
      tufts.length
    );
    tufts.forEach(([x, z], index) => {
      const size = 0.8 + noise(index, 14) * 0.7;
      position.set(x, -0.09, z);
      turn.setFromAxisAngle(up, noise(index, 15) * Math.PI * 2);
      matrix.compose(position, turn, scale.set(size, size, size));
      mesh.setMatrixAt(index, matrix);
    });
    group.add(mesh);
  }
  if (pebbles.length > 0) {
    const mesh = new InstancedMesh(
      keeper.keep(paint(new DodecahedronGeometry(0.07), look.rock, 1.05)),
      lit,
      pebbles.length
    );
    pebbles.forEach(([x, z], index) => {
      const size = 0.7 + noise(index, 16) * 0.9;
      position.set(x, -0.07, z);
      turn.setFromAxisAngle(up, noise(index, 17) * 6);
      matrix.compose(position, turn, scale.set(size, size * 0.7, size));
      mesh.setMatrixAt(index, matrix);
    });
    group.add(mesh);
  }
  const post = keeper.keep(
    merge([
      place(
        paint(new CylinderGeometry(0.035, 0.045, 0.42, 6), look.trunk),
        at(0, 0.12, 0)
      ),
      place(
        paint(new CylinderGeometry(0.035, 0.045, 0.34, 6), look.trunk, 0.9),
        at(0.34, 0.08, 0)
      ),
      place(
        paint(new BoxGeometry(0.44, 0.035, 0.03), look.trunk, 1.1),
        at(0.17, 0.16, 0)
      ),
    ])
  );
  const fence = new Mesh(post, lit);
  fence.position.set(-width / 2 - edge, 0, height / 2 - 0.9);
  fence.rotation.y = Math.PI / 2;
  group.add(fence);

  // --- Mist the underside fades into. ---------------------------------------------------------
  const mistMaterial = keeper.keep(
    new SpriteMaterial({
      map: blob,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  const mist = new Sprite(mistMaterial);
  mist.position.set(0, deep - span * 0.3, 0);
  mist.scale.set(span * 2.4, span * 1.3, 1);
  group.add(mist);
  const mistBase = new Color(look.mist);

  return {
    group,
    update(horizon, dusk) {
      mistMaterial.color.copy(mistBase).lerp(horizon, 0.5 + dusk * 0.4);
      mistMaterial.opacity = 0.55 - dusk * 0.25;
    },
    tint(counts) {
      const busiest = counts === null ? 1 : Math.max(1, ...counts);
      for (let tile = 0; tile < width * height; tile++) {
        colour.fromArray(tileColours, tile * 3);
        if (counts !== null && puzzle.terrain[tile] === 'grass') {
          const share = (counts[tile] ?? 0) / busiest;
          if (share > 0)
            colour
              .lerp(heat, HEAT.mix * share)
              .multiplyScalar(1 + (HEAT.boost - 1) * share);
          else colour.multiplyScalar(HEAT.unused);
        }
        tiles.setColorAt(tile, colour);
      }
      if (tiles.instanceColor !== null) tiles.instanceColor.needsUpdate = true;
    },
  };
}
