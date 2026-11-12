import { describe, expect, it } from 'vitest';
import { puzzleFromText, puzzleToRows, readFixture } from './puzzle-text';

const ROWS = ['>.#T~', '/\\WRG', 'BMCY.', '^v<..'];

describe('puzzle text', () => {
  it('reads every symbol', () => {
    const puzzle = puzzleFromText({
      rows: ROWS,
      inventory: { mirrors: 2, prisms: 1 },
      sourceColours: ['red'],
    });
    expect(puzzle.width).toBe(5);
    expect(puzzle.height).toBe(4);
    expect(puzzle.terrain.slice(0, 5)).toEqual([
      'grass',
      'grass',
      'rock',
      'tree',
      'water',
    ]);
    expect(puzzle.sources).toEqual([
      { x: 0, y: 0, direction: 'east', colour: 'red' },
      { x: 0, y: 3, direction: 'north', colour: 'white' },
      { x: 1, y: 3, direction: 'south', colour: 'white' },
      { x: 2, y: 3, direction: 'west', colour: 'white' },
    ]);
    expect(puzzle.lanterns.map((lantern) => lantern.colour)).toEqual([
      'white',
      'red',
      'green',
      'blue',
      'magenta',
      'cyan',
      'yellow',
    ]);
    expect(puzzle.fixedMirrors).toEqual([
      { x: 0, y: 1, orientation: 'slash' },
      { x: 1, y: 1, orientation: 'backslash' },
    ]);
    expect(puzzle.inventory).toEqual({ mirrors: 2, prisms: 1 });
  });

  it('round-trips back to the same rows', () => {
    const puzzle = puzzleFromText({
      rows: ROWS,
      inventory: { mirrors: 0, prisms: 0 },
      sourceColours: [],
    });
    expect(puzzleToRows(puzzle)).toEqual(ROWS);
  });

  it('rejects ragged rows, unknown symbols and empty islands', () => {
    const inventory = { mirrors: 0, prisms: 0 };
    expect(() =>
      puzzleFromText({ rows: ['...', '..'], inventory, sourceColours: [] })
    ).toThrow(/Row 1/);
    expect(() =>
      puzzleFromText({ rows: ['.?.'], inventory, sourceColours: [] })
    ).toThrow(/Unknown tile/);
    expect(() =>
      puzzleFromText({ rows: [], inventory, sourceColours: [] })
    ).toThrow(/at least one tile/);
  });
});

describe('readFixture', () => {
  const good = {
    name: 'One',
    note: 'Why par is 1.',
    par: 1,
    rows: ['>.W'],
    inventory: { mirrors: 1, prisms: 0 },
  };

  it('reads a well-formed fixture', () => {
    expect(readFixture(good)).toEqual({ ...good, sourceColours: [] });
    expect(
      readFixture({ ...good, sourceColours: ['blue'] }).sourceColours
    ).toEqual(['blue']);
  });

  it.each([
    ['a non-object', 3],
    ['no name', { ...good, name: '' }],
    ['no note', { ...good, note: undefined }],
    ['a fractional par', { ...good, par: 1.5 }],
    ['rows that are not text', { ...good, rows: [1, 2] }],
    ['no inventory', { ...good, inventory: undefined }],
    ['an unknown source colour', { ...good, sourceColours: ['pink'] }],
  ])('rejects %s', (_name, value) => {
    expect(() => readFixture(value)).toThrow();
  });
});
