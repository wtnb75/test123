import { describe, expect, it } from 'vitest';
import {
  chooseStartGoal, cloneStage, computeHints, createRandomStage, indexOf, neighbors8, revealZeros, stairsMinDistance
} from './board';
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

  it('puts the start and the goal on interior cells: 8x8 with rng 0 is (1, 1) and the first of the 11 far cells, (6, 1)', () => {
    const stage = createRandomStage(
      { width: 8, height: 8, bombCount: 0, stageNo: 1, depthTarget: 1 },
      () => 0
    );

    expect(stage.start).toEqual({ x: 1, y: 1 });
    expect(stage.goal).toEqual({ x: 6, y: 1 });
  });

  it('takes the first far cell in reading order when several qualify (5x5, start (1, 1), distance >= 2)', () => {
    const stage = createRandomStage(
      { width: 5, height: 5, bombCount: 0, stageNo: 1, depthTarget: 1 },
      () => 0
    );

    expect(stage.start).toEqual({ x: 1, y: 1 });
    expect(stage.goal).toEqual({ x: 3, y: 1 });
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

describe('chooseStartGoal (docs/spec.md: start and goal are interior cells)', () => {
  it('the farthest interior corner is used when no cell is far enough; ties go to the top, then the left', () => {
    // 8x8, interior 1..6, minimum distance 5. rng 0.4 -> index 2 -> start (3, 3): every corner is 2..3 away.
    const values = [0.4, 0.4];
    let i = 0;
    const picked = chooseStartGoal(8, 8, () => values[i++] ?? 0);

    expect(picked.start).toEqual({ x: 3, y: 3 });
    // distances: (1,1) = 2, (6,1) = 3, (1,6) = 3, (6,6) = 3 -> the first of the farthest, (6, 1)
    expect(picked.goal).toEqual({ x: 6, y: 1 });
  });

  it('the minimum distance is ceil((shorter side - 3) * 0.9): 8 -> 5, 10 -> 7, 12 -> 9, 27 -> 22', () => {
    expect(stairsMinDistance(8, 8)).toBe(5);
    expect(stairsMinDistance(10, 10)).toBe(7);
    expect(stairsMinDistance(12, 12)).toBe(9);
    expect(stairsMinDistance(27, 40)).toBe(22);
    expect(stairsMinDistance(3, 3)).toBe(1);
  });

  it('keeps both cells at least one cell inside and apart, for squares and rectangles, on many seeds', () => {
    const sizes: Array<[number, number]> = [[8, 8], [9, 9], [12, 12], [17, 17], [8, 14], [20, 9]];
    for (const [width, height] of sizes) {
      const minDistance = stairsMinDistance(width, height);
      for (let seed = 1; seed <= 150; seed += 1) {
        const { start, goal } = chooseStartGoal(width, height, createRng(seed));
        if (start.x < 1 || start.y < 1 || start.x > width - 2 || start.y > height - 2) {
          expect.fail(`start ${JSON.stringify(start)} on the edge of ${width}x${height} (seed ${seed})`);
        }
        if (goal.x < 1 || goal.y < 1 || goal.x > width - 2 || goal.y > height - 2) {
          expect.fail(`goal ${JSON.stringify(goal)} on the edge of ${width}x${height} (seed ${seed})`);
        }
        const distance = Math.max(Math.abs(goal.x - start.x), Math.abs(goal.y - start.y));
        const corners = [
          { x: 1, y: 1 }, { x: width - 2, y: 1 }, { x: 1, y: height - 2 }, { x: width - 2, y: height - 2 }
        ];
        const farthest = Math.max(...corners.map((c) => Math.max(Math.abs(c.x - start.x), Math.abs(c.y - start.y))));
        if (distance < Math.min(minDistance, farthest)) {
          expect.fail(`goal ${distance} from start on ${width}x${height} (seed ${seed}), wanted >= ${Math.min(minDistance, farthest)}`);
        }
        if (distance < 3) {
          expect.fail(`goal too close (${distance}) on ${width}x${height} (seed ${seed})`);
        }
      }
    }
  });

  it('a cell exactly at the minimum distance qualifies: 20x9 (minimum 6) with rng 0 is start (1, 1), goal (7, 1)', () => {
    const picked = chooseStartGoal(20, 9, () => 0);
    expect(stairsMinDistance(20, 9)).toBe(6);
    expect(picked).toEqual({ start: { x: 1, y: 1 }, goal: { x: 7, y: 1 } });
  });

  it('is reproducible: the same seed gives the same start and goal', () => {
    expect(chooseStartGoal(12, 12, createRng(7))).toEqual(chooseStartGoal(12, 12, createRng(7)));
  });

  it('puts no bomb on the start, the goal or their neighbours, on many seeds', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const stage = createRandomStage(
        { width: 9, height: 9, bombCount: 20, stageNo: 2, depthTarget: 1 },
        createRng(seed)
      );
      for (const p of [stage.start, stage.goal]) {
        for (const cell of [p, ...neighbors8(stage, p)]) {
          if (stage.cells[indexOf(stage, cell)].hasBomb) {
            expect.fail(`bomb next to ${JSON.stringify(p)} (seed ${seed})`);
          }
        }
      }
    }
  });
});
