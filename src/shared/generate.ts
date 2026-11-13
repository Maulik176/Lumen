/**
 * Seeded island generator. Builds an island backwards from a hidden solution, then lets the
 * solver say what par really is and throws the island away if it does not fit its weekday.
 *
 *  1. Pick the weekday's template: size, sun crystals, pieces, colours.
 *  2. Put sun crystals on the edge. Drop hidden pieces onto the light, one at a time, each on a
 *     tile the light already reaches, so the beams wander across the island.
 *  3. Stand lanterns where beams end up (and where two colours cross, for mixed lanterns).
 *  4. Scatter rock, trees and water where they do not disturb the hidden solution, and cut off
 *     tempting straight shots at lanterns with a rock on the last tile (misleading paths).
 *  5. Remove the hidden pieces and solve. Reject if par, looseness or difficulty miss the band.
 *
 * Everything random comes from one generator seeded by the day number, so day N is always the
 * same island.
 */
import type { Weekday } from './calendar';
import { weekdayOfDay } from './calendar';
import { GENERATOR, type WeekdayTemplate } from './config';
import { rateDifficulty, type Difficulty } from './difficulty';
import { createRng, daySeed, type Rng } from './rng';
import { solve } from './solve';
import { trace } from './trace';
import type {
  BeamColour,
  BeamSegment,
  Direction,
  FixedMirror,
  Lantern,
  LanternColour,
  Placement,
  Puzzle,
  Source,
  Terrain,
} from './types';

export type RejectReason =
  | 'no-room'
  | 'too-few-lanterns'
  | 'no-mixed-lantern'
  | 'lit-at-start'
  | 'too-few-decoys'
  | 'build-broken'
  | 'solver-limit'
  | 'unsolvable'
  | 'par-low'
  | 'par-high'
  | 'too-loose'
  | 'too-cramped'
  | 'prism-unused'
  | 'difficulty-low'
  | 'difficulty-high';

export type GeneratedIsland = {
  day: number;
  weekday: Weekday;
  puzzle: Puzzle;
  par: number;
  /** One minimum solution, from the solver. */
  solution: Placement[];
  difficulty: Difficulty;
  decoys: number;
  /** Islands tried before this one was accepted, counting this one. */
  attempts: number;
  /** Why the others were thrown away. */
  rejections: Partial<Record<RejectReason, number>>;
  /** Search nodes the solver needed. */
  solveNodes: number;
};

type Draft = {
  size: number;
  terrain: Terrain[];
  sources: Source[];
  lanterns: Lantern[];
  fixedMirrors: FixedMirror[];
  /** The hidden solution the island is built around. */
  pieces: Placement[];
  /** Tiles holding a source, lantern, fixed mirror or hidden piece. */
  occupied: Set<number>;
};

const STEP: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

const PRIMARIES: readonly BeamColour[] = ['red', 'green', 'blue'];

function between(rng: Rng, range: readonly [number, number]): number {
  return rng.range(range[0], range[1]);
}

function readingOrder(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return a.y - b.y || a.x - b.x;
}

/** A fresh puzzle object each time: the tracer caches per object, and drafts keep changing. */
function draftPuzzle(draft: Draft, mirrors: number, prisms: number): Puzzle {
  return {
    width: draft.size,
    height: draft.size,
    terrain: draft.terrain.slice(),
    // Reading order (row by row), which is the order the text format stores things in. Keeping
    // to it here means the island that is solved is exactly the island that is published.
    sources: draft.sources.slice().sort(readingOrder),
    lanterns: draft.lanterns.slice().sort(readingOrder),
    fixedMirrors: draft.fixedMirrors.slice().sort(readingOrder),
    inventory: { mirrors, prisms },
  };
}

function traceDraft(draft: Draft, withPieces: boolean) {
  return trace(draftPuzzle(draft, 99, 99), withPieces ? draft.pieces : []);
}

