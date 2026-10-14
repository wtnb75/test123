import { describe, expect, it } from 'vitest';
import { chooseRoomAnchors, cloneStage, computeHints, createRandomStage, indexOf, neighbors8 } from './board';
import { cellStateOf, sameBoardShape } from './cellAppearance';
import { oppositeHeading } from './floorLayout';
import { createRng } from './random';
import { movePlayer } from './rules';
import type { Stage } from './types';
import { roomDoors, roomWalls, roomWallsFor } from './walls';

// docs/spec/rooms-and-floors.md: room A has two doors (A1 on the `h1` wall, A2 on the `h2` wall); rooms B and C one.
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0;
};

describe('chooseRoomAnchors with a second door (room A)', () => {
  it('8x8, start (1, 1), doors on the right and the bottom walls, rng 0: door A1 (7, 0) and door A2 (0, 7)', () => {
    const anchors = chooseRoomAnchors(8, 8, 'A', 'E', sequence(0, 0, 0, 0), 0.9, { heading2: 'S' });

    expect(anchors).toEqual({ start: { x: 1, y: 1 }, goal: { x: 7, y: 0 }, goal2: { x: 0, y: 7 } });
  });

  it('door A2 is never the cell of door A1: with A1 at the corner (7, 7) the last candidate of the bottom wall is (6, 7)', () => {
    const anchors = chooseRoomAnchors(8, 8, 'A', 'E', sequence(0, 0, 0.999, 0.999), 0.9, { heading2: 'S' });

    expect(anchors.goal).toEqual({ x: 7, y: 7 });
    expect(anchors.goal2).toEqual({ x: 6, y: 7 });
  });

  it('with no wall cell far enough (ratio 2) door A2 is the farthest cell of its wall except the cell of door A1', () => {
    // top wall (0, 0)..(7, 0) from (1, 1): (7, 0) is farthest (6) but it is door A1's cell; next is (6, 0) at 5
    const anchors = chooseRoomAnchors(8, 8, 'A', 'E', sequence(0, 0), 2, { heading2: 'N' });

    expect(anchors.goal).toEqual({ x: 7, y: 0 });
    expect(anchors.goal2).toEqual({ x: 6, y: 0 });
  });

  it('a dead-end room B has only its door cell: the start is drawn, no goal is drawn and goal equals start', () => {
    let draws = 0;
    const rng = () => {
      draws += 1;
      return 0;
    };

    const anchors = chooseRoomAnchors(8, 8, 'B', 'E', rng, 0.9, { withDown: false });

    expect(anchors).toEqual({ start: { x: 0, y: 0 }, goal: { x: 0, y: 0 } });
    expect(draws).toBe(1);
  });
});

describe('createRandomStage with two doors / a dead end', () => {
  const params = { width: 9, height: 9, bombCount: 20, stageNo: 2, depthTarget: 1 };

  it('room A lists door A1 then door A2 with their walls; goal is door A1', () => {
    const stage = createRandomStage(params, () => 0, 'A', 'E', { heading2: 'S' });

    expect(stage.doors).toEqual([
      { cell: { x: 8, y: 0 }, side: 'E' },
      { cell: { x: 0, y: 8 }, side: 'S' }
    ]);
    expect(stage.goal).toEqual({ x: 8, y: 0 });
    expect(stage.doorSide).toBe('E');
  });

  it('room C (a room B made with heading h2) has its door in the wall opposite h2', () => {
    const stage = createRandomStage(params, () => 0, 'B', 'S', { withDown: false });

    expect(stage.doors).toEqual([{ cell: { x: 0, y: 0 }, side: oppositeHeading('S') }]);
    expect(stage.goalKind).toBe('none');
    expect(stage.startKind).toBe('door');
  });

  it('puts no bomb on the start, on either door cell or around them, on many seeds', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const stage = createRandomStage(params, createRng(seed), 'A', 'E', { heading2: 'N' });
      for (const p of [stage.start, ...stage.doors!.map((door) => door.cell)]) {
        for (const cell of [p, ...neighbors8(stage, p)]) {
          if (stage.cells[indexOf(stage, cell)].hasBomb) {
            expect.fail(`bomb next to ${JSON.stringify(p)} (seed ${seed})`);
          }
        }
      }
    }
  });

  it('cloneStage copies the doors: changing the copy leaves the original', () => {
    const stage = createRandomStage(params, () => 0, 'A', 'E', { heading2: 'S' });
    const copy = cloneStage(stage);

    copy.doors![1].cell.x = 5;

    expect(stage.doors![1].cell.x).toBe(0);
    expect(copy.doors).not.toBe(stage.doors);
  });
});

