/**
 * The 3D view of an island. It ties together the sky, the ground, the pieces, the light, the
 * lanterns and the sky lantern, and owns the camera and the frame loop.
 *
 * This file draws what `PlayState` says. It holds no rules of its own.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { BIOME_LOOK, CAMERA, RELEASE, VIEW } from '../../shared/config';
import type { Biome } from '../../shared/calendar';
import type { PlayState } from '../../shared/play';
import type { Puzzle } from '../../shared/types';
import { createBeams } from './beams';
import {
  cameraPosition,
  easeInOut,
  fitDistance,
  tileAt,
  tileCentre,
} from './fit';
import { createGround, RIM } from './ground';
import { createKeeper, softDisc, sparkle } from './kit';
import { createLanterns } from './lanterns';
import { createPieceKit } from './pieces';
import { createSkyLantern, type Rider } from './release';
import { createSky } from './sky';

const DEGREES = Math.PI / 180;
/** How level the camera gets as it follows the sky lantern up, in degrees above the horizon. */
const RELEASE_PITCH = 14;
/** How much closer the camera comes to the sky lantern than it sits to the island. */
const RELEASE_ZOOM = 0.55;

type PieceView = { group: Group; code: string; bornAt: number };

export type ViewStats = {
  fps: number;
  calls: number;
  triangles: number;
  pixelRatio: number;
};

export type IslandView = {
  /** Fit the island to the canvas, leaving `top` and `bottom` pixels clear for the interface. */
  resize: (width: number, height: number, top: number, bottom: number) => void;
  /** Redraw pieces, light and lanterns from the play state. */
  sync: (state: PlayState) => void;
  /** The tile under a point on the screen, or null. */
  pick: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Turn the view a quarter turn. */
  rotate: () => void;
  /** Night falls, then each lantern blooms in turn. Resolves when the last has bloomed. */
  nightfall: (onBloom: (index: number) => void) => Promise<void>;
  /** The player's sky lantern lifts off and the camera follows it up. Resolves when it is aloft. */
  release: () => Promise<void>;
  /** Back to dusk, for another go. */
  dawn: () => void;
  stats: () => ViewStats;
  dispose: () => void;
};

export type ViewOptions = { biome: Biome; calm: boolean; rider: Rider };

