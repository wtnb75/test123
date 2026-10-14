import { describe, expect, it } from 'vitest';
import { indexOf, neighbors8, stairsMinDistance } from './board';
import { CORRIDOR_LENGTH } from './corridor';
import { HEADING_VECTOR, oppositeHeading } from './floorLayout';
import { floorHeading, generateFloor, generateStage } from './generator';
import { analyzeSolvability } from './solver';
import type { Stage } from './types';

type Point = { x: number; y: number };
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const onEdge = (stage: Stage, p: Point) => p.x === 0 || p.y === 0 || p.x === stage.width - 1 || p.y === stage.height - 1;
/** The door cell touches the wall of the room's door side. */
const touchesWall = (stage: Stage, p: Point, side: 'E' | 'S' | 'W' | 'N') =>
  (side === 'E' && p.x === stage.width - 1) ||
  (side === 'W' && p.x === 0) ||
  (side === 'S' && p.y === stage.height - 1) ||
  (side === 'N' && p.y === 0);

// A large time budget: the tests must not depend on the speed of the machine (the spec's 1500 ms is a runtime guard).
const makeFloor = (stageNo: number, seed: number) => generateFloor(stageNo, { seed, maxGenerationMs: 600_000 });

describe('generateFloor (docs/spec/rooms-and-floors.md)', () => {
  it('makes room A (up-stairs, door cell) and room B (door cell, down-stairs) of the size of stage n', () => {
    const floor = makeFloor(3, 5);
    const [a, b] = floor.rooms;

    expect(floor.stageNo).toBe(3);
    expect([a.width, a.height, b.width, b.height]).toEqual([10, 10, 10, 10]);
    expect([a.stageNo, b.stageNo]).toEqual([3, 3]);
    expect([a.startKind, a.goalKind]).toEqual(['up', 'door']);
    expect([b.startKind, b.goalKind]).toEqual(['door', 'down']);
    expect(floor.layout.corridor).toHaveLength(CORRIDOR_LENGTH);
  });

  it('puts the doors in opposite walls: room A on the floor\'s heading side, room B on the other (every heading appears)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const floor = makeFloor(1, seed);
      const [a, b] = floor.rooms;
      expect(a.doorSide).toBe(floor.layout.heading);
      expect(b.doorSide).toBe(oppositeHeading(floor.layout.heading));
      expect(touchesWall(a, a.goal, a.doorSide!)).toBe(true);
      expect(touchesWall(b, b.start, b.doorSide!)).toBe(true);
      seen.add(floor.layout.heading);
    }
    expect([...seen].sort()).toEqual(['E', 'N', 'S', 'W']);
  });

  it('puts the stairs inside and each pair far enough apart (stages 1, 3 and 5)', () => {
    for (const stageNo of [1, 3, 5]) {
      for (let seed = 1; seed <= 5; seed += 1) {
        const [a, b] = makeFloor(stageNo, seed).rooms;
        const min = stairsMinDistance(a.width, a.height);
        expect(onEdge(a, a.start)).toBe(false);
        expect(onEdge(b, b.goal)).toBe(false);
        // the exact distance rule (minimum, or the farthest cell) is pinned in board.test.ts; here: never closer than 3
        expect(cheb(a.start, a.goal)).toBeGreaterThanOrEqual(Math.min(min, 3));
        expect(cheb(b.start, b.goal)).toBeGreaterThanOrEqual(Math.min(min, 3));
      }
    }
  });

  it('keeps every anchor and its neighbours free of bombs (stages 1, 2, 5 and 10)', () => {
    for (const stageNo of [1, 2, 5, 10]) {
      for (let seed = 1; seed <= 3; seed += 1) {
        for (const room of makeFloor(stageNo, seed).rooms) {
          for (const p of [room.start, room.goal]) {
            for (const cell of [p, ...neighbors8(room, p)]) {
              expect(room.cells[indexOf(room, cell)].hasBomb).toBe(false);
            }
          }
        }
      }
    }
  });

  it('makes each room solvable from its own start (room A from the up-stairs, room B from its entry cell), stages 1, 2 and 5', () => {
    for (const stageNo of [1, 2, 5]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const [a, b] = makeFloor(stageNo, seed).rooms;
        expect(analyzeSolvability(a).solvable).toBe(true);
        expect(analyzeSolvability(b).solvable).toBe(true);
      }
    }
  });

  it('opens the start of both rooms (room B too, so entering it shows its first cells)', () => {
    const [a, b] = makeFloor(1, 9).rooms;

    expect(a.cells[indexOf(a, a.start)].revealed).toBe(true);
    expect(b.cells[indexOf(b, b.start)].revealed).toBe(true);
  });

  it('puts room B where the corridor leads: its entry cell is right after the corridor\'s last cell, in the heading', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { rooms, layout } = makeFloor(2, seed);
      const d = HEADING_VECTOR[layout.heading];
      const last = layout.corridor[CORRIDOR_LENGTH - 1];
      const entry = {
        x: layout.roomOrigin[1].x + rooms[1].start.x,
        y: layout.roomOrigin[1].y + rooms[1].start.y
      };
      const exit = {
        x: layout.roomOrigin[0].x + rooms[0].goal.x,
        y: layout.roomOrigin[0].y + rooms[0].goal.y
      };

      expect(entry).toEqual({ x: last.x + d.x, y: last.y + d.y });
      expect(layout.corridor[0]).toEqual({ x: exit.x + d.x, y: exit.y + d.y });
    }
  });

  it('is reproducible: the same seed and stage give the same heading, rooms and corridor', () => {
    const first = makeFloor(4, 21);
    const second = makeFloor(4, 21);
    const shape = (s: Stage) => ({ start: s.start, goal: s.goal, side: s.doorSide, bombs: s.cells.map((c) => c.hasBomb) });

    expect(first.rooms.map(shape)).toEqual(second.rooms.map(shape));
    expect(first.layout).toEqual(second.layout);
  });

  it('makes room B a different room from room A for one seed (its own anchors and bombs)', () => {
    const [a, b] = makeFloor(4, 21).rooms;
    const bombs = (s: Stage) => s.cells.map((c) => c.hasBomb).join();

    expect(bombs(a)).not.toBe(bombs(b));
    expect(generateStage(4, { seed: 21, role: 'B' }).cells.map((c) => c.hasBomb)).not.toEqual(a.cells.map((c) => c.hasBomb));
  });

  it('the Title demo room is the floor\'s room A: the same seed and stage give the same room and the same heading', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const [a] = makeFloor(2, seed).rooms;
      const demo = generateStage(2, { seed, maxGenerationMs: 600_000 });

      expect(demo.doorSide).toBe(a.doorSide);
      expect([demo.start, demo.goal]).toEqual([a.start, a.goal]);
      expect(demo.cells.map((c) => c.hasBomb)).toEqual(a.cells.map((c) => c.hasBomb));
    }
  });

  it('makes a room A by default (the Title demo plays room A: its goal is the door cell) with the floor\'s heading', () => {
    const room = generateStage(2, { seed: 3 });

    expect(room.startKind).toBe('up');
    expect(room.goalKind).toBe('door');
    expect(room.doorSide).toBe(floorHeading(3, 2));
  });
});
