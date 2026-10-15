import { describe, expect, it } from 'vitest';
import { indexOf, neighbors8, stairsMinDistance } from './board';
import { CORRIDOR_LENGTH } from './corridor';
import { HEADING_VECTOR, oppositeHeading, placementFitsApart } from './floorLayout';
import { buildFloorTree, entryHeadingOf } from './floorTree';
import { MAX_CORRIDOR_EXTENSION, floorHeadings, generateFloor, generateStage, type Floor } from './generator';
import { createRng } from './random';
import { analyzeSolvability } from './solver';
import type { Heading, Position, Stage } from './types';

// A large time budget: tests must not depend on the speed of the machine (the spec's 1500 ms is a runtime guard).
// These tests are about the tree of rooms: no loops (`maxLoops: 0`; the loops are in generator.loops.test.ts).
const makeFloor = (stageNo: number, seed: number) =>
  generateFloor(stageNo, { seed, maxGenerationMs: 600_000, maxLoops: 0 });
// For geometry only (large rooms): no solving effort, whatever the first attempts give.
const quickFloor = (stageNo: number, seed: number, extra: object = {}) =>
  generateFloor(stageNo, { seed, maxRetries: 1, maxGenerationMs: 600_000, maxLoops: 0, ...extra });

const touchesWall = (stage: Stage, p: Position, side: Heading) =>
  (side === 'E' && p.x === stage.width - 1) ||
  (side === 'W' && p.x === 0) ||
  (side === 'S' && p.y === stage.height - 1) ||
  (side === 'N' && p.y === 0);

const fitsApart = (floor: Floor): boolean =>
  placementFitsApart(
    floor.layout,
    floor.rooms.map((room) => ({ width: room.width, height: room.height })),
    floor.graph
  );

describe('floorHeadings (docs/spec/rooms-and-floors.md "フロアの生成")', () => {
  it('gives two different headings, every ordered pair of the 12', () => {
    const pairs = new Set<string>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const { headings } = floorHeadings(seed, 1);
      expect(headings[0]).not.toBe(headings[1]);
      pairs.add(headings.join(''));
    }
    expect(pairs.size).toBe(12);
  });
});

