import { describe, expect, it } from 'vitest';
import { cloneStage, computeHints, createRandomStage, indexOf, neighbors8, revealZeros } from './board';
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

  it('returns only in-bounds neighbors at corners and all eight in the middle', () => {
    const stage = createTinyStage();

    expect(neighbors8(stage, { x: 0, y: 0 })).toHaveLength(3);
    expect(neighbors8(stage, { x: 1, y: 0 })).toHaveLength(5);
    expect(neighbors8(stage, { x: 1, y: 1 })).toHaveLength(8);
  });

  it('does not reveal bombs and stops the cascade at hinted cells', () => {
    const stage = createTinyStage();
    stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
    computeHints(stage);

    revealZeros(stage, { x: 0, y: 0 });

    expect(stage.cells[indexOf(stage, { x: 2, y: 2 })].revealed).toBe(false);
    expect(stage.cells.filter((c) => c.revealed)).toHaveLength(8);
  });

  it('keeps flagged cells hidden while revealing the rest of the zero region', () => {
    const stage = createTinyStage();
    computeHints(stage);
    stage.cells[indexOf(stage, { x: 2, y: 0 })].flagged = true;

    revealZeros(stage, { x: 0, y: 0 });

    expect(stage.cells[indexOf(stage, { x: 2, y: 0 })].revealed).toBe(false);
    expect(stage.cells.filter((c) => c.revealed)).toHaveLength(8);
  });

  it('reveals nothing when the origin is flagged', () => {
    const stage = createTinyStage();
    computeHints(stage);
    stage.cells[indexOf(stage, { x: 0, y: 0 })].flagged = true;

    revealZeros(stage, { x: 0, y: 0 });

    expect(stage.cells.some((c) => c.revealed)).toBe(false);
  });

  it('moves the goal to the opposite corner when start and goal collide', () => {
    // rng() === 0 picks the horizontal layout with x = 0 for both start and goal,
    // and a one-row board makes their y coordinates equal as well.
    const stage = createRandomStage(
      { width: 5, height: 1, bombCount: 0, stageNo: 1, depthTarget: 1 },
      () => 0
    );

    expect(stage.start).toEqual({ x: 0, y: 0 });
    expect(stage.goal).toEqual({ x: 4, y: 0 });
  });

  it('keeps the goal in place when start and goal differ', () => {
    const stage = createRandomStage(
      { width: 5, height: 5, bombCount: 0, stageNo: 1, depthTarget: 1 },
      () => 0
    );

    expect(stage.start).toEqual({ x: 0, y: 0 });
    expect(stage.goal).toEqual({ x: 0, y: 4 });
  });

  it('clones a stage deeply so edits do not leak into the original', () => {
    const stage = createTinyStage();
    const copy = cloneStage(stage);

    copy.cells[0].revealed = true;
    copy.player.x = 2;
    copy.generation.retries = 9;

    expect(stage.cells[0].revealed).toBe(false);
    expect(stage.player.x).toBe(0);
    expect(stage.generation.retries).toBe(0);
  });
});