/** Tiles a segment passes over after leaving its start tile, in order, with distance travelled. */
function tilesAlong(
  segment: BeamSegment,
  size: number
): { tile: number; distance: number }[] {
  const { dx, dy } = STEP[segment.direction];
  const tiles: { tile: number; distance: number }[] = [];
  let { x, y } = segment.from;
  let distance = 0;
  while (x !== segment.to.x || y !== segment.to.y) {
    x += dx;
    y += dy;
    distance++;
    tiles.push({ tile: y * size + x, distance });
  }
  return tiles;
}

function isFree(draft: Draft, tile: number): boolean {
  return draft.terrain[tile] === 'grass' && !draft.occupied.has(tile);
}

/** Every hidden piece and fixed mirror still turns some beam, and every lantern is lit. */
function buildHolds(draft: Draft): boolean {
  const result = traceDraft(draft, true);
  if (result.lit.some((lit) => !lit)) return false;
  const turning = new Set<number>();
  for (const segment of result.segments) {
    if (segment.end === 'turn')
      turning.add(segment.to.y * draft.size + segment.to.x);
  }
  for (const piece of draft.pieces) {
    if (!turning.has(piece.y * draft.size + piece.x)) return false;
  }
  for (const mirror of draft.fixedMirrors) {
    if (!turning.has(mirror.y * draft.size + mirror.x)) return false;
  }
  return true;
}

function placeSources(
  draft: Draft,
  template: WeekdayTemplate,
  rng: Rng
): boolean {
  const count = between(rng, template.sources);
  const inward: readonly Direction[] = ['east', 'west', 'south', 'north'];
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (
      let attempt = 0;
      attempt < GENERATOR.placementTries && !placed;
      attempt++
    ) {
      const side = rng.int(4);
      const along = rng.range(1, draft.size - 2);
      const x = side === 0 ? 0 : side === 1 ? draft.size - 1 : along;
      const y = side === 2 ? 0 : side === 3 ? draft.size - 1 : along;
      const tile = y * draft.size + x;
      if (draft.occupied.has(tile)) continue;
      // Two crystals on the same row or column would shine into each other.
      const direction = inward[side] ?? 'east';
      const horizontal = direction === 'east' || direction === 'west';
      if (
        draft.sources.some((other) =>
          horizontal ? other.y === y : other.x === x
        )
      )
        continue;
      const colour: BeamColour = rng.chance(template.colouredSourceChance)
        ? rng.pick(PRIMARIES)
        : 'white';
      draft.sources.push({ x, y, direction, colour });
      draft.occupied.add(tile);
      placed = true;
    }
    if (!placed) return false;
  }
  return true;
}

/**
 * Drop one hidden piece on a tile the light reaches. A fixed mirror is placed the same way and
 * then handed to the island. Returns false if no placement keeps the build intact.
 */
function placePiece(
  draft: Draft,
  kind: 'mirror' | 'prism' | 'fixed',
  rng: Rng
): boolean {
  const spots: { tile: number; colour: BeamColour }[] = [];
  const far: { tile: number; colour: BeamColour }[] = [];
  for (const segment of traceDraft(draft, true).segments) {
    for (const { tile, distance } of tilesAlong(segment, draft.size)) {
      if (!isFree(draft, tile)) continue;
      if (kind === 'prism' && segment.colour !== 'white') continue;
      spots.push({ tile, colour: segment.colour });
      if (distance >= 2) far.push({ tile, colour: segment.colour });
    }
  }
  const pool = far.length > 0 ? far : spots;
  if (pool.length === 0) return false;

  for (const spot of rng.shuffle(pool).slice(0, GENERATOR.placementTries)) {
    const x = spot.tile % draft.size;
    const y = Math.floor(spot.tile / draft.size);
    const orientation = rng.chance(0.5) ? 'slash' : 'backslash';
    draft.occupied.add(spot.tile);
    if (kind === 'fixed') draft.fixedMirrors.push({ x, y, orientation });
    else if (kind === 'prism')
      draft.pieces.push({ x, y, piece: { kind: 'prism' } });
    else draft.pieces.push({ x, y, piece: { kind: 'mirror', orientation } });

    // Keep it only if the light goes somewhere after the new piece and nothing earlier is starved.
    const leaves = traceDraft(draft, true).segments.some(
      (segment) =>
        segment.from.x === x &&
        segment.from.y === y &&
        (segment.to.x !== x || segment.to.y !== y)
    );
    if (leaves && buildHolds(draft)) return true;

    draft.occupied.delete(spot.tile);
    if (kind === 'fixed') draft.fixedMirrors.pop();
    else draft.pieces.pop();
  }
  return false;
}

