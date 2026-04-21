import { describe, expect, it } from 'vitest';
import type { Stage } from './types';
import { computeHints, indexOf } from './board';
import { analyzeSolvability } from './solver';

const createStage = (): Stage => ({
  width: 3,
  height: 3,
  stageNo: 1,
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 9 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
});

describe('solver', () => {
  it('marks simple board as solvable', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
    computeHints(stage);

    const result = analyzeSolvability(stage);

    expect(result.solvable).toBe(true);
    expect(result.decidedBombs).toBe(1);
  });

  it('can report unsolved board', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 0, y: 2 })].hasBomb = true;
    stage.cells[indexOf(stage, { x: 2, y: 0 })].hasBomb = true;
    computeHints(stage);

    const result = analyzeSolvability(stage);

    expect(result.decidedBombs).toBeLessThanOrEqual(2);
  });
});
