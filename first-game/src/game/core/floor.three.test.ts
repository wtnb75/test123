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

// docs/spec/rooms-and-floors.md: room A has door A1 (to room B, corridor 1) and door A2 (to room C, corridor 2);
// rooms B and C have one door, back to room A through the same corridor.
describe('FloorState (three rooms)', () => {
  it('starts in room A; door A1 leads to room B and back, door A2 to room C and back', () => {
    const [a, b, c] = [room(1, 1), room(1, 2), room(1, 3)];
    const floor = new FloorState([a, b, c]);

    expect(floor.roomIndex).toBe(0);
    expect(floor.current).toBe(a);
    expect(floor.cross(0)).toBe(b);
    expect(floor.roomIndex).toBe(1);
    expect(floor.cross()).toBe(a);
    expect(floor.cross(1)).toBe(c);
    expect(floor.roomIndex).toBe(2);
    expect(floor.cross()).toBe(a);
  });

  it('names the corridor, the direction and the end of each walk', () => {
    const floor = new FloorState([room(1, 1), room(1, 1), room(1, 1)]);

    expect(floor.route(0)).toEqual({ corridor: 0, forward: true, to: 1 });
    expect(floor.route(1)).toEqual({ corridor: 1, forward: true, to: 2 });
    floor.cross(0);
    expect(floor.route()).toEqual({ corridor: 0, forward: false, to: 0 });
    floor.cross();
    floor.cross(1);
    expect(floor.route()).toEqual({ corridor: 1, forward: false, to: 0 });
  });

  it('keeps what was committed to a room (opened cells, flags) when the player comes back, in each room', () => {
    const floor = new FloorState([room(1, 1), room(1, 1), room(1, 1)]);
    const playedA = room(1, 3);
    playedA.cells[3].flagged = true;
    const playedC = room(1, 4);

    floor.commit(playedA);
    floor.cross(1);
    floor.commit(playedC);
    floor.cross();

    expect(floor.current).toBe(playedA);
    expect(floor.current.cells[3].flagged).toBe(true);
    floor.cross(1);
    expect(floor.current).toBe(playedC);
  });

  it('commits to the room the player is in, not to another one', () => {
    const [a, b, c] = [room(1, 1), room(1, 1), room(1, 1)];
    const floor = new FloorState([a, b, c]);
    floor.cross(0);
    const played = room(1, 4);

    floor.commit(played);

    expect(floor.current).toBe(played);
    floor.cross();
    expect(floor.current).toBe(a);
    floor.cross(1);
    expect(floor.current).toBe(c);
  });
});