function mixedColour(colours: ReadonlySet<BeamColour>): LanternColour | null {
  const options: LanternColour[] = [];
  if (colours.has('red') && colours.has('blue')) options.push('magenta');
  if (colours.has('green') && colours.has('blue')) options.push('cyan');
  if (colours.has('red') && colours.has('green')) options.push('yellow');
  return options[0] ?? null;
}

/** Stand a two-colour lantern on a tile where two coloured beams cross. */
function placeMixedLantern(draft: Draft, rng: Rng): boolean {
  const crossing = new Map<number, Set<BeamColour>>();
  for (const segment of traceDraft(draft, true).segments) {
    if (segment.colour === 'white') continue;
    for (const { tile } of tilesAlong(segment, draft.size)) {
      if (!isFree(draft, tile)) continue;
      const colours = crossing.get(tile) ?? new Set<BeamColour>();
      colours.add(segment.colour);
      crossing.set(tile, colours);
    }
  }
  const spots = [...crossing.entries()].filter(
    ([, colours]) => colours.size >= 2
  );
  for (const [tile, colours] of rng
    .shuffle(spots)
    .slice(0, GENERATOR.placementTries)) {
    const colour = mixedColour(colours);
    if (colour === null) continue;
    draft.lanterns.push({
      x: tile % draft.size,
      y: Math.floor(tile / draft.size),
      colour,
    });
    draft.occupied.add(tile);
    if (buildHolds(draft)) return true;
    draft.lanterns.pop();
    draft.occupied.delete(tile);
  }
  return false;
}

/** Stand a lantern on the last stretch of a beam that currently runs off the island or into rock. */
function placeLantern(
  draft: Draft,
  template: WeekdayTemplate,
  rng: Rng
): boolean {
  const spots: { tile: number; colour: BeamColour }[] = [];
  const near: { tile: number; colour: BeamColour }[] = [];
  for (const segment of traceDraft(draft, true).segments) {
    if (segment.end !== 'edge' && segment.end !== 'blocked') continue;
    for (const { tile, distance } of tilesAlong(segment, draft.size)) {
      if (!isFree(draft, tile)) continue;
      const spot = { tile, colour: segment.colour };
      if (distance >= GENERATOR.minLanternRun) spots.push(spot);
      else near.push(spot);
    }
  }
  const pool = spots.length > 0 ? spots : near;
  for (const spot of rng.shuffle(pool).slice(0, GENERATOR.placementTries)) {
    const colour: LanternColour =
      spot.colour !== 'white' && rng.chance(template.colouredLanternChance)
        ? spot.colour
        : 'white';
    draft.lanterns.push({
      x: spot.tile % draft.size,
      y: Math.floor(spot.tile / draft.size),
      colour,
    });
    draft.occupied.add(spot.tile);
    if (buildHolds(draft)) return true;
    draft.lanterns.pop();
    draft.occupied.delete(spot.tile);
  }
  return false;
}

/** Tiles any beam of the hidden solution touches. Nothing solid may go on these. */
function hiddenPath(draft: Draft): Set<number> {
  const path = new Set<number>();
  for (const segment of traceDraft(draft, true).segments) {
    path.add(segment.from.y * draft.size + segment.from.x);
    for (const { tile } of tilesAlong(segment, draft.size)) path.add(tile);
  }
  return path;
}

