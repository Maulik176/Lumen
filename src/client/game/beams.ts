/**
 * Light. Each straight run is one flat ribbon with a bright core, a wide soft halo and a slow
 * shimmer that travels the way the light does. Coloured light also carries its shape (triangle,
 * circle or square) once per tile, so it can be read without colour vision. Where a prism splits
 * white light, a small sparkle sits on the prism.
 *
 * A fixed pool of ribbons is reused on every change; nothing is created while playing.
 */
import {
  AdditiveBlending,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  type Texture,
} from 'three';
import { LOOK } from '../../shared/config';
import type { BeamColour, BeamSegment, Placement } from '../../shared/types';
import { tileCentre } from './fit';
import type { Keeper } from './kit';
import { SHAPE_CODE } from './shapes';

const POOL = 72;
const SPARKLES = 6;
/** Ribbon width in tiles: the halo's full reach. */
const WIDTH = 0.62;

const BEAM_HEX: Record<BeamColour, number> = {
  white: LOOK.beamWhite,
  red: LOOK.beamRed,
  green: LOOK.beamGreen,
  blue: LOOK.beamBlue,
};
/** Different colours ride at slightly different heights so overlapping beams all show. */
const BEAM_HEIGHT: Record<BeamColour, number> = {
  white: 0.34,
  red: 0.31,
  green: 0.37,
  blue: 0.4,
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  uniform float uLength;
  uniform float uShape;
  uniform float uTime;
  uniform float uWidth;
  uniform float uNight;
  varying vec2 vUv;

  float triangle(vec2 p, float r) {
    // Points the way the light travels (+x).
    p.x -= r * 0.15;
    float edge = max(abs(p.y) * 0.866 + p.x * 0.5, -p.x) - r * 0.5;
    return edge;
  }

  void main() {
    float across = abs(vUv.y - 0.5) * 2.0;
    float along = vUv.x * uLength;

    float core = smoothstep(0.27, 0.12, across);
    float halo = pow(max(0.0, 1.0 - across), 2.4);
    float shimmer = 0.86 + 0.14 * sin(along * 5.5 - uTime * 3.2);
    // Soft ends, so a run never starts or stops with a hard edge.
    float ends = smoothstep(0.0, 0.12, along) * smoothstep(0.0, 0.12, uLength - along);

    // The core is laid over the scene so a red beam stays red on bright grass; the halo is added
    // on top as light. (Blend: source + destination x (1 - source alpha).)
    float white = step(uShape, 0.5);
    vec3 coreColour = mix(uColour, vec3(1.0), mix(0.12, 0.6, white));
    float coreAlpha = core * ends * mix(0.94, 1.0, shimmer);
    vec3 glow = uColour * halo * (0.42 + 0.3 * uNight) * shimmer * ends;

    // The colour's shape, once per tile, in white with a dark edge so it reads on any ground.
    if (uShape > 0.5) {
      vec2 p = vec2(fract(along) - 0.5, (vUv.y - 0.5) * uWidth);
      float r = 0.1;
      float d;
      if (uShape < 1.5) d = triangle(p, r * 1.7);
      else if (uShape < 2.5) d = length(p) - r;
      else d = max(abs(p.x), abs(p.y)) - r * 0.86;
      float mark = smoothstep(0.012, -0.012, d) * ends;
      float edge = smoothstep(0.045, 0.012, d) * ends;
      coreColour = mix(coreColour, uColour * 0.35, max(0.0, edge - mark) * step(coreAlpha, edge));
      coreAlpha = max(coreAlpha, edge);
      coreColour = mix(coreColour, vec3(1.0), mark);
    }

    gl_FragColor = vec4(coreColour * coreAlpha + glow, coreAlpha);
  }
`;

type Ribbon = {
  mesh: Mesh;
  colour: { value: Color };
  length: { value: number };
  shape: { value: number };
};

export type Beams = {
  group: Group;
  /** Lay the ribbons for the current light, and sparkles on prisms that are splitting white. */
  sync: (
    segments: readonly BeamSegment[],
    placements: readonly Placement[],
    width: number,
    height: number
  ) => void;
  update: (timeMs: number, night: number, calm: boolean) => void;
};

export function createBeams(sparkleMap: Texture, keeper: Keeper): Beams {
  const group = new Group();
  const time = { value: 0 };
  const night = { value: 0 };
  const widthUniform = { value: WIDTH };
  const geometry = keeper.keep(new PlaneGeometry(1, 1));
  geometry.rotateX(-Math.PI / 2);

  const ribbons: Ribbon[] = [];
  for (let i = 0; i < POOL; i++) {
    const colour = { value: new Color(LOOK.beamWhite) };
    const length = { value: 1 };
    const shape = { value: 0 };
    const material = keeper.keep(
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uColour: colour,
          uLength: length,
          uShape: shape,
          uTime: time,
          uWidth: widthUniform,
          uNight: night,
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
      })
    );
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = 2;
    group.add(mesh);
    ribbons.push({ mesh, colour, length, shape });
  }

  const sparkleMaterial = keeper.keep(
    new SpriteMaterial({
      map: sparkleMap,
      color: 0xffffff,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  const sparkles: Sprite[] = [];
  for (let i = 0; i < SPARKLES; i++) {
    const sprite = new Sprite(sparkleMaterial);
    sprite.visible = false;
    sprite.renderOrder = 6;
    group.add(sprite);
    sparkles.push(sprite);
  }

  return {
    group,
    sync(segments, placements, width, height) {
      let used = 0;
      for (const segment of segments) {
        const ribbon = ribbons[used];
        if (ribbon === undefined) break;
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
        const alongX =
          segment.direction === 'east' || segment.direction === 'west';
        const sign =
          segment.direction === 'east' || segment.direction === 'south'
            ? 1
            : -1;
        // Run off the island's edge; stop at the face of a rock or crystal, and inside a lantern.
        const extra =
          segment.end === 'edge'
            ? 0.95
            : segment.end === 'blocked'
              ? -0.42
              : segment.end === 'lantern'
                ? -0.12
                : 0;
        const start = alongX ? fromX : fromZ;
        const end = (alongX ? toX : toZ) + sign * extra;
        const length = (end - start) * sign;
        if (length <= 0.05) continue;
        const middle = (start + end) / 2;
        ribbon.mesh.position.set(
          alongX ? middle : fromX,
          BEAM_HEIGHT[segment.colour],
          alongX ? fromZ : middle
        );
        // The ribbon's own x axis must point the way the light travels, for shimmer and shapes.
        ribbon.mesh.rotation.y =
          segment.direction === 'east'
            ? 0
            : segment.direction === 'west'
              ? Math.PI
              : segment.direction === 'south'
                ? -Math.PI / 2
                : Math.PI / 2;
        ribbon.mesh.scale.set(length, 1, WIDTH);
        ribbon.colour.value.setHex(BEAM_HEX[segment.colour]);
        ribbon.length.value = length;
        ribbon.shape.value = SHAPE_CODE[segment.colour];
        ribbon.mesh.visible = true;
        used++;
      }
      for (let i = used; i < POOL; i++) {
        const ribbon = ribbons[i];
        if (ribbon !== undefined) ribbon.mesh.visible = false;
      }

      // A sparkle on each prism that white light is entering.
      let lit = 0;
      for (const placement of placements) {
        if (placement.piece.kind !== 'prism') continue;
        const splitting = segments.some(
          (segment) =>
            segment.colour === 'white' &&
            segment.end === 'turn' &&
            segment.to.x === placement.x &&
            segment.to.y === placement.y
        );
        const sprite = sparkles[lit];
        if (!splitting || sprite === undefined) continue;
        const [x, z] = tileCentre(placement.x, placement.y, width, height);
        sprite.position.set(x, 0.62, z);
        sprite.visible = true;
        lit++;
      }
      for (let i = lit; i < SPARKLES; i++) {
        const sprite = sparkles[i];
        if (sprite !== undefined) sprite.visible = false;
      }
    },
    update(timeMs, nightAmount, calm) {
      time.value = calm ? 0 : timeMs / 1000;
      night.value = nightAmount;
      const pulse = calm ? 0.8 : 0.72 + 0.16 * Math.sin(timeMs / 260);
      for (const sprite of sparkles) {
        if (sprite.visible) sprite.scale.setScalar(pulse);
      }
    },
  };
}
