/**
 * The Shared Night Sky: everyone who lit tonight's island, each as a small paper lantern
 * drifting up around it, carrying their snoovatar or a seal with their first letter.
 *
 * Up to SKY.maxLanterns are drawn as points in ONE draw call. Every lantern's picture is painted
 * once into a cell of one shared sheet (a canvas texture), and each point shows its own cell.
 * Nearer lanterns are larger. On a quiet night, last night's lanterns are drawn too, faintly.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CustomBlending,
  Group,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Camera,
  type Scene,
} from 'three';
import type { SkyLantern } from '../../shared/api';
import {
  arrivalPhase,
  crowdScale,
  nameHash,
  quietness,
  skySize,
  skyLook,
  skySpot,
  type SkyLook,
  type SkyView,
} from '../../shared/skyspot';
import { LOOK, SKY, UI, type LanternStyle } from '../../shared/config';
import { css, type Keeper } from './kit';

/** The band of colour under a lantern's crown says which style its player's streak has earned. */
const STYLE_BAND: Record<LanternStyle, number | null> = {
  plain: null,
  paper: LOOK.beamRed,
  star: LOOK.lanternYellow,
  koi: LOOK.flame,
  comet: LOOK.beamBlue,
};

const CELL = SKY.cellPx;
const COLUMNS = SKY.sheetColumns;
const ROWS = Math.ceil(SKY.maxLanterns / COLUMNS);