/**
 * Misleading paths. Where the light, before any piece is placed, crosses a clear straight line
 * into a lantern, a single mirror there would shine right at it. Put a rock on the last tile
 * of that line: the shot still looks open from a distance, and does not work.
 */
function addDecoys(
  draft: Draft,
  path: ReadonlySet<number>,
  wanted: number,
  rng: Rng
): number {
  if (wanted === 0) return 0;
  const tempting = new Set<number>();
  for (const segment of traceDraft(draft, false).segments) {
    for (const { tile } of tilesAlong(segment, draft.size)) {
      if (isFree(draft, tile)) tempting.add(tile);
    }
  }
  let made = 0;
  const directions: readonly Direction[] = ['north', 'east', 'south', 'west'];
  for (const lantern of rng.shuffle(draft.lanterns)) {
    for (const direction of rng.shuffle(directions)) {
      if (made >= wanted) return made;
      const { dx, dy } = STEP[direction];
      const lastX = lantern.x - dx;
      const lastY = lantern.y - dy;
      if (lastX < 0 || lastY < 0 || lastX >= draft.size || lastY >= draft.size)
        continue;
      const lastTile = lastY * draft.size + lastX;
      if (!isFree(draft, lastTile) || path.has(lastTile)) continue;
      // Walk away from the lantern looking for a tile the starting light crosses.
      let x = lastX - dx;
      let y = lastY - dy;
      let found = false;
      while (x >= 0 && y >= 0 && x < draft.size && y < draft.size) {
        const tile = y * draft.size + x;
        const ground = draft.terrain[tile];
        if (ground === 'rock' || ground === 'tree' || draft.occupied.has(tile))
          break;
        if (tempting.has(tile)) {
          found = true;
          break;
        }
        x -= dx;
        y -= dy;
      }
      if (!found) continue;
      draft.terrain[lastTile] = rng.chance(0.5) ? 'rock' : 'tree';
      made++;
    }
  }
  return made;
}

function scatterTerrain(
  draft: Draft,
  template: WeekdayTemplate,
  path: ReadonlySet<number>,
  rng: Rng
): void {
  for (let tile = 0; tile < draft.terrain.length; tile++) {
    if (!isFree(draft, tile)) continue;
    const roll = rng.next();
    if (path.has(tile)) {
      if (roll < template.waterOnPathShare) draft.terrain[tile] = 'water';
      continue;
    }
    if (roll < template.rockShare) draft.terrain[tile] = 'rock';
    else if (roll < template.rockShare + template.treeShare)
      draft.terrain[tile] = 'tree';
    else if (
      roll <
      template.rockShare + template.treeShare + template.waterShare
    )
      draft.terrain[tile] = 'water';
  }
}

type Built = { draft: Draft; decoys: number } | RejectReason;

function buildDraft(template: WeekdayTemplate, rng: Rng): Built {
  const size = rng.pick(template.sizes);
  const draft: Draft = {
    size,
    terrain: Array.from({ length: size * size }, (): Terrain => 'grass'),
    sources: [],
    lanterns: [],
    fixedMirrors: [],
    pieces: [],
    occupied: new Set<number>(),
  };
  if (!placeSources(draft, template, rng)) return 'no-room';

  const fixed = between(rng, template.fixedMirrors);
  for (let i = 0; i < fixed; i++)
    if (!placePiece(draft, 'fixed', rng)) return 'no-room';
  // Prisms go in early, so the mirrors after them have coloured light to route.
  const prisms = between(rng, template.builtPrisms);
  for (let i = 0; i < prisms; i++)
    if (!placePiece(draft, 'prism', rng)) return 'no-room';
  const mirrors = between(rng, template.builtMirrors);
  for (let i = 0; i < mirrors; i++)
    if (!placePiece(draft, 'mirror', rng)) return 'no-room';

  const mixed = between(rng, template.mixedLanterns);
  for (let i = 0; i < mixed; i++)
    if (!placeMixedLantern(draft, rng)) return 'no-mixed-lantern';
  const lanterns = between(rng, template.lanterns);
  while (draft.lanterns.length < lanterns) {
    if (!placeLantern(draft, template, rng)) break;
  }
  if (draft.lanterns.length < template.lanterns[0]) return 'too-few-lanterns';
  if (traceDraft(draft, false).litCount > 0) return 'lit-at-start';

  const path = hiddenPath(draft);
  const decoys = addDecoys(draft, path, between(rng, template.decoys), rng);
  if (decoys < template.decoys[0]) return 'too-few-decoys';
  scatterTerrain(draft, template, path, rng);
  if (!buildHolds(draft)) return 'build-broken';
  return { draft, decoys };
}

