import { describe, expect, it } from 'vitest';
import { roomExits } from './exits';
import type { Stage } from './types';

// docs/spec/rooms-and-floors.md "画面外の出口の矢印". Rooms are 8 x 8 of 30 px cells at (20, 80); a cell centre is
// 20 + 30 x + 15, 80 + 30 y + 15.
const room = (over: Partial<Stage>): Stage => ({
  width: 8,
  height: 8,
  stageNo: 1,
  player: { x: 1, y: 1 },
  start: { x: 1, y: 1 },
  goal: { x: 7, y: 0 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: [],
  ...over
});
const origin = { x: 20, y: 80 };

describe('roomExits', () => {
  it('room A: one DOOR per door, in the order of the doors (A1 then A2)', () => {
    const a = room({
      startKind: 'up',
      goalKind: 'door',
      doorSide: 'E',
      doors: [{ cell: { x: 7, y: 0 }, side: 'E' }, { cell: { x: 0, y: 7 }, side: 'S' }]
    });

    expect(roomExits(a, 0, origin, 30)).toEqual([
      { x: 20 + 7 * 30 + 15, y: 80 + 15, label: 'DOOR' },
      { x: 20 + 15, y: 80 + 7 * 30 + 15, label: 'DOOR' }
    ]);
  });

  it('a room with the down-stairs points at them with GOAL, not at its door', () => {
    const b = room({ startKind: 'door', goalKind: 'down', start: { x: 0, y: 3 }, goal: { x: 5, y: 2 } });

    expect(roomExits(b, 1, origin, 30)).toEqual([{ x: 20 + 5 * 30 + 15, y: 80 + 2 * 30 + 15, label: 'GOAL' }]);
  });

  it('a dead end points back at its door (its start cell) with DOOR', () => {
    const c = room({ startKind: 'door', goalKind: 'none', start: { x: 0, y: 3 }, goal: { x: 0, y: 3 } });

    expect(roomExits(c, 2, origin, 30)).toEqual([{ x: 20 + 15, y: 80 + 3 * 30 + 15, label: 'DOOR' }]);
  });

  it('uses the cell size and the origin it is given (a room drawn small)', () => {
    const b = room({ startKind: 'door', goalKind: 'down', goal: { x: 5, y: 2 } });

    expect(roomExits(b, 1, { x: 0, y: 0 }, 10)).toEqual([{ x: 55, y: 25, label: 'GOAL' }]);
  });
});

describe('roomExits with loop doors', () => {
  const doors = [
    { cell: { x: 0, y: 3 }, side: 'W' as const },
    { cell: { x: 7, y: 5 }, side: 'E' as const },
    { cell: { x: 4, y: 7 }, side: 'S' as const }
  ];
  const centre = (x: number, y: number) => ({ x: 20 + x * 30 + 15, y: 80 + y * 30 + 15 });

  it('a dead end with a loop door points at both of its doors with DOOR (the entry, then the loop door)', () => {
    const dead = room({ startKind: 'door', goalKind: 'none', start: doors[0].cell, goal: doors[0].cell, doors: doors.slice(0, 2) });

    expect(roomExits(dead, 3, origin, 30)).toEqual([
      { ...centre(0, 3), label: 'DOOR' },
      { ...centre(7, 5), label: 'DOOR' }
    ]);
  });

  it('a branching room points at its entry, exits and loop door: every door, in the order of the doors', () => {
    const branching = room({ startKind: 'door', goalKind: 'door', start: doors[0].cell, goal: doors[1].cell, doors });

    expect(roomExits(branching, 1, origin, 30).map((e) => [e.label, e.x, e.y])).toEqual(
      doors.map((d) => ['DOOR', centre(d.cell.x, d.cell.y).x, centre(d.cell.x, d.cell.y).y])
    );
  });

  it('the down-stairs room points at the stairs only, loop door or not', () => {
    const down = room({ startKind: 'door', goalKind: 'down', start: doors[0].cell, goal: { x: 5, y: 2 }, doors: doors.slice(0, 2) });

    expect(roomExits(down, 2, origin, 30)).toEqual([{ ...centre(5, 2), label: 'GOAL' }]);
  });
});