// Repeats skySpot() in src/shared/skyspot.ts exactly; change both together.
const VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute float aBorn;
  attribute float aFaint;
  attribute float aCell;
  uniform float uFaint;
  uniform float uTime;
  uniform float uSize;
  uniform float uNear;
  uniform float uLow;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uNight;
  uniform float uDay;
  uniform float uAloft;
  uniform float uAimY;
  uniform float uDropTan;
  uniform float uCamBack;
  uniform float uHalfV;
  uniform float uHalfH;
  uniform float uFill;
  uniform float uBelow;
  uniform float uAbove;
  uniform float uSway;
  uniform float uCrowd;
  uniform float uQuiet;
  uniform float uQuietBelow;
  uniform float uQuietAbove;
  uniform float uQuietFill;
  varying float vAlpha;
  varying float vCell;
  void main() {
    // position: x = side (-1..1), y = phase (0..1), z = -depth.
    float span = uHigh - uLow;
    float rate = uSpeed * (0.6 + aSeed * 0.8) / span;
    // The same formulas as skySpot and skyFade in shared/skyspot.ts: on a quiet night the
    // climb becomes a slow hover up and down in clear view, and nothing fades.
    float wrap = fract(position.y + uTime * rate);
    float hover = 0.5 - 0.5 * cos(6.2831853 * wrap);
    float t = mix(wrap, hover, uQuiet);
    float below = mix(uBelow, uQuietBelow, uQuiet);
    float above = mix(uAbove, uQuietAbove, uQuiet);
    float fill = mix(uFill, uQuietFill, uQuiet);
    float depth = -position.z;
    float reach = depth + uCamBack;
    float x = position.x * uHalfH * fill * reach + sin(uTime * 0.25 + aSeed * 40.0) * uSway;
    float yPlay = uLow + t * span;
    float yAloft = uAimY - uDropTan * depth + (t * (below + above) - below) * uHalfV * fill * reach * uCrowd;
    vec3 p = vec3(x, mix(yPlay, yAloft, uAloft), position.z);
    // Fade in at the bottom and out at the top, so wrapping round is never seen.
    float edge = smoothstep(0.0, 0.08, wrap) * smoothstep(1.0, 0.9, wrap);
    edge = 1.0 - (1.0 - edge) * (1.0 - uQuiet);
    // A lantern that has just arrived is larger for a few seconds.
    float fresh = 1.0 + 0.8 * exp(-max(0.0, uTime - aBorn) * 0.6);
    vAlpha = edge * mix(uDay, 1.0, uNight) * mix(1.0, uFaint, aFaint);
    vCell = aCell;
    vec4 seen = modelViewMatrix * vec4(p, 1.0);
    // Nearer lanterns are larger, within limits, so the sky has depth.
    float near = clamp(uNear / max(1.0, -seen.z), 0.5, 1.5);
    gl_PointSize = uSize * near * fresh;
    gl_Position = projectionMatrix * seen;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uSheet;
  uniform vec2 uGrid;
  varying float vAlpha;
  varying float vCell;
  void main() {
    float column = mod(vCell, uGrid.x);
    float row = floor(vCell / uGrid.x);
    vec2 uv = vec2(
      (column + gl_PointCoord.x) / uGrid.x,
      1.0 - (row + gl_PointCoord.y) / uGrid.y
    );
    // The sheet is premultiplied: its colour already carries its own alpha.
    vec4 paint = texture2D(uSheet, uv);
    gl_FragColor = vec4(paint.rgb * vAlpha, paint.a * vAlpha);
  }
`;

export type SkyField = {
  /** Add a whole list, for a player who has just arrived. `past`: last night's, drawn faintly. */
  set: (lanterns: readonly SkyLantern[], past?: boolean) => void;
  /** One more lantern, as it happens. */
  add: (lantern: SkyLantern) => void;
  /** `yaw` is the camera's turn around the island; the field of lanterns turns with it. */
  update: (
    timeMs: number,
    night: number,
    calm: boolean,
    pixelRatio: number,
    yaw: number,
    /** The camera this frame, so every lantern is placed where it can be seen. */
    view: SkyView
  ) => void;
  count: () => number;
  /**
   * The lantern nearest a tap, if one is within reach. The tap and the answer are in the
   * camera's own view coordinates (-1 to 1); `reach` is in the same units, measured vertically.
   */
  pick: (
    camera: Camera,
    x: number,
    y: number,
    reach: number,
    aspect: number
  ) => { name: string; x: number; y: number; past: boolean } | null;
};

export function createSkyField(
  scene: Scene,
  keeper: Keeper,
  /** The player's own name: their entry is left out (they have their own lantern). */
  self: string | null
): SkyField {
  const max = SKY.maxLanterns;
  const slotNames: string[] = [];
  const spot = new Vector3();
  const positions = new Float32Array(max * 3);
  const seeds = new Float32Array(max);
  const born = new Float32Array(max);
  const faint = new Float32Array(max);
  const cells = new Float32Array(max);
  for (let slot = 0; slot < max; slot++) cells[slot] = slot;
  const geometry = keeper.keep(new BufferGeometry());
  const positionAttribute = new BufferAttribute(positions, 3);
  const seedAttribute = new BufferAttribute(seeds, 1);
  const bornAttribute = new BufferAttribute(born, 1);
  const faintAttribute = new BufferAttribute(faint, 1);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aSeed', seedAttribute);
  geometry.setAttribute('aBorn', bornAttribute);
  geometry.setAttribute('aFaint', faintAttribute);
  geometry.setAttribute('aCell', new BufferAttribute(cells, 1));
  geometry.setDrawRange(0, 0);

  // The sheet: one cell per lantern, painted once when the lantern arrives.
  const sheet = document.createElement('canvas');
  sheet.width = CELL * COLUMNS;
  sheet.height = CELL * ROWS;
  const pen = sheet.getContext('2d');
  const sheetMap = keeper.keep(new CanvasTexture(sheet));
  // Uploaded as it is (premultiplied), never un-premultiplied: that round trip is what turns a
  // canvas's faint soft edges into coloured speckle on Safari.
  sheetMap.premultiplyAlpha = true;
  let sheetStale = false;

  // A picture the browser will not let us read back (no cross-origin permission) would taint
  // the whole sheet, and a tainted sheet cannot reach the graphics card: every lantern would
  // vanish. So each picture is tried on a 1-pixel scratch canvas first; if it fails, the
  // lantern keeps its letter seal.
  const scratch = document.createElement('canvas');
  scratch.width = 1;
  scratch.height = 1;
  const scratchPen = scratch.getContext('2d', { willReadFrequently: true });
  const usable = (picture: HTMLImageElement): boolean => {
    if (scratchPen === null) return false;
    try {
      scratchPen.clearRect(0, 0, 1, 1);
      scratchPen.drawImage(picture, 0, 0, 1, 1);
      scratchPen.getImageData(0, 0, 1, 1);
      return true;
    } catch {
      return false;
    }
  };

  /** Paint one lantern into its cell: glow, paper shade, crown, hoop, and who it carries. */
  const paint = (
    slot: number,
    lantern: SkyLantern,
    picture: HTMLImageElement | null
  ): void => {
    if (pen === null) return;
    const left = (slot % COLUMNS) * CELL;
    const top = Math.floor(slot / COLUMNS) * CELL;
    // Drawn on a 72-unit grid, whatever the cell's real size.
    const u = CELL / 72;
    pen.save();
    pen.translate(left, top);
    pen.clearRect(0, 0, CELL, CELL);
    const glow = pen.createRadialGradient(
      36 * u,
      38 * u,
      4 * u,
      36 * u,
      38 * u,
      35 * u
    );
    glow.addColorStop(0, 'rgba(255, 198, 110, 0.55)');
    glow.addColorStop(1, 'rgba(255, 198, 110, 0)');
    pen.fillStyle = glow;
    pen.fillRect(0, 0, CELL, CELL);
    // The shade: wider at the top, with a domed crown.
    const paper = pen.createLinearGradient(0, 12 * u, 0, 60 * u);
    paper.addColorStop(0, css(LOOK.lanternPaper));
    paper.addColorStop(1, css(LOOK.lanternWarm));
    pen.fillStyle = paper;
    pen.beginPath();
    pen.moveTo(18 * u, 22 * u);
    pen.quadraticCurveTo(36 * u, 6 * u, 54 * u, 22 * u);
    pen.lineTo(48 * u, 58 * u);
    pen.lineTo(24 * u, 58 * u);
    pen.closePath();
    pen.fill();
    const band = STYLE_BAND[lantern.s];
    if (band !== null) {
      pen.fillStyle = css(band);
      pen.fillRect(18.6 * u, 21 * u, 34.8 * u, 3.4 * u);
    }
    pen.fillStyle = css(LOOK.woodDark);
    pen.fillRect(23 * u, 57 * u, 26 * u, 3.2 * u);
    if (picture !== null && usable(picture)) {
      // The snoovatar, printed small on the paper.
      pen.drawImage(picture, 26 * u, 27 * u, 20 * u, 26.5 * u);
    } else {
      // A round seal with the player's first letter, in a colour of their own.
      pen.beginPath();
      pen.arc(36 * u, 40 * u, 9.5 * u, 0, Math.PI * 2);
      pen.fillStyle = UI.paper;
      pen.fill();
      pen.lineWidth = 1.8 * u;
      pen.strokeStyle = `hsl(${Math.round(nameHash(lantern.u, 9) * 360)} 55% 46%)`;
      pen.stroke();
      pen.fillStyle = UI.ink;
      pen.font = `600 ${Math.round(12 * u)}px "Young Serif", Georgia, serif`;
      pen.textAlign = 'center';
      pen.textBaseline = 'middle';
      pen.fillText(lantern.u.charAt(0).toUpperCase(), 36 * u, 40.8 * u);
    }
    pen.restore();
    sheetStale = true;
  };

  const size: { value: number } = { value: SKY.pointSize };
  const uniforms = {
    uTime: { value: 0 },
    uSize: size,
    uNear: { value: SKY.fullSizeAt },
    uLow: { value: SKY.heightLow },
    uHigh: { value: SKY.heightHigh },
    uSpeed: { value: SKY.riseSpeed },
    uNight: { value: 0 },
    uDay: { value: SKY.dayOpacity },
    uFaint: { value: SKY.lastNightOpacity },
    uSheet: { value: sheetMap },
    uAloft: { value: 0 },
    uAimY: { value: 0 },
    uDropTan: { value: 1 },
    uCamBack: { value: 10 },
    uHalfV: { value: 0.25 },
    uHalfH: { value: 0.25 },
    uFill: { value: SKY.viewFill },
    uBelow: { value: SKY.bandBelow },
    uAbove: { value: SKY.bandAbove },
    uSway: { value: SKY.sway },
    uCrowd: { value: 1 },
    uQuiet: { value: 1 },
    uQuietBelow: { value: SKY.quietBandBelow },
    uQuietAbove: { value: SKY.quietBandAbove },
    uQuietFill: { value: SKY.quietFill },
    uGrid: { value: new Vector2(COLUMNS, ROWS) },
  };
  const material = keeper.keep(
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    })
  );
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -5;
  const field = new Group();
  field.add(points);
  scene.add(field);

  let total = 0;
  let loads = 0;
  const looks: SkyLook[] = [];
  let view: SkyView = {
    aloft: 0,
    aimY: 0,
    dropTan: 1,
    camBack: 10,
    halfV: 0.25,
    halfH: 0.25,
    count: 0,
  };
  let nowSeconds = 0;
  const names = new Set<string>();

  const place = (lantern: SkyLantern, fresh: boolean, past = false): void => {
    // The player's own entry (from /api/sky or the realtime echo) is never drawn here: their
    // lantern is the big one that rose from the island, labelled "You". (Same rule as
    // othersInSky in shared/skyspot.ts, which is tested.)
    if (names.has(lantern.u) || lantern.u === self) return;
    names.add(lantern.u);
    // Past the cap the oldest slot is reused, so the newest lanterns are always the ones shown.
    const slot = total % max;
    total++;
    // Where it sits comes from the player's name; the shader keeps it inside the view.
    const look = skyLook(lantern.u);
    // A new arrival starts at the bottom of its climb and rises into view.
    if (fresh) look.phase = arrivalPhase(look, uniforms.uTime.value);
    looks[slot] = look;
    positions[slot * 3] = look.side;
    positions[slot * 3 + 1] = look.phase;
    positions[slot * 3 + 2] = -look.depth;
    seeds[slot] = look.seed;
    slotNames[slot] = lantern.u;
    born[slot] = fresh ? nowSeconds : -100;
    faint[slot] = past ? 1 : 0;
    positionAttribute.needsUpdate = true;
    seedAttribute.needsUpdate = true;
    bornAttribute.needsUpdate = true;
    faintAttribute.needsUpdate = true;
    geometry.setDrawRange(0, Math.min(total, max));
    paint(slot, lantern, null);
    // Snoovatars are fetched for a bounded number of lanterns; the rest keep their seal.
    if (lantern.a === '' || loads >= SKY.snoovatarLoads) return;
    loads++;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (slotNames[slot] === lantern.u) paint(slot, lantern, image);
    };
    image.src = lantern.a;
  };

  /** Where the shader draws a lantern right now, in the field's own space. */
  const pointAt = (slot: number, out: Vector3): boolean => {
    const look = looks[slot];
    if (look === undefined) return false;
    const spot = skySpot(look, uniforms.uTime.value, view);
    out.set(spot.x, spot.y, spot.z);
    return true;
  };

  return {
    set(lanterns, past = false) {
      for (const lantern of lanterns.slice(-max)) place(lantern, false, past);
    },
    add(lantern) {
      place(lantern, true);
    },
    count: () => total,
    pick(camera, x, y, reach, aspect) {
      field.updateMatrixWorld();
      let best: { name: string; x: number; y: number; past: boolean } | null =
        null;
      let nearest = reach;
      const shown = Math.min(total, max);
      for (let slot = 0; slot < shown; slot++) {
        const name = slotNames[slot];
        if (name === undefined) continue;
        if (!pointAt(slot, spot)) continue;
        field.localToWorld(spot).project(camera);
        if (spot.z > 1 || Math.abs(spot.x) > 1 || Math.abs(spot.y) > 1)
          continue;
        const away = Math.hypot((spot.x - x) * aspect, spot.y - y);
        if (away >= nearest) continue;
        nearest = away;
        best = { name, x: spot.x, y: spot.y, past: faint[slot] === 1 };
      }
      return best;
    },
    update(timeMs, night, calm, pixelRatio, yaw, now) {
      field.rotation.y = yaw;
      now.count = Math.min(total, max);
      view = now;
      uniforms.uAloft.value = now.aloft;
      uniforms.uAimY.value = now.aimY;
      uniforms.uDropTan.value = now.dropTan;
      uniforms.uCamBack.value = now.camBack;
      uniforms.uHalfV.value = now.halfV;
      uniforms.uHalfH.value = now.halfH;
      uniforms.uCrowd.value = crowdScale(now.count);
      uniforms.uQuiet.value = quietness(now.count);
      nowSeconds = timeMs / 1000;
      uniforms.uTime.value = calm ? nowSeconds * 0.35 : nowSeconds;
      uniforms.uNight.value = night;
      uniforms.uSize.value = SKY.pointSize * pixelRatio * skySize(now.count);
      // Newly painted cells reach the graphics card once per frame at most.
      if (sheetStale) {
        sheetStale = false;
        sheetMap.needsUpdate = true;
      }
    },
  };
}
