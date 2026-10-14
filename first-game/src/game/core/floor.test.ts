import { describe, expect, it } from 'vitest';
import { FloorState } from './floor';
import type { Stage } from './types';

const room = (stageNo: number, revealedCount: number): Stage => ({
  width: 2,
  height: 2,
  stageNo,
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 1, y: 1 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 4 }, (_, i) => ({ hasBomb: false, flagged: false, revealed: i < revealedCount, hint: 0 }))
});

describe('FloorState', () => {
  it('starts in room A, and crossing goes to room B and back', () => {
    const a = room(1, 1);
    const b = room(1, 2);
    const floor = new FloorState([a, b]);

    expect(floor.roomIndex).toBe(0);
    expect(floor.current).toBe(a);
    expect(floor.otherIndex).toBe(1);
    expect(floor.cross()).toBe(b);
    expect(floor.roomIndex).toBe(1);
    expect(floor.otherIndex).toBe(0);
    expect(floor.cross()).toBe(a);
  });

  it('keeps what was committed to a room (opened cells, flags) when the player comes back', () => {
    const floor = new FloorState([room(1, 1), room(1, 1)]);
    const played = room(1, 3);
    played.cells[3].flagged = true;

    floor.commit(played);
    floor.cross();
    floor.cross();

    expect(floor.current).toBe(played);
    expect(floor.current.cells.filter((c) => c.revealed)).toHaveLength(3);
    expect(floor.current.cells[3].flagged).toBe(true);
  });

  it('commits to the room the player is in, not to the other one', () => {
    const a = room(1, 1);
    const b = room(1, 1);
    const floor = new FloorState([a, b]);
    floor.cross();
    const played = room(1, 4);

    floor.commit(played);

    expect(floor.current).toBe(played);
    floor.cross();
    expect(floor.current).toBe(a);
  });
});
