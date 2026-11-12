import { describe, expect, it } from 'vitest';
import { compileBoard, createScratch, runTrace } from './board';
import { TRACE } from './config';
import { puzzleFromText } from './puzzle-text';
import { piecesFromPlacements, trace } from './trace';
import type {
  BeamColour,
  Direction,
  MirrorOrientation,
  Placement,
  Puzzle,
} from './types';

function island(rows: string[], sourceColours: BeamColour[] = []): Puzzle {
  return puzzleFromText({
    rows,
    inventory: { mirrors: 9, prisms: 9 },
    sourceColours,
  });
}

function mirror(
  x: number,
  y: number,
  orientation: MirrorOrientation
): Placement {
  return { x, y, piece: { kind: 'mirror', orientation } };
}

function prism(x: number, y: number): Placement {
  return { x, y, piece: { kind: 'prism' } };
}

/** A 5x5 island with one sun crystal aimed at the centre tile (2,2) from the given side. */
const AIMED_AT_CENTRE: Record<Direction, string[]> = {
  east: ['.....', '.....', '>....', '.....', '.....'],
  west: ['.....', '.....', '....<', '.....', '.....'],
  south: ['..v..', '.....', '.....', '.....', '.....'],
  north: ['.....', '.....', '.....', '.....', '..^..'],
};

const LEFT_OF: Record<Direction, Direction> = {
  north: 'west',
  west: 'south',
  south: 'east',
  east: 'north',
};
const RIGHT_OF: Record<Direction, Direction> = {
  north: 'east',
  east: 'south',
  south: 'west',
  west: 'north',
};

describe('sun crystal', () => {
  it.each<[Direction, string[], { x: number; y: number }]>([
    ['east', AIMED_AT_CENTRE.east, { x: 4, y: 2 }],
    ['west', AIMED_AT_CENTRE.west, { x: 0, y: 2 }],
    ['south', AIMED_AT_CENTRE.south, { x: 2, y: 4 }],
    ['north', AIMED_AT_CENTRE.north, { x: 2, y: 0 }],
  ])(
    'emits one beam facing %s that runs straight to the edge',
    (direction, rows, lastTile) => {
      const result = trace(island(rows), []);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toMatchObject({
        direction,
        colour: 'white',
        end: 'edge',
        to: lastTile,
      });
    }
  );

  it('emits its fixed colour', () => {
    const result = trace(island(['>...W'], ['blue']), []);
    expect(result.segments[0]?.colour).toBe('blue');
    expect(result.received[0]).toEqual(['blue']);
  });

  it('blocks a beam that reaches it', () => {
    const result = trace(island(['>..<.']), []);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({
      end: 'blocked',
      to: { x: 3, y: 0 },
    });
    expect(result.segments[1]).toMatchObject({
      end: 'blocked',
      to: { x: 0, y: 0 },
    });
  });

  it('traces sources in puzzle order', () => {
    const result = trace(island(['>....', '.....', '>....']), []);
    expect(result.segments.map((segment) => segment.from.y)).toEqual([0, 2]);
  });
});

describe('lantern', () => {
  it.each<BeamColour>(['white', 'red', 'green', 'blue'])(
    'white lantern is lit by a %s beam',
    (colour) => {
      expect(trace(island(['>..W.'], [colour]), []).lit).toEqual([true]);
    }
  );

  it.each<[string, BeamColour, boolean]>([
    ['R', 'red', true],
    ['R', 'white', false],
    ['R', 'green', false],
    ['R', 'blue', false],
    ['G', 'green', true],
    ['G', 'white', false],
    ['G', 'red', false],
    ['B', 'blue', true],
    ['B', 'white', false],
    ['B', 'green', false],
  ])('coloured lantern %s hit by %s: lit = %s', (lantern, colour, lit) => {
    expect(trace(island([`>..${lantern}.`], [colour]), []).lit).toEqual([lit]);
  });

  it.each<[string, BeamColour, BeamColour]>([
    ['M', 'red', 'blue'],
    ['C', 'green', 'blue'],
    ['Y', 'red', 'green'],
  ])('mixed lantern %s needs both %s and %s', (lantern, first, second) => {
    const rows = [`>.${lantern}.<`];
    expect(trace(island(rows, [first, first]), []).lit).toEqual([false]);
    expect(trace(island(rows, [second, second]), []).lit).toEqual([false]);
    expect(trace(island(rows, [first, second]), []).lit).toEqual([true]);
    expect(trace(island(rows, [second, first]), []).lit).toEqual([true]);
  });

  it('mixed lantern is not lit by white light, or by one right colour and one wrong one', () => {
    expect(trace(island(['>.M.<'], ['white', 'white']), []).lit).toEqual([
      false,
    ]);
    expect(trace(island(['>.M.<'], ['red', 'green']), []).lit).toEqual([false]);
  });

  it('absorbs the beam, so a lantern behind it stays dark', () => {
    const result = trace(island(['>.W.W']), []);
    expect(result.lit).toEqual([true, false]);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      end: 'lantern',
      to: { x: 2, y: 0 },
    });
    expect(result.solved).toBe(false);
  });

  it('reports solved only when every lantern is lit', () => {
    expect(trace(island(['>.W..', '>...W']), []).solved).toBe(true);
    expect(trace(island(['>.W..', '....W']), []).solved).toBe(false);
    expect(trace(island(['>....']), []).solved).toBe(false);
  });
});

