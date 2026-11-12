/**
 * Core data types for the Lumen engine.
 *
 * Coordinates: x grows east, y grows south, (0, 0) is the north-west tile.
 * Tiles are indexed row by row: index = y * width + x.
 */

/** A compass direction. Order matters: turning right is +1, turning left is -1 (mod 4). */
export type Direction = 'north' | 'east' | 'south' | 'west';

export const DIRECTIONS: readonly Direction[] = [
  'north',
  'east',
  'south',
  'west',
];

/** Colours a beam can have. */
export type BeamColour = 'white' | 'red' | 'green' | 'blue';

export const BEAM_COLOURS: readonly BeamColour[] = [
  'white',
  'red',
  'green',
  'blue',
];

/**
 * Colours a lantern can ask for.
 * white: any beam lights it. red/green/blue: only that exact colour.
 * magenta = red + blue, cyan = green + blue, yellow = red + green: both must arrive.
 */
export type LanternColour = BeamColour | 'magenta' | 'cyan' | 'yellow';

export const LANTERN_COLOURS: readonly LanternColour[] = [
  'white',
  'red',
  'green',
  'blue',
  'magenta',
  'cyan',
  'yellow',
];

/**
 * What the ground is.
 * grass: light passes, a piece may be placed. rock and tree: block light, no piece.
 * water: light passes, no piece.
 */
export type Terrain = 'grass' | 'rock' | 'tree' | 'water';

/** slash is "/", backslash is "\". Both faces reflect. */
export type MirrorOrientation = 'slash' | 'backslash';

export type Piece =
  { kind: 'mirror'; orientation: MirrorOrientation } | { kind: 'prism' };

export type Position = { x: number; y: number };

/** A sun crystal. It sits on a tile, emits one beam, and blocks any beam that reaches it. */
export type Source = Position & { direction: Direction; colour: BeamColour };

export type Lantern = Position & { colour: LanternColour };

/** A mirror that is part of the island. The player cannot move or remove it. */
export type FixedMirror = Position & { orientation: MirrorOrientation };

export type Inventory = { mirrors: number; prisms: number };

export type Puzzle = {
  width: number;
  height: number;
  /** Row-major, length width x height. Tiles under sources, lanterns and fixed mirrors are grass. */
  terrain: Terrain[];
  /** Traced in this order. */
  sources: Source[];
  lanterns: Lantern[];
  fixedMirrors: FixedMirror[];
  /** How many of each piece the player may place. */
  inventory: Inventory;
};

/** One piece the player has put on the island. */
export type Placement = Position & { piece: Piece };

/**
 * Why a beam segment stopped.
 * turn: a mirror or prism redirected it (the next segment starts on the same tile).
 * lantern: absorbed by a lantern. blocked: hit a rock, tree or sun crystal.
 * edge: left the board. loop: re-entered a tile it already crossed in this direction and colour.
 * cap: the step cap was reached.
 */
export type SegmentEnd =
  'turn' | 'lantern' | 'blocked' | 'edge' | 'loop' | 'cap';

/**
 * A straight run of light, for rendering.
 * `from` is the tile the run starts on (a source, mirror or prism tile).
 * `to` is the last tile it touches: the lantern, blocker or turning piece it reaches,
 * or the last tile on the board when it leaves over the edge.
 */
export type BeamSegment = {
  from: Position;
  to: Position;
  direction: Direction;
  colour: BeamColour;
  end: SegmentEnd;
};

export type TraceResult = {
  segments: BeamSegment[];
  /** One entry per lantern, in puzzle order. */
  lit: boolean[];
  /** Beam colours that reached each lantern, in puzzle order, whether or not they lit it. */
  received: BeamColour[][];
  litCount: number;
  /** True when every lantern is lit. A puzzle with no lanterns is never solved. */
  solved: boolean;
  /** Beam steps taken. */
  steps: number;
  /** True if the step cap cut the trace short. Should never happen on a valid board. */
  capped: boolean;
};

export type Medal = 'lamplighter' | 'glow' | 'spark';
