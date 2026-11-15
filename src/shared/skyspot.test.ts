import { describe, expect, it } from 'vitest';
import { SKY } from './config';
import {
  arrivalPhase,
  climbAt,
  othersInSky,
  skyLook,
  skySpot,
  type SkyView,
} from './skyspot';

/** A portrait phone (430 x 701) with the camera aloft, as after the release. */
const tanHalf = Math.tan((14 * Math.PI) / 180);
const phone: SkyView = {
  aloft: 1,
  aimY: 10,
  dropTan: Math.tan((14 * Math.PI) / 180),
  camBack: 10.7,
  halfV: tanHalf,
  halfH: tanHalf * (430 / 701),
  count: 2,
};

/** Is a point inside the camera's picture? The camera looks at (0, aimY, 0) from +z. */
function onScreen(spot: { x: number; y: number; z: number }, view: SkyView) {
  const reach = -spot.z + view.camBack;
  const centre = view.aimY - view.dropTan * -spot.z;
  return (
    Math.abs(spot.x) <= view.halfH * reach &&
    Math.abs(spot.y - centre) <= view.halfV * reach
  );
}

describe('every lantern can be seen', () => {
  it('the two players from the Android report are on a portrait phone, at every moment', () => {
    for (const name of ['Dry_Promotion2506', 'mohak2605'])
      for (let second = 0; second < 600; second += 7)
        expect(onScreen(skySpot(skyLook(name), second, phone), phone)).toBe(
          true
        );
  });

  it('so are a thousand others, on a phone and on a wide desktop view', () => {
    const desktop: SkyView = { ...phone, halfH: tanHalf * (1100 / 700) };
    for (let i = 0; i < 1000; i++) {
      const look = skyLook(`player_${i}`);
      for (const view of [phone, desktop])
        expect(onScreen(skySpot(look, i * 3.1, view), view)).toBe(true);
    }
  });

  it('while playing, every lantern is inside the view from side to side', () => {
    const playing: SkyView = { ...phone, aloft: 0, camBack: 12 };
    for (let i = 0; i < 1000; i++) {
      const spot = skySpot(skyLook(`player_${i}`), i, playing);
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(
        playing.halfH * (-spot.z + playing.camBack)
      );
    }
  });

  it('a new arrival starts at the bottom of its climb', () => {
    const look = skyLook('newcomer');
    const at = 123.4;
    expect(climbAt({ ...look, phase: arrivalPhase(look, at) }, at)).toBeCloseTo(
      SKY.arrivalClimb,
      5
    );
  });
});

describe('a busy night', () => {
  it('shows about SKY.comfortable lanterns at once, never all three hundred', () => {
    const busy: SkyView = { ...phone, count: 300 };
    let shown = 0;
    for (let i = 0; i < 300; i++)
      if (onScreen(skySpot(skyLook(`player_${i}`), 40, busy), busy)) shown++;
    expect(shown).toBeGreaterThan(SKY.comfortable * 0.5);
    expect(shown).toBeLessThan(SKY.comfortable * 2);
  });
});

describe('othersInSky', () => {
  const sky = [
    {
      u: 'Dry_Promotion2506',
      s: 'plain',
      a: 'https://i.redd.it/snoovatar/x.png',
    },
    { u: 'mohak2605', s: 'plain', a: '' },
  ];
  it('hides only the viewer, and keeps a lantern whatever its snoovatar', () => {
    expect(othersInSky(sky, 'mohak2605').map((l) => l.u)).toEqual([
      'Dry_Promotion2506',
    ]);
    expect(othersInSky(sky, 'Dry_Promotion2506').map((l) => l.u)).toEqual([
      'mohak2605',
    ]);
    expect(othersInSky(sky, null)).toHaveLength(2);
  });
  it('shows each name once', () => {
    expect(othersInSky([...sky, ...sky], null)).toHaveLength(2);
  });
});