describe('mirror', () => {
  it.each<[MirrorOrientation, Direction, Direction]>([
    ['slash', 'east', 'north'],
    ['slash', 'north', 'east'],
    ['slash', 'west', 'south'],
    ['slash', 'south', 'west'],
    ['backslash', 'east', 'south'],
    ['backslash', 'south', 'east'],
    ['backslash', 'west', 'north'],
    ['backslash', 'north', 'west'],
  ])(
    '%s turns a beam travelling %s to the %s',
    (orientation, incoming, outgoing) => {
      const result = trace(island(AIMED_AT_CENTRE[incoming]), [
        mirror(2, 2, orientation),
      ]);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]).toMatchObject({
        direction: incoming,
        end: 'turn',
        to: { x: 2, y: 2 },
      });
      expect(result.segments[1]).toMatchObject({
        direction: outgoing,
        from: { x: 2, y: 2 },
        end: 'edge',
      });
    }
  );

  it('keeps the colour of the beam it turns', () => {
    const result = trace(island(AIMED_AT_CENTRE.east, ['red']), [
      mirror(2, 2, 'slash'),
    ]);
    expect(result.segments.map((segment) => segment.colour)).toEqual([
      'red',
      'red',
    ]);
  });

  it('reflects on both faces at once', () => {
    const rows = ['..v..', '.....', '>....', '.....', '.....'];
    const result = trace(island(rows), [mirror(2, 2, 'slash')]);
    const leaving = result.segments.filter(
      (segment) => segment.from.x === 2 && segment.from.y === 2
    );
    expect(leaving.map((segment) => segment.direction).sort()).toEqual([
      'north',
      'west',
    ]);
  });
});

describe('prism', () => {
  it.each<Direction>(['north', 'east', 'south', 'west'])(
    'splits white light travelling %s: red left, green straight, blue right',
    (incoming) => {
      const result = trace(island(AIMED_AT_CENTRE[incoming]), [prism(2, 2)]);
      const leaving = result.segments.filter(
        (segment) => segment.from.x === 2 && segment.from.y === 2
      );
      const directionOf = (colour: BeamColour): Direction | undefined =>
        leaving.find((segment) => segment.colour === colour)?.direction;
      expect(leaving).toHaveLength(3);
      expect(directionOf('red')).toBe(LEFT_OF[incoming]);
      expect(directionOf('green')).toBe(incoming);
      expect(directionOf('blue')).toBe(RIGHT_OF[incoming]);
      expect(result.segments[0]).toMatchObject({
        colour: 'white',
        end: 'turn',
        to: { x: 2, y: 2 },
      });
    }
  );

  it.each<BeamColour>(['red', 'green', 'blue'])(
    'lets a %s beam straight through unchanged',
    (colour) => {
      const result = trace(island(AIMED_AT_CENTRE.east, [colour]), [
        prism(2, 2),
      ]);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toMatchObject({
        colour,
        direction: 'east',
        end: 'edge',
        to: { x: 4, y: 2 },
      });
    }
  );

  it('lights three coloured lanterns from one white beam', () => {
    const rows = ['...R..', '......', '>....G', '......', '......', '...B..'];
    expect(trace(island(rows), []).litCount).toBe(0);
    expect(trace(island(rows), [prism(3, 2)]).solved).toBe(true);
  });
});

describe('terrain', () => {
  it.each(['#', 'T'])('"%s" blocks light', (blocker) => {
    const result = trace(island([`>.${blocker}.W`]), []);
    expect(result.lit).toEqual([false]);
    expect(result.segments[0]).toMatchObject({
      end: 'blocked',
      to: { x: 2, y: 0 },
    });
  });

  it('water lets light pass', () => {
    expect(trace(island(['>~~~W']), []).lit).toEqual([true]);
  });

  it('empty grass lets light pass', () => {
    expect(trace(island(['>...W']), []).lit).toEqual([true]);
  });

  it.each([
    ['rock', '#'],
    ['tree', 'T'],
    ['water', '~'],
    ['a sun crystal', '>'],
    ['a lantern', 'W'],
    ['a fixed mirror', '/'],
  ])('%s cannot hold a piece', (_name, char) => {
    const puzzle = island([`.${char}...`, '.....']);
    expect(() => trace(puzzle, [mirror(1, 0, 'slash')])).toThrow(RangeError);
  });

  it('grass can hold one piece, not two, and nothing off the board', () => {
    const puzzle = island(['>....', '.....']);
    expect(() => trace(puzzle, [mirror(2, 0, 'slash')])).not.toThrow();
    expect(() => trace(puzzle, [mirror(2, 0, 'slash'), prism(2, 0)])).toThrow(
      RangeError
    );
    expect(() => trace(puzzle, [mirror(5, 0, 'slash')])).toThrow(RangeError);
    expect(() => trace(puzzle, [mirror(0, -1, 'slash')])).toThrow(RangeError);
  });
});

