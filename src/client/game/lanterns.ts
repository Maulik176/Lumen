/**
 * The island's paper lanterns: a paper globe with a wooden cap and foot, a soft glow, a pool of
 * light on the ground around it, and a shape badge for the colour it wants.
 */
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Texture,
} from 'three';
import { LOOK, VIEW } from '../../shared/config';
import type { LanternColour, Puzzle } from '../../shared/types';
import { tileCentre } from './fit';
import { at, merge, paint, place, type Keeper } from './kit';
import { badgeTexture } from './shapes';

const GLOW_HEX: Record<LanternColour, number> = {
  white: LOOK.lanternWarm,
  red: LOOK.beamRed,
  green: LOOK.beamGreen,
  blue: LOOK.beamBlue,
  magenta: LOOK.lanternMagenta,
  cyan: LOOK.lanternCyan,
  yellow: LOOK.lanternYellow,
};

type LanternView = {
  group: Group;
  /** The colour this lantern shines when lit. */
  hue: Color;
  paper: MeshStandardMaterial;
  glow: SpriteMaterial;
  glowSprite: Sprite;
  spill: MeshBasicMaterial;
  badge: SpriteMaterial | null;
  level: number;
  target: number;
  popAt: number;
};

export type Lanterns = {
  group: Group;
  count: number;
  /** During play: which lanterns the light reaches. */
  setLit: (lit: readonly boolean[], allLit: boolean, timeMs: number) => void;
  /** Nightfall: every lantern sinks to an ember. */
  embers: () => void;
  /** Nightfall: one lantern comes fully alight. */
  bloom: (index: number, timeMs: number) => void;
  /** Back to unlit, for another go. */
  reset: () => void;
  update: (
    timeMs: number,
    deltaMs: number,
    allLit: boolean,
    night: boolean
  ) => void;
};

