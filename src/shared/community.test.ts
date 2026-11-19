import { describe, expect, it } from 'vitest';
import { COMMUNITY } from './config';
import {
  boardKey,
  communityIndex,
  communityNumber,
  fallbackName,
  isCommunity,
  nameFiltered,
  skyChannel,
} from './community';
import type { Placement } from './types';

describe('community island numbers', () => {
  it('sit in their own range, far from every daily day', () => {
    expect(isCommunity(1)).toBe(false);
    expect(isCommunity(90)).toBe(false);
    expect(isCommunity(904)).toBe(false);
    expect(isCommunity(communityNumber(1))).toBe(true);
    expect(communityIndex(communityNumber(7))).toBe(7);
    expect(communityNumber(1)).toBe(COMMUNITY.numberBase + 1);
  });

  it('each island has its own realtime channel, in the characters realtime allows', () => {
    expect(skyChannel(12)).toBe('sky_12');
    expect(skyChannel(communityNumber(7))).toBe('sky_isl_7');
    for (const number of [1, 90, communityNumber(1), communityNumber(123456)])
      expect(skyChannel(number)).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it('an island with no name is named after its world and number', () => {
    expect(fallbackName('moss', 7)).toBe('Moss Island #7');
    expect(fallbackName('dune', 12)).toBe('Dune Island #12');
  });
});

describe('the name filter', () => {
  it('refuses a listed word, in any case or disguise', () => {
    expect(nameFiltered('Shit Island')).toBe(true);
    expect(nameFiltered('SHIT')).toBe(true);
    expect(nameFiltered('sh1t hollow')).toBe(true);
    expect(nameFiltered('$h!t')).toBe(true);
    expect(nameFiltered('s h i t')).toBe(true);
    expect(nameFiltered('s-h-i-t')).toBe(true);
    expect(nameFiltered('Shits')).toBe(true);
  });

  it('lets ordinary names through, even ones that contain a listed string', () => {
    for (const name of [
      'Frost Hollow',
      "Maulik's Hollow",
      'Scunthorpe',
      'Cockle Bay',
      'Dickens Isle',
      'Essex Steps',
      'Pishogue',
      'Snow-Bound',
      'Moss Island #7',
    ])
      expect(nameFiltered(name), name).toBe(false);
  });
});

describe('telling boards apart', () => {
  const at = (x: number, y: number, slash: boolean): Placement => ({
    x,
    y,
    piece: { kind: 'mirror', orientation: slash ? 'slash' : 'backslash' },
  });

  it('the same pieces in any order are the same board', () => {
    expect(boardKey([at(1, 2, true), at(3, 4, false)])).toBe(
      boardKey([at(3, 4, false), at(1, 2, true)])
    );
  });

  it('a different place, turn or piece is a different board', () => {
    const base = boardKey([at(1, 2, true)]);
    expect(boardKey([at(1, 3, true)])).not.toBe(base);
    expect(boardKey([at(1, 2, false)])).not.toBe(base);
    expect(boardKey([{ x: 1, y: 2, piece: { kind: 'prism' } }])).not.toBe(base);
  });
});
