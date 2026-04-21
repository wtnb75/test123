import { describe, expect, it } from 'vitest';
import { computeHints, createRandomStage, indexOf, neighbors8, revealZeros } from './board';
import { createRng } from './random';
import type { Stage } from './types';

const createTinyStage = (): Stage => ({
  width: 3,
  height: 3,
  stageNo: 1,
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 9 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
});

describe('board', () => {
  it('computes 8-neighborhood hints', () => {
    const stage = createTinyStage();
    stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;

    computeHints(stage);

    expect(stage.cells[indexOf(stage, { x: 0, y: 0 })].hint).toBe(1);
    expect(stage.cells[indexOf(stage, { x: 2, y: 2 })].hint).toBe(1);
    expect(stage.cells[indexOf(stage, { x: 1, y: 1 })].hint).toBe(-1);
  });

  it('reveals zero region recursively', () => {
    const stage = createTinyStage();
    computeHints(stage);

    revealZeros(stage, { x: 0, y: 0 });

    const revealed = stage.cells.filter((c) => c.revealed).length;
    expect(revealed).toBe(9);
  });

  it('creates random stage keeping start/goal neighbor safe', () => {
    const stage = createRandomStage(
      { width: 8, height: 8, bombCount: 12, stageNo: 1, depthTarget: 1 },
      createRng(1234)
    );

    const protectedCells = [...neighbors8(stage, stage.start), stage.start, ...neighbors8(stage, stage.goal), stage.goal];
    const bombsOnProtected = protectedCells.some((p) => stage.cells[indexOf(stage, p)].hasBomb);

    expect(bombsOnProtected).toBe(false);
  });
});
