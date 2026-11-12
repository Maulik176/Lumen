/**
 * Solver speed report. Not part of `npm test`; run with `npm run bench`.
 *
 * Builds random open islands (few rocks, so close to the worst case for the solver), solves each
 * and prints time by par. Daily islands from the generator are tighter and solve faster.
 */
import { performance } from 'node:perf_hooks';
import { it } from 'vitest';
import { SOLVER } from '../../src/shared/config';
import { createRng, type Rng } from '../../src/shared/rng';
import { solve } from '../../src/shared/solve';
import { trace } from '../../src/shared/trace';
import type {
  Direction,
  LanternColour,
  Placement,
  Puzzle,
  Terrain,
} from '../../src/shared/types';

const STEP: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};
const FACING_IN: readonly Direction[] = ['east', 'west', 'south', 'north'];

/** Place `pieceCount` random pieces on the beams, then put lanterns where the light ends up. */
function buildIsland(
  rng: Rng,
  size: number,
  pieceCount: number,
  sourceCount: number,
  prisms: number
): Puzzle | null {
  const terrain: Terrain[] = [];
  for (let i = 0; i < size * size; i++) {
    const roll = rng.next();
    terrain.push(roll < 0.08 ? 'rock' : roll < 0.14 ? 'water' : 'grass');
  }
  const bare: Puzzle = {
    width: size,
    height: size,
    terrain,
    sources: [],
    lanterns: [],
    fixedMirrors: [],
    inventory: { mirrors: pieceCount + 1, prisms },
  };
  const used = new Set<number>();
  for (let s = 0; s < sourceCount; s++) {
    const side = rng.int(4);
    const along = rng.int(size);
    const x = side === 0 ? 0 : side === 1 ? size - 1 : along;
    const y = side === 2 ? 0 : side === 3 ? size - 1 : along;
    if (used.has(y * size + x)) continue;
    used.add(y * size + x);
    terrain[y * size + x] = 'grass';
    bare.sources.push({
      x,
      y,
      direction: FACING_IN[side] ?? 'east',
      colour: 'white',
    });
  }

  const placed: Placement[] = [];
  let prismsLeft = prisms;
  for (let i = 0; i < pieceCount; i++) {
    const onBeam: number[] = [];
    for (const segment of trace(bare, placed).segments) {
      const { dx, dy } = STEP[segment.direction];
      let { x, y } = segment.from;
      while (x !== segment.to.x || y !== segment.to.y) {
        x += dx;
        y += dy;
        const tile = y * size + x;
        if (terrain[tile] === 'grass' && !used.has(tile)) onBeam.push(tile);
      }
    }
    if (onBeam.length === 0) return null;
    const tile = rng.pick(onBeam);
    used.add(tile);
    const usePrism = prismsLeft > 0 && rng.chance(0.4);
    if (usePrism) prismsLeft--;
    placed.push({
      x: tile % size,
      y: Math.floor(tile / size),
      piece: usePrism
        ? { kind: 'prism' }
        : {
            kind: 'mirror',
            orientation: rng.chance(0.5) ? 'slash' : 'backslash',
          },
    });
  }

  const lanterns: Puzzle['lanterns'] = [];
  for (const segment of rng.shuffle(trace(bare, placed).segments)) {
    if (lanterns.length >= 4) break;
    if (segment.end !== 'edge' && segment.end !== 'blocked') continue;
    const { dx, dy } = STEP[segment.direction];
    const x = segment.end === 'edge' ? segment.to.x : segment.to.x - dx;
    const y = segment.end === 'edge' ? segment.to.y : segment.to.y - dy;
    const tile = y * size + x;
    if (used.has(tile) || terrain[tile] !== 'grass') continue;
    if (x === segment.from.x && y === segment.from.y) continue;
    used.add(tile);
    const colour: LanternColour =
      segment.colour === 'white' || rng.chance(0.3) ? 'white' : segment.colour;
    lanterns.push({ x, y, colour });
  }
  if (lanterns.length < 2) return null;
  const island: Puzzle = { ...bare, lanterns };
  return trace(island, placed).solved ? island : null;
}

it('solver speed by par on open islands', () => {
  const rng = createRng('bench');
  const shapes = [
    { size: 7, pieces: 4, sources: 2, prisms: 1 },
    { size: 8, pieces: 5, sources: 2, prisms: 1 },
    { size: 9, pieces: 6, sources: 2, prisms: 1 },
    { size: 9, pieces: 7, sources: 3, prisms: 1 },
    { size: 9, pieces: 8, sources: 3, prisms: 2 },
    { size: 9, pieces: 10, sources: 3, prisms: 2 },
  ];
  const byPar = new Map<number, number[]>();
  let limits = 0;
  let islands = 0;

  for (const shape of shapes) {
    let made = 0;
    for (let attempt = 0; attempt < 5000 && made < 40; attempt++) {
      const island = buildIsland(
        rng,
        shape.size,
        shape.pieces,
        shape.sources,
        shape.prisms
      );
      if (island === null) continue;
      made++;
      islands++;
      const started = performance.now();
      const result = solve(island);
      const elapsed = performance.now() - started;
      if (result.status === 'solved') {
        const times = byPar.get(result.par) ?? [];
        times.push(elapsed);
        byPar.set(result.par, times);
      } else {
        limits++;
      }
    }
  }

  console.log(
    `\nSolver speed, ${islands} open islands 7x7 to 9x9, node limit ${SOLVER.nodeLimit}`
  );
  console.log('par   islands   median ms   worst ms   over 2 s');
  for (const [par, times] of [...byPar.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = times.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const worst = sorted[sorted.length - 1] ?? 0;
    const slow = sorted.filter((ms) => ms > 2000).length;
    console.log(
      `${String(par).padStart(3)}   ${String(sorted.length).padStart(7)}   ${median.toFixed(0).padStart(9)}   ${worst
        .toFixed(0)
        .padStart(8)}   ${String(slow).padStart(8)}`
    );
  }
  console.log(`hit the node limit without an answer: ${limits}`);
}, 900_000);
