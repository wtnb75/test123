import { describe, expect, it } from 'vitest';
import { indexOf, neighbors8 } from './board';
import { HEADING_VECTOR, oppositeHeading, placementFitsApart } from './floorLayout';
import { corridorFrom } from './floorGraph';
import { LOOP_COUNT_MAX, LOOP_DOOR_MIN_DISTANCE, LOOP_MAX_LENGTH, LOOP_MIN_LENGTH, enterableDoors } from './floorLoops';
import { generateFloor, type Floor } from './generator';
import { analyzeSolvability } from './solver';
import type { Position, Stage } from './types';

// docs/spec/rooms-and-floors.md "輪": loops, the rooms they make again, and what they must not move.
const makeFloor = (stageNo: number, seed: number, maxLoops?: number): Floor =>
  generateFloor(stageNo, { seed, maxGenerationMs: 600_000, ...(maxLoops === undefined ? {} : { maxLoops }) });

const STAGES = [1, 5, 10];
const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const floors = STAGES.flatMap((stageNo) =>
  SEEDS.map((seed) => ({ stageNo, seed, floor: makeFloor(stageNo, seed), plain: makeFloor(stageNo, seed, 0) }))
);
const withLoops = floors.filter(({ floor }) => floor.loops.length > 0);

const bombsOf = (room: Stage): number[] => room.cells.flatMap((cell, i) => (cell.hasBomb ? [i] : []));
const cheb = (a: Position, b: Position) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const touchesWall = (room: Stage, p: Position, side: string) =>
  (side === 'E' && p.x === room.width - 1) ||
  (side === 'W' && p.x === 0) ||
  (side === 'S' && p.y === room.height - 1) ||
  (side === 'N' && p.y === 0);

