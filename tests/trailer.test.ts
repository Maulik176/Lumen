import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { puzzleOfDaily, readDailyFile } from '../src/shared/daily';
import { startPlay, tapTile } from '../src/shared/play';
import { trailerSteps } from '../src/shared/trailer';

const days = readDailyFile(
  JSON.parse(readFileSync('content/puzzles.json', 'utf8'))
).days;

describe('trailerSteps', () => {
  it.each([1, 5, 12])('replays day %i to every lantern lit', (day) => {
    const island = days[day - 1];
    if (island === undefined) throw new Error('missing day');
    const puzzle = puzzleOfDaily(island);
    const taps = trailerSteps(puzzle, island.solution);
    let state = startPlay(puzzle);
    for (const tap of taps) state = tapTile(state, tap.x, tap.y).state;
    expect(state.light.solved).toBe(true);
    expect(state.placements).toHaveLength(island.solution.length);
    expect(
      taps.every((tap, i) => i === 0 || tap.atMs > (taps[i - 1]?.atMs ?? 0))
    ).toBe(true);
  });
});
