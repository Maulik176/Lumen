/**
 * The player's own sky lantern: it lifts off the island after the lanterns bloom and climbs into
 * the night, carrying the player's snoovatar. When an account has no snoovatar, or the picture
 * cannot be loaded, it carries a glyph made from the username instead.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Texture as TextureType,
  TorusGeometry,
} from 'three';
import { LOOK, RELEASE, UI } from '../../shared/config';
import { css, type Keeper } from './kit';

export type Rider = {
  /** Reddit's address for the player's snoovatar, if they have one. */
  snoovatar: string | null;
  username: string | null;
};

export type SkyLantern = {
  group: Group;
  /** Show the lantern at a height, with a glow level 0 to 1 and an overall fade 0 to 1. */
  pose: (height: number, sway: number, glow: number, fade: number) => void;
  hide: () => void;
};

/** A repeatable hue (0 to 360) from a name, so each player's glyph has its own colour. */
function hueOf(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++)
    sum = (sum * 31 + name.charCodeAt(i)) % 360;
  return sum;
}

/** A round paper seal with the first letter of the name. */
function glyphTexture(username: string | null): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const pen = canvas.getContext('2d');
  if (pen !== null) {
    // Drawn on a 128-unit grid at twice the pixels, so the seal stays crisp on the lantern.
    pen.scale(2, 2);
    const name = username ?? '';
    pen.beginPath();
    pen.arc(64, 64, 54, 0, Math.PI * 2);
    pen.fillStyle = UI.paper;
    pen.fill();
    pen.lineWidth = 8;
    pen.strokeStyle =
      name.length > 0 ? `hsl(${hueOf(name)} 55% 46%)` : css(LOOK.brass);
    pen.stroke();
    pen.fillStyle = UI.ink;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    if (name.length > 0) {
      pen.font = '600 64px "Young Serif", Georgia, serif';
      pen.fillText(name.charAt(0).toUpperCase(), 64, 69);
    } else {
      // Nobody signed in: a small flame instead of a letter.
      pen.beginPath();
      pen.moveTo(64, 30);
      pen.bezierCurveTo(92, 62, 84, 96, 64, 98);
      pen.bezierCurveTo(44, 96, 36, 62, 64, 30);
      pen.fillStyle = css(LOOK.flame);
      pen.fill();
    }
  }
  return new CanvasTexture(canvas);
}

/** Load the snoovatar as a texture. Resolves to null if it cannot be used. */
function loadSnoovatar(url: string): Promise<TextureType | null> {
  return new Promise((resolve) => {
    // Only Reddit's own image host is ever asked, and always with cross-origin access so the
    // picture can be used as a texture (see PLATFORM.md).
    if (!url.startsWith('https://i.redd.it/')) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 6000);
    image.onload = () => {
      window.clearTimeout(timer);
      // Redrawn large and smoothly into a canvas first, then filtered with mipmaps and
      // anisotropy on the card: the raw picture, shrunk by the graphics card alone, looked
      // pixelated on the lantern.
      const tall = RELEASE.portraitPx;
      const wide = Math.round(
        (tall * image.naturalWidth) / Math.max(1, image.naturalHeight)
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, wide);
      canvas.height = tall;
      const pen = canvas.getContext('2d');
      if (pen === null) {
        resolve(null);
        return;
      }
      try {
        pen.imageSmoothingEnabled = true;
        pen.imageSmoothingQuality = 'high';
        pen.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Reading one pixel back throws if the picture is not allowed: then keep the seal.
        pen.getImageData(0, 0, 1, 1);
      } catch {
        resolve(null);
        return;
      }
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      texture.anisotropy = RELEASE.portraitAnisotropy;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}

export function createSkyLantern(
  rider: Rider,
  glowMap: TextureType,
  keeper: Keeper
): SkyLantern {
  const group = new Group();
  group.visible = false;

  const paper = keeper.keep(
    new MeshStandardMaterial({
      color: LOOK.lanternPaper,
      emissive: LOOK.lanternWarm,
      emissiveIntensity: 1.2,
      roughness: 0.9,
      side: DoubleSide,
      transparent: true,
    })
  );
  const wood = keeper.keep(
    new MeshStandardMaterial({
      color: LOOK.woodDark,
      roughness: 1,
      transparent: true,
    })
  );
  // A tall paper shade, wider at the top, open underneath, with a domed crown.
  const shade = new Mesh(
    keeper.keep(
      new CylinderGeometry(0.42, 0.3, 0.78, RELEASE.shadeSides, 1, true)
    ),
    paper
  );
  shade.position.y = 0.5;
  const crown = new Mesh(
    keeper.keep(
      new SphereGeometry(
        0.42,
        RELEASE.shadeSides,
        8,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      )
    ),
    paper
  );
  crown.position.y = 0.89;
  crown.scale.y = 0.42;
  const hoop = new Mesh(
    keeper.keep(new TorusGeometry(0.3, 0.018, 5, RELEASE.shadeSides)),
    wood
  );
  hoop.rotation.x = Math.PI / 2;
  hoop.position.y = 0.11;
  group.add(shade, crown, hoop);

  const flameMaterial = keeper.keep(
    new SpriteMaterial({
      map: glowMap,
      color: LOOK.flame,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  const flame = new Sprite(flameMaterial);
  flame.position.y = 0.2;
  group.add(flame);
  const haloMaterial = keeper.keep(
    new SpriteMaterial({
      map: glowMap,
      color: LOOK.lanternWarm,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  const halo = new Sprite(haloMaterial);
  halo.position.y = 0.5;
  group.add(halo);

  // The rider, always facing the camera, drawn over the paper.
  const glyph = keeper.keep(glyphTexture(rider.username));
  const portraitMaterial = keeper.keep(
    new SpriteMaterial({ map: glyph, depthTest: false, transparent: true })
  );
  const portrait = new Sprite(portraitMaterial);
  // Low on the shade, so the lantern's paper and crown show all round it.
  portrait.position.y = 0.44;
  portrait.scale.set(RELEASE.portraitSize, RELEASE.portraitSize, 1);
  portrait.renderOrder = 8;
  group.add(portrait);

  if (rider.snoovatar !== null) {
    void loadSnoovatar(rider.snoovatar).then((texture) => {
      if (texture === null) return;
      keeper.keep(texture);
      portraitMaterial.map = texture;
      portraitMaterial.needsUpdate = true;
      // Snoovatars are taller than wide (380 x 501); keep the picture's own shape.
      const image = texture.image;
      const shape =
        image instanceof HTMLCanvasElement && image.height > 0
          ? image.width / image.height
          : 0.76;
      portrait.scale.set(RELEASE.portraitSize * shape, RELEASE.portraitSize, 1);
    });
  }

  return {
    group,
    pose(height, sway, glow, fade) {
      group.visible = fade > 0.01;
      group.position.set(sway, height, 0);
      group.rotation.z = sway * 0.12;
      paper.opacity = fade;
      wood.opacity = fade;
      // Kept low enough that the paper shade still reads as a lantern, not a ball of light.
      paper.emissiveIntensity = 0.35 + glow * 0.55;
      flameMaterial.opacity = fade * (0.7 + glow * 0.3);
      flame.scale.setScalar(0.5 + glow * 0.25);
      haloMaterial.opacity = fade * glow * 0.32;
      halo.scale.setScalar(1.8 + glow * 1.2);
      portraitMaterial.opacity = fade;
    },
    hide() {
      group.visible = false;
    },
  };
}
