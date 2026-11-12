import { describe, expect, it } from 'vitest';
import { puzzleFromText } from './puzzle-text';
import {
  medalFor,
  scoreSubmission,
  validatePlacements,
  validatePuzzle,
} from './validate';
import type { Puzzle } from './types';

// One sun, one lantern, one of everything a piece may not stand on. Par is 1: "/" at (3,2).
const ROWS = ['...W.#', '.T..~.', '>.....', '....\\.'];

function island(mirrors = 2, prisms = 1): Puzzle {
  return puzzleFromText({
    rows: ROWS,
    inventory: { mirrors, prisms },
    sourceColours: [],
  });
}

const slash = (x: number, y: number) => ({
  x,
  y,
  piece: { kind: 'mirror', orientation: 'slash' },
});
const prism = (x: number, y: number) => ({ x, y, piece: { kind: 'prism' } });

describe('validatePlacements', () => {
  it('accepts legal placements and returns clean copies', () => {
    const check = validatePlacements(island(), [
      { ...slash(3, 2), score: 0, extra: 'ignored' },
    ]);
    expect(check).toEqual({ ok: true, placements: [slash(3, 2)] });
  });

  it('accepts an empty list', () => {
    expect(validatePlacements(island(), [])).toEqual({
      ok: true,
      placements: [],
    });
  });

  it.each([
    ['null', null],
    ['an object', { length: 1 }],
    ['a string', '[]'],
    ['a number', 3],
  ])('rejects %s instead of a list', (_name, input) => {
    expect(validatePlacements(island(), input)).toMatchObject({
      ok: false,
      problem: 'not-a-list',
    });
  });

  it.each([
    ['null entry', null],
    ['missing piece', { x: 1, y: 2 }],
    ['text coordinates', { x: '1', y: 2, piece: { kind: 'prism' } }],
    ['fractional coordinates', { x: 1.5, y: 2, piece: { kind: 'prism' } }],
    ['NaN coordinates', { x: Number.NaN, y: 2, piece: { kind: 'prism' } }],
    ['unknown piece', { x: 1, y: 2, piece: { kind: 'lens' } }],
    [
      'unknown orientation',
      { x: 1, y: 2, piece: { kind: 'mirror', orientation: 'flat' } },
    ],
    ['mirror with no orientation', { x: 1, y: 2, piece: { kind: 'mirror' } }],
  ])('rejects a malformed placement: %s', (_name, entry) => {
    expect(validatePlacements(island(), [entry])).toEqual({
      ok: false,
      problem: 'malformed',
      index: 0,
    });
  });

  it.each([
    [-1, 0],
    [0, -1],
    [6, 0],
    [0, 4],
  ])('rejects a piece off the board at %i,%i', (x, y) => {
    expect(validatePlacements(island(), [slash(x, y)])).toMatchObject({
      ok: false,
      problem: 'off-board',
    });
  });

  it.each([
    ['rock', 5, 0],
    ['tree', 1, 1],
    ['water', 4, 1],
    ['the sun crystal', 0, 2],
    ['the lantern', 3, 0],
    ['the fixed mirror', 4, 3],
  ])('rejects a piece on %s', (_name, x, y) => {
    expect(validatePlacements(island(), [slash(x, y)])).toMatchObject({
      ok: false,
      problem: 'not-placeable',
    });
  });

  it('rejects two pieces on one tile and says which entry', () => {
    const check = validatePlacements(island(), [slash(1, 2), prism(1, 2)]);
    expect(check).toEqual({ ok: false, problem: 'duplicate-tile', index: 1 });
  });

  it('rejects more mirrors or prisms than the day allows', () => {
    expect(
      validatePlacements(island(2, 1), [slash(1, 2), slash(2, 2), slash(3, 2)])
    ).toEqual({
      ok: false,
      problem: 'too-many-mirrors',
      index: 2,
    });
    expect(
      validatePlacements(island(2, 1), [prism(1, 2), prism(2, 2)])
    ).toEqual({
      ok: false,
      problem: 'too-many-prisms',
      index: 1,
    });
    expect(validatePlacements(island(2, 0), [prism(1, 2)])).toMatchObject({
      ok: false,
      problem: 'too-many-prisms',
    });
  });
});

