/**
 * The sky: a gradient dome driven by one `dusk` value (0 afternoon, 0.5 dusk, 1 night), stars,
 * and a few far-off floating rocks and clouds for depth.
 *
 * The camera looks down on the island, so most of what it sees is the sky below the horizon.
 * The gradient therefore runs over the whole sphere: horizon colour underneath, top colour above.
 */
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Scene,
  type Texture,
} from 'three';
import { LOOK, type BiomeLook } from '../../shared/config';
import { at, merge, noise, paint, place, type Keeper } from './kit';

const STAR_COUNT = 900;
const ROCK_COUNT = 7;
const CLOUD_COUNT = 5;

const VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform float uGlow;
  varying vec3 vDirection;
  void main() {
    // Two stretches: the low sky the camera sees while playing, and the high sky it turns to
    // when it follows the lantern up. Both keep a visible gradient.
    float height = 0.55 * smoothstep(-0.98, -0.3, vDirection.y) + 0.45 * smoothstep(-0.3, 0.75, vDirection.y);
    vec3 colour = mix(uHorizon, uTop, height);
    // A warm band low in the sky, strongest at dusk.
    float band = exp(-pow((vDirection.y + 0.9) * 3.2, 2.0));
    colour += uHorizon * band * uGlow;
    gl_FragColor = vec4(colour, 1.0);
  }
`;

export type Sky = {
  /** Set the time of day, 0 to 1, and move the clouds. */
  update: (dusk: number, timeMs: number, calm: boolean) => void;
  /** The colour of the sky at the horizon now, for mist and far things. */
  horizon: Color;
  /** The colour the page behind the canvas should be, so there is no flash. */
  top: Color;
};

function threeStops(
  stops: readonly [number, number, number]
): [Color, Color, Color] {
  return [new Color(stops[0]), new Color(stops[1]), new Color(stops[2])];
}

function blend(
  out: Color,
  stops: readonly [Color, Color, Color],
  dusk: number
): void {
  if (dusk < 0.5) out.lerpColors(stops[0], stops[1], dusk * 2);
  else out.lerpColors(stops[1], stops[2], dusk * 2 - 1);
}

export function createSky(
  scene: Scene,
  look: BiomeLook,
  blob: Texture,
  keeper: Keeper
): Sky {
  const tops = threeStops(look.skyTop);
  const horizons = threeStops(look.skyHorizon);
  const top = new Color();
  const horizon = new Color();
  const white = new Color(0xffffff);

  const glow = { value: 0 };
  const material = keeper.keep(
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTop: { value: top },
        uHorizon: { value: horizon },
        uGlow: glow,
      },
      side: BackSide,
      depthWrite: false,
      depthTest: false,
    })
  );
  const dome = new Mesh(keeper.keep(new SphereGeometry(300, 24, 16)), material);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  // Stars over the whole sphere, in two sizes.
  const stars: PointsMaterial[] = [];
  for (const [salt, count, size] of [
    [7, STAR_COUNT, 1.6],
    [17, Math.floor(STAR_COUNT / 6), 2.8],
  ] as const) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const around = noise(i, salt) * Math.PI * 2;
      const y = noise(i, salt + 1) * 2 - 1;
      const ring = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(around) * ring * 260;
      positions[i * 3 + 1] = y * 260;
      positions[i * 3 + 2] = Math.sin(around) * ring * 260;
    }
    const geometry = keeper.keep(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const starMaterial = keeper.keep(
      new PointsMaterial({
        color: LOOK.star,
        size,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      })
    );
    const points = new Points(geometry, starMaterial);
    points.renderOrder = -9;
    points.frustumCulled = false;
    scene.add(points);
    stars.push(starMaterial);
  }

  // Far-off floating rocks, tinted toward the sky so they sit back.
  // Far-off islets: a flat green top over a point of rock, tinted toward the sky so they sit back.
  const isletGeometry = keeper.keep(
    merge([
      place(
        paint(new CylinderGeometry(1, 0.86, 0.22, 7), look.groundA),
        at(0, 0.11, 0)
      ),
      place(
        paint(new ConeGeometry(0.86, 1.5, 7), look.underside),
        new Matrix4().makeRotationX(Math.PI).setPosition(0, -0.75, 0)
      ),
    ])
  );
  const rockMaterial = keeper.keep(
    new MeshBasicMaterial({ vertexColors: true, transparent: true })
  );
  const rockColour = rockMaterial.color;
  const far = new InstancedMesh(isletGeometry, rockMaterial, ROCK_COUNT);
  const rockMatrix = new Matrix4();
  const rockTurn = new Quaternion();
  const rockEuler = new Euler();
  const rockPosition = new Vector3();
  const rockScale = new Vector3();
  for (let i = 0; i < ROCK_COUNT; i++) {
    const around = (i / ROCK_COUNT) * Math.PI * 2 + noise(i, 31) * 0.9;
    // Low and fairly near: the camera looks down, so anything level with the island is out of view.
    const distance = 20 + noise(i, 32) * 16;
    const size = 0.8 + noise(i, 34) * 1.3;
    rockPosition.set(
      Math.cos(around) * distance,
      -15 - noise(i, 33) * 18,
      Math.sin(around) * distance
    );
    rockScale.set(size * 1.3, size * (0.8 + noise(i, 35) * 0.5), size);
    rockTurn.setFromEuler(rockEuler.set(0, noise(i, 36) * 6, 0));
    far.setMatrixAt(i, rockMatrix.compose(rockPosition, rockTurn, rockScale));
  }
  far.frustumCulled = false;
  scene.add(far);

  // Slow clouds: soft blobs below and around the island.
  const cloudMaterial = keeper.keep(
    new SpriteMaterial({
      map: blob,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
  );
  const clouds: Sprite[] = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new Sprite(cloudMaterial);
    const around = (i / CLOUD_COUNT) * Math.PI * 2 + noise(i, 41);
    const distance = 12 + noise(i, 42) * 16;
    cloud.position.set(
      Math.cos(around) * distance,
      -12 - noise(i, 43) * 14,
      Math.sin(around) * distance
    );
    const size = 7 + noise(i, 44) * 9;
    cloud.scale.set(size * 1.8, size * 0.7, 1);
    clouds.push(cloud);
    scene.add(cloud);
  }

  return {
    horizon,
    top,
    update(dusk, timeMs, calm) {
      blend(top, tops, dusk);
      blend(horizon, horizons, dusk);
      glow.value = 0.18 * (1 - Math.abs(dusk - 0.5) * 2);
      const night = Math.max(0, (dusk - 0.55) / 0.45);
      stars.forEach((star, index) => {
        star.opacity = night * (index === 0 ? 0.85 : 1);
      });
      // A veil of sky colour over the islets: they fade with distance and darken at night.
      rockColour
        .copy(white)
        .lerp(horizon, 0.45)
        .multiplyScalar(1 - 0.6 * night);
      rockMaterial.opacity = 0.78;
      // Clouds are a lighter tone of the sky by day and a darker veil at night.
      cloudMaterial.color.copy(horizon).lerp(white, 0.55 * (1 - night));
      cloudMaterial.opacity = 0.34 - 0.2 * night;
      if (!calm) {
        for (let i = 0; i < clouds.length; i++) {
          const cloud = clouds[i];
          if (cloud !== undefined)
            cloud.position.x += Math.sin(timeMs / 9000 + i) * 0.002;
        }
        far.rotation.y = timeMs / 240000;
      }
    },
  };
}