describe('generateFloor with loops', () => {
  it('produces loops: some floors have none, some one, some two (never more than LoopCountMax)', () => {
    const counts = floors.map(({ floor }) => floor.loops.length);

    expect(counts.filter((n) => n === 0).length).toBeGreaterThan(5);
    expect(counts.filter((n) => n === 1).length).toBeGreaterThan(5);
    expect(counts.filter((n) => n === 2).length).toBeGreaterThan(0);
    expect(Math.max(...counts)).toBeLessThanOrEqual(LOOP_COUNT_MAX);
  });

  it('adds one corridor per loop after the tree\'s, in the layout and in the graph, with both doors at the end of the lists', () => {
    for (const { floor, plain } of withLoops) {
      const treeEdges = floor.tree.parent.length - 1;

      expect(floor.layout.corridors).toHaveLength(treeEdges + floor.loops.length);
      expect(floor.graph.corridors).toHaveLength(treeEdges + floor.loops.length);
      expect(floor.layout.corridors.slice(0, treeEdges)).toEqual(plain.layout.corridors);
      floor.loops.forEach((loop, n) => {
        const link = floor.graph.corridors[treeEdges + n];

        expect(link.from.room).toBe(loop.from);
        expect(link.to.room).toBe(loop.to);
        expect(floor.rooms[loop.from].doors![link.from.door]).toEqual(loop.fromDoor);
        expect(floor.rooms[loop.to].doors![link.to.door]).toEqual(loop.toDoor);
        expect(floor.layout.corridors[treeEdges + n]).toEqual(loop.cells);
      });
    }
  });

  it('lays each loop as a straight corridor of 3..26 cells between two doors that face each other, on the floor grid', () => {
    for (const { floor } of withLoops) {
      for (const loop of floor.loops) {
        const d = HEADING_VECTOR[loop.heading];
        const fromOrigin = floor.layout.roomOrigin[loop.from];
        const toOrigin = floor.layout.roomOrigin[loop.to];

        expect(loop.cells.length).toBe(loop.length);
        expect(loop.length).toBeGreaterThanOrEqual(LOOP_MIN_LENGTH);
        expect(loop.length).toBeLessThanOrEqual(LOOP_MAX_LENGTH);
        loop.cells.forEach((cell, i) => {
          expect(cell).toEqual({
            x: fromOrigin.x + loop.fromDoor.cell.x + d.x * (1 + i),
            y: fromOrigin.y + loop.fromDoor.cell.y + d.y * (1 + i)
          });
        });
        const last = loop.cells[loop.cells.length - 1];
        expect({ x: last.x + d.x, y: last.y + d.y }).toEqual({
          x: toOrigin.x + loop.toDoor.cell.x,
          y: toOrigin.y + loop.toDoor.cell.y
        });
        expect(loop.fromDoor.side).toBe(loop.heading);
        expect(loop.toDoor.side).toBe(oppositeHeading(loop.heading));
        expect(touchesWall(floor.rooms[loop.from], loop.fromDoor.cell, loop.fromDoor.side)).toBe(true);
        expect(touchesWall(floor.rooms[loop.to], loop.toDoor.cell, loop.toDoor.side)).toBe(true);
      }
    }
  });

  it('keeps every room and corridor (loops included) apart', () => {
    for (const { floor } of floors) {
      expect(
        placementFitsApart(floor.layout, floor.rooms.map((r) => ({ width: r.width, height: r.height })), floor.graph)
      ).toBe(true);
    }
  });

  it('never joins room A, a parent and its child, or the same pair twice, and keeps a loop door 2 from earlier doors', () => {
    expect(LOOP_DOOR_MIN_DISTANCE).toBe(2);
    for (const { floor } of withLoops) {
      const pairs = new Set<string>();
      for (const loop of floor.loops) {
        expect(loop.from).toBeGreaterThan(0);
        expect(loop.to).toBeGreaterThan(loop.from);
        expect(floor.tree.parent[loop.to]).not.toBe(loop.from);
        expect(floor.tree.parent[loop.from]).not.toBe(loop.to);
        pairs.add(`${loop.from}-${loop.to}`);
      }
      expect(pairs.size).toBe(floor.loops.length);
      expect(floor.rooms[0].doors).toHaveLength(2);
      for (const room of floor.rooms) {
        const doors = room.doors!;
        doors.forEach((a, i) => {
          doors.slice(i + 1).forEach((b) => {
            expect(cheb(a.cell, b.cell)).toBeGreaterThanOrEqual(1);
          });
        });
      }
      floor.loops.forEach((_, n) => {
        const link = floor.graph.corridors[floor.tree.parent.length - 1 + n];
        for (const end of [link.from, link.to]) {
          const doors = floor.rooms[end.room].doors!;
          doors.forEach((other, i) => {
            // A loop door added later may sit nearer to an earlier loop door only if it was placed before it: the
            // rule holds against every door that was already there when it was placed (a lower index).
            if (i < end.door) {
              expect(cheb(other.cell, doors[end.door].cell)).toBeGreaterThanOrEqual(LOOP_DOOR_MIN_DISTANCE);
            }
          });
        }
      });
    }
  });

  it('keeps every door cell of every room, and its neighbours, free of bombs (loop doors included)', () => {
    for (const { floor } of floors) {
      for (const room of floor.rooms) {
        for (const door of room.doors!) {
          expect(room.cells[indexOf(room, door.cell)].hasBomb).toBe(false);
          for (const n of neighbors8(room, door.cell)) {
            expect(room.cells[indexOf(room, n)].hasBomb).toBe(false);
          }
        }
      }
    }
  });

  it('makes every room solvable from each door the player may enter it through', () => {
    let checked = 0;
    for (const { floor } of withLoops) {
      floor.rooms.forEach((room, index) => {
        for (const door of enterableDoors(floor.graph, index)) {
          expect(analyzeSolvability({ ...room, start: room.doors![door].cell }).solvable).toBe(true);
          checked += door === 0 ? 0 : 1;
        }
      });
    }
    // Doors other than the entry were checked (the guard against a run that proves nothing).
    expect(checked).toBeGreaterThan(20);
  });

  it('leaves the tree, the tree corridors and room A as they are without loops (a loop adds, it does not move)', () => {
    for (const { floor, plain } of floors) {
      expect(floor.tree).toEqual(plain.tree);
      expect(floor.extensions).toEqual(plain.extensions);
      expect(floor.layout.roomOrigin).toEqual(plain.layout.roomOrigin);
      expect(floor.rooms[0].doors).toEqual(plain.rooms[0].doors);
      expect(bombsOf(floor.rooms[0])).toEqual(bombsOf(plain.rooms[0]));
      expect(floor.rooms[0].cells.map((c) => c.revealed)).toEqual(plain.rooms[0].cells.map((c) => c.revealed));
    }
  });

  it('keeps start, doors and down-stairs of every room; only the bombs of a room with a loop door or two ways in change', () => {
    let unchanged = 0;
    let remade = 0;
    for (const { floor, plain } of withLoops) {
      floor.rooms.forEach((room, index) => {
        const was = plain.rooms[index];

        expect(room.start).toEqual(was.start);
        expect(room.goal).toEqual(was.goal);
        expect(room.doors!.slice(0, was.doors!.length)).toEqual(was.doors);
        const remadeRoom = index > 0 && (room.doors!.length > was.doors!.length || enterableDoors(floor.graph, index).length >= 2);
        if (remadeRoom) {
          remade += 1;
        } else {
          expect(bombsOf(room)).toEqual(bombsOf(was));
          unchanged += 1;
        }
      });
    }
    expect(remade).toBeGreaterThan(10);
    expect(unchanged).toBeGreaterThan(10);
  });

  it('makes a remade room different from the plain one in at least some floors (the loop door\'s zone is bomb-free)', () => {
    const differs = withLoops.some(({ floor, plain }) =>
      floor.rooms.some((room, index) => index > 0 && bombsOf(room).join() !== bombsOf(plain.rooms[index]).join())
    );

    expect(differs).toBe(true);
  });

  it('never puts a door cell on the down-stairs (the stairs are an inside cell, a door cell touches the wall)', () => {
    for (const { floor } of floors) {
      const down = floor.rooms[floor.downRoom];

      for (const door of down.doors!) {
        expect(door.cell).not.toEqual(down.goal);
      }
    }
  });

  it('leaves every room other than A closed, with the player on its entry cell', () => {
    for (const { floor } of floors) {
      // Room A opens from its up-stairs as always.
      expect(floor.rooms[0].cells.some((cell) => cell.revealed)).toBe(true);
      for (const room of floor.rooms.slice(1)) {
        expect(room.cells.some((cell) => cell.revealed || cell.flagged)).toBe(false);
        expect(room.player).toEqual(room.start);
      }
    }
  });

  it('is reproducible: the same seed and stage give the same tree, loops, doors, bombs and layout', () => {
    const { stageNo, seed, floor: first } = withLoops[0];
    const again = makeFloor(stageNo, seed);

    expect(first.loops.length).toBeGreaterThan(0);
    expect(again.tree).toEqual(first.tree);
    expect(again.extensions).toEqual(first.extensions);
    expect(again.graph).toEqual(first.graph);
    expect(again.loops).toEqual(first.loops);
    expect(again.rooms.map(bombsOf)).toEqual(first.rooms.map(bombsOf));
    expect(again.layout).toEqual(first.layout);
  });

  it('walks a loop back: from the far room\'s loop door the corridor runs last cell to first and ends at the near door', () => {
    for (const { floor } of withLoops) {
      floor.loops.forEach((loop, n) => {
        const at = floor.tree.parent.length - 1 + n;
        const link = floor.graph.corridors[at];

        expect(corridorFrom(floor.graph, link.from)).toEqual({ corridor: at, forward: true, to: link.to });
        expect(corridorFrom(floor.graph, link.to)).toEqual({ corridor: at, forward: false, to: link.from });
        expect(loop.to).toBe(link.to.room);
      });
    }
  });
});
