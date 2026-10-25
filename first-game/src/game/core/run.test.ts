import { describe, expect, it } from 'vitest';
import type { Stage } from './types';
import { RUN_STEP_MS, flagWaitAction, isDoorExit, runBlockAt, runSteps } from './run';
import { indexOf } from './board';

const createStage = (): Stage => ({
  width: 6,
  height: 3,
  stageNo: 1,
  player: { x: 1, y: 1 },
  start: { x: 1, y: 1 },
  goal: { x: 5, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 18 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
});

const open = (stage: Stage, x: number, y: number): void => {
  stage.cells[indexOf(stage, { x, y })].revealed = true;
};

describe('run', () => {
  it('uses one cell per 100 ms', () => {
    expect(RUN_STEP_MS).toBe(100);
  });

  it('may step onto an opened cell', () => {
    const stage = createStage();
    open(stage, 2, 1);

    expect(runBlockAt(stage, { x: 2, y: 1 })).toBeNull();
  });

  it('stops before an unopened cell', () => {
    const stage = createStage();

    expect(runBlockAt(stage, { x: 2, y: 1 })).toBe('closed');
  });

  it('stops before the edge of the board', () => {
    const stage = createStage();

    expect(runBlockAt(stage, { x: 6, y: 1 })).toBe('edge');
    expect(runBlockAt(stage, { x: -1, y: 1 })).toBe('edge');
  });

  it('stops before a door cell even when it is opened', () => {
    const stage = createStage();
    stage.doors = [{ cell: { x: 3, y: 1 }, side: 'E' }];
    open(stage, 3, 1);

    expect(runBlockAt(stage, { x: 3, y: 1 })).toBe('door');
  });

  it('stops before the down-stairs, and an opened goal cell is not a stop for a room without them', () => {
    const stage = createStage();
    open(stage, 5, 2);

    expect(runBlockAt(stage, { x: 5, y: 2 })).toBe('goal');

    stage.goalKind = 'none';
    expect(runBlockAt(stage, { x: 5, y: 2 })).toBeNull();
  });

  it('treats a step out of the player door cell as a door exit, not a run', () => {
    const stage = createStage();
    stage.player = { x: 5, y: 1 };
    stage.doors = [{ cell: { x: 5, y: 1 }, side: 'E' }];

    expect(isDoorExit(stage, { x: 6, y: 1 })).toBe(true);
    expect(isDoorExit(stage, { x: 5, y: 2 })).toBe(false);
  });

  it('is not a door exit from an ordinary cell', () => {
    const stage = createStage();
    stage.doors = [{ cell: { x: 5, y: 1 }, side: 'E' }];

    expect(isDoorExit(stage, { x: 6, y: 1 })).toBe(false);
  });

  it('is not a door exit for a step back into the room from the door cell', () => {
    const stage = createStage();
    stage.player = { x: 5, y: 1 };
    stage.doors = [{ cell: { x: 5, y: 1 }, side: 'E' }];

    expect(isDoorExit(stage, { x: 4, y: 1 })).toBe(false);
  });

  it('stops at the edge of the board: from (4,1) with (5,1) open the run takes 1 step', () => {
    const stage = createStage();
    stage.player = { x: 4, y: 1 };
    open(stage, 5, 1);

    expect(runSteps(stage, { x: 1, y: 0 })).toBe(1);
  });

  it('counts the opened cells before an unopened cell', () => {
    const stage = createStage();
    stage.player = { x: 1, y: 1 };
    open(stage, 2, 1);
    open(stage, 3, 1);

    expect(runSteps(stage, { x: 1, y: 0 })).toBe(2);
  });

  it('counts the cells up to the edge of the board when they are all open', () => {
    const stage = createStage();
    stage.player = { x: 3, y: 1 };
    open(stage, 4, 1);
    open(stage, 5, 1);

    expect(runSteps(stage, { x: 1, y: 0 })).toBe(2);
  });

  it('stops before a door cell, so the steps end at the cell before it', () => {
    const stage = createStage();
    stage.player = { x: 1, y: 1 };
    stage.doors = [{ cell: { x: 3, y: 1 }, side: 'E' }];
    open(stage, 2, 1);
    open(stage, 3, 1);

    expect(runSteps(stage, { x: 1, y: 0 })).toBe(1);
  });

  it('gives no steps when the first cell is not open', () => {
    const stage = createStage();

    expect(runSteps(stage, { x: 1, y: 0 })).toBe(0);
  });

  it('turns an f press with a move key into a toggle of that neighbour', () => {
    expect(flagWaitAction({ x: 1, y: 0 }, false)).toEqual({ kind: 'toggle', dir: { x: 1, y: 0 } });
  });

  it('turns an f press with Shift and a move key into a run, and anything else into a cancel', () => {
    expect(flagWaitAction({ x: 0, y: 1 }, true)).toEqual({ kind: 'run', dir: { x: 0, y: 1 } });
    expect(flagWaitAction(null, false)).toEqual({ kind: 'cancel' });
    expect(flagWaitAction(null, true)).toEqual({ kind: 'cancel' });
  });
});
