import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_LENGTH,
  CORRIDOR_MAX_FRAME_MS,
  CORRIDOR_STEP_MS,
  advanceCorridor,
  corridorCellAt,
  corridorShape,
  corridorState
} from './corridor';
import { createRng } from './random';

// Fixtures are worked by hand from docs/spec/rooms-and-floors.md ("通路の形" and "テスト観点"). A cell is
// (forward, right): `y` is to the right of the way the corridor goes (left is negative).
// Each draw is `d` (< 0.5 turns) and, for a turn out of a forward step, `e` (< 0.5 is left, otherwise right).
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0.9;
};

const cellsOf = (...values: number[]) => corridorShape(sequence(...values));

describe('corridorShape', () => {
  it('keeps going forward when no draw turns: a straight corridor', () => {
    expect(cellsOf(0.9, 0.9, 0.9, 0.9)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }
    ]);
  });

  it('turns left on step 3 and keeps going left', () => {
    // forward, forward, (d 0.1 turns, e 0.2 -> left), left, left
    expect(cellsOf(0.9, 0.1, 0.2, 0.9, 0.9)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: -1 }, { x: 2, y: -2 }, { x: 2, y: -3 }
    ]);
  });

  it('turns right (e >= 0.5) and then forward out of a sideways run', () => {
    // forward, forward, forward, (d 0.1, e 0.8 -> right), (d 0.1 -> forward)
    expect(cellsOf(0.9, 0.9, 0.1, 0.8, 0.1)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }
    ]);
  });

  it('goes forward instead of a step that would land next to a cell it did not come from', () => {
    // forward, right, forward, then a left turn would reach (2, 0), beside (1, 0): forward to (3, 1); forward
    expect(cellsOf(0.1, 0.9, 0.1, 0.1, 0.1, 0.9)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }
    ]);
  });

  it('makes shapes of the given turn chance: chance 0 is always straight, chance 1 always turns', () => {
    expect(corridorShape(createRng(3), 6, 0).map((c) => c.y)).toEqual([0, 0, 0, 0, 0, 0]);

    // chance 1, e = 0.1 (left): forward, left (turn), forward (turn back), left (turn), forward (turn back)
    expect(corridorShape(sequence(0.1, 0.1, 0.1, 0.1, 0.1), 6, 1)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: -2 }, { x: 3, y: -2 }
    ]);
  });

  it('does not turn on a draw exactly at the turn chance (d = 0.5), and goes right on e = 0.5', () => {
    expect(corridorShape(sequence(0.5, 0.5, 0.5, 0.5)).map((c) => c.y)).toEqual([0, 0, 0, 0, 0, 0]);
    // d = 0.1 turns, e = 0.5 is not < 0.5: right. The first three cells are (0, 0), (1, 0), (1, 1).
    expect(cellsOf(0.1, 0.5, 0.9, 0.9).slice(0, 3)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  });

  it('on many seeds: 6 connected cells from (0, 0), no revisits or touching, never backwards, turns and straights both occur', () => {
    let straight = 0;
    let turned = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const cells = corridorShape(createRng(seed));
      if (cells.length !== CORRIDOR_LENGTH) {
        expect.fail(`seed ${seed}: ${cells.length} cells`);
      }
      if (cells[0].x !== 0 || cells[0].y !== 0) {
        expect.fail(`seed ${seed}: first cell ${JSON.stringify(cells[0])}`);
      }
      for (let i = 1; i < cells.length; i += 1) {
        const step = Math.abs(cells[i].x - cells[i - 1].x) + Math.abs(cells[i].y - cells[i - 1].y);
        if (step !== 1 || cells[i].x < cells[i - 1].x) {
          expect.fail(`seed ${seed}: step ${i} is not one cell forward / left / right`);
        }
        for (let j = 0; j < i - 1; j += 1) {
          const distance = Math.abs(cells[i].x - cells[j].x) + Math.abs(cells[i].y - cells[j].y);
          if (distance <= 1) {
            expect.fail(`seed ${seed}: cells ${i} and ${j} touch`);
          }
        }
      }
      if (cells.every((c) => c.y === 0)) {
        straight += 1;
      } else {
        turned += 1;
      }
    }
    expect(straight).toBeGreaterThan(0);
    expect(turned).toBeGreaterThan(0);
  });

  it('is reproducible: the same seed gives the same shape', () => {
    expect(corridorShape(createRng(11))).toEqual(corridorShape(createRng(11)));
  });
});

describe('corridorState', () => {
  it.each([
    [0, 0, false],
    [119, 0, false],
    [120, 1, false],
    [599, 4, false],
    [600, 5, false],
    [719, 5, false],
    [720, 5, true],
    [5000, 5, true]
  ])('at %i ms the player is on walk cell %i (done: %s)', (elapsed, index, done) => {
    expect(corridorState(elapsed, 6, 120)).toEqual({ index, done });
  });

  it('uses the corridor constants by default and never goes below the first cell', () => {
    expect(CORRIDOR_LENGTH * CORRIDOR_STEP_MS).toBe(720);
    expect(corridorState(-50)).toEqual({ index: 0, done: false });
    expect(corridorState(720)).toEqual({ index: 5, done: true });
  });
});

describe('corridorCellAt', () => {
  const cells = [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }];

  it('counts from the first cell going from room A to room B and from the last cell on the way back', () => {
    expect(corridorCellAt(cells, 0, true)).toEqual({ x: 0, y: 1 });
    expect(corridorCellAt(cells, 5, true)).toEqual({ x: 4, y: 0 });
    expect(corridorCellAt(cells, 0, false)).toEqual({ x: 4, y: 0 });
    expect(corridorCellAt(cells, 3, false)).toEqual({ x: 2, y: 1 });
    expect(corridorCellAt(cells, 5, false)).toEqual({ x: 0, y: 1 });
  });
});

describe('advanceCorridor', () => {
  it('adds the frame time, capped at the maximum frame time, and ignores a negative one', () => {
    expect(advanceCorridor(0, 16)).toBe(16);
    expect(advanceCorridor(16, CORRIDOR_MAX_FRAME_MS)).toBe(16 + CORRIDOR_MAX_FRAME_MS);
    expect(advanceCorridor(16, CORRIDOR_MAX_FRAME_MS + 1)).toBe(16 + CORRIDOR_MAX_FRAME_MS);
    expect(advanceCorridor(700, 60000)).toBe(800);
    expect(advanceCorridor(700, -5)).toBe(700);
  });

  it('turns a frame of 300 ms into 100 ms of the walk', () => {
    expect(advanceCorridor(0, 300)).toBe(100);
  });
});
