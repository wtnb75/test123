import { describe, expect, it } from 'vitest';
import { computeHints, indexOf } from './board';
import { applyDemoAction } from './demoBot';
import { moveByDelta, movePlayer } from './rules';
import type { Heading, Stage } from './types';

// docs/spec/rooms-and-floors.md "操作仕様" / "テスト観点" (扉を通る判定). Positions are (x, y). The door is a gap in
// the wall: the player goes through it by moving one cell out of the board from the cell next to it.
const makeStage = (over: Partial<Stage> = {}): Stage => ({
  width: 5,
  height: 5,
  stageNo: 1,
  player: { x: 1, y: 1 },
  start: { x: 1, y: 1 },
  goal: { x: 4, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 25 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 })),
  ...over
});

/** Room A with its door in the east wall: the up-stairs at (1, 1), the door cell (the goal) at (4, 2). */
const roomA = (over: Partial<Stage> = {}): Stage =>
  makeStage({ startKind: 'up', goalKind: 'door', doorSide: 'E', player: { x: 4, y: 2 }, ...over });

describe('going out through the door', () => {
  it("is a 'door' result from the door cell, one cell in the way of the door, and nothing in the room changes", () => {
    const stage = roomA();
    computeHints(stage);

    const out = movePlayer(stage, { x: 5, y: 2 });

    expect(out.result.status).toBe('door');
    expect(out.stage).toBe(stage);
    expect(out.stage.player).toEqual({ x: 4, y: 2 });
  });

  it.each<[Heading, { x: number; y: number }, { x: number; y: number }]>([
    ['E', { x: 4, y: 2 }, { x: 5, y: 2 }],
    ['S', { x: 2, y: 4 }, { x: 2, y: 5 }],
    ['W', { x: 0, y: 2 }, { x: -1, y: 2 }],
    ['N', { x: 2, y: 0 }, { x: 2, y: -1 }]
  ])('on the %s wall the door is left in its own direction', (side, doorCell, outside) => {
    const stage = roomA({ doorSide: side, goal: doorCell, player: doorCell });
    computeHints(stage);

    expect(movePlayer(stage, outside).result.status).toBe('door');
  });

  it("is the wall ('out-of-bounds') when leaving diagonally, or from another cell, or through a wall without the door", () => {
    const stage = roomA();
    computeHints(stage);

    expect(movePlayer(stage, { x: 5, y: 3 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(stage, { x: 5, y: 1 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(stage, { x: 4, y: 3 }).result.status).toBe('alive');

    const away = roomA({ player: { x: 4, y: 3 } });
    computeHints(away);
    expect(movePlayer(away, { x: 5, y: 3 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(away, { x: 5, y: 3 }).result.status).toBe('alive');
  });

  it("is the wall on the wall of the room that has no door (the up- and down-stairs room's other sides)", () => {
    const stage = roomA();
    computeHints(stage);

    expect(movePlayer(stage, { x: 4, y: 5 }).result.message).toBe('out-of-bounds');
    expect(movePlayer(stage, { x: 4, y: -1 }).result.message).toBe('out-of-bounds');
  });

  it("is a 'door' result from the entry cell of room B, going back out of the wall it is next to", () => {
    const stage = makeStage({ startKind: 'door', goalKind: 'down', doorSide: 'W', start: { x: 0, y: 3 }, player: { x: 0, y: 3 } });
    computeHints(stage);

    expect(movePlayer(stage, { x: -1, y: 3 }).result.status).toBe('door');
  });

  it('is not a door result on a room that has no door (a stage that says nothing about kinds)', () => {
    const stage = makeStage({ player: { x: 4, y: 2 } });
    computeHints(stage);

    expect(movePlayer(stage, { x: 5, y: 2 }).result.message).toBe('out-of-bounds');
  });
});

describe('landing on the door cell', () => {
  it('is an ordinary move in room A (the door cell is not the down-stairs), also after chain reveal', () => {
    const stage = roomA({ player: { x: 3, y: 2 } });
    computeHints(stage);

    expect(moveByDelta(stage, 1, 0).result.status).toBe('alive');
  });

  it('is an ordinary move onto room B\'s entry cell', () => {
    const stage = makeStage({ startKind: 'door', goalKind: 'down', doorSide: 'W', start: { x: 0, y: 3 }, player: { x: 1, y: 3 } });
    computeHints(stage);

    expect(moveByDelta(stage, -1, 0).result.status).toBe('alive');
  });

  it('kills when the door cell has a flag on it (a flag on a safe cell), like any safe cell', () => {
    const stage = roomA({ player: { x: 3, y: 2 } });
    stage.cells[indexOf(stage, { x: 4, y: 2 })].flagged = true;
    computeHints(stage);

    const out = moveByDelta(stage, 1, 0);

    expect(out.result.status).toBe('dead');
    expect(out.result.message).toBe('false-flag');
  });

  it("is still a 'goal' result for the down-stairs in room B, and for a stage that says nothing about kinds", () => {
    const roomB = makeStage({ startKind: 'door', goalKind: 'down', doorSide: 'W', start: { x: 0, y: 3 }, player: { x: 3, y: 2 } });
    computeHints(roomB);
    const plain = makeStage({ player: { x: 3, y: 2 } });
    computeHints(plain);

    expect(moveByDelta(roomB, 1, 0).result.status).toBe('goal');
    expect(moveByDelta(plain, 1, 0).result.status).toBe('goal');
  });
});

describe('the Title demo bot and the door cell (docs/spec/title-demo.md)', () => {
  it("ends a round on the door cell (a position, the game's own result is a plain move) and plays other moves as 'alive'", () => {
    const stage = roomA({ player: { x: 3, y: 2 } });
    computeHints(stage);

    expect(applyDemoAction(stage, { kind: 'move', pos: { x: 4, y: 2 } }).status).toBe('goal');
    expect(applyDemoAction(stage, { kind: 'move', pos: { x: 3, y: 1 } }).status).toBe('alive');
  });
});
