/**
 * The things that bend light: the mirror and prism the player places, the fixed mirror that is
 * part of the island, and the sun crystal. Each is a small crafted object, built from primitives.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Sprite,
  SpriteMaterial,
  type BufferGeometry,
  type Texture,
} from 'three';
import { ART, LOOK } from '../../shared/config';
import type { BeamColour, MirrorOrientation } from '../../shared/types';
import { at, merge, paint, place, type Keeper } from './kit';

const BEAM_HEX: Record<BeamColour, number> = {
  white: LOOK.beamWhite,
  red: LOOK.beamRed,
  green: LOOK.beamGreen,
  blue: LOOK.beamBlue,
};

export type PieceKit = {
  mirror: (orientation: MirrorOrientation) => Group;
  prism: () => Group;
  fixedMirror: (orientation: MirrorOrientation) => Group;
  sunCrystal: (colour: BeamColour) => {
    group: Group;
    crystal: Mesh;
    halo: Sprite;
    /** Thin rays around the crystal, turned and pulsed by the scene. */
    rays: SpriteMaterial;
  };
};

/** A standing frame: two posts, a top bar and a foot, around a pane 0.84 wide and 0.5 tall. */
function frameGeometry(
  wood: number,
  woodDark: number,
  foot: boolean
): BufferGeometry {
  const parts = [
    place(paint(new BoxGeometry(0.07, 0.62, 0.08), wood), at(-0.46, 0.33, 0)),
    place(paint(new BoxGeometry(0.07, 0.62, 0.08), wood), at(0.46, 0.33, 0)),
    place(paint(new BoxGeometry(1.04, 0.07, 0.1), wood, 1.08), at(0, 0.66, 0)),
    place(paint(new BoxGeometry(0.9, 0.05, 0.06), woodDark), at(0, 0.07, 0)),
  ];
  if (foot) {
    parts.push(
      place(
        paint(new BoxGeometry(0.16, 0.05, 0.34), woodDark),
        at(-0.46, 0.025, 0)
      )
    );
    parts.push(
      place(
        paint(new BoxGeometry(0.16, 0.05, 0.34), woodDark),
        at(0.46, 0.025, 0)
      )
    );
  } else {
    parts.push(
      place(paint(new BoxGeometry(1.08, 0.1, 0.4), woodDark), at(0, 0.03, 0))
    );
  }
  return merge(parts);
}

export function createPieceKit(
  glow: Texture,
  rayMap: Texture,
  keeper: Keeper,
  /** Share of full halo and ray strength, lower on pale ground (shared/glare.ts). */
  sunStrength: number
): PieceKit {
  const painted = keeper.keep(
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      flatShading: true,
    })
  );
  // Glass that always catches a little sky: a pale pane with its own soft light.
  const glass = keeper.keep(
    new MeshStandardMaterial({
      color: LOOK.glass,
      emissive: LOOK.glassSheen,
      emissiveIntensity: 0.38,
      roughness: 0.2,
    })
  );
  const dullGlass = keeper.keep(
    new MeshStandardMaterial({
      color: LOOK.glass,
      emissive: LOOK.glassSheen,
      emissiveIntensity: 0.18,
      roughness: 0.4,
    })
  );
  const prismGlass = keeper.keep(
    new MeshStandardMaterial({
      color: LOOK.prismGlass,
      emissive: LOOK.prismGlass,
      emissiveIntensity: 0.3,
      roughness: 0.05,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
    })
  );

  const woodFrame = keeper.keep(frameGeometry(LOOK.wood, LOOK.woodDark, true));
  const stoneFrame = keeper.keep(
    frameGeometry(LOOK.stone, LOOK.stoneDark, false)
  );
  const pane = keeper.keep(new BoxGeometry(0.85, 0.52, 0.035));
  const prismBody = keeper.keep(new CylinderGeometry(0.3, 0.3, 0.46, 3));
  const prismFittings = keeper.keep(
    merge([
      place(
        paint(new CylinderGeometry(0.33, 0.33, 0.05, 3), LOOK.brass),
        at(0, 0.075, 0)
      ),
      place(
        paint(new CylinderGeometry(0.33, 0.33, 0.05, 3), LOOK.brass),
        at(0, 0.585, 0)
      ),
      place(
        paint(new CylinderGeometry(0.2, 0.26, 0.05, 6), LOOK.woodDark),
        at(0, 0.025, 0)
      ),
    ])
  );
  const crystalBody = keeper.keep(new OctahedronGeometry(0.24));
  const plinth = keeper.keep(
    merge([
      place(
        paint(new CylinderGeometry(0.3, 0.38, 0.12, 6), LOOK.stone),
        at(0, 0.06, 0)
      ),
      place(
        paint(new CylinderGeometry(0.2, 0.26, 0.1, 6), LOOK.stoneDark),
        at(0, 0.17, 0)
      ),
    ])
  );

  const standing = (
    frame: BufferGeometry,
    paneMaterial: MeshStandardMaterial,
    orientation: MirrorOrientation
  ): Group => {
    const group = new Group();
    const paneMesh = new Mesh(pane, paneMaterial);
    paneMesh.position.y = 0.36;
    group.add(new Mesh(frame, painted), paneMesh);
    // "/" runs from the south-west corner to the north-east corner of its tile.
    group.rotation.y = orientation === 'slash' ? Math.PI / 4 : -Math.PI / 4;
    return group;
  };

  return {
    mirror: (orientation) => standing(woodFrame, glass, orientation),
    fixedMirror: (orientation) => standing(stoneFrame, dullGlass, orientation),
    prism() {
      const group = new Group();
      const body = new Mesh(prismBody, prismGlass);
      body.position.y = 0.33;
      group.add(body, new Mesh(prismFittings, painted));
      return group;
    },
    sunCrystal(colour) {
      const group = new Group();
      const material = keeper.keep(
        new MeshStandardMaterial({
          color: LOOK.crystal,
          emissive: BEAM_HEX[colour],
          emissiveIntensity: 1.5,
          roughness: 0.25,
          flatShading: true,
        })
      );
      const crystal = new Mesh(crystalBody, material);
      crystal.position.y = 0.56;
      crystal.scale.set(1, 1.55, 1);
      const haloMaterial = keeper.keep(
        new SpriteMaterial({
          map: glow,
          color: BEAM_HEX[colour],
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: ART.sunHaloOpacity * sunStrength,
        })
      );
      const halo = new Sprite(haloMaterial);
      halo.position.y = 0.56;
      halo.scale.setScalar(ART.sunHalo);
      const rays = keeper.keep(
        new SpriteMaterial({
          map: rayMap,
          color: BEAM_HEX[colour],
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: ART.sunRayOpacity,
        })
      );
      const burst = new Sprite(rays);
      burst.position.y = 0.56;
      burst.scale.setScalar(ART.sunRays);
      group.add(new Mesh(plinth, painted), crystal, halo, burst);
      return { group, crystal, halo, rays };
    },
  };
}
