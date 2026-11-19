import { describe, expect, it } from 'vitest';
import {
  applyTool,
  builderStart,
  difficultyLabel,
  draftProblem,
  draftPuzzleText,
  emptyDraft,
  islandHash,
  nameProblem,
  nextLesson,
  readDraft,
  redoEdit,
  resizeDraft,
  startHistory,
  undoEdit,
  withEdit,
  type IslandDraft,
} from './builder';
import { COMMUNITY } from './config';
import { puzzleFromText } from './puzzle-text';
import { trace } from './trace';

const at = (draft: IslandDraft, x: number, y: number): string =>
  draft.rows[y]?.[x] ?? '?';

describe('the Builder tools', () => {
  it('starts as a plain grass island of the chosen size and biome', () => {
    const draft = emptyDraft(7, 'snow');
    expect(draft.rows).toHaveLength(7);
    expect(draft.rows.every((row) => row === '.......')).toBe(true);
    expect(draft.biome).toBe('snow');
    expect(draft.spare).toBe(COMMUNITY.defaultSpare);
  });

  it('places a sun facing into the island, and tapping it again turns it clockwise', () => {
    let draft = emptyDraft(6, 'moss');
    let step = applyTool(draft, 'sun', 0, 2);
    expect(step.event).toBe('placed');
    draft = step.draft;
    expect(at(draft, 0, 2)).toBe('>');
    // A sun on the right half faces west, toward the middle.
    expect(at(applyTool(draft, 'sun', 5, 2).draft, 5, 2)).toBe('<');
    const turns = ['v', '<', '^', '>'];
    for (const next of turns) {
      step = applyTool(draft, 'sun', 0, 2);
      expect(step.event).toBe('cycled');
      draft = step.draft;
      expect(at(draft, 0, 2)).toBe(next);
    }
  });

  it('cycles a lantern through every colour, mixes included', () => {
    let draft = applyTool(emptyDraft(6, 'moss'), 'lantern', 3, 3).draft;
    const seen = [at(draft, 3, 3)];
    for (let i = 0; i < 7; i++) {
      draft = applyTool(draft, 'lantern', 3, 3).draft;
      seen.push(at(draft, 3, 3));
    }
    expect(seen).toEqual(['W', 'R', 'G', 'B', 'M', 'C', 'Y', 'W']);
  });

  it('flips a stone mirror, toggles rock, tree and water, and erases anything', () => {
    let draft = applyTool(emptyDraft(6, 'moss'), 'stone', 1, 1).draft;
    expect(at(draft, 1, 1)).toBe('/');
    draft = applyTool(draft, 'stone', 1, 1).draft;
    expect(at(draft, 1, 1)).toBe('\\');
    for (const [tool, char] of [
      ['rock', '#'],
      ['tree', 'T'],
      ['water', '~'],
    ] as const) {
      const placed = applyTool(draft, tool, 4, 4);
      expect(at(placed.draft, 4, 4)).toBe(char);
      const again = applyTool(placed.draft, tool, 4, 4);
      expect(again.event).toBe('removed');
      expect(at(again.draft, 4, 4)).toBe('.');
    }
    const erased = applyTool(draft, 'eraser', 1, 1);
    expect(erased.event).toBe('removed');
    expect(at(erased.draft, 1, 1)).toBe('.');
    expect(applyTool(erased.draft, 'eraser', 1, 1).event).toBe('nothing');
  });

  it('a different tool replaces what is on the tile', () => {
    let draft = applyTool(emptyDraft(6, 'moss'), 'sun', 2, 2).draft;
    draft = applyTool(draft, 'rock', 2, 2).draft;
    expect(at(draft, 2, 2)).toBe('#');
  });

  it(`refuses a fourth sun and a seventh lantern`, () => {
    let draft = emptyDraft(8, 'moss');
    for (let x = 0; x < COMMUNITY.maxSuns; x++)
      draft = applyTool(draft, 'sun', x, 0).draft;
    const more = applyTool(draft, 'sun', 7, 0);
    expect(more.event).toBe('too-many-suns');
    expect(more.draft).toBe(draft);
    for (let x = 0; x < COMMUNITY.maxLanterns; x++)
      draft = applyTool(draft, 'lantern', x, 7).draft;
    expect(applyTool(draft, 'lantern', 7, 7).event).toBe('too-many-lanterns');
    // Turning one that is already there is still fine.
    expect(applyTool(draft, 'sun', 0, 0).event).toBe('cycled');
  });

  it('ignores taps off the board', () => {
    const draft = emptyDraft(6, 'moss');
    expect(applyTool(draft, 'rock', 6, 0).event).toBe('nothing');
    expect(applyTool(draft, 'rock', -1, 0).event).toBe('nothing');
  });

  it('resizing keeps what fits, from the top-left', () => {
    let draft = applyTool(emptyDraft(8, 'moss'), 'rock', 1, 1).draft;
    draft = applyTool(draft, 'rock', 7, 7).draft;
    const smaller = resizeDraft(draft, 6);
    expect(smaller.rows).toHaveLength(6);
    expect(smaller.rows[0]).toHaveLength(6);
    expect(at(smaller, 1, 1)).toBe('#');
    const bigger = resizeDraft(smaller, 8);
    expect(at(bigger, 7, 7)).toBe('.');
  });
});

