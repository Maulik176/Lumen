/**
 * The Shared Night Sky: everyone who lit tonight's island, as lanterns drifting up around it.
 *
 * Up to SKY.maxLanterns are drawn as points in ONE draw call, each a small light shaped by the
 * style its player's streak has earned. The newest few who have a snoovatar are drawn larger and
 * nearer, carrying it; their pictures share one atlas texture.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Points,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Camera,
  type Scene,
  type Texture,
} from 'three';
import type { SkyLantern } from '../../shared/api';
import { LOOK, SKY, type LanternStyle } from '../../shared/config';
import { css, type Keeper } from './kit';

const STYLE_CODE: Record<LanternStyle, number> = {
  plain: 0,
  paper: 1,
  star: 2,
  koi: 3,
  comet: 4,
};
const ATLAS_COLUMNS = 4;
const CELL_WIDTH = 96;
const CELL_HEIGHT = 128;

const VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute float aStyle;
  attribute float aBorn;
  uniform float uTime;
  uniform float uSize;
  uniform float uLow;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uNight;
  uniform float uDay;
  uniform float uSelfSize;
  varying float vStyle;
  varying float vAlpha;
  varying float vSelf;
  void main() {
    // The player's own lantern is marked by adding 10 to its style.
    vSelf = step(9.5, aStyle);
    float span = uHigh - uLow;
    float lift = mod(position.y - uLow + uTime * uSpeed * (0.6 + aSeed * 0.8), span);
    vec3 p = vec3(position.x + sin(uTime * 0.25 + aSeed * 40.0) * 0.6, uLow + lift, position.z);
    // Fade in at the bottom and out at the top, so wrapping round is never seen.
    float edge = smoothstep(0.0, 0.08, lift / span) * smoothstep(1.0, 0.9, lift / span);
    // A lantern that has just arrived glows brighter for a few seconds.
    float fresh = 1.0 + 1.6 * exp(-max(0.0, uTime - aBorn) * 0.6);
    vAlpha = edge * mix(uDay, 1.0, uNight);
    vStyle = aStyle - 10.0 * vSelf;
    gl_PointSize = uSize * (0.75 + 0.5 * aSeed) * min(fresh, 2.2) * mix(1.0, uSelfSize, vSelf);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uWarm;
  uniform float uSelfGlow;
  varying float vStyle;
  varying float vAlpha;
  varying float vSelf;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float glow = exp(-dot(p, p) * 3.2) * 0.55 * mix(1.0, uSelfGlow, vSelf);
    float body;
    vec3 colour = uWarm;
    if (vStyle < 0.5) {
      body = smoothstep(0.34, 0.2, length(p));
    } else if (vStyle < 1.5) {
      // Paper: a small upright lantern.
      vec2 q = abs(p) - vec2(0.2, 0.3);
      body = smoothstep(0.1, 0.0, length(max(q, 0.0)));
      colour = mix(uWarm, vec3(1.0, 0.95, 0.85), 0.35);
    } else if (vStyle < 2.5) {
      // Star: four soft points.
      float star = abs(p.x) * abs(p.y) * 9.0 + dot(p, p) * 1.2;
      body = smoothstep(0.5, 0.15, star);
      colour = vec3(1.0, 0.96, 0.7);
    } else if (vStyle < 3.5) {
      // Koi: a rounded body with a tail.
      float fish = length(vec2(p.x * 1.7, p.y + 0.05)) - 0.34;
      float tail = max(abs(p.x) - (-p.y - 0.25) * 0.9, -p.y - 0.75);
      body = smoothstep(0.06, -0.04, min(fish, max(tail, 0.2 - (-p.y))));
      colour = vec3(1.0, 0.55, 0.3);
    } else {
      // Comet: a bright head with a trail below, since it is rising.
      float head = smoothstep(0.3, 0.12, length(p - vec2(0.0, 0.3)));
      float trail = smoothstep(0.22, 0.0, abs(p.x)) * smoothstep(-0.95, 0.3, p.y) * step(p.y, 0.3) * 0.7;
      body = max(head, trail);
      colour = vec3(0.8, 0.92, 1.0);
    }
    float alpha = (body + glow) * vAlpha;
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;

/** A repeatable number in 0..1 from a name. */
function hash(name: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < name.length; i++)
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

type Portrait = {
  group: Group;
  material: SpriteMaterial;
  map: Texture;
  glow: SpriteMaterial;
  seed: number;
  name: string;
};