describe('scoreSubmission', () => {
  it('re-traces the placements and counts the pieces itself', () => {
    const score = scoreSubmission(island(), [slash(3, 2)]);
    expect(score).toMatchObject({
      ok: true,
      solved: true,
      pieces: 1,
      litCount: 1,
      lanternCount: 1,
    });
  });

  it('does not believe a claim of lit lanterns', () => {
    const tampered = [{ ...slash(2, 2), lit: true, solved: true, pieces: 0 }];
    expect(scoreSubmission(island(), tampered)).toMatchObject({
      ok: true,
      solved: false,
      pieces: 1,
      litCount: 0,
    });
  });

  it('counts wasted pieces against the player', () => {
    const score = scoreSubmission(island(), [slash(3, 2), slash(0, 0)]);
    expect(score).toMatchObject({ ok: true, solved: true, pieces: 2 });
  });

  it('passes on the validation problem for an illegal submission', () => {
    expect(scoreSubmission(island(), [slash(5, 0)])).toEqual({
      ok: false,
      problem: 'not-placeable',
      index: 0,
    });
    expect(scoreSubmission(island(), 'solved')).toMatchObject({
      ok: false,
      problem: 'not-a-list',
    });
  });
});

describe('medalFor', () => {
  it('awards Lamplighter at par, Glow at par + 1, Spark beyond', () => {
    expect(medalFor(4, 4)).toBe('lamplighter');
    expect(medalFor(5, 4)).toBe('glow');
    expect(medalFor(6, 4)).toBe('spark');
    expect(medalFor(12, 4)).toBe('spark');
  });
});

describe('validatePuzzle', () => {
  const good = (): Puzzle => island();

  it('accepts a well-formed island and returns a clean copy', () => {
    const puzzle = good();
    const check = validatePuzzle(
      JSON.parse(JSON.stringify({ ...puzzle, extra: 1 }))
    );
    expect(check).toEqual({ ok: true, puzzle });
  });

  it.each([
    ['not an object', () => null, 'malformed'],
    ['too small', () => ({ ...good(), width: 3 }), 'bad-size'],
    ['too large', () => ({ ...good(), height: 10 }), 'bad-size'],
    ['fractional size', () => ({ ...good(), width: 5.5 }), 'bad-size'],
    [
      'terrain of the wrong length',
      () => ({ ...good(), terrain: ['grass'] }),
      'bad-terrain',
    ],
    [
      'unknown terrain',
      () => ({ ...good(), terrain: good().terrain.map(() => 'lava') }),
      'bad-terrain',
    ],
    [
      'negative inventory',
      () => ({ ...good(), inventory: { mirrors: -1, prisms: 0 } }),
      'bad-inventory',
    ],
    [
      'missing inventory',
      () => ({ ...good(), inventory: null }),
      'bad-inventory',
    ],
    ['no sun crystal', () => ({ ...good(), sources: [] }), 'no-sources'],
    ['no lantern', () => ({ ...good(), lanterns: [] }), 'no-lanterns'],
    [
      'a lantern off the board',
      () => ({ ...good(), lanterns: [{ x: 9, y: 0, colour: 'white' }] }),
      'off-board',
    ],
    [
      'a lantern on the sun crystal',
      () => ({ ...good(), lanterns: [{ x: 0, y: 2, colour: 'white' }] }),
      'overlap',
    ],
    [
      'a lantern on rock',
      () => ({ ...good(), lanterns: [{ x: 5, y: 0, colour: 'white' }] }),
      'not-on-grass',
    ],
    [
      'an unknown lantern colour',
      () => ({ ...good(), lanterns: [{ x: 3, y: 0, colour: 'pink' }] }),
      'bad-value',
    ],
    [
      'an unknown direction',
      () => ({
        ...good(),
        sources: [{ x: 0, y: 2, direction: 'up', colour: 'white' }],
      }),
      'bad-value',
    ],
    [
      'an unknown mirror orientation',
      () => ({
        ...good(),
        fixedMirrors: [{ x: 4, y: 3, orientation: 'flat' }],
      }),
      'bad-value',
    ],
    [
      'too many sun crystals',
      () => ({
        ...good(),
        sources: [0, 1, 2, 3, 4].map((x) => ({
          x,
          y: 3,
          direction: 'north',
          colour: 'white',
        })),
      }),
      'too-many-sources',
    ],
  ])('rejects %s', (_name, make, problem) => {
    expect(validatePuzzle(make())).toEqual({ ok: false, problem });
  });
});
