/**
 * The atmosphere pass (Maulik's Nov 19 timeline): a little life in the air over each world,
 * drawn as one cloud of points in one draw call. Moss has fireflies that wake at dusk, blossom
 * drops petals, snow falls softly, dune drifts with warm motes, autumn lets go of its leaves.
 * All motion is computed in the vertex shader from a time uniform, so the CPU does nothing per
 * frame but set three numbers. Reduce Motion: nothing travels; the motes only glow and fade.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  type Object3D,
} from 'three';
import type { Biome } from '../../shared/calendar';
import { AMBIENT } from '../../shared/config';
import { noise, type Keeper } from './kit';

export type Ambient = {
  /** `dusk` 0 afternoon to 1 night; `pixelRatio` keeps the motes the same size on every screen. */
  update: (time: number, dusk: number, pixelRatio: number) => void;
};

const VERTEX = /* glsl */ `
  attribute vec4 seed;
  uniform float time;
  uniform float fall;
  uniform float sway;
  uniform float drift;
  uniform float height;
  uniform float size;
  uniform float ratio;
  uniform float still;
  varying float vSeed;
  varying float vShade;
  void main() {
    float t = time * (1.0 - still);
    vec3 p = position;
    // Falling things wrap around inside the box; floating things bob about where they are.
    p.y = mod(p.y - t * fall * (0.6 + 0.8 * seed.x), height);
    p.x += sin(t * 0.7 * (0.5 + seed.y) + seed.z * 6.283) * sway + t * drift * (0.5 + seed.x);
    p.z += cos(t * 0.5 * (0.5 + seed.x) + seed.w * 6.283) * sway;
    // Sideways drift wraps too, so dune motes never pile up on one side.
    p.x = mod(p.x + ${AMBIENT.spread.toFixed(1)}, ${(AMBIENT.spread * 2).toFixed(1)}) - ${AMBIENT.spread.toFixed(1)};
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = size * ratio * (0.6 + 0.8 * seed.w) * (${AMBIENT.sizeScale.toFixed(1)} / -view.z);
    vSeed = seed.z;
    // Fade in from the floor and out at the top, so nothing pops.
    float h = p.y / height;
    vShade = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.8, 1.0, h));
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 colour;
  uniform float opacity;
  uniform float blink;
  uniform float time;
  varying float vSeed;
  varying float vShade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    // Fireflies blink, each on its own beat; everything else glows steadily.
    float pulse = mix(1.0, 0.35 + 0.65 * max(0.0, sin(time * 1.7 + vSeed * 40.0)), blink);
    gl_FragColor = vec4(colour, soft * opacity * vShade * pulse);
  }
`;

export function createAmbient(
  parent: Object3D,
  biome: Biome,
  width: number,
  height: number,
  calm: boolean,
  keeper: Keeper
): Ambient {
  const kind = AMBIENT.kinds[biome];
  const count = kind.count;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  // A box over the island and a little beyond it, so motes cross the edges too.
  const halfX = (width / 2) * AMBIENT.overhang;
  const halfZ = (height / 2) * AMBIENT.overhang;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (noise(i, 3) * 2 - 1) * halfX;
    positions[i * 3 + 1] = noise(i, 5) * AMBIENT.height;
    positions[i * 3 + 2] = (noise(i, 7) * 2 - 1) * halfZ;
    seeds[i * 4] = noise(i, 11);
    seeds[i * 4 + 1] = noise(i, 13);
    seeds[i * 4 + 2] = noise(i, 17);
    seeds[i * 4 + 3] = noise(i, 19);
  }
  const geometry = keeper.keep(new BufferGeometry());
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 4));
  const material = keeper.keep(
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        time: { value: 0 },
        fall: { value: kind.fall },
        sway: { value: kind.sway },
        drift: { value: kind.drift },
        height: { value: AMBIENT.height },
        size: { value: kind.size },
        ratio: { value: 1 },
        still: { value: calm ? 1 : 0 },
        colour: { value: new Color(kind.colour) },
        opacity: { value: 0 },
        blink: { value: kind.glow ? 1 : 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: kind.glow ? AdditiveBlending : NormalBlending,
    })
  );
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  parent.add(points);

  const uniforms = material.uniforms;
  return {
    update(time, dusk, pixelRatio) {
      const seconds = time / 1000;
      if (uniforms['time']) uniforms['time'].value = seconds;
      if (uniforms['ratio']) uniforms['ratio'].value = pixelRatio;
      // Fireflies wake as the light goes; the rest belong to the day and thin out at night.
      const shown = kind.glow
        ? Math.min(1, Math.max(0, (dusk - kind.from) / (1 - kind.from)))
        : 1 - Math.min(1, Math.max(0, (dusk - kind.from) / (1 - kind.from)));
      if (uniforms['opacity'])
        uniforms['opacity'].value =
          kind.opacity *
          (kind.glow
            ? shown
            : AMBIENT.nightFloor + (1 - AMBIENT.nightFloor) * shown);
    },
  };
}