describe('going out through one of two doors', () => {
  const roomA = (over: Partial<Stage> = {}): Stage => ({
    width: 5,
    height: 5,
    stageNo: 1,
    player: { x: 4, y: 2 },
    start: { x: 1, y: 1 },
    goal: { x: 4, y: 2 },
    startKind: 'up',
    goalKind: 'door',
    doorSide: 'E',
    doors: [
      { cell: { x: 4, y: 2 }, side: 'E' },
      { cell: { x: 2, y: 4 }, side: 'S' }
    ],
    generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
    cells: Array.from({ length: 25 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 })),
    ...over
  });

  it('door A1: from (4, 2) one cell to the right is door index 0', () => {
    const stage = roomA();
    computeHints(stage);

    const out = movePlayer(stage, { x: 5, y: 2 });

    expect(out.result).toEqual({ status: 'door', doorIndex: 0 });
    expect(out.stage).toBe(stage);
  });

  it('door A2: from (2, 4) one cell down is door index 1', () => {
    const stage = roomA({ player: { x: 2, y: 4 } });
    computeHints(stage);

    expect(movePlayer(stage, { x: 2, y: 5 }).result).toEqual({ status: 'door', doorIndex: 1 });
  });

  it('is the wall when leaving a door cell in the direction of the other door\'s wall (no door there)', () => {
    const a1 = roomA();
    computeHints(a1);
    const a2 = roomA({ player: { x: 2, y: 4 } });
    computeHints(a2);

    expect(movePlayer(a1, { x: 4, y: 5 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(a2, { x: 5, y: 4 }).result.message).toBe('out-of-bounds');
  });

  it('is the wall from a cell next to the door cell, even to the cell right of the door (a diagonal step out)', () => {
    const above = roomA({ player: { x: 4, y: 1 } });
    const below = roomA({ player: { x: 4, y: 3 } });
    computeHints(above);
    computeHints(below);

    expect(movePlayer(above, { x: 5, y: 2 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(below, { x: 5, y: 2 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(above, { x: 5, y: 2 }).result.status).toBe('alive');
  });

  it('a dead-end room: stepping on its placeholder goal (= its start cell) is a plain move, not the goal', () => {
    const stage: Stage = {
      ...roomA(),
      player: { x: 2, y: 1 },
      start: { x: 1, y: 1 },
      goal: { x: 1, y: 1 },
      startKind: 'door',
      goalKind: 'none',
      doorSide: 'W',
      doors: [{ cell: { x: 1, y: 1 }, side: 'W' }]
    };
    stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;
    computeHints(stage);

    expect(movePlayer(stage, { x: 1, y: 1 }).result.status).toBe('alive');
  });
});

describe('walls for two doors', () => {
  it('doors in the east and the north walls: both bars are cut and the two marks come in order', () => {
    const walls = roomWallsFor(4, 3, 30, [
      { cell: { x: 3, y: 1 }, side: 'E' },
      { cell: { x: 2, y: 0 }, side: 'N' }
    ]);

    expect(walls.bars).toContainEqual({ x: -2, y: -2, width: 62, height: 2 });
    expect(walls.bars).toContainEqual({ x: 90, y: -2, width: 30, height: 2 });
    expect(walls.bars).toContainEqual({ x: 118, y: 0, width: 2, height: 30 });
    expect(walls.bars).toContainEqual({ x: 118, y: 60, width: 2, height: 30 });
    expect(walls.doors.map((door) => door.center)).toEqual([{ x: 119, y: 45 }, { x: 75, y: -1 }]);
  });

  it('two doors in the same wall (north, cells 0 and 3): a corner piece, the middle bar, and no zero-size bar', () => {
    const walls = roomWallsFor(4, 3, 30, [
      { cell: { x: 3, y: 0 }, side: 'N' },
      { cell: { x: 0, y: 0 }, side: 'N' }
    ]);
    const top = walls.bars.filter((bar) => bar.y === -2);

    expect(top).toEqual([
      { x: -2, y: -2, width: 2, height: 2 },
      { x: 30, y: -2, width: 60, height: 2 }
    ]);
    expect(walls.bars.every((bar) => bar.width > 0 && bar.height > 0)).toBe(true);
  });

  it('without doors four full bars are drawn; the one-door helper agrees with the general one', () => {
    expect(roomWallsFor(4, 3, 30, []).doors).toEqual([]);
    expect(roomWallsFor(4, 3, 30, []).bars).toHaveLength(4);
    const one = roomWalls(4, 3, 30, 'E', { x: 3, y: 1 });
    const general = roomWallsFor(4, 3, 30, [{ cell: { x: 3, y: 1 }, side: 'E' }]);

    expect(one.bars).toEqual(general.bars);
    expect(one.door).toEqual(general.doors[0].center);
    expect(one.posts).toEqual(general.doors[0].posts);
  });

  it('roomDoors: the list when there is one, the one door the kinds describe otherwise, nothing without a door', () => {
    const base = { goal: { x: 4, y: 2 }, start: { x: 1, y: 1 } };
    const doors = [{ cell: { x: 4, y: 2 }, side: 'E' as const }, { cell: { x: 2, y: 4 }, side: 'S' as const }];

    expect(roomDoors({ ...base, goalKind: 'door', doorSide: 'E', doors })).toBe(doors);
    expect(roomDoors({ ...base, goalKind: 'door', doorSide: 'E' })).toEqual([{ cell: { x: 4, y: 2 }, side: 'E' }]);
    expect(roomDoors({ ...base, startKind: 'door', goalKind: 'down', doorSide: 'W' })).toEqual([{ cell: { x: 1, y: 1 }, side: 'W' }]);
    expect(roomDoors({ ...base })).toEqual([]);
  });
});

describe('looks of a room with two doors / a dead end', () => {
  const stage = (over: Partial<Stage>): Stage => ({
    width: 4,
    height: 3,
    stageNo: 1,
    player: { x: 1, y: 1 },
    start: { x: 1, y: 1 },
    goal: { x: 3, y: 2 },
    generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
    cells: Array.from({ length: 12 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 })),
    ...over
  });

  it('a dead-end room has no stairs on any cell (the placeholder goal is its start cell)', () => {
    const dead = stage({ startKind: 'door', goalKind: 'none', goal: { x: 1, y: 1 } });

    for (let idx = 0; idx < 12; idx += 1) {
      expect(cellStateOf(dead, idx).stairs).toBe('none');
    }
  });

  it('a goal of the kind none that is not the start cell has no stairs either', () => {
    expect(cellStateOf(stage({ startKind: 'up', goalKind: 'none' }), 11).stairs).toBe('none');
  });

  it('the board is another one when the second door differs (walls are drawn again), the same when it is equal', () => {
    const doors = [{ cell: { x: 3, y: 2 }, side: 'E' as const }, { cell: { x: 0, y: 2 }, side: 'S' as const }];
    const a = { width: 4, height: 3, start: { x: 1, y: 1 }, goal: { x: 3, y: 2 }, goalKind: 'door' as const, doors };

    expect(sameBoardShape(a, { ...a, doors: doors.map((door) => ({ ...door, cell: { ...door.cell } })) })).toBe(true);
    expect(sameBoardShape(a, { ...a, doors: [doors[0], { cell: { x: 1, y: 2 }, side: 'S' as const }] })).toBe(false);
    expect(sameBoardShape(a, { ...a, doors: [doors[0]] })).toBe(false);
    expect(sameBoardShape(a, { ...a, doors: undefined })).toBe(false);
  });
});
