import { describe, expect, it } from 'vitest';
import { COPY } from './config';
import { reset, startPlay, tapTile } from './play';
import { puzzleFromText } from './puzzle-text';
import { solve } from './solve';
import { soloLine, TUTORIAL, TUTORIAL_SOLO } from './tutorial';

describe('tutorial islands', () => {
  it('there are three: mirror, turn, prism', () => {
    expect(TUTORIAL.map((step) => step.hints[step.hints.length - 1])).toEqual([
      'mirror',
      'turn',
      'prism',
    ]);
  });

  it.each(TUTORIAL.map((step, index) => [index + 1, step] as const))(
    'island %i is lit by exactly the taught number of taps on its one tile, and not before',
    (_number, step) => {
      let state = startPlay(puzzleFromText(step));
      expect(state.light.litCount).toBe(0);
      for (let tap = 1; tap <= step.taps; tap++) {
        expect(state.light.solved).toBe(false);
        state = tapTile(state, step.tap.x, step.tap.y).state;
      }
      expect(state.light.solved).toBe(true);
      expect(state.placements).toHaveLength(1);
    }
  );

  it('each island needs one piece and has a hint for every tap', () => {
    for (const step of TUTORIAL) {
      expect(solve(puzzleFromText(step))).toMatchObject({
        status: 'solved',
        par: 1,
      });
      expect(step.hints).toHaveLength(step.taps);
    }
  });

  it('the last island needs the prism: a mirror alone cannot light it', () => {
    const last = TUTORIAL[2];
    if (last === undefined) throw new Error('missing island');
    const mirrorsOnly = puzzleFromText({
      ...last,
      inventory: { mirrors: 3, prisms: 0 },
    });
    expect(solve(mirrorsOnly).status).toBe('unsolvable');
  });
});

describe('the "Your turn" island', () => {
  it('needs one mirror, turned: the two things the lessons taught', () => {
    const puzzle = puzzleFromText(TUTORIAL_SOLO);
    expect(solve(puzzle)).toMatchObject({ status: 'solved', par: 1 });
    let state = tapTile(startPlay(puzzle), 1, 1).state;
    expect(state.light.solved).toBe(false);
    state = tapTile(state, 1, 1).state;
    expect(state.light.solved).toBe(true);
  });
});

describe('"Your turn" when a newcomer goes wrong', () => {
  const puzzle = puzzleFromText(TUTORIAL_SOLO);
  // The sun at (0, 1) shines east; the lantern is at (1, 3). These two tiles help nothing.
  const wrong = [
    { x: 3, y: 3 },
    { x: 2, y: 0 },
  ];

  it('says how many mirrors are left to place', () => {
    let state = startPlay(puzzle);
    expect(soloLine(state, [])).toEqual({
      text: COPY.tutorialSoloLeft.replace('{count}', '2'),
      again: false,
    });
    state = tapTile(state, 3, 3).state;
    expect(soloLine(state, []).text).toBe(COPY.tutorialSoloLeftOne);
  });

  it('spending both mirrors badly explains the way back and offers to start again', () => {
    let state = startPlay(puzzle);
    for (const tile of wrong) state = tapTile(state, tile.x, tile.y).state;
    expect(state.light.solved).toBe(false);
    expect(soloLine(state, [])).toEqual({
      text: COPY.tutorialSoloNone,
      again: true,
    });
    // An empty tile now takes nothing: before, this tap looked like it did nothing at all.
    const step = tapTile(state, 2, 2);
    expect(step.events).toContainEqual({ type: 'no-pieces-left' });
    expect(soloLine(step.state, step.events)).toEqual({
      text: COPY.tutorialSoloStuck,
      again: true,
    });
  });

  it('starting again gives both mirrors back, and the island can still be lit', () => {
    let state = startPlay(puzzle);
    for (const tile of wrong) state = tapTile(state, tile.x, tile.y).state;
    state = reset(state).state;
    expect(soloLine(state, []).text).toBe(
      COPY.tutorialSoloLeft.replace('{count}', '2')
    );
    state = tapTile(state, 1, 1).state;
    state = tapTile(state, 1, 1).state;
    expect(state.light.solved).toBe(true);
  });
});
