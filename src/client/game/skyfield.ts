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
  varying float vAlpha;
  varying float vCell;
  void main() {
    float span = uHigh - uLow;
    float lift = mod(position.y - uLow + uTime * uSpeed * (0.6 + aSeed * 0.8), span);
    vec3 p = vec3(position.x + sin(uTime * 0.25 + aSeed * 40.0) * 0.6, uLow + lift, position.z);
    // Fade in at the bottom and out at the top, so wrapping round is never seen.
    float edge = smoothstep(0.0, 0.08, lift / span) * smoothstep(1.0, 0.9, lift / span);
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
    vec4 paint = texture2D(uSheet, uv);
    float alpha = paint.a * vAlpha;
    gl_FragColor = vec4(paint.rgb * alpha, alpha);
  }
`;

/** A repeatable number in 0..1 from a name. */
function hash(name: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < name.length; i++)
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

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
    yaw: number
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
  let sheetStale = false;

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
    if (picture !== null) {
      // The snoovatar, printed small on the paper.
      pen.drawImage(picture, 26 * u, 27 * u, 20 * u, 26.5 * u);
    } else {
      // A round seal with the player's first letter, in a colour of their own.
      pen.beginPath();
      pen.arc(36 * u, 40 * u, 9.5 * u, 0, Math.PI * 2);
      pen.fillStyle = UI.paper;
      pen.fill();
      pen.lineWidth = 1.8 * u;
      pen.strokeStyle = `hsl(${Math.round(hash(lantern.u, 9) * 360)} 55% 46%)`;
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
  let nowSeconds = 0;
  const names = new Set<string>();

  const place = (lantern: SkyLantern, fresh: boolean, past = false): void => {
    // The player's own entry (from /api/sky or the realtime echo) is never drawn here: their
    // lantern is the big one that rose from the island, labelled "You".
    if (names.has(lantern.u) || lantern.u === self) return;
    names.add(lantern.u);
    // Past the cap the oldest slot is reused, so the newest lanterns are always the ones shown.
    const slot = total % max;
    total++;
    // The lens is narrow, so lanterns are spread across the slice of sky the camera faces (the
    // whole field turns with the view) rather than all the way round, where most would go unseen.
    const depth =
      SKY.ringNear + hash(lantern.u, 2) * (SKY.ringFar - SKY.ringNear);
    positions[slot * 3] = (hash(lantern.u, 1) - 0.5) * 2 * depth * SKY.spread;
    // A new arrival starts low and rises into view; the rest are spread over the whole height.
    positions[slot * 3 + 1] = fresh
      ? SKY.heightLow +
        (SKY.heightHigh - SKY.heightLow) * 0.1 -
        nowSeconds * SKY.riseSpeed * (0.6 + hash(lantern.u, 3) * 0.8)
      : SKY.heightLow + hash(lantern.u, 4) * (SKY.heightHigh - SKY.heightLow);
    positions[slot * 3 + 2] = -depth;
    seeds[slot] = hash(lantern.u, 3);
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
  const pointAt = (slot: number, out: Vector3): void => {
    const seed = seeds[slot] ?? 0;
    const time = uniforms.uTime.value;
    const span = SKY.heightHigh - SKY.heightLow;
    const travelled =
      (positions[slot * 3 + 1] ?? 0) -
      SKY.heightLow +
      time * SKY.riseSpeed * (0.6 + seed * 0.8);
    const lift = ((travelled % span) + span) % span;
    out.set(
      (positions[slot * 3] ?? 0) + Math.sin(time * 0.25 + seed * 40) * 0.6,
      SKY.heightLow + lift,
      positions[slot * 3 + 2] ?? 0
    );
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
        pointAt(slot, spot);
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
    update(timeMs, night, calm, pixelRatio, yaw) {
      field.rotation.y = yaw;
      nowSeconds = timeMs / 1000;
      uniforms.uTime.value = calm ? nowSeconds * 0.35 : nowSeconds;
      uniforms.uNight.value = night;
      uniforms.uSize.value = SKY.pointSize * pixelRatio;
      // Newly painted cells reach the graphics card once per frame at most.
      if (sheetStale) {
        sheetStale = false;
        sheetMap.needsUpdate = true;
      }
    },
  };
}