describe('undo and redo', () => {
  it('steps back and forward through edits; a new edit clears redo', () => {
    let history = startHistory(emptyDraft(6, 'moss'));
    history = withEdit(history, applyTool(history.draft, 'rock', 0, 0).draft);
    history = withEdit(history, applyTool(history.draft, 'tree', 1, 0).draft);
    history = undoEdit(history);
    expect(at(history.draft, 1, 0)).toBe('.');
    expect(at(history.draft, 0, 0)).toBe('#');
    history = redoEdit(history);
    expect(at(history.draft, 1, 0)).toBe('T');
    history = undoEdit(undoEdit(history));
    expect(at(history.draft, 0, 0)).toBe('.');
    expect(undoEdit(history)).toBe(history);
    history = withEdit(history, applyTool(history.draft, 'water', 2, 2).draft);
    expect(redoEdit(history)).toBe(history);
  });
});

describe('what the creator must fix before a check', () => {
  const base = (): IslandDraft => {
    let draft = emptyDraft(6, 'moss');
    draft = applyTool(draft, 'sun', 0, 1).draft; // shines east along row 1
    draft = applyTool(draft, 'lantern', 3, 4).draft;
    return draft;
  };

  it('needs a sun and a lantern', () => {
    expect(draftProblem(emptyDraft(6, 'moss'))).toBe('no-sun');
    expect(
      draftProblem(applyTool(emptyDraft(6, 'moss'), 'sun', 0, 0).draft)
    ).toBe('no-lantern');
    expect(draftProblem(base())).toBeNull();
  });

  it('refuses a lantern the light already reaches with no pieces placed', () => {
    const lit = applyTool(base(), 'lantern', 4, 1).draft;
    expect(draftProblem(lit)).toBe('already-lit');
  });

  it('suns are white, and the live light is the real tracer on the real island', () => {
    const text = draftPuzzleText(base(), { mirrors: 2, prisms: 0 });
    expect(text.sourceColours).toEqual(['white']);
    const light = trace(puzzleFromText(text), []);
    expect(light.segments[0]?.direction).toBe('east');
    expect(light.litCount).toBe(0);
  });
});

