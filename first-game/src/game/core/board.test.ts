import { describe, expect, it } from 'vitest';
import {
  chooseRoomAnchors, cloneStage, computeHints, createRandomStage, indexOf, neighbors8, revealZeros,
  stairsMinDistance, wallCells, type RoomRole
} from './board';
import { HEADINGS, oppositeHeading } from './floorLayout';
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

  it('room A: the up-stairs on an interior cell and the door cell on the first far cell of the wall: 8x8, heading right, rng 0 is (1, 1) and (7, 0)', () => {
    const stage = createRandomStage(
      { width: 8, height: 8, bombCount: 0, stageNo: 1, depthTarget: 1 },
      () => 0
    );

    expect(stage.start).toEqual({ x: 1, y: 1 });
    expect(stage.goal).toEqual({ x: 7, y: 0 });
    expect(stage.startKind).toBe('up');
    expect(stage.goalKind).toBe('door');
    expect(stage.doorSide).toBe('E');
  });

  it('room B: the entry cell is the first cell of the opposite wall and the down-stairs the first far interior cell: (0, 0) and (5, 1)', () => {
    const stage = createRandomStage(
      { width: 8, height: 8, bombCount: 0, stageNo: 1, depthTarget: 1 },
      () => 0,
      'B'
    );

    expect(stage.start).toEqual({ x: 0, y: 0 });
    expect(stage.goal).toEqual({ x: 5, y: 1 });
    expect(stage.startKind).toBe('door');
    expect(stage.goalKind).toBe('down');
    expect(stage.doorSide).toBe('W');
  });

  it('takes the heading of the floor: room A\'s door is on that wall, room B\'s on the opposite wall', () => {
    const params = { width: 8, height: 8, bombCount: 0, stageNo: 1, depthTarget: 1 };

    expect(createRandomStage(params, () => 0, 'A', 'S').doorSide).toBe('S');
    expect(createRandomStage(params, () => 0, 'B', 'S').doorSide).toBe('N');
    expect(createRandomStage(params, () => 0, 'A', 'S').goal).toEqual({ x: 0, y: 7 });
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

describe('chooseRoomAnchors (docs/spec/rooms-and-floors.md)', () => {
  const sequence = (...values: number[]) => {
    let i = 0;
    return () => values[i++] ?? 0;
  };

  it('the cells that touch a wall are in reading order: 8x8 east wall (7, 0) .. (7, 7), south wall (0, 7) .. (7, 7)', () => {
    expect(wallCells(8, 8, 'E')).toEqual(Array.from({ length: 8 }, (_, y) => ({ x: 7, y })));
    expect(wallCells(8, 8, 'W')[3]).toEqual({ x: 0, y: 3 });
    expect(wallCells(8, 8, 'S')).toEqual(Array.from({ length: 8 }, (_, x) => ({ x, y: 7 })));
    expect(wallCells(8, 8, 'N')[5]).toEqual({ x: 5, y: 0 });
  });

  it('a corner cell touches two walls and has 3 neighbours, the others of a wall have 5', () => {
    const board = { width: 8, height: 8 };
    const east = wallCells(8, 8, 'E');

    expect(east.filter((cell) => neighbors8(board, cell).length === 3)).toEqual([{ x: 7, y: 0 }, { x: 7, y: 7 }]);
    expect(east.filter((cell) => neighbors8(board, cell).length === 5)).toHaveLength(6);
  });

  it('the minimum distance is ceil((shorter side - 3) * 0.9): 8 -> 5, 10 -> 7, 12 -> 9, 27 -> 22', () => {
    expect(stairsMinDistance(8, 8)).toBe(5);
    expect(stairsMinDistance(10, 10)).toBe(7);
    expect(stairsMinDistance(12, 12)).toBe(9);
    expect(stairsMinDistance(27, 40)).toBe(22);
    expect(stairsMinDistance(3, 3)).toBe(1);
  });

  it('room A, 8x8, heading right, start (1, 1): all 8 cells of the east wall are 6 away; first (7, 0), last (7, 7)', () => {
    expect(chooseRoomAnchors(8, 8, 'A', 'E', sequence(0, 0, 0)).goal).toEqual({ x: 7, y: 0 });
    expect(chooseRoomAnchors(8, 8, 'A', 'E', sequence(0, 0, 0.999)).goal).toEqual({ x: 7, y: 7 });
  });

  it('room A, 8x8, heading right, start (6, 6): only (7, 0) (6 away) and (7, 1) (5 away) are far enough', () => {
    // 0.84 * 6 = 5.04 -> interior index 5 -> coordinate 6 on both axes
    expect(chooseRoomAnchors(8, 8, 'A', 'E', sequence(0.84, 0.84, 0)).goal).toEqual({ x: 7, y: 0 });
    expect(chooseRoomAnchors(8, 8, 'A', 'E', sequence(0.84, 0.84, 0.99)).goal).toEqual({ x: 7, y: 1 });
  });

  it('room A, 5x5 (minimum 2), heading down, start (1, 1): the south wall (0, 4) .. (4, 4) is 3 away, first (0, 4)', () => {
    expect(chooseRoomAnchors(5, 5, 'A', 'S', () => 0)).toEqual({ start: { x: 1, y: 1 }, goal: { x: 0, y: 4 } });
  });

  it('room A, 20x9 (minimum 6), heading up, start (1, 1): a cell exactly at the minimum distance qualifies, (7, 0)', () => {
    expect(stairsMinDistance(20, 9)).toBe(6);
    expect(chooseRoomAnchors(20, 9, 'A', 'N', () => 0)).toEqual({ start: { x: 1, y: 1 }, goal: { x: 7, y: 0 } });
  });

  it('room A with no far cell (ratio 2, start (6, 1), heading right): the farthest wall cell, (7, 7) at 6, not the first', () => {
    // 0.84 * 6 = 5.04 -> x = 6; 0 -> y = 1
    expect(chooseRoomAnchors(8, 8, 'A', 'E', sequence(0.84, 0), 2)).toEqual({ start: { x: 6, y: 1 }, goal: { x: 7, y: 7 } });
  });

  it('room B, 8x8, heading right: the entry cell is on the west wall; with (0, 0) the down-stairs candidates are 20 cells, first (5, 1), last (6, 6)', () => {
    expect(chooseRoomAnchors(8, 8, 'B', 'E', sequence(0, 0))).toEqual({ start: { x: 0, y: 0 }, goal: { x: 5, y: 1 } });
    expect(chooseRoomAnchors(8, 8, 'B', 'E', sequence(0, 0.999)).goal).toEqual({ x: 6, y: 6 });
  });

  it('room B, heading down: the entry cell is on the north wall', () => {
    // 0.5 * 8 = 4 -> the 5th cell of the north wall, (4, 0)
    expect(chooseRoomAnchors(8, 8, 'B', 'S', sequence(0.5, 0)).start).toEqual({ x: 4, y: 0 });
  });

  it('room B with no far cell: the farthest interior corner, ties to the top then the left (ratio 2, entry (0, 0) -> (6, 1))', () => {
    // corner distances from (0, 0): (1, 1) 1, (6, 1) 6, (1, 6) 6, (6, 6) 6
    expect(chooseRoomAnchors(8, 8, 'B', 'E', sequence(0), 2).goal).toEqual({ x: 6, y: 1 });
  });

  it('keeps the anchors on the right cells and apart, for squares and rectangles, on many seeds, for every heading', () => {
    const sizes: Array<[number, number]> = [[8, 8], [9, 9], [12, 12], [17, 17], [8, 14], [20, 9]];
    const roles: RoomRole[] = ['A', 'B'];
    let anchors = 0;
    let far = 0;
    for (const role of roles) {
      for (const heading of HEADINGS) {
        for (const [width, height] of sizes) {
          const minDistance = stairsMinDistance(width, height);
          for (let seed = 1; seed <= 40; seed += 1) {
            const { start, goal } = chooseRoomAnchors(width, height, role, heading, createRng(seed));
            const interior = (p: { x: number; y: number }) => p.x >= 1 && p.y >= 1 && p.x <= width - 2 && p.y <= height - 2;
            const doorCell = role === 'A' ? goal : start;
            const stairs = role === 'A' ? start : goal;
            const wall = role === 'A' ? heading : oppositeHeading(heading);
            if (!interior(stairs)) {
              expect.fail(`stairs ${JSON.stringify(stairs)} not interior in ${width}x${height} (${role}, ${heading}, seed ${seed})`);
            }
            if (!wallCells(width, height, wall).some((c) => c.x === doorCell.x && c.y === doorCell.y)) {
              expect.fail(`door cell ${JSON.stringify(doorCell)} not on the ${wall} wall of ${width}x${height} (${role}, seed ${seed})`);
            }
            const distance = Math.max(Math.abs(goal.x - start.x), Math.abs(goal.y - start.y));
            const pool = role === 'A'
              ? wallCells(width, height, heading)
              : [{ x: 1, y: 1 }, { x: width - 2, y: 1 }, { x: 1, y: height - 2 }, { x: width - 2, y: height - 2 }];
            const farthest = Math.max(...pool.map((c) => Math.max(Math.abs(c.x - start.x), Math.abs(c.y - start.y))));
            if (distance < Math.min(minDistance, farthest)) {
              expect.fail(`distance ${distance} on ${width}x${height} (${role}, ${heading}, seed ${seed}), wanted >= ${Math.min(minDistance, farthest)}`);
            }
            anchors += 1;
            if (distance >= minDistance) {
              far += 1;
            }
          }
        }
      }
    }
    expect(anchors).toBe(2 * 4 * 6 * 40);
    expect(far).toBeGreaterThan(0);
  });

  it('is reproducible: the same seed gives the same anchors', () => {
    expect(chooseRoomAnchors(12, 12, 'A', 'S', createRng(7))).toEqual(chooseRoomAnchors(12, 12, 'A', 'S', createRng(7)));
    expect(chooseRoomAnchors(12, 12, 'B', 'W', createRng(7))).toEqual(chooseRoomAnchors(12, 12, 'B', 'W', createRng(7)));
  });

  it('puts no bomb on the anchors or their neighbours in either room, on many seeds', () => {
    for (const role of ['A', 'B'] as const) {
      for (let seed = 1; seed <= 60; seed += 1) {
        const stage = createRandomStage(
          { width: 9, height: 9, bombCount: 20, stageNo: 2, depthTarget: 1 },
          createRng(seed),
          role,
          HEADINGS[seed % 4]
        );
        for (const p of [stage.start, stage.goal]) {
          for (const cell of [p, ...neighbors8(stage, p)]) {
            if (stage.cells[indexOf(stage, cell)].hasBomb) {
              expect.fail(`bomb next to ${JSON.stringify(p)} (${role}, seed ${seed})`);
            }
          }
        }
      }
    }
  });
});