describe('generateFloor, a tree of rooms', () => {
  it('makes RoomCount rooms of the size of stage n: room A with two doors, the others an entry and their exits', () => {
    const floor = makeFloor(3, 5);

    expect(floor.stageNo).toBe(3);
    expect(floor.rooms).toHaveLength(5);
    // The room with the down-stairs is one cell bigger (docs/spec/rooms-and-floors.md "▼ の部屋の難しさ"): 11 instead of 10.
    expect(floor.rooms.map((room) => [room.width, room.height, room.stageNo])).toEqual(
      floor.rooms.map((_, i) => (i === floor.downRoom ? [11, 11, 3] : [10, 10, 3]))
    );
    expect([floor.rooms[0].startKind, floor.rooms[0].goalKind]).toEqual(['up', 'door']);
    expect(floor.rooms[0].doors).toHaveLength(2);
    floor.rooms.slice(1).forEach((room, i) => {
      const children = floor.tree.children[i + 1].length;
      expect(room.startKind).toBe('door');
      expect(room.doors).toHaveLength(1 + children);
    });
    expect(floor.layout.corridors).toHaveLength(4);
    expect(floor.graph.corridors).toHaveLength(4);
  });

  it('puts the down-stairs in exactly one leaf (downRoom); the other leaves are dead ends with no stairs', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const floor = quickFloor(1, seed);
      const leaves = floor.rooms.map((_, k) => k).filter((k) => k > 0 && floor.tree.children[k].length === 0);

      expect(leaves).toContain(floor.downRoom);
      for (const k of leaves) {
        expect(floor.rooms[k].goalKind).toBe(k === floor.downRoom ? 'down' : 'none');
        if (k !== floor.downRoom) {
          expect(floor.rooms[k].goal).toEqual(floor.rooms[k].start);
        }
      }
      for (const k of floor.rooms.keys()) {
        if (k === 0 || floor.tree.children[k].length > 0) {
          expect(floor.rooms[k].goalKind).toBe('door');
        }
      }
      seen.add(floor.downRoom);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('builds trees where room A has two children and every other room has at most two', () => {
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const tree = buildFloorTree(createRng(seed), 5);

      expect(tree.children[0]).toEqual([1, 2]);
      tree.children.forEach((children, room) => {
        expect(children.length).toBeLessThanOrEqual(2);
        children.forEach((child) => expect(tree.parent[child]).toBe(room));
      });
      for (let k = 1; k < 5; k += 1) {
        expect(tree.parent[k]).toBeLessThan(k);
      }
      shapes.add(tree.parent.join(','));
    }
    // 0,0,1,1 / 0,0,1,2 / 0,0,2,2 / 0,0,1,3 / 0,0,2,3 / 0,0,1,4 ... more than one shape comes up.
    expect(shapes.size).toBeGreaterThan(2);
  });

  it('puts the doors in the drawn walls: A1 and A2 differ; an entry is opposite its parent\'s exit; exits avoid the entry wall', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const floor = quickFloor(1, seed);
      const { tree, rooms } = floor;
      const [h1, h2] = tree.exitHeadings[0];

      expect(h1).not.toBe(h2);
      expect(rooms[0].doors!.map((door) => door.side)).toEqual([h1, h2]);
      expect(rooms[0].doors![0].cell).not.toEqual(rooms[0].doors![1].cell);
      for (let k = 1; k < rooms.length; k += 1) {
        const entry = entryHeadingOf(tree, k) as Heading;
        const doors = rooms[k].doors!;

        expect(doors[0].side).toBe(entry);
        expect(touchesWall(rooms[k], rooms[k].start, entry)).toBe(true);
        expect(doors[0].cell).toEqual(rooms[k].start);
        expect(doors.slice(1).map((door) => door.side)).toEqual(tree.exitHeadings[k]);
        expect(new Set(doors.map((door) => door.side)).size).toBe(doors.length);
        expect(new Set(doors.map((door) => `${door.cell.x},${door.cell.y}`)).size).toBe(doors.length);
        for (const door of doors) {
          expect(touchesWall(rooms[k], door.cell, door.side)).toBe(true);
        }
      }
    }
  });

  it('keeps every anchor and its neighbours free of bombs in all rooms (stages 1, 2, 5 and 10)', () => {
    for (const stageNo of [1, 2, 5, 10]) {
      for (let seed = 1; seed <= 3; seed += 1) {
        for (const room of makeFloor(stageNo, seed).rooms) {
          const anchors = [room.start, ...(room.doors ?? []).map((door) => door.cell)];
          if (room.goalKind === 'down') {
            anchors.push(room.goal);
          }
          for (const p of anchors) {
            for (const cell of [p, ...neighbors8(room, p)]) {
              expect(room.cells[indexOf(room, cell)].hasBomb).toBe(false);
            }
          }
        }
      }
    }
  });

  it('makes each room solvable from its own start (stages 1, 2 and 5)', () => {
    for (const stageNo of [1, 2, 5]) {
      for (let seed = 1; seed <= 6; seed += 1) {
        for (const room of makeFloor(stageNo, seed).rooms) {
          expect(analyzeSolvability(room).solvable).toBe(true);
        }
      }
    }
  });

  it('opens the start (and its zero cascade) of room A only; every other room is closed until the player arrives', () => {
    const rooms = makeFloor(1, 9).rooms;

    expect(rooms[0].cells[indexOf(rooms[0], rooms[0].start)].revealed).toBe(true);
    for (const room of rooms.slice(1)) {
      expect(room.cells.some((cell) => cell.revealed)).toBe(false);
      expect(room.player).toEqual(room.start);
    }
  });

  it('keeps the rooms and corridors apart (docs "配置の条件"), also for big rooms (stage 20 and 30)', () => {
    for (const stageNo of [1, 5, 20, 30]) {
      for (let seed = 1; seed <= 25; seed += 1) {
        if (!fitsApart(quickFloor(stageNo, seed))) {
          expect.fail(`floor stage ${stageNo} seed ${seed} does not fit apart`);
        }
      }
    }
  });

  it('puts each room at the end of its corridor: the entry cell is right after the last cell, in the exit\'s heading', () => {
    for (const stageNo of [1, 30]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { rooms, layout, graph } = quickFloor(stageNo, seed);
        graph.corridors.forEach((link, j) => {
          const cells = layout.corridors[j];
          const parentDoor = rooms[link.from.room].doors![link.from.door];
          const parentOrigin = layout.roomOrigin[link.from.room];
          const exit = { x: parentOrigin.x + parentDoor.cell.x, y: parentOrigin.y + parentDoor.cell.y };
          const d = HEADING_VECTOR[parentDoor.side];
          const childOrigin = layout.roomOrigin[link.to.room];
          const entry = rooms[link.to.room].doors![link.to.door].cell;
          const last = cells[cells.length - 1];

          expect(cells[0]).toEqual({ x: exit.x + d.x, y: exit.y + d.y });
          expect({ x: childOrigin.x + entry.x, y: childOrigin.y + entry.y }).toEqual({ x: last.x + d.x, y: last.y + d.y });
        });
      }
    }
  });

  it('lengthens corridors only as far as needed: every length is CorridorLength + its extension, at most the cap', () => {
    let lengthened = 0;
    for (const stageNo of [20, 30]) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const floor = quickFloor(stageNo, seed);
        floor.layout.corridors.forEach((cells, j) => {
          expect(cells).toHaveLength(CORRIDOR_LENGTH + floor.extensions[j]);
          expect(floor.extensions[j]).toBeLessThanOrEqual(MAX_CORRIDOR_EXTENSION);
          lengthened += floor.extensions[j] > 0 ? 1 : 0;
        });
      }
    }
    expect(lengthened).toBeGreaterThan(0);
  });

  it('does not lengthen when the cap is 0: corridors keep the base length, and more floors need a rebuild', () => {
    let capped = 0;
    let free = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const without = quickFloor(30, seed, { maxExtension: 0 });
      without.layout.corridors.forEach((cells) => expect(cells).toHaveLength(CORRIDOR_LENGTH));
      capped += without.rebuilds + without.rerolls;
      const withCap = quickFloor(30, seed);
      free += withCap.rebuilds + withCap.rerolls;
    }
    expect(capped).toBeGreaterThan(free);
  });

  it('makes a parent and child again with the exit on another wall when no length fits (stage 30, cap 0)', () => {
    let rebuiltFloors = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const floor = quickFloor(30, seed, { maxExtension: 0 });
      if (floor.rebuilds === 0 || floor.rerolls > 0) {
        continue;
      }
      rebuiltFloors += 1;
      const fresh = buildFloorTree(createRng(seed + 30 * 9973 + 3), 5);

      expect(fresh.exitHeadings.flat().join()).not.toBe(floor.tree.exitHeadings.flat().join());
      expect(fitsApart(floor)).toBe(true);
    }
    expect(rebuiltFloors).toBeGreaterThan(0);
  });

  it('keeps every room\'s entry wall off its own exit walls after rebuilds (stage 30, cap 0, many rebuilds)', () => {
    let rebuiltWithChildren = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const floor = quickFloor(30, seed, { maxExtension: 0, layoutRebuilds: 8 });
      if (floor.rebuilds === 0) {
        continue;
      }
      floor.rooms.forEach((room, k) => {
        const sides = room.doors!.map((door) => door.side);
        expect(new Set(sides).size).toBe(sides.length);
        if (k > 0 && floor.tree.children[k].length > 0) {
          rebuiltWithChildren += 1;
        }
      });
    }
    expect(rebuiltWithChildren).toBeGreaterThan(0);
  });

  it('keeps the drawn tree and walls when the floor fits at once (no rebuild, no reroll)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const floor = quickFloor(1, seed);
      if (floor.rebuilds === 0 && floor.rerolls === 0) {
        const fresh = buildFloorTree(createRng(seed + 9973 + 3), 5);
        expect(floor.tree).toEqual(fresh);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('keeps door A1, A2, each exit and the down-stairs far enough from the start (or the farthest cell), stages 1, 3 and 5', () => {
    const cheb = (p: Position, q: Position) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
    for (const stageNo of [1, 3, 5]) {
      for (let seed = 1; seed <= 5; seed += 1) {
        const floor = makeFloor(stageNo, seed);
        const [a] = floor.rooms;
        const min = stairsMinDistance(a.width, a.height);

        for (const door of a.doors!) {
          expect(cheb(a.start, door.cell)).toBeGreaterThanOrEqual(Math.min(min, 3));
        }
        for (const room of floor.rooms.slice(1)) {
          for (const door of room.doors!.slice(1)) {
            expect(cheb(room.start, door.cell)).toBeGreaterThanOrEqual(Math.min(min, 3));
          }
        }
        const down = floor.rooms[floor.downRoom];
        expect(cheb(down.start, down.goal)).toBeGreaterThanOrEqual(Math.min(min, 3));
        expect(a.start.x > 0 && a.start.y > 0 && a.start.x < a.width - 1 && a.start.y < a.height - 1).toBe(true);
        expect(down.goal.x > 0 && down.goal.y > 0 && down.goal.x < down.width - 1 && down.goal.y < down.height - 1).toBe(true);
      }
    }
  });

  it('works for other RoomCount values: 4 and 6 rooms with matching corridors', () => {
    for (const roomCount of [4, 6]) {
      const floor = quickFloor(1, 7, { roomCount });

      expect(floor.rooms).toHaveLength(roomCount);
      expect(floor.layout.corridors).toHaveLength(roomCount - 1);
      expect(floor.graph.corridors).toHaveLength(roomCount - 1);
      expect(floor.tree.roomCount).toBe(roomCount);
      expect(fitsApart(floor)).toBe(true);
    }
  });

  it('is reproducible: the same seed and stage give the same tree, rooms, corridors and extensions', () => {
    const first = makeFloor(4, 21);
    const second = makeFloor(4, 21);
    const shape = (s: Stage) => ({ start: s.start, goal: s.goal, doors: s.doors, bombs: s.cells.map((c) => c.hasBomb) });

    expect(first.rooms.map(shape)).toEqual(second.rooms.map(shape));
    expect(first.layout).toEqual(second.layout);
    expect(first.tree).toEqual(second.tree);
    expect(first.extensions).toEqual(second.extensions);
    expect(first.downRoom).toBe(second.downRoom);
  });

  it('makes the rooms different rooms for one seed (their own anchors and bombs)', () => {
    const rooms = makeFloor(4, 21).rooms;
    const bombs = (s: Stage) => s.cells.map((cell) => cell.hasBomb).join();

    expect(new Set(rooms.map(bombs)).size).toBe(rooms.length);
  });

  it('the Title demo room is the floor\'s room A: same seed and stage give the same room, doors and bombs', () => {
    let compared = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const floor = makeFloor(2, seed);
      const drawn = floorHeadings(seed, 2).headings;
      if (floor.rerolls > 0 || floor.tree.exitHeadings[0].some((side, i) => side !== drawn[i])) {
        continue;
      }
      const demo = generateStage(2, { seed, maxGenerationMs: 600_000 });
      const [a] = floor.rooms;

      expect(demo.doors).toEqual(a.doors);
      expect([demo.start, demo.goal]).toEqual([a.start, a.goal]);
      expect(demo.cells.map((c) => c.hasBomb)).toEqual(a.cells.map((c) => c.hasBomb));
      compared += 1;
    }
    expect(compared).toBeGreaterThan(5);
  });

  it('makes a room A with two doors by default (the Title demo: its goal is door A1)', () => {
    const room = generateStage(2, { seed: 3 });
    const { headings } = floorHeadings(3, 2);

    expect(room.startKind).toBe('up');
    expect(room.goalKind).toBe('door');
    expect(room.doors!.map((door) => door.side)).toEqual(headings);
    expect(room.goal).toEqual(room.doors![0].cell);
  });

  it('keeps the opposite walls of a corridor\'s two doors (the entry faces the exit)', () => {
    const { rooms, graph } = quickFloor(5, 11);

    graph.corridors.forEach((link) => {
      const from = rooms[link.from.room].doors![link.from.door];
      const to = rooms[link.to.room].doors![link.to.door];
      expect(to.side).toBe(oppositeHeading(from.side));
    });
  });
});