export function createIslandView(
  canvas: HTMLCanvasElement,
  puzzle: Puzzle,
  options: ViewOptions
): IslandView {
  const { width, height } = puzzle;
  const { calm } = options;
  const look = BIOME_LOOK[options.biome];
  const keeper = createKeeper();

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, VIEW.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.info.autoReset = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fieldOfViewDegrees, 1, 0.5, 700);

  const glowMap = keeper.keep(softDisc(64, 0, 0.32));
  const blobMap = keeper.keep(softDisc(128, 0, 0.5));
  const sparkleMap = keeper.keep(sparkle(64));

  const sky = createSky(scene, look, blobMap, keeper);

  const hemisphere = new HemisphereLight(0xffffff, 0x8f8a78, 1);
  const sun = new DirectionalLight(0xffe6bd, 1.3);
  sun.position.set(-5, 9, 6);
  const moon = new AmbientLight(0x93a2ff, 0);
  scene.add(hemisphere, sun, moon);
  const sunDay = new Color(0xffe6bd);
  const sunDusk = new Color(0xff9d6b);

  // Everything that floats together.
  const island = new Group();
  scene.add(island);
  const ground = createGround(puzzle, look, blobMap, keeper);
  island.add(ground.group);

  const kit = createPieceKit(glowMap, keeper);
  for (const source of puzzle.sources) {
    const [x, z] = tileCentre(source.x, source.y, width, height);
    const crystal = kit.sunCrystal(source.colour);
    crystal.position.set(x, 0, z);
    island.add(crystal);
  }
  for (const mirror of puzzle.fixedMirrors) {
    const [x, z] = tileCentre(mirror.x, mirror.y, width, height);
    const fixed = kit.fixedMirror(mirror.orientation);
    fixed.position.set(x, 0, z);
    island.add(fixed);
  }

  const lanterns = createLanterns(puzzle, glowMap, keeper, calm);
  island.add(lanterns.group);
  const beams = createBeams(sparkleMap, keeper);
  island.add(beams.group);
  const skyLantern = createSkyLantern(options.rider, glowMap, keeper);
  island.add(skyLantern.group);

  const pieces = new Map<number, PieceView>();

  // --- Things that change over time ---------------------------------------------------------
  const startedAt = performance.now();
  let now = startedAt;
  let lastFrame = startedAt;
  let allLit = false;
  /** -1 until Lock in; then the moment night began to fall. */
  let nightAt = -1;
  let duskAtNightfall: number = VIEW.duskStart;
  /** -1 until the sky lantern lifts off. */
  let releaseAt = -1;
  let yawFrom = 0;
  let yawTo = 0;
  let yawAt = -1;
  let distance = 20;
  let distanceTarget = 20;
  let framed = false;
  let offsetY = 0;
  let offsetTarget = 0;
  let viewWidth = 1;
  let viewHeight = 1;
  let slowFrames = 0;
  let frameHandle = 0;
  let disposed = false;
  let fps = 60;
  let calls = 0;
  let triangles = 0;
  const pitch = CAMERA.pitchDegrees * DEGREES;

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

  /** 0 before the sky lantern lifts, 1 once it is aloft. */
  const riseNow = (): number => {
    if (releaseAt < 0) return 0;
    return easeInOut(
      (now - releaseAt) / (calm ? RELEASE.calmRiseMs : RELEASE.riseMs)
    );
  };

  const applyCamera = (): void => {
    const turnProgress =
      yawAt < 0 ? 1 : easeInOut((now - yawAt) / CAMERA.rotateMs);
    const yaw = yawFrom + (yawTo - yawFrom) * turnProgress;
    if (turnProgress >= 1) yawAt = -1;

    // Calm mode never moves the camera: the lantern travels and the light changes instead.
    const rise = calm ? 0 : riseNow();
    const lanternHeight = 1 + RELEASE.riseHeight * rise;
    const targetY = 0.15 + (lanternHeight * 0.92 - 0.15) * rise;
    const pitchNow = pitch + (RELEASE_PITCH * DEGREES - pitch) * rise;
    const distanceNow = distance * (1 + (RELEASE_ZOOM - 1) * rise);
    const [x, y, z] = cameraPosition(distanceNow, pitchNow, yaw);
    camera.position.set(x, y + targetY, z);
    camera.lookAt(0, targetY, 0);
    // The picture is shifted to sit between the bars; once aloft the sky fills the whole view.
    camera.setViewOffset(
      viewWidth,
      viewHeight,
      0,
      offsetY * (1 - rise),
      viewWidth,
      viewHeight
    );
  };

  const frame = (time: number): void => {
    if (disposed) return;
    frameHandle = requestAnimationFrame(frame);
    const delta = Math.min(100, Math.max(1, time - lastFrame));
    lastFrame = time;
    now = time;
    fps += (1000 / delta - fps) * 0.05;

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
    const night = Math.max(0, (dusk - 0.55) / 0.45);
    sky.update(dusk, time, calm);
    ground.update(sky.horizon, dusk);
    hemisphere.color.copy(sky.top).lerp(sunDay, 0.6);
    hemisphere.intensity = 1.5 - 1.05 * dusk;
    sun.color.lerpColors(sunDay, sunDusk, Math.min(1, dusk * 1.6));
    sun.intensity = 1.5 - 1.3 * dusk;
    moon.intensity = 0.62 * night;

    if (!calm)
      island.position.y =
        Math.sin(((time - startedAt) / VIEW.floatPeriodMs) * Math.PI * 2) *
        VIEW.floatHeight;

    // The island is reframed smoothly when the interface below or above it changes size.
    const settle = calm ? 1 : 1 - Math.exp(-delta / 180);
    distance += (distanceTarget - distance) * settle;
    offsetY += (offsetTarget - offsetY) * settle;

    lanterns.update(time, delta, allLit, nightAt >= 0);
    beams.update(time, night, calm);

    for (const piece of pieces.values()) {
      const t = Math.min(1, (time - piece.bornAt) / VIEW.pieceDropMs);
      piece.group.scale.setScalar(calm ? 1 : 0.72 + 0.28 * easeInOut(t));
      piece.group.position.y = calm ? 0 : 0.18 * (1 - easeInOut(t));
    }

    if (releaseAt >= 0) {
      const since = time - releaseAt;
      const rise = riseNow();
      const drift =
        Math.max(0, since - (calm ? RELEASE.calmRiseMs : RELEASE.riseMs)) /
        1000;
      const lift = 1 + RELEASE.riseHeight * rise + drift * RELEASE.driftSpeed;
      const sway = calm
        ? 0
        : Math.sin((since / RELEASE.swayPeriodMs) * Math.PI * 2) *
          RELEASE.swayWidth *
          rise;
      const appear = Math.min(1, since / 700);
      // In calm mode the lantern leaves the picture by fading as it climbs.
      const fade = calm ? appear * (1 - Math.max(0, rise - 0.7) / 0.3) : appear;
      skyLantern.pose(lift - island.position.y, sway, 0.6 + 0.4 * rise, fade);
    }

    applyCamera();
    renderer.info.reset();
    renderer.render(scene, camera);
    calls = renderer.info.render.calls;
    triangles = renderer.info.render.triangles;
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
      const free = Math.max(110, viewHeight - top - bottom);
      const tanHalf = Math.tan((CAMERA.fieldOfViewDegrees * DEGREES) / 2);
      distanceTarget = fitDistance({
        width: width + RIM * 2,
        height: height + RIM * 2,
        tallest: 1.15,
        pitch,
        yaw: 0,
        tanHalfVertical: tanHalf * (free / viewHeight),
        aspect: viewWidth / free,
        margin: CAMERA.margin,
      });
      offsetTarget = -(top - bottom) / 2;
      // The first framing is immediate; later ones glide.
      if (!framed) {
        framed = true;
        distance = distanceTarget;
        offsetY = offsetTarget;
      }
      camera.aspect = viewWidth / viewHeight;
      camera.updateProjectionMatrix();
    },

    sync(state) {
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
        if (existing !== undefined) island.remove(existing.group);
        const [x, z] = tileCentre(placement.x, placement.y, width, height);
        const model =
          placement.piece.kind === 'prism'
            ? kit.prism()
            : kit.mirror(placement.piece.orientation);
        // The model turns inside a holder, so the drop animation never fights its orientation.
        const holder = new Group();
        holder.add(model);
        holder.position.set(x, 0, z);
        island.add(holder);
        pieces.set(tile, { group: holder, code, bornAt: now });
      }
      for (const [tile, piece] of pieces) {
        if (wanted.has(tile)) continue;
        island.remove(piece.group);
        pieces.delete(tile);
      }

      beams.sync(state.light.segments, state.placements, width, height);
      allLit = state.light.solved && state.phase !== 'locked';
      // Night sets the lanterns itself; until then they follow the light.
      if (nightAt < 0)
        lanterns.setLit(state.light.lit, state.light.solved, now);
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

    nightfall(onBloom) {
      duskAtNightfall = duskNow();
      nightAt = now;
      allLit = false;
      // The lanterns sink to embers as the light goes, then bloom one at a time.
      lanterns.embers();
      const fall = calm ? VIEW.calmNightfallMs : VIEW.nightfallMs;
      const gap = calm ? VIEW.calmBloomGapMs : VIEW.lanternBloomGapMs;
      return new Promise<void>((resolve) => {
        for (let index = 0; index < lanterns.count; index++) {
          window.setTimeout(
            () => {
              lanterns.bloom(index, performance.now());
              onBloom(index);
            },
            fall + gap * index
          );
        }
        window.setTimeout(
          resolve,
          fall + gap * Math.max(0, lanterns.count - 1) + RELEASE.delayMs
        );
      });
    },

    release() {
      releaseAt = now;
      return new Promise<void>((resolve) => {
        window.setTimeout(
          resolve,
          (calm ? RELEASE.calmRiseMs : RELEASE.riseMs) + VIEW.resultDelayMs
        );
      });
    },

    dawn() {
      nightAt = -1;
      releaseAt = -1;
      allLit = false;
      skyLantern.hide();
      lanterns.reset();
    },

    stats() {
      return { fps, calls, triangles, pixelRatio };
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      keeper.dispose();
      renderer.dispose();
    },
  };
}
