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
import { ART, LOOK, type BiomeLook } from '../../shared/config';
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
  uniform vec3 uDeep;
  uniform float uGlow;
  uniform float uNight;
  uniform float uTime;
  uniform float uWisps;
  uniform float uDeepSky;
  uniform float uMilky;
  varying vec3 vDirection;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float soft(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float cloud(vec2 p) {
    return 0.6 * soft(p) + 0.3 * soft(p * 2.1 + 3.7) + 0.1 * soft(p * 4.3 + 9.1);
  }

  void main() {
    vec3 d = normalize(vDirection);
    // Two stretches: the low sky the camera sees while playing, and the high sky it turns to
    // when it follows the lantern up. Both keep a visible gradient.
    float height = 0.55 * smoothstep(-0.98, -0.3, d.y) + 0.45 * smoothstep(-0.3, 0.75, d.y);
    vec3 colour = mix(uHorizon, uTop, height);
    // Below the island the sky falls away into a deeper tone: the island floats over a depth.
    colour = mix(colour, uDeep, smoothstep(-0.5, -1.0, d.y) * uDeepSky);
    // A warm band where the play view meets the horizon, strongest at dusk.
    float bandAt = (d.y + 0.5) * 3.4;
    float band = exp(-bandAt * bandAt);
    colour += uHorizon * band * uGlow;
    // Thin, slow wisps of cloud, lit by day and a faint veil by night.
    vec2 plane = d.xz / (1.25 + abs(d.y));
    float wisp = smoothstep(0.5, 0.86, cloud(plane * vec2(3.2, 6.4) + uTime * 0.006));
    colour = mix(colour, mix(uHorizon, vec3(1.0), 0.4), wisp * uWisps * (1.0 - 0.75 * uNight));
    // Night: a milky-way band slanting across the sky, clumped by the same soft noise, and a
    // violet lift near the horizon so the dark has depth.
    float laneAt = dot(d, normalize(vec3(0.6, 0.8, 0.0))) * 3.4;
    float lane = exp(-laneAt * laneAt);
    float dust = cloud(d.xz * 5.0 + d.y * 3.0);
    vec3 milky = (vec3(0.3, 0.34, 0.6) + vec3(0.5, 0.32, 0.26) * dust) * lane * (0.35 + dust);
    colour += milky * uNight * uMilky;
    colour += vec3(0.11, 0.06, 0.17) * uNight * exp(-d.y * d.y * 5.76) * 0.55;
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
  const deep = new Color();
  const nightAmount = { value: 0 };
  const skyTime = { value: 0 };
  const material = keeper.keep(
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTop: { value: top },
        uHorizon: { value: horizon },
        uGlow: glow,
        uDeep: { value: deep },
        uNight: nightAmount,
        uTime: skyTime,
        uWisps: { value: ART.wisps },
        uDeepSky: { value: ART.deepSky },
        uMilky: { value: ART.milkyWay },
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

  // Extra faint stars along the milky-way band (the same slant as in the shader).
  {
    const normal = new Vector3(0.6, 0.8, 0).normalize();
    const across = new Vector3(0, 0, 1);
    const along = new Vector3().crossVectors(normal, across).normalize();
    const positions = new Float32Array(ART.bandStars * 3);
    const spot = new Vector3();
    for (let i = 0; i < ART.bandStars; i++) {
      const turn = noise(i, 51) * Math.PI * 2;
      // Two random numbers added: most stars near the middle of the band, a few further out.
      const off = (noise(i, 52) + noise(i, 53) - 1) * 0.34;
      spot
        .copy(across)
        .multiplyScalar(Math.cos(turn))
        .addScaledVector(along, Math.sin(turn))
        .addScaledVector(normal, off)
        .normalize()
        .multiplyScalar(260);
      positions[i * 3] = spot.x;
      positions[i * 3 + 1] = spot.y;
      positions[i * 3 + 2] = spot.z;
    }
    const geometry = keeper.keep(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const bandMaterial = keeper.keep(
      new PointsMaterial({
        color: LOOK.star,
        size: 1.2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      })
    );
    const points = new Points(geometry, bandMaterial);
    points.renderOrder = -9;
    points.frustumCulled = false;
    scene.add(points);
    stars.push(bandMaterial);
  }

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
      glow.value = 0.22 * (1 - Math.abs(dusk - 0.5) * 2);
      const night = Math.max(0, (dusk - 0.55) / 0.45);
      // The depth below the island: the upper sky's colour, darker.
      deep
        .copy(horizon)
        .lerp(top, 0.7)
        .multiplyScalar(0.8 - 0.25 * night);
      nightAmount.value = night;
      skyTime.value = calm ? 0 : timeMs / 1000;
      stars.forEach((star, index) => {
        star.opacity = night * (index === 0 ? 0.85 : index === 1 ? 1 : 0.6);
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
