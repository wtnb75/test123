import { describe, expect, it } from 'vitest';
import type { Stage } from './types';
import { travelRoute } from './travel';
import { indexOf } from './board';

const createStage = (): Stage => ({
  width: 8,
  height: 8,
  stageNo: 1,
  player: { x: 1, y: 1 },
  start: { x: 1, y: 1 },
  goal: { x: 7, y: 7 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 64 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
});

const open = (stage: Stage, cells: Array<[number, number]>): void => {
  for (const [x, y] of cells) {
    stage.cells[indexOf(stage, { x, y })].revealed = true;
  }
};

describe('travelRoute', () => {
  it('walks the opened cells in a straight line to a far opened cell', () => {
    const stage = createStage();
    open(stage, [[2, 1], [3, 1], [4, 1]]);

    expect(travelRoute(stage, { x: 4, y: 1 })).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]);
  });

  it('goes around an unopened cell over opened cells', () => {
    const stage = createStage();
    open(stage, [[2, 2], [3, 1]]);

    expect(travelRoute(stage, { x: 3, y: 1 })).toEqual([{ x: 2, y: 2 }, { x: 3, y: 1 }]);
  });

  it('walks diagonally up and to the left as well as in the other directions', () => {
    const stage = createStage();
    stage.player = { x: 2, y: 2 };
    open(stage, [[1, 1], [0, 0]]);

    expect(travelRoute(stage, { x: 0, y: 0 })).toEqual([{ x: 1, y: 1 }, { x: 0, y: 0 }]);
  });

  it('ends at the first cell next to the down-stairs when the stairs are the target', () => {
    const stage = createStage();
    stage.goal = { x: 4, y: 1 };
    open(stage, [[2, 1], [3, 1], [4, 1]]);

    expect(travelRoute(stage, { x: 4, y: 1 })).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
  });

  it('does not walk through the down-stairs to reach a cell behind them', () => {
    const stage = createStage();
    stage.goal = { x: 3, y: 1 };
    open(stage, [[2, 1], [3, 1], [4, 1]]);

    expect(travelRoute(stage, { x: 4, y: 1 })).toBeNull();
  });

  it('walks through a door cell and an up-stairs cell (the route does not stop on them)', () => {
    const stage = createStage();
    stage.doors = [{ cell: { x: 3, y: 1 }, side: 'E' }];
    open(stage, [[2, 1], [3, 1], [4, 1]]);

    expect(travelRoute(stage, { x: 4, y: 1 })).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]);
  });

  it('reaches an opened door cell that is the target', () => {
    const stage = createStage();
    stage.doors = [{ cell: { x: 3, y: 1 }, side: 'E' }];
    open(stage, [[2, 1], [3, 1]]);

    expect(travelRoute(stage, { x: 3, y: 1 })).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
  });

  it('gives no route to an unopened target or to the player cell', () => {
    const stage = createStage();
    open(stage, [[2, 1]]);

    expect(travelRoute(stage, { x: 5, y: 5 })).toBeNull();
    expect(travelRoute(stage, { x: 1, y: 1 })).toBeNull();
  });

  it('gives no route when the opened cells do not connect the player to the target', () => {
    const stage = createStage();
    open(stage, [[2, 1], [5, 1]]);

    expect(travelRoute(stage, { x: 5, y: 1 })).toBeNull();
  });
});