/**
 * Generate the island for a day. `weekday` defaults to the day's real UTC weekday; pass one to
 * make, say, a Sunday fallback island. Returns null if no island fits within the attempt budget.
 */
export function generateIsland(
  day: number,
  weekday: Weekday = weekdayOfDay(day)
): GeneratedIsland | null {
  const template: WeekdayTemplate = GENERATOR.templates[weekday];
  const rng = createRng(daySeed(day));
  const rejections: Partial<Record<RejectReason, number>> = {};
  const reject = (reason: RejectReason): void => {
    rejections[reason] = (rejections[reason] ?? 0) + 1;
  };

  const targetPar = between(rng, template.par);

  for (let attempt = 1; attempt <= GENERATOR.maxAttempts; attempt++) {
    const aiming = attempt <= GENERATOR.targetParAttempts;
    const parLow = aiming ? targetPar : template.par[0];
    const parHigh = aiming ? targetPar : template.par[1];
    const built = buildDraft(template, rng);
    if (typeof built === 'string') {
      reject(built);
      continue;
    }
    const { draft, decoys } = built;
    const builtPrisms = draft.pieces.filter(
      (piece) => piece.piece.kind === 'prism'
    ).length;
    const builtMirrors = draft.pieces.length - builtPrisms;

    const trial = draftPuzzle(
      draft,
      builtMirrors + GENERATOR.mirrorSlack,
      builtPrisms
    );
    const solved = solve(trial, { nodeLimit: GENERATOR.maxSolveNodes });
    if (solved.status === 'limit') {
      reject('solver-limit');
      continue;
    }
    if (solved.status === 'unsolvable') {
      reject('unsolvable');
      continue;
    }
    if (solved.par < parLow) {
      reject('par-low');
      continue;
    }
    if (solved.par > parHigh) {
      reject('par-high');
      continue;
    }
    if (
      !solved.solutionCountComplete ||
      solved.solutionCount > GENERATOR.maxMinimumSolutions
    ) {
      reject('too-loose');
      continue;
    }

    if (
      trace(trial, solved.solution).steps <
      GENERATOR.minTravelPerPiece * solved.par
    ) {
      reject('too-cramped');
      continue;
    }

    // The player gets par plus a little slack in mirrors, and exactly the prisms the island was
    // built with. A smaller mirror count than the trial cannot change par or the solution count.
    const puzzle = draftPuzzle(
      draft,
      solved.par + GENERATOR.mirrorSlack,
      builtPrisms
    );
    const difficulty = rateDifficulty(puzzle, solved, decoys);
    if (template.builtPrisms[0] > 0 && difficulty.factors.prismNeeded === 0) {
      reject('prism-unused');
      continue;
    }
    if (difficulty.score < template.difficulty[0]) {
      reject('difficulty-low');
      continue;
    }
    if (difficulty.score > template.difficulty[1]) {
      reject('difficulty-high');
      continue;
    }

    return {
      day,
      weekday,
      puzzle,
      par: solved.par,
      solution: solved.solution,
      difficulty,
      decoys,
      attempts: attempt,
      rejections,
      solveNodes: solved.nodes,
    };
  }
  return null;
}
