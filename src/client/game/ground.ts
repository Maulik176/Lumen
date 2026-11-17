/**
 * The island itself: chunky tiles, the earth rim around them, the rock it hangs from, water,
 * rocks and trees, and a few small props on the rim. Everything is built from primitives and
 * coloured per biome; nothing here is loaded from a file.
 */
import {
  BoxGeometry,
  type BufferGeometry,
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
  type Texture,
  Vector3,
} from 'three';
import { ART, type BiomeLook } from '../../shared/config';
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
const other = new Color();

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
  // Tiles meet edge to edge: no grid lines. Each differs a little from its neighbours in height
  // and tone, which is all that marks the squares.
  // The top is cut three by three and its inner corners pushed out toward the edge, leaving a
  // narrow band all round that darkens to the edge: a soft seam between neighbours.
  const tileBox = new BoxGeometry(1, 0.5, 1, 3, 1, 3).toNonIndexed();
  const tileNormals = tileBox.getAttribute('normal');
  const tilePoints = tileBox.getAttribute('position');
  const inner = 0.5 - ART.seamWidth;
  for (let i = 0; i < tilePoints.count; i++) {
    const x = tilePoints.getX(i);
    const z = tilePoints.getZ(i);
    if (Math.abs(x) < 0.4) tilePoints.setX(i, Math.sign(x) * inner);
    if (Math.abs(z) < 0.4) tilePoints.setZ(i, Math.sign(z) * inner);
  }
  const tilePaint = new Float32Array(tileNormals.count * 3);
  for (let i = 0; i < tileNormals.count; i++) {
    const atEdge =
      Math.abs(tilePoints.getX(i)) > 0.49 ||
      Math.abs(tilePoints.getZ(i)) > 0.49;
    const shade = tileNormals.getY(i) > 0.5 ? (atEdge ? ART.seam : 1) : 0.78;
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
    const lift = ground === 'water' ? 0 : (noise(tile, 1) - 0.5) * ART.tileLift;
    position.set(
      worldX,
      tileTop(ground) - 0.25 - ART.tileLift / 2 + lift,
      worldZ
    );
    matrix.compose(position, turn.identity(), scale.set(1, 1, 1));
    tiles.setMatrixAt(tile, matrix);
    if (ground === 'water') colour.setHex(look.water);
    else
      colour
        .setHex(look.groundA)
        .lerp(
          other.setHex(look.groundB),
          0.5 + (x % 2 === y % 2 ? -0.5 : 0.5) * ART.chequer
        )
        .multiplyScalar(1 + (noise(tile, 2) - 0.5) * 2 * ART.tileShade);
    tiles.setColorAt(tile, colour);
    if (ground === 'rock') rockTiles.push(tile);
    if (ground === 'tree') treeTiles.push(tile);
  }
  group.add(tiles);
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
      // A turf ledge around the tiles, then bare earth under it: an island's edge, not a tray's.
      place(
        paint(new BoxGeometry(rimWidth, 0.16, rimDepth), look.groundSide, 1.12),
        at(0, -0.2, 0)
      ),
      place(
        paint(
          new BoxGeometry(rimWidth - 0.14, 0.22, rimDepth - 0.14),
          look.rim
        ),
        at(0, -0.37, 0)
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
  // The rock pales toward the mist as it goes down, so the island has no hard underside.
  const basePaint = base.getAttribute('color');
  const basePoints = base.getAttribute('position');
  const mistTone = new Color(look.mist);
  const lowest = deep - span * 0.45;
  for (let i = 0; i < basePoints.count; i++) {
    const depth = Math.min(
      1,
      Math.max(0, (basePoints.getY(i) + 0.5) / (lowest + 0.5))
    );
    colour
      .setRGB(basePaint.getX(i), basePaint.getY(i), basePaint.getZ(i))
      .lerp(mistTone, depth * ART.undersideFade);
    basePaint.setXYZ(i, colour.r, colour.g, colour.b);
  }
  group.add(new Mesh(base, lit));

  // --- Small islets floating near the island: a grass cap on a point of rock. -----------------
  const isletGeometry = keeper.keep(
    merge([
      place(
        paint(new CylinderGeometry(1, 0.9, 0.2, 7), look.groundA),
        at(0, -0.1, 0)
      ),
      place(
        paint(new CylinderGeometry(0.9, 0.62, 0.3, 7), look.rim),
        at(0, -0.35, 0)
      ),
      place(
        paint(new ConeGeometry(0.62, 1.5, 7), look.underside, 0.85),
        new Matrix4().makeRotationX(Math.PI).setPosition(0, -1.25, 0)
      ),
      place(
        paint(new DodecahedronGeometry(0.2), look.rock),
        at(0.35, 0.1, 0.2)
      ),
    ])
  );
  const islets = new InstancedMesh(isletGeometry, lit, ART.islets);
  const isletTrees = new InstancedMesh(
    keeper.keep(treeGeometry(look)),
    lit,
    ART.islets
  );
  for (let i = 0; i < ART.islets; i++) {
    // One toward each corner, where they never stand between the camera and the tiles.
    const around = Math.PI / 4 + (i * Math.PI) / 2 + (noise(i, 71) - 0.5) * 0.5;
    const away = span * 0.72 + 1.3 + noise(i, 72) * 1.6;
    const size = 0.55 + noise(i, 73) * 0.6;
    position.set(
      Math.cos(around) * away,
      -1 - noise(i, 74) * 2.4,
      Math.sin(around) * away
    );
    turn.setFromAxisAngle(up, noise(i, 75) * Math.PI * 2);
    islets.setMatrixAt(
      i,
      matrix.compose(position, turn, scale.set(size, size, size))
    );
    // A tree on most of them, sized to its islet.
    const tree = noise(i, 76) < 0.75 ? size * 0.8 : 0;
    position.x -= size * 0.2;
    isletTrees.setMatrixAt(
      i,
      matrix.compose(position, turn, scale.set(tree, tree, tree))
    );
  }
  group.add(islets, isletTrees);

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
  // A second, higher bank wraps the rock where it narrows.
  const bank = new Sprite(mistMaterial);
  bank.position.set(0, deep + span * 0.05, 0);
  bank.scale.set(span * 1.5, span * 0.7, 1);
  group.add(mist, bank);
  const mistBase = new Color(look.mist);

  return {
    group,
    update(horizon, dusk) {
      mistMaterial.color.copy(mistBase).lerp(horizon, 0.5 + dusk * 0.4);
      mistMaterial.opacity = 0.55 - dusk * 0.25;
    },
  };
}