export type SkyField = {
  /** Replace the whole sky, for a player who has just arrived. */
  set: (lanterns: readonly SkyLantern[]) => void;
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
  ) => { name: string; x: number; y: number } | null;
  /** Where the player's own lantern is in the world. False when it is not in the sky. */
  locateSelf: (out: Vector3) => boolean;
};

export function createSkyField(
  scene: Scene,
  glowMap: Texture,
  keeper: Keeper,
  /** The player's own name: their lantern is drawn larger and brighter. */
  self: string | null
): SkyField {
  const max = SKY.maxLanterns;
  const slotNames: string[] = [];
  const spot = new Vector3();
  const positions = new Float32Array(max * 3);
  const seeds = new Float32Array(max);
  const styles = new Float32Array(max);
  const born = new Float32Array(max);
  const geometry = keeper.keep(new BufferGeometry());
  const positionAttribute = new BufferAttribute(positions, 3);
  const seedAttribute = new BufferAttribute(seeds, 1);
  const styleAttribute = new BufferAttribute(styles, 1);
  const bornAttribute = new BufferAttribute(born, 1);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aSeed', seedAttribute);
  geometry.setAttribute('aStyle', styleAttribute);
  geometry.setAttribute('aBorn', bornAttribute);
  geometry.setDrawRange(0, 0);

  const size: { value: number } = { value: SKY.pointSize };
  const uniforms = {
    uTime: { value: 0 },
    uSize: size,
    uLow: { value: SKY.heightLow },
    uHigh: { value: SKY.heightHigh },
    uSpeed: { value: SKY.riseSpeed },
    uNight: { value: 0 },
    uDay: { value: SKY.dayOpacity },
    uWarm: { value: new Color(LOOK.lanternWarm) },
    uSelfSize: { value: SKY.selfSize },
    uSelfGlow: { value: SKY.selfGlow },
  };
  const material = keeper.keep(
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
    })
  );
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -5;
  const field = new Group();
  field.add(points);
  scene.add(field);

  // The portrait atlas: one canvas, one picture per cell.
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = CELL_WIDTH * ATLAS_COLUMNS;
  atlasCanvas.height = CELL_HEIGHT * Math.ceil(SKY.portraits / ATLAS_COLUMNS);
  const atlasPen = atlasCanvas.getContext('2d');
  const atlas = keeper.keep(new CanvasTexture(atlasCanvas));
  const rows = Math.ceil(SKY.portraits / ATLAS_COLUMNS);
  const portraits: Portrait[] = [];
  for (let i = 0; i < SKY.portraits; i++) {
    const map = keeper.keep(atlas.clone());
    map.repeat.set(1 / ATLAS_COLUMNS, 1 / rows);
    map.offset.set(
      (i % ATLAS_COLUMNS) / ATLAS_COLUMNS,
      1 - (Math.floor(i / ATLAS_COLUMNS) + 1) / rows
    );
    const portraitMaterial = keeper.keep(
      new SpriteMaterial({
        map,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      })
    );
    const glow = keeper.keep(
      new SpriteMaterial({
        map: glowMap,
        color: LOOK.lanternWarm,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      })
    );
    const group = new Group();
    const halo = new Sprite(glow);
    halo.scale.setScalar(SKY.portraitSize * 2.4);
    const picture = new Sprite(portraitMaterial);
    picture.scale.set(SKY.portraitSize * 0.76, SKY.portraitSize, 1);
    group.add(halo, picture);
    group.visible = false;
    field.add(group);
    portraits.push({
      group,
      material: portraitMaterial,
      map,
      glow,
      seed: i / SKY.portraits,
      name: '',
    });
  }
  let nextPortrait = 0;
  let total = 0;
  let nowSeconds = 0;
  const names = new Set<string>();

  const givePortrait = (lantern: SkyLantern): void => {
    if (lantern.a === '' || atlasPen === null) return;
    const slot = nextPortrait % SKY.portraits;
    nextPortrait++;
    const portrait = portraits[slot];
    if (portrait === undefined) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const x = (slot % ATLAS_COLUMNS) * CELL_WIDTH;
      const y = Math.floor(slot / ATLAS_COLUMNS) * CELL_HEIGHT;
      atlasPen.clearRect(x, y, CELL_WIDTH, CELL_HEIGHT);
      // A paper lantern first: a glowing shade, wider at the top, with a dark hoop underneath.
      const shade = atlasPen.createLinearGradient(0, y + 8, 0, y + 118);
      shade.addColorStop(0, css(LOOK.lanternPaper));
      shade.addColorStop(1, css(LOOK.lanternWarm));
      atlasPen.fillStyle = shade;
      atlasPen.beginPath();
      atlasPen.moveTo(x + 10, y + 30);
      atlasPen.quadraticCurveTo(x + 48, y - 4, x + 86, y + 30);
      atlasPen.lineTo(x + 72, y + 116);
      atlasPen.lineTo(x + 24, y + 116);
      atlasPen.closePath();
      atlasPen.fill();
      atlasPen.fillStyle = css(LOOK.woodDark);
      atlasPen.fillRect(x + 22, y + 114, 52, 6);
      // Then the rider, small, printed on the paper.
      atlasPen.drawImage(image, x + 27, y + 46, 42, 56);
      atlas.needsUpdate = true;
      for (const other of portraits) other.map.needsUpdate = true;
      portrait.name = lantern.u;
      portrait.seed = hash(lantern.u, 5);
      portrait.group.visible = true;
    };
    image.src = lantern.a;
  };

  const place = (lantern: SkyLantern, fresh: boolean): void => {
    if (names.has(lantern.u)) return;
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
    styles[slot] = STYLE_CODE[lantern.s] + (lantern.u === self ? 10 : 0);
    slotNames[slot] = lantern.u;
    born[slot] = fresh ? nowSeconds : -100;
    positionAttribute.needsUpdate = true;
    seedAttribute.needsUpdate = true;
    styleAttribute.needsUpdate = true;
    bornAttribute.needsUpdate = true;
    geometry.setDrawRange(0, Math.min(total, max));
    givePortrait(lantern);
  };

  /** Where the shader draws a far lantern right now, in the field's own space. */
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
    set(lanterns) {
      for (const lantern of lanterns.slice(-max)) place(lantern, false);
    },
    add(lantern) {
      place(lantern, true);
    },
    count: () => total,
    pick(camera, x, y, reach, aspect) {
      field.updateMatrixWorld();
      let best: { name: string; x: number; y: number } | null = null;
      let nearest = reach;
      const consider = (name: string, grow: number): void => {
        field.localToWorld(spot).project(camera);
        if (spot.z > 1 || Math.abs(spot.x) > 1 || Math.abs(spot.y) > 1) return;
        const away = Math.hypot((spot.x - x) * aspect, spot.y - y) / grow;
        if (away >= nearest) return;
        nearest = away;
        best = { name, x: spot.x, y: spot.y };
      };
      for (const portrait of portraits) {
        if (!portrait.group.visible || portrait.material.opacity < 0.2)
          continue;
        spot.copy(portrait.group.position);
        consider(portrait.name, 1.6);
      }
      const shown = Math.min(total, max);
      for (let slot = 0; slot < shown; slot++) {
        const name = slotNames[slot];
        if (name === undefined) continue;
        pointAt(slot, spot);
        consider(name, 1);
      }
      return best;
    },
    locateSelf(out) {
      if (self === null) return false;
      const slot = slotNames.indexOf(self);
      if (slot < 0) return false;
      field.updateMatrixWorld();
      pointAt(slot, out);
      field.localToWorld(out);
      return true;
    },
    update(timeMs, night, calm, pixelRatio, yaw) {
      field.rotation.y = yaw;
      nowSeconds = timeMs / 1000;
      uniforms.uTime.value = calm ? nowSeconds * 0.35 : nowSeconds;
      uniforms.uNight.value = night;
      uniforms.uSize.value = SKY.pointSize * pixelRatio;
      const height = SKY.portraitHigh - SKY.portraitLow;
      for (const portrait of portraits) {
        if (!portrait.group.visible) continue;
        const across =
          (portrait.seed - 0.5) * 2 * SKY.portraitRing * SKY.spread * 0.8;
        const lift =
          (portrait.seed * height + nowSeconds * SKY.riseSpeed * 0.4) % height;
        portrait.group.position.set(
          across,
          SKY.portraitLow + lift,
          -SKY.portraitRing - portrait.seed * 4
        );
        const edge = Math.min(
          1,
          lift / (height * 0.12),
          (height - lift) / (height * 0.12)
        );
        portrait.material.opacity = Math.max(0, edge) * night;
        portrait.glow.opacity = Math.max(0, edge) * night * 0.6;
      }
    },
  };
}