describe('names, fingerprints and labels', () => {
  it('names are 1 to 24 letters, digits and spaces', () => {
    expect(nameProblem('Frost Hollow')).toBeNull();
    expect(nameProblem('')).toBe('empty');
    expect(nameProblem('   ')).toBe('empty');
    expect(nameProblem('x'.repeat(COMMUNITY.nameMax + 1))).toBe('too-long');
    expect(nameProblem('Hello <b>')).toBe('characters');
  });

  it('the same island always has the same fingerprint, and a changed tile changes it', () => {
    const draft = applyTool(emptyDraft(6, 'moss'), 'rock', 2, 2).draft;
    expect(islandHash(draft.rows)).toBe(islandHash([...draft.rows]));
    expect(islandHash(draft.rows)).not.toBe(
      islandHash(applyTool(draft, 'rock', 3, 3).draft.rows)
    );
    expect(islandHash(draft.rows)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('labels difficulty Gentle, Tricky or Fiendish', () => {
    expect(difficultyLabel(COMMUNITY.trickyFrom - 1)).toBe('gentle');
    expect(difficultyLabel(COMMUNITY.trickyFrom)).toBe('tricky');
    expect(difficultyLabel(COMMUNITY.fiendishFrom)).toBe('fiendish');
  });

  it('reads a stored draft back, and refuses anything malformed', () => {
    const draft = applyTool(emptyDraft(7, 'autumn'), 'tree', 1, 1).draft;
    expect(readDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    expect(readDraft({ ...draft, size: 5 })).toBeNull();
    expect(readDraft({ ...draft, rows: ['.......'] })).toBeNull();
    expect(
      readDraft({ ...draft, rows: draft.rows.map(() => '...x...') })
    ).toBeNull();
    expect(readDraft({ ...draft, biome: 'lava' })).toBeNull();
    expect(readDraft(null)).toBeNull();
  });
});

describe('the first-island tutorial', () => {
  it('moves on only when the player does the step', () => {
    expect(
      nextLesson('biome', { type: 'tool', tool: 'sun', event: 'placed' })
    ).toBe('biome');
    expect(nextLesson('biome', { type: 'biome' })).toBe('sun');
    expect(
      nextLesson('sun', { type: 'tool', tool: 'sun', event: 'placed' })
    ).toBe('turn');
    expect(
      nextLesson('turn', { type: 'tool', tool: 'sun', event: 'cycled' })
    ).toBe('lantern');
    expect(
      nextLesson('lantern', { type: 'tool', tool: 'lantern', event: 'placed' })
    ).toBe('colour');
    expect(nextLesson('colour', { type: 'next' })).toBe('block');
    expect(
      nextLesson('colour', { type: 'tool', tool: 'lantern', event: 'cycled' })
    ).toBe('block');
    expect(
      nextLesson('block', { type: 'tool', tool: 'tree', event: 'placed' })
    ).toBe('spare');
    expect(nextLesson('spare', { type: 'spare' })).toBe('check');
    expect(nextLesson('check', { type: 'checked' })).toBe('test');
    expect(nextLesson('test', { type: 'tested' })).toBe('done');
  });

  it('a refused placement never counts as doing the step', () => {
    expect(
      nextLesson('sun', { type: 'tool', tool: 'sun', event: 'too-many-suns' })
    ).toBe('sun');
  });
});

describe('where the Builder starts', () => {
  const server = applyTool(emptyDraft(7, 'moss'), 'rock', 1, 1).draft;
  const device = applyTool(emptyDraft(7, 'snow'), 'tree', 2, 2).draft;

  it('signed in, the server decides, so a dev reset really starts over', () => {
    // Nov 19: the device's copy kept the old island and a finished tutorial after a reset.
    expect(
      builderStart({
        loggedIn: true,
        serverDraft: null,
        serverTutorialDone: false,
        deviceDraft: device,
        deviceTutorialDone: true,
      })
    ).toEqual({ draft: null, tutorialDone: false });
    expect(
      builderStart({
        loggedIn: true,
        serverDraft: server,
        serverTutorialDone: true,
        deviceDraft: device,
        deviceTutorialDone: false,
      })
    ).toEqual({ draft: server, tutorialDone: true });
  });

  it('signed out, the device copy is the only one', () => {
    expect(
      builderStart({
        loggedIn: false,
        serverDraft: null,
        serverTutorialDone: false,
        deviceDraft: device,
        deviceTutorialDone: true,
      })
    ).toEqual({ draft: device, tutorialDone: true });
  });
});
