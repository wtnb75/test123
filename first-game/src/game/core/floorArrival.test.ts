import { describe, expect, it } from 'vitest';
import { computeHints, indexOf } from './board';
import { FloorState, arriveAtDoor } from './floor';
import type { Stage, StageDoor } from './types';

// docs/spec/rooms-and-floors.md "扉のマスに出たとき": a room is closed until the player arrives on one of its doors.
const room = (doors: StageDoor[], bomb = { x: 4, y: 4 }): Stage => {
  const width = 5;
  const height = 5;
  const stage: Stage = {
    width,
    height,
    stageNo: 1,
    cells: Array.from({ length: width * height }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 })),
    player: { ...doors[0].cell },
    start: { ...doors[0].cell },
    goal: { x: 2, y: 2 },
    startKind: 'door',
    goalKind: 'none',
    doors,
    generation: { retries: 0, depthTarget: 1, solverDepth: 1, generationMs: 0 }
  };
  stage.cells[indexOf(stage, bomb)].hasBomb = true;
  computeHints(stage);
  return stage;
};

const entry: StageDoor = { cell: { x: 0, y: 0 }, side: 'W' };
const loopDoor: StageDoor = { cell: { x: 0, y: 3 }, side: 'W' };
const at = (stage: Stage, x: number, y: number) => stage.cells[indexOf(stage, { x, y })];

describe('arriveAtDoor', () => {
  it('stands the player on the door cell, opens it and its zero cascade, and leaves the bomb and the room it was', () => {
    const closed = room([entry, loopDoor]);
    const next = arriveAtDoor(closed, 1);

    expect(next.player).toEqual({ x: 0, y: 3 });
    expect(at(next, 0, 3).revealed).toBe(true);
    // Zero cells open, and the numbers around the bomb are the edge of the opened area.
    expect(at(next, 0, 0).revealed).toBe(true);
    expect(at(next, 2, 2).revealed).toBe(true);
    expect(at(next, 3, 3).revealed).toBe(true);
    expect(at(next, 3, 3).hint).toBe(1);
    expect(at(next, 4, 4).revealed).toBe(false);
    // The room it was is not changed.
    expect(closed.cells.some((cell) => cell.revealed)).toBe(false);
    expect(closed.player).toEqual({ x: 0, y: 0 });
  });

  it('takes a flag off the door cell: the cell is safe, so it opens', () => {
    const closed = room([entry, loopDoor]);
    at(closed, 0, 3).flagged = true;
    const next = arriveAtDoor(closed, 1);

    expect(at(next, 0, 3).flagged).toBe(false);
    expect(at(next, 0, 3).revealed).toBe(true);
  });

  it('leaves the player\'s flags on the cells around the door as they are (the cascade stops at a flag)', () => {
    const closed = room([entry, loopDoor]);
    at(closed, 1, 3).flagged = true;
    const next = arriveAtDoor(closed, 1);

    expect(at(next, 1, 3).flagged).toBe(true);
    expect(at(next, 1, 3).revealed).toBe(false);
    expect(at(next, 0, 3).revealed).toBe(true);
  });

  it('does not open the room\'s other door cell when the cascade does not reach it (a bomb beside the entry)', () => {
    const closed = room([entry, loopDoor], { x: 1, y: 1 });
    const next = arriveAtDoor(closed, 1);

    expect(at(next, 0, 3).revealed).toBe(true);
    expect(at(next, 0, 0).revealed).toBe(false);
  });

  it('returns the very same room when the player already stands on the open door cell', () => {
    const opened = arriveAtDoor(room([entry, loopDoor]), 1);

    expect(arriveAtDoor(opened, 1)).toBe(opened);
  });

  it('moves the player to another open door cell without changing the cells (coming back by a different door)', () => {
    const opened = arriveAtDoor(room([entry, loopDoor]), 1);
    const next = arriveAtDoor(opened, 0);

    expect(next.player).toEqual({ x: 0, y: 0 });
    expect(next.cells).toEqual(opened.cells);
  });

  it('returns the room as it is for a door the room does not have', () => {
    const closed = room([entry]);

    expect(arriveAtDoor(closed, 3)).toBe(closed);
  });
});

describe('FloorState.cross arrives on the door at the other end of the corridor', () => {
  // Room 0 door 0 ends in room 1's door 1 (a loop door), not in its entry (door 0).
  const graph = { startRoom: 0, corridors: [{ from: { room: 0, door: 0 }, to: { room: 1, door: 1 } }] };

  it('opens the arrival door, puts the player on it and keeps the room in the floor', () => {
    const state = new FloorState([room([entry]), room([entry, loopDoor])], graph);
    const arrived = state.cross(0);

    expect(state.roomIndex).toBe(1);
    expect(arrived.player).toEqual({ x: 0, y: 3 });
    expect(at(arrived, 0, 3).revealed).toBe(true);
    expect(state.current).toBe(arrived);
    // The entry of that room was not the way in: it is open only because the cascade reached it.
    expect(at(arrived, 0, 0).revealed).toBe(true);
  });

  it('reports which door of the room the walk ends at', () => {
    const state = new FloorState([room([entry]), room([entry, loopDoor])], graph);

    expect(state.route(0)).toEqual({ corridor: 0, forward: true, to: 1, toDoor: 1 });
  });
});
