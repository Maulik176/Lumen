/**
 * The 3D island: tiles, props, sun crystals, lanterns, pieces and light.
 * Milestone 3 placeholder look; Milestone 4 replaces materials and shaders, not this structure.
 *
 * This file draws what `PlayState` says. It holds no rules of its own.
 */
import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CAMERA, PALETTE, VIEW } from '../../shared/config';
import type { PlayState } from '../../shared/play';
import type { BeamColour, LanternColour, Puzzle } from '../../shared/types';
import {
  cameraPosition,
  easeInOut,
  fitDistance,
  tileAt,
  tileCentre,
} from './fit';

const DEGREES = Math.PI / 180;
const BEAM_POOL = 64;
const STAR_COUNT = 420;

const BEAM_HEX: Record<BeamColour, number> = {
  white: PALETTE.beamWhite,
  red: PALETTE.beamRed,
  green: PALETTE.beamGreen,
  blue: PALETTE.beamBlue,
};
/** Different colours ride at slightly different heights so overlapping beams all show. */
const BEAM_HEIGHT: Record<BeamColour, number> = {
  white: 0.32,
  red: 0.29,
  green: 0.35,
  blue: 0.38,
};

const LANTERN_HEX: Record<LanternColour, number> = {
  white: PALETTE.beamWhite,
  red: PALETTE.beamRed,
  green: PALETTE.beamGreen,
  blue: PALETTE.beamBlue,
  magenta: PALETTE.lanternMagenta,
  cyan: PALETTE.lanternCyan,
  yellow: PALETTE.lanternYellow,
};

type LanternView = {
  group: Group;
  paper: MeshStandardMaterial;
  glow: Sprite;
  glowMaterial: SpriteMaterial;
  /** How brightly it is shining now, and where it is heading. 0 dark, 1 full bloom. */
  level: number;
  target: number;
  /** Time the last pop began, or -1. */
  popAt: number;
};

type PieceView = { mesh: Mesh; code: string; bornAt: number };

export type IslandView = {
  /** Fit the island to the canvas, leaving `top` and `bottom` pixels clear for the bars. */
  resize: (width: number, height: number, top: number, bottom: number) => void;
  /** Redraw pieces, light and lanterns from the play state. */
  sync: (state: PlayState) => void;
  /** The tile under a point on the screen, or null. */
  pick: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Turn the view a quarter turn. */
  rotate: () => void;
  /** Soft glow while every lantern is lit and the player has not locked in. */
  setAllLit: (allLit: boolean) => void;
  /** Night falls, then each lantern blooms in turn. Resolves when the last has bloomed. */
  nightfall: (onBloom: (index: number) => void) => Promise<void>;
  /** Back to dusk, for another go. */
  dawn: () => void;
  dispose: () => void;
};