export function createLanterns(
  puzzle: Puzzle,
  glowMap: Texture,
  keeper: Keeper,
  calm: boolean
): Lanterns {
  const { width, height } = puzzle;
  const group = new Group();
  const body = keeper.keep(new SphereGeometry(0.3, 18, 12));
  const quarter = new Matrix4().makeRotationX(Math.PI / 2);
  const rib = (y: number, size: number): BufferGeometry => {
    const ring = paint(
      new TorusGeometry(0.3 * size, 0.006, 4, 18),
      LOOK.lanternPaper,
      0.8
    );
    ring.applyMatrix4(quarter);
    return place(ring, at(0, y, 0));
  };
  const fittings = keeper.keep(
    merge([
      place(
        paint(new CylinderGeometry(0.1, 0.14, 0.07, 10), LOOK.woodDark),
        at(0, 0.74, 0)
      ),
      place(
        paint(new CylinderGeometry(0.17, 0.2, 0.06, 10), LOOK.woodDark),
        at(0, 0.05, 0)
      ),
      place(
        paint(new CylinderGeometry(0.025, 0.025, 0.12, 5), LOOK.wood),
        at(0, 0.83, 0)
      ),
      rib(0.26, 0.93),
      rib(0.4, 1.005),
      rib(0.54, 0.93),
    ])
  );
  const wood = keeper.keep(
    new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  );
  const spillGeometry = keeper.keep(new CircleGeometry(1.25, 24));
  const bandGeometry = keeper.keep(
    new CylinderGeometry(0.305, 0.305, 0.1, 18, 1, true)
  );
  const paperGlow = new Color(LOOK.lanternPaper);

  const views: LanternView[] = puzzle.lanterns.map((lantern) => {
    const [x, z] = tileCentre(lantern.x, lantern.y, width, height);
    const one = new Group();
    one.position.set(x, 0, z);
    const hex = GLOW_HEX[lantern.colour];
    const paper = keeper.keep(
      new MeshStandardMaterial({
        color: LOOK.lanternPaper,
        emissive: hex,
        emissiveIntensity: 0,
        roughness: 0.7,
      })
    );
    const globe = new Mesh(body, paper);
    globe.position.y = 0.4;
    globe.scale.set(1, 1.14, 1);
    one.add(globe, new Mesh(fittings, wood));

    // A band of the lantern's own colour, so it can be read before it is lit.
    if (lantern.colour !== 'white') {
      const band = new Mesh(
        bandGeometry,
        keeper.keep(new MeshBasicMaterial({ color: hex }))
      );
      band.position.y = 0.4;
      one.add(band);
    }

    const glow = keeper.keep(
      new SpriteMaterial({
        map: glowMap,
        color: hex,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      })
    );
    const glowSprite = new Sprite(glow);
    glowSprite.position.y = 0.42;
    one.add(glowSprite);

    // Light on the ground: a flat additive disc, not a real light.
    const spill = keeper.keep(
      new MeshBasicMaterial({
        map: glowMap,
        color: hex,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      })
    );
    const pool = new Mesh(spillGeometry, spill);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.03;
    one.add(pool);

    let badge: SpriteMaterial | null = null;
    const badgeMap = badgeTexture(lantern.colour);
    if (badgeMap !== null) {
      keeper.keep(badgeMap);
      badge = keeper.keep(
        new SpriteMaterial({
          map: badgeMap,
          depthTest: false,
          transparent: true,
        })
      );
      const sprite = new Sprite(badge);
      sprite.position.y = 1.16;
      sprite.scale.set(0.9, 0.45, 1);
      sprite.renderOrder = 5;
      one.add(sprite);
    }

    group.add(one);
    return {
      group: one,
      hue: new Color(hex),
      paper,
      glow,
      glowSprite,
      spill,
      badge,
      level: 0,
      target: 0,
      popAt: -1,
    };
  });

  return {
    group,
    count: views.length,
    setLit(lit, allLit, timeMs) {
      views.forEach((view, index) => {
        const on = lit[index] === true;
        if (on && view.target === 0 && !calm) view.popAt = timeMs;
        view.target = on ? (allLit ? 0.74 : 0.56) : 0;
      });
    },
    embers() {
      for (const view of views) view.target = 0.1;
    },
    bloom(index, timeMs) {
      const view = views[index];
      if (view === undefined) return;
      view.target = 1;
      if (!calm) view.popAt = timeMs;
    },
    reset() {
      for (const view of views) {
        view.target = 0;
        view.popAt = -1;
      }
    },
    update(timeMs, deltaMs, allLit, night) {
      // Calm mode eases more slowly: the glow itself is the animation.
      const ease = 1 - Math.exp(-deltaMs / (calm ? 420 : 150));
      views.forEach((view, index) => {
        view.level += (view.target - view.level) * ease;
        const breathe =
          allLit && !night && !calm
            ? 0.07 * Math.sin(timeMs / 430 + index * 1.7)
            : 0;
        const level = Math.max(0, view.level + breathe);
        // Unlit paper still catches the day: a faint warmth keeps it reading as paper, not wood.
        view.paper.emissive
          .copy(paperGlow)
          .lerp(view.hue, Math.min(1, level * 2.2));
        view.paper.emissiveIntensity = 0.42 + level * 1.4;
        view.glow.opacity = Math.min(1, level * 0.9);
        view.glowSprite.scale.setScalar(0.75 + level * 1.7);
        view.spill.opacity = level * (night ? 0.5 : 0.3);
        if (view.badge !== null)
          view.badge.opacity = night ? 0.55 + 0.45 * (1 - level) : 1;
        let pop = 1;
        if (view.popAt >= 0) {
          const t = (timeMs - view.popAt) / VIEW.lanternPopMs;
          if (t >= 1) view.popAt = -1;
          else pop = 1 + (VIEW.lanternPopScale - 1) * Math.sin(t * Math.PI);
        }
        view.group.scale.setScalar(pop);
      });
    },
  };
}