describe('fixed mirror', () => {
  it('reflects like a placed mirror', () => {
    const fixed = trace(island(['>.\\..', '.....', '..W..']), []);
    const placed = trace(island(['>....', '.....', '..W..']), [
      mirror(2, 0, 'backslash'),
    ]);
    expect(fixed.lit).toEqual([true]);
    expect(fixed.segments).toEqual(placed.segments);
  });
});

describe('beam rules', () => {
  it('beams of different colours cross the same tile without interacting', () => {
    const rows = ['..v..', '.....', '>...R', '.....', '..B..'];
    const result = trace(island(rows, ['blue', 'red']), []);
    expect(result.lit).toEqual([true, true]);
    expect(result.segments).toHaveLength(2);
  });

  it('beams of the same colour cross without interacting', () => {
    const rows = ['..v..', '.....', '>...W', '.....', '..W..'];
    expect(trace(island(rows), []).lit).toEqual([true, true]);
  });

  it('two beams of the same colour and direction on one tile merge: the second stops', () => {
    // The prism turns the white beam's red part east along row 1, where a red beam already runs.
    const rows = ['..v..', '>...W', '.....'];
    const result = trace(island(rows, ['white', 'red']), [prism(2, 1)]);
    expect(result.lit).toEqual([true]);
    expect(result.received[0]).toEqual(['red']);
    expect(
      result.segments.filter((segment) => segment.end === 'loop')
    ).toHaveLength(1);
    expect(result.capped).toBe(false);
  });

  it('stops a beam that re-enters a tile in the same direction and colour', () => {
    // The prism sends red north and blue south; four mirrors route each back through the prism.
    const rows = ['.....', '.....', '>....', '.....', '.....'];
    const pieces = [
      prism(2, 2),
      mirror(2, 0, 'slash'),
      mirror(4, 0, 'backslash'),
      mirror(4, 4, 'slash'),
      mirror(2, 4, 'backslash'),
    ];
    const result = trace(island(rows), pieces);
    const loops = result.segments.filter((segment) => segment.end === 'loop');
    expect(loops.map((segment) => segment.colour).sort()).toEqual([
      'blue',
      'red',
    ]);
    expect(result.capped).toBe(false);
    expect(result.steps).toBeLessThan(60);
  });

  it('caps total steps at 4 x tiles x 4 directions x 4 colours', () => {
    const board = compileBoard(island(['>....', '.....']));
    expect(board.stepCap).toBe(TRACE.stepCapFactor * 10 * 4 * 4);
    expect(board.stepCap).toBe(640);
  });

  it('stops and reports when the cap is reached', () => {
    const board = { ...compileBoard(island(['>....'])), stepCap: 2 };
    const scratch = createScratch(board);
    const ends: number[] = [];
    runTrace(
      board,
      new Uint8Array(board.tiles),
      scratch,
      (_from, _to, _direction, _colour, end) => {
        ends.push(end);
      }
    );
    expect(scratch.capped).toBe(true);
    expect(scratch.steps).toBe(2);
    expect(ends).toHaveLength(1);
  });

  it('is deterministic: the same input gives byte-identical output', () => {
    const rows = ['...R..', '..#...', '>....G', '.~....', '\\.....', '...B..'];
    const pieces = [prism(3, 2), mirror(1, 2, 'slash')];
    const first = JSON.stringify(trace(island(rows), pieces));
    const second = JSON.stringify(
      trace(island(rows), pieces.slice().reverse())
    );
    expect(second).toBe(first);
  });
});

describe('segments', () => {
  it('describe each straight run from its start tile to the tile it ends on', () => {
    const rows = ['...W..', '......', '>.....'];
    const result = trace(island(rows), [mirror(3, 2, 'slash')]);
    expect(result.segments).toEqual([
      {
        from: { x: 0, y: 2 },
        to: { x: 3, y: 2 },
        direction: 'east',
        colour: 'white',
        end: 'turn',
      },
      {
        from: { x: 3, y: 2 },
        to: { x: 3, y: 0 },
        direction: 'north',
        colour: 'white',
        end: 'lantern',
      },
    ]);
    expect(result.steps).toBe(4);
  });
});

describe('piecesFromPlacements', () => {
  it('lays pieces on the grid by tile index', () => {
    const board = compileBoard(island(['>....', '.....']));
    const grid = piecesFromPlacements(board, [
      mirror(1, 0, 'slash'),
      mirror(2, 1, 'backslash'),
      prism(4, 1),
    ]);
    expect(Array.from(grid)).toEqual([0, 1, 0, 0, 0, 0, 0, 2, 0, 3]);
  });
});