function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const pen = canvas.getContext('2d');
  if (pen !== null) {
    const gradient = pen.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    pen.fillStyle = gradient;
    pen.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

/** A repeatable number in 0..1 for a tile, so props vary without Math.random in the look. */
function tileNoise(tile: number, salt: number): number {
  const value = Math.sin(tile * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createIslandView(
  canvas: HTMLCanvasElement,
  puzzle: Puzzle,
  calm: boolean
): IslandView {
  const { width, height } = puzzle;
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, VIEW.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const skyDay = new Color(PALETTE.skyDay);
  const skyDusk = new Color(PALETTE.skyDusk);
  const skyNight = new Color(PALETTE.skyNight);
  const sky = new Color(PALETTE.skyDay);
  scene.background = sky;

  const camera = new PerspectiveCamera(CAMERA.fieldOfViewDegrees, 1, 0.1, 500);
  const pitch = CAMERA.pitchDegrees * DEGREES;
  let distance = 20;
  let yawFrom = 0;
  let yawTo = 0;
  let yawAt = -1;
  let viewWidth = 1;
  let viewHeight = 1;

  const hemisphere = new HemisphereLight(0xfff4dc, 0x4a5a3c, 1.1);
  const sun = new DirectionalLight(0xffe2b0, 1.3);
  sun.position.set(-4, 9, 5);
  const fill = new AmbientLight(0x8fa0ff, 0);
  scene.add(hemisphere, sun, fill);

  const island = new Group();
  scene.add(island);
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const turn = new Quaternion();
  const upAxis = new Vector3(0, 1, 0);
  const colour = new Color();

  // --- Ground -------------------------------------------------------------------------------
  const tileGeometry = keep(new BoxGeometry(0.96, 0.3, 0.96));
  const tileMaterial = keep(new MeshStandardMaterial({ roughness: 0.95 }));
  const tiles = new InstancedMesh(tileGeometry, tileMaterial, width * height);
  const rockTiles: number[] = [];
  const treeTiles: number[] = [];
  for (let tile = 0; tile < width * height; tile++) {
    const [x, z] = tileCentre(
      tile % width,
      Math.floor(tile / width),
      width,
      height
    );
    const ground = puzzle.terrain[tile];
    const lift = ground === 'water' ? -0.14 : tileNoise(tile, 1) * 0.04;
    position.set(x, -0.15 + lift, z);
    scale.set(1, 1, 1);
    matrix.compose(position, turn.identity(), scale);
    tiles.setMatrixAt(tile, matrix);
    if (ground === 'water') colour.setHex(PALETTE.water);
    else
      colour.setHex(
        (tile % width) % 2 === Math.floor(tile / width) % 2
          ? PALETTE.grassA
          : PALETTE.grassB
      );
    tiles.setColorAt(tile, colour);
    if (ground === 'rock') rockTiles.push(tile);
    if (ground === 'tree') treeTiles.push(tile);
  }
  tiles.instanceMatrix.needsUpdate = true;
  island.add(tiles);

  // The rock the island floats on: the island's own footprint, tapering to a point below.
  const span = Math.max(width, height);
  const undersideGeometry = keep(
    new CylinderGeometry(span * 0.7, span * 0.12, span * 0.7, 4, 1)
  );
  const undersideMaterial = keep(
    new MeshStandardMaterial({
      color: PALETTE.underside,
      roughness: 1,
      flatShading: true,
    })
  );
  const underside = new Mesh(undersideGeometry, undersideMaterial);
  underside.rotation.y = Math.PI / 4;
  underside.scale.set(width / span, 1, height / span);
  underside.position.y = -0.31 - (span * 0.7) / 2;
  island.add(underside);

  if (rockTiles.length > 0) {
    const geometry = keep(new DodecahedronGeometry(0.36));
    const material = keep(
      new MeshStandardMaterial({
        color: PALETTE.rock,
        roughness: 1,
        flatShading: true,
      })
    );
    const rocks = new InstancedMesh(geometry, material, rockTiles.length);
    rockTiles.forEach((tile, index) => {
      const [x, z] = tileCentre(
        tile % width,
        Math.floor(tile / width),
        width,
        height
      );
      const size = 0.85 + tileNoise(tile, 2) * 0.4;
      position.set(x, 0.2, z);
      scale.set(size, size * (0.8 + tileNoise(tile, 3) * 0.4), size);
      turn.setFromAxisAngle(upAxis, tileNoise(tile, 4) * Math.PI * 2);
      matrix.compose(position, turn, scale);
      rocks.setMatrixAt(index, matrix);
    });
    island.add(rocks);
  }

  if (treeTiles.length > 0) {
    const crownGeometry = keep(new ConeGeometry(0.32, 0.8, 7));
    const crownMaterial = keep(
      new MeshStandardMaterial({
        color: PALETTE.tree,
        roughness: 1,
        flatShading: true,
      })
    );
    const trunkGeometry = keep(new CylinderGeometry(0.06, 0.08, 0.3, 6));
    const trunkMaterial = keep(
      new MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 })
    );
    const crowns = new InstancedMesh(
      crownGeometry,
      crownMaterial,
      treeTiles.length
    );
    const trunks = new InstancedMesh(
      trunkGeometry,
      trunkMaterial,
      treeTiles.length
    );
    treeTiles.forEach((tile, index) => {
      const [x, z] = tileCentre(
        tile % width,
        Math.floor(tile / width),
        width,
        height
      );
      const size = 0.9 + tileNoise(tile, 5) * 0.3;
      turn.identity();
      position.set(x, 0.15, z);
      scale.set(1, 1, 1);
      matrix.compose(position, turn, scale);
      trunks.setMatrixAt(index, matrix);
      position.set(x, 0.3 + 0.4 * size, z);
      scale.set(size, size, size);
      matrix.compose(position, turn, scale);
      crowns.setMatrixAt(index, matrix);
    });
    island.add(crowns, trunks);
  }

  // --- Sun crystals and fixed mirrors -------------------------------------------------------
  const glowMap = keep(glowTexture());
  const crystalGeometry = keep(new OctahedronGeometry(0.26));
  const baseGeometry = keep(new CylinderGeometry(0.3, 0.36, 0.14, 8));
  const stoneMaterial = keep(
    new MeshStandardMaterial({ color: PALETTE.rock, roughness: 1 })
  );
  for (const source of puzzle.sources) {
    const [x, z] = tileCentre(source.x, source.y, width, height);
    const material = keep(
      new MeshStandardMaterial({
        color: PALETTE.crystal,
        emissive: BEAM_HEX[source.colour],
        emissiveIntensity: 1.4,
        roughness: 0.3,
        flatShading: true,
      })
    );
    const crystal = new Mesh(crystalGeometry, material);
    crystal.position.set(x, 0.42, z);
    crystal.scale.set(1, 1.5, 1);
    const base = new Mesh(baseGeometry, stoneMaterial);
    base.position.set(x, 0.07, z);
    const haloMaterial = keep(
      new SpriteMaterial({
        map: glowMap,
        color: BEAM_HEX[source.colour],
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0.7,
      })
    );
    const halo = new Sprite(haloMaterial);
    halo.position.set(x, 0.45, z);
    halo.scale.setScalar(1.3);
    island.add(crystal, base, halo);
  }

  const mirrorGeometry = keep(new BoxGeometry(1.0, 0.56, 0.07));
  const mirrorMaterial = keep(
    new MeshStandardMaterial({
      color: PALETTE.mirror,
      roughness: 0.15,
      metalness: 0.6,
    })
  );
  const fixedMaterial = keep(
    new MeshStandardMaterial({
      color: PALETTE.mirrorFixed,
      roughness: 0.4,
      metalness: 0.4,
    })
  );
  const prismGeometry = keep(new CylinderGeometry(0.3, 0.3, 0.52, 3));
  const prismMaterial = keep(
    new MeshStandardMaterial({
      color: PALETTE.prism,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
    })
  );
  for (const mirror of puzzle.fixedMirrors) {
    const [x, z] = tileCentre(mirror.x, mirror.y, width, height);
    const mesh = new Mesh(mirrorGeometry, fixedMaterial);
    mesh.position.set(x, 0.36, z);
    mesh.rotation.y =
      mirror.orientation === 'slash' ? Math.PI / 4 : -Math.PI / 4;
    const base = new Mesh(baseGeometry, stoneMaterial);
    base.position.set(x, 0.07, z);
    island.add(mesh, base);
  }

  // --- Lanterns -----------------------------------------------------------------------------
  // A paper globe with a small wooden cap and foot.
  const bodyGeometry = keep(new SphereGeometry(0.29, 16, 12));
  const capGeometry = keep(new CylinderGeometry(0.11, 0.13, 0.06, 10));
  const footGeometry = keep(new CylinderGeometry(0.16, 0.18, 0.05, 10));
  const handleGeometry = keep(new CylinderGeometry(0.03, 0.03, 0.1, 6));
  const bandGeometry = keep(new CylinderGeometry(0.295, 0.295, 0.08, 16));
  const capMaterial = keep(
    new MeshStandardMaterial({ color: PALETTE.lanternDark, roughness: 1 })
  );
  const lanterns: LanternView[] = puzzle.lanterns.map((lantern) => {
    const [x, z] = tileCentre(lantern.x, lantern.y, width, height);
    const group = new Group();
    group.position.set(x, 0, z);
    const paper = keep(
      new MeshStandardMaterial({
        color: PALETTE.lanternPaper,
        emissive: LANTERN_HEX[lantern.colour],
        emissiveIntensity: 0,
        roughness: 0.8,
      })
    );
    const body = new Mesh(bodyGeometry, paper);
    body.position.y = 0.38;
    body.scale.set(1, 1.12, 1);
    const top = new Mesh(capGeometry, capMaterial);
    top.position.y = 0.71;
    const foot = new Mesh(footGeometry, capMaterial);
    foot.position.y = 0.05;
    const handle = new Mesh(handleGeometry, capMaterial);
    handle.position.y = 0.78;
    group.add(body, top, foot, handle);
    // A coloured band says which light this lantern wants. White lanterns have none.
    if (lantern.colour !== 'white') {
      const bandMaterial = keep(
        new MeshBasicMaterial({ color: LANTERN_HEX[lantern.colour] })
      );
      const band = new Mesh(bandGeometry, bandMaterial);
      band.position.y = 0.38;
      group.add(band);
    }
    const glowMaterial = keep(
      new SpriteMaterial({
        map: glowMap,
        color: LANTERN_HEX[lantern.colour],
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      })
    );
    const glow = new Sprite(glowMaterial);
    glow.position.y = 0.38;
    group.add(glow);
    island.add(group);
    return { group, paper, glow, glowMaterial, level: 0, target: 0, popAt: -1 };
  });

  // --- Light beams: a fixed pool, reused on every change ------------------------------------
  const coreGeometry = keep(new BoxGeometry(1, 0.06, 0.06));
  const haloGeometry = keep(new BoxGeometry(1, 0.02, 0.3));
  const beamMaterials: Record<
    BeamColour,
    { core: MeshBasicMaterial; halo: MeshBasicMaterial }
  > = {
    white: { core: new MeshBasicMaterial(), halo: new MeshBasicMaterial() },
    red: { core: new MeshBasicMaterial(), halo: new MeshBasicMaterial() },
    green: { core: new MeshBasicMaterial(), halo: new MeshBasicMaterial() },
    blue: { core: new MeshBasicMaterial(), halo: new MeshBasicMaterial() },
  };
  for (const [name, pair] of Object.entries(beamMaterials)) {
    const hex =
      name === 'red'
        ? BEAM_HEX.red
        : name === 'green'
          ? BEAM_HEX.green
          : name === 'blue'
            ? BEAM_HEX.blue
            : BEAM_HEX.white;
    for (const [material, opacity] of [
      [pair.core, 0.95],
      [pair.halo, 0.26],
    ] as const) {
      material.color.setHex(hex);
      material.transparent = true;
      material.opacity = opacity;
      material.blending = AdditiveBlending;
      material.depthWrite = false;
      keep(material);
    }
  }
  const beamCores: Mesh[] = [];
  const beamHalos: Mesh[] = [];
  for (let i = 0; i < BEAM_POOL; i++) {
    const core = new Mesh(coreGeometry, beamMaterials.white.core);
    const halo = new Mesh(haloGeometry, beamMaterials.white.halo);
    core.visible = false;
    halo.visible = false;
    beamCores.push(core);
    beamHalos.push(halo);
    island.add(core, halo);
  }

  // --- Stars --------------------------------------------------------------------------------
  const starPositions = new Float32Array(STAR_COUNT * 3);
  // The camera looks down on the island, so the sky it sees is all around and below: stars are
  // spread over a whole sphere, not just overhead.
  for (let i = 0; i < STAR_COUNT; i++) {
    const around = tileNoise(i, 7) * Math.PI * 2;
    const y = tileNoise(i, 8) * 2 - 1;
    const ring = Math.sqrt(1 - y * y);
    const far = 140;
    starPositions[i * 3] = Math.cos(around) * ring * far;
    starPositions[i * 3 + 1] = y * far;
    starPositions[i * 3 + 2] = Math.sin(around) * ring * far;
  }
  const starGeometry = keep(new BufferGeometry());
  starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
  const starMaterial = keep(
    new PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  scene.add(new Points(starGeometry, starMaterial));

  // --- Pieces -------------------------------------------------------------------------------
  const pieces = new Map<number, PieceView>();

  // --- State that changes over time ---------------------------------------------------------
  const startedAt = performance.now();
  let now = startedAt;
  let allLit = false;
  /** -1 until Lock in; then the time night began to fall. */
  let nightAt = -1;
  let duskAtNightfall: number = VIEW.duskStart;
  let slowFrames = 0;
  let frameHandle = 0;
  let disposed = false;
  let lastFrame = startedAt;

  const applyCamera = (): void => {
    const progress = yawAt < 0 ? 1 : easeInOut((now - yawAt) / CAMERA.rotateMs);
    const yaw = yawFrom + (yawTo - yawFrom) * progress;
    if (progress >= 1) yawAt = -1;
    const night =
      nightAt < 0 || calm ? 0 : easeInOut((now - nightAt) / VIEW.nightfallMs);
    const [x, y, z] = cameraPosition(
      distance * (1 + CAMERA.nightLift * night),
      pitch,
      yaw
    );
    camera.position.set(x, y, z);
    camera.lookAt(0, 0.15, 0);
  };

  const duskNow = (): number => {
    if (nightAt >= 0) {
      const fall = easeInOut(
        (now - nightAt) / (calm ? VIEW.calmNightfallMs : VIEW.nightfallMs)
      );
      return duskAtNightfall + (1 - duskAtNightfall) * fall;
    }
    const drift = Math.min(1, (now - startedAt) / VIEW.duskDriftMs);
    return VIEW.duskStart + (VIEW.duskEnd - VIEW.duskStart) * drift;
  };

  const frame = (time: number): void => {
    if (disposed) return;
    frameHandle = requestAnimationFrame(frame);
    const delta = Math.min(100, time - lastFrame);
    lastFrame = time;
    now = time;

    // Drop the resolution once if this device cannot keep up.
    if (delta > VIEW.slowFrameMs && pixelRatio > VIEW.lowPixelRatio) {
      slowFrames++;
      if (slowFrames > VIEW.slowFramesBeforeDrop) {
        pixelRatio = VIEW.lowPixelRatio;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(viewWidth, viewHeight, false);
      }
    } else if (slowFrames > 0) {
      slowFrames--;
    }

    const dusk = duskNow();
    // Gold to rose to indigo: going straight from gold to indigo passes through mud.
    if (dusk < 0.5) sky.lerpColors(skyDay, skyDusk, dusk * 2);
    else sky.lerpColors(skyDusk, skyNight, dusk * 2 - 1);
    hemisphere.intensity = 1.1 - 0.75 * dusk;
    sun.intensity = 1.3 - 1.15 * dusk;
    fill.intensity = 0.55 * dusk;
    starMaterial.opacity = Math.max(0, (dusk - 0.6) / 0.4);

    if (!calm)
      island.position.y =
        Math.sin(((time - startedAt) / VIEW.floatPeriodMs) * Math.PI * 2) *
        VIEW.floatHeight;

    const ease = 1 - Math.exp(-delta / 140);
    for (let i = 0; i < lanterns.length; i++) {
      const lantern = lanterns[i];
      if (lantern === undefined) continue;
      lantern.level += (lantern.target - lantern.level) * ease;
      const breathe =
        allLit && nightAt < 0 && !calm ? 0.08 * Math.sin(time / 420 + i) : 0;
      const level = Math.max(0, lantern.level + breathe);
      lantern.paper.emissiveIntensity = level * 1.7;
      lantern.glowMaterial.opacity = Math.min(1, level * 0.85);
      lantern.glow.scale.setScalar(0.7 + level * 1.5);
      let pop = 1;
      if (lantern.popAt >= 0) {
        const t = (time - lantern.popAt) / VIEW.lanternPopMs;
        if (t >= 1) lantern.popAt = -1;
        else pop = 1 + (VIEW.lanternPopScale - 1) * Math.sin(t * Math.PI);
      }
      lantern.group.scale.setScalar(pop);
    }

    for (const piece of pieces.values()) {
      const t = Math.min(1, (time - piece.bornAt) / VIEW.pieceDropMs);
      const grow = calm ? 1 : 0.7 + 0.3 * easeInOut(t);
      piece.mesh.scale.setScalar(grow);
    }

    applyCamera();
    renderer.render(scene, camera);
  };

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const pickPlane = new Plane(new Vector3(0, 1, 0), -0.2);
  const hit = new Vector3();

  canvas.addEventListener('webglcontextlost', (event) =>
    event.preventDefault()
  );

  frameHandle = requestAnimationFrame(frame);

  return {
    resize(viewW, viewH, top, bottom) {
      viewWidth = Math.max(1, viewW);
      viewHeight = Math.max(1, viewH);
      renderer.setSize(viewWidth, viewHeight, false);
      const free = Math.max(120, viewHeight - top - bottom);
      const tanHalf = Math.tan((CAMERA.fieldOfViewDegrees * DEGREES) / 2);
      distance = fitDistance({
        width,
        height,
        tallest: 1.1,
        pitch,
        yaw: 0,
        tanHalfVertical: tanHalf * (free / viewHeight),
        aspect: viewWidth / free,
        margin: CAMERA.margin,
      });
      camera.aspect = viewWidth / viewHeight;
      // Shift the picture so the island sits in the middle of the space between the bars.
      camera.setViewOffset(
        viewWidth,
        viewHeight,
        0,
        -(top - bottom) / 2,
        viewWidth,
        viewHeight
      );
      camera.updateProjectionMatrix();
    },

    sync(state) {
      // Pieces.
      const wanted = new Set<number>();
      for (const placement of state.placements) {
        const tile = placement.y * width + placement.x;
        const code =
          placement.piece.kind === 'prism'
            ? 'prism'
            : placement.piece.orientation;
        wanted.add(tile);
        const existing = pieces.get(tile);
        if (existing !== undefined && existing.code === code) continue;
        if (existing !== undefined) island.remove(existing.mesh);
        const [x, z] = tileCentre(placement.x, placement.y, width, height);
        const mesh =
          placement.piece.kind === 'prism'
            ? new Mesh(prismGeometry, prismMaterial)
            : new Mesh(mirrorGeometry, mirrorMaterial);
        mesh.position.set(x, placement.piece.kind === 'prism' ? 0.28 : 0.3, z);
        if (placement.piece.kind === 'mirror') {
          mesh.rotation.y =
            placement.piece.orientation === 'slash'
              ? Math.PI / 4
              : -Math.PI / 4;
        }
        island.add(mesh);
        pieces.set(tile, { mesh, code, bornAt: now });
      }
      for (const [tile, piece] of pieces) {
        if (wanted.has(tile)) continue;
        island.remove(piece.mesh);
        pieces.delete(tile);
      }

      // Light.
      let used = 0;
      for (const segment of state.light.segments) {
        if (used >= BEAM_POOL) break;
        const core = beamCores[used];
        const halo = beamHalos[used];
        if (core === undefined || halo === undefined) break;
        const [fromX, fromZ] = tileCentre(
          segment.from.x,
          segment.from.y,
          width,
          height
        );
        const [toX, toZ] = tileCentre(
          segment.to.x,
          segment.to.y,
          width,
          height
        );
        const along =
          segment.direction === 'east' || segment.direction === 'west';
        const sign =
          segment.direction === 'east' || segment.direction === 'south'
            ? 1
            : -1;
        // Run off the island's edge; stop at the face of a rock or crystal, just inside a lantern.
        const extra =
          segment.end === 'edge'
            ? 0.6
            : segment.end === 'blocked'
              ? -0.5
              : segment.end === 'lantern'
                ? -0.2
                : 0;
        const start = along ? fromX : fromZ;
        const end = (along ? toX : toZ) + sign * extra;
        const length = (end - start) * sign;
        if (length <= 0.02) continue;
        const middle = (start + end) / 2;
        const y = BEAM_HEIGHT[segment.colour];
        const pair = beamMaterials[segment.colour];
        for (const [mesh, material] of [
          [core, pair.core],
          [halo, pair.halo],
        ] as const) {
          mesh.material = material;
          mesh.position.set(along ? middle : fromX, y, along ? fromZ : middle);
          mesh.rotation.y = along ? 0 : Math.PI / 2;
          mesh.scale.set(length, 1, 1);
          mesh.visible = true;
        }
        used++;
      }
      for (let i = used; i < BEAM_POOL; i++) {
        const core = beamCores[i];
        const halo = beamHalos[i];
        if (core !== undefined) core.visible = false;
        if (halo !== undefined) halo.visible = false;
      }

      // Lanterns: lit ones glow softly during play. Night changes the targets itself.
      if (nightAt < 0) {
        state.light.lit.forEach((lit, index) => {
          const lantern = lanterns[index];
          if (lantern === undefined) return;
          const target = lit ? 0.55 : 0;
          if (lit && lantern.target === 0 && !calm) lantern.popAt = now;
          lantern.target = target;
        });
      }
    },

    pick(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        -(((clientY - bounds.top) / bounds.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(pickPlane, hit) === null) return null;
      return tileAt(hit.x, hit.z, width, height);
    },

    rotate() {
      const progress =
        yawAt < 0 ? 1 : easeInOut((now - yawAt) / CAMERA.rotateMs);
      yawFrom = yawFrom + (yawTo - yawFrom) * progress;
      yawTo += CAMERA.rotateStepDegrees * DEGREES;
      yawAt = calm ? now - CAMERA.rotateMs : now;
    },

    setAllLit(value) {
      allLit = value;
      if (nightAt >= 0) return;
      for (const lantern of lanterns) {
        if (lantern.target > 0) lantern.target = value ? 0.72 : 0.55;
      }
    },

    nightfall(onBloom) {
      duskAtNightfall = duskNow();
      nightAt = now;
      // The lanterns sink to embers as the light goes, then bloom one at a time.
      for (const lantern of lanterns) lantern.target = 0.1;
      const fall = calm ? VIEW.calmNightfallMs : VIEW.nightfallMs;
      const gap = calm ? VIEW.calmBloomGapMs : VIEW.lanternBloomGapMs;
      return new Promise<void>((resolve) => {
        lanterns.forEach((lantern, index) => {
          window.setTimeout(
            () => {
              lantern.target = 1;
              if (!calm) lantern.popAt = performance.now();
              onBloom(index);
            },
            fall + gap * index
          );
        });
        window.setTimeout(
          resolve,
          fall + gap * Math.max(0, lanterns.length - 1) + VIEW.resultDelayMs
        );
      });
    },

    dawn() {
      nightAt = -1;
      allLit = false;
      for (const lantern of lanterns) {
        lantern.target = 0;
        lantern.popAt = -1;
      }
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      for (const thing of disposables) thing.dispose();
      tiles.dispose();
      renderer.dispose();
    },
  };
}
