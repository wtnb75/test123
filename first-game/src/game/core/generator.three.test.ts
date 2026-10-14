import { describe, expect, it } from 'vitest';
import { indexOf, neighbors8, stairsMinDistance } from './board';
import { CORRIDOR_LENGTH } from './corridor';
import { HEADING_VECTOR, floorFitsApart, oppositeHeading } from './floorLayout';
import { floorHeadings, generateFloor, generateStage } from './generator';
import { analyzeSolvability } from './solver';
import type { Heading, Position, Stage } from './types';

// A large time budget: tests must not depend on the speed of the machine (the spec's 1500 ms is a runtime guard).
const makeFloor = (stageNo: number, seed: number) => generateFloor(stageNo, { seed, maxGenerationMs: 600_000 });
// For geometry only (large rooms): no solving effort, whatever the first attempts give.
const quickFloor = (stageNo: number, seed: number) => generateFloor(stageNo, { seed, maxRetries: 1, maxGenerationMs: 600_000 });

const touchesWall = (stage: Stage, p: Position, side: Heading) =>
  (side === 'E' && p.x === stage.width - 1) ||
  (side === 'W' && p.x === 0) ||
  (side === 'S' && p.y === stage.height - 1) ||
  (side === 'N' && p.y === 0);

describe('floorHeadings (docs/spec/rooms-and-floors.md "フロアの生成")', () => {
  it('gives two different headings, every ordered pair of the 12 and both rooms for the down-stairs', () => {
    const pairs = new Set<string>();
    const downIn = new Set<boolean>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const { headings, downInB } = floorHeadings(seed, 1);
      expect(headings[0]).not.toBe(headings[1]);
      pairs.add(headings.join(''));
      downIn.add(downInB);
    }
    expect(pairs.size).toBe(12);
    expect([...downIn].sort()).toEqual([false, true]);
  });
});

describe('generateFloor, three rooms', () => {
  it('makes room A (up-stairs, two doors) and rooms B and C (a door each) of the size of stage n', () => {
    const floor = makeFloor(3, 5);
    const [a, b, c] = floor.rooms;

    expect(floor.stageNo).toBe(3);
    expect([a, b, c].map((room) => [room.width, room.height, room.stageNo])).toEqual([[10, 10, 3], [10, 10, 3], [10, 10, 3]]);
    expect([a.startKind, a.goalKind]).toEqual(['up', 'door']);
    expect(a.doors).toHaveLength(2);
    expect([b.startKind, c.startKind]).toEqual(['door', 'door']);
    expect(b.doors).toHaveLength(1);
    expect(c.doors).toHaveLength(1);
    expect(floor.layout.corridors.map((corridor) => corridor.length)).toEqual([CORRIDOR_LENGTH, CORRIDOR_LENGTH]);
  });

  it('puts the down-stairs in exactly one of rooms B and C (downRoom); the other is a dead end with no stairs', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 30; seed += 1) {
      const floor = makeFloor(1, seed);
      const down = floor.rooms[floor.downRoom];
      const dead = floor.rooms[floor.downRoom === 1 ? 2 : 1];

      expect(floor.downRoom).toBe(floorHeadings(seed, 1).downInB ? 1 : 2);
      expect(down.goalKind).toBe('down');
      expect(dead.goalKind).toBe('none');
      expect(dead.goal).toEqual(dead.start);
      expect(floor.rooms[0].goalKind).toBe('door');
      seen.add(floor.downRoom);
    }
    expect([...seen].sort()).toEqual([1, 2]);
  });

  it('puts door A1 and door A2 in different walls and different cells; the doors of B and C are in the walls opposite', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const floor = makeFloor(1, seed);
      const [a, b, c] = floor.rooms;
      const [h1, h2] = floor.layout.headings;
      const doors = a.doors!;

      expect(h1).not.toBe(h2);
      expect(doors.map((door) => door.side)).toEqual([h1, h2]);
      expect(doors[0].cell).toEqual(a.goal);
      expect(doors[0].cell).not.toEqual(doors[1].cell);
      expect(touchesWall(a, doors[0].cell, h1)).toBe(true);
      expect(touchesWall(a, doors[1].cell, h2)).toBe(true);
      expect(b.doors![0].side).toBe(oppositeHeading(h1));
      expect(c.doors![0].side).toBe(oppositeHeading(h2));
      expect(touchesWall(b, b.start, oppositeHeading(h1))).toBe(true);
      expect(touchesWall(c, c.start, oppositeHeading(h2))).toBe(true);
    }
  });

  it('keeps every anchor and its neighbours free of bombs in all three rooms (stages 1, 2, 5 and 10)', () => {
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

  it('opens the start of all three rooms (so entering a room shows its first cells)', () => {
    for (const room of makeFloor(1, 9).rooms) {
      expect(room.cells[indexOf(room, room.start)].revealed).toBe(true);
    }
  });

  it('keeps the rooms and corridors apart (docs "配置の条件"), also for big rooms (stage 20 and 30)', () => {
    for (const stageNo of [1, 5, 20, 30]) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const floor = quickFloor(stageNo, seed);
        const [a] = floor.rooms;
        if (!floorFitsApart(floor.layout, a.width, a.height)) {
          expect.fail(`floor stage ${stageNo} seed ${seed} does not fit apart`);
        }
      }
    }
  });

  // Stage 30, geometry only (one attempt per room): these seeds do not fit apart within the redraws (measured by
  // running generateFloor), the others do.
  const REBUILT_SEEDS = [3, 17, 18, 39, 43, 48];

  it('makes rooms A and C again with door A2 opposite door A1 when the corridors cannot be drawn apart', () => {
    for (const seed of REBUILT_SEEDS) {
      const floor = quickFloor(30, seed);
      const drawn = floorHeadings(seed, 30).headings;
      const [h1, h2] = floor.layout.headings;
      const [a, , c] = floor.rooms;

      expect(drawn[1]).not.toBe(oppositeHeading(drawn[0]));
      expect(h1).toBe(drawn[0]);
      expect(h2).toBe(oppositeHeading(h1));
      expect(a.doors![1].side).toBe(h2);
      expect(c.doors![0].side).toBe(oppositeHeading(h2));
      expect(floorFitsApart(floor.layout, a.width, a.height)).toBe(true);
    }
  });

  it('big rooms whose drawn doors are already in opposite walls fit apart without being made again (stage 30)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60 && checked < 4; seed += 1) {
      const drawn = floorHeadings(seed, 30).headings;
      if (drawn[1] !== oppositeHeading(drawn[0])) {
        continue;
      }
      const floor = quickFloor(30, seed);

      expect(floor.layout.headings).toEqual(drawn);
      expect(floorFitsApart(floor.layout, floor.rooms[0].width, floor.rooms[0].height)).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(4);
  });

  it('leaves the drawn headings alone when the floor fits apart (the seeds that need no rebuild)', () => {
    for (const seed of [1, 2, 4, 5, 6, 7]) {
      expect(quickFloor(30, seed).layout.headings).toEqual(floorHeadings(seed, 30).headings);
    }
  });

  it('puts each room at the end of its corridor: the entry cell is right after the corridor\'s last cell, in its heading', () => {
    const seeds = [...REBUILT_SEEDS.slice(0, 3), 1, 2, 4, 5];
    for (const stageNo of [1, 30]) {
      for (const seed of seeds) {
        const { rooms, layout } = quickFloor(stageNo, seed);
        for (const k of [0, 1]) {
          const d = HEADING_VECTOR[layout.headings[k]];
          const last = layout.corridors[k][CORRIDOR_LENGTH - 1];
          const origin = layout.roomOrigin[k + 1];
          const entry = { x: origin.x + rooms[k + 1].start.x, y: origin.y + rooms[k + 1].start.y };
          const doorCell = rooms[0].doors![k].cell;
          const exit = { x: layout.roomOrigin[0].x + doorCell.x, y: layout.roomOrigin[0].y + doorCell.y };
          const dk = HEADING_VECTOR[layout.headings[k]];

          expect(entry).toEqual({ x: last.x + d.x, y: last.y + d.y });
          expect(layout.corridors[k][0]).toEqual({ x: exit.x + dk.x, y: exit.y + dk.y });
        }
      }
    }
  });

  it('keeps door A1, door A2 and the down-stairs far enough from the start (or the farthest cell), stages 1, 3 and 5', () => {
    const cheb = (p: Position, q: Position) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
    for (const stageNo of [1, 3, 5]) {
      for (let seed = 1; seed <= 5; seed += 1) {
        const floor = makeFloor(stageNo, seed);
        const [a] = floor.rooms;
        const min = stairsMinDistance(a.width, a.height);
        const down = floor.rooms[floor.downRoom];
        const doorCells = a.doors!.map((door) => door.cell);

        for (const door of doorCells) {
          expect(cheb(a.start, door)).toBeGreaterThanOrEqual(Math.min(min, 3));
        }
        expect(cheb(down.start, down.goal)).toBeGreaterThanOrEqual(Math.min(min, 3));
        for (const room of [a, down]) {
          const stairs = room === a ? room.start : room.goal;
          expect(stairs.x > 0 && stairs.y > 0 && stairs.x < room.width - 1 && stairs.y < room.height - 1).toBe(true);
        }
      }
    }
  });

  it('draws the corridors again before making rooms again: fewer floors are made again with retries than without', () => {
    const rebuilt = (layoutRetries: number) => {
      let count = 0;
      for (let seed = 1; seed <= 60; seed += 1) {
        const floor = generateFloor(30, { seed, maxRetries: 1, maxGenerationMs: 600_000, layoutRetries });
        count += floor.layout.headings[1] === floorHeadings(seed, 30).headings[1] ? 0 : 1;
      }
      return count;
    };

    expect(rebuilt(8)).toBeLessThan(rebuilt(0));
  });

  it('is reproducible: the same seed and stage give the same headings, rooms and corridors', () => {
    const first = makeFloor(4, 21);
    const second = makeFloor(4, 21);
    const shape = (s: Stage) => ({ start: s.start, goal: s.goal, doors: s.doors, bombs: s.cells.map((c) => c.hasBomb) });

    expect(first.rooms.map(shape)).toEqual(second.rooms.map(shape));
    expect(first.layout).toEqual(second.layout);
    expect(first.downRoom).toBe(second.downRoom);
  });

  it('makes the three rooms different rooms for one seed (their own anchors and bombs)', () => {
    const [a, b, c] = makeFloor(4, 21).rooms;
    const bombs = (s: Stage) => s.cells.map((cell) => cell.hasBomb).join();

    expect(new Set([bombs(a), bombs(b), bombs(c)]).size).toBe(3);
  });

  it('the Title demo room is the floor\'s room A: same seed and stage give the same room, doors and bombs', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const [a] = makeFloor(2, seed).rooms;
      const demo = generateStage(2, { seed, maxGenerationMs: 600_000 });

      expect(demo.doors).toEqual(a.doors);
      expect([demo.start, demo.goal]).toEqual([a.start, a.goal]);
      expect(demo.cells.map((c) => c.hasBomb)).toEqual(a.cells.map((c) => c.hasBomb));
    }
  });

  it('makes a room A with two doors by default (the Title demo: its goal is door A1)', () => {
    const room = generateStage(2, { seed: 3 });
    const { headings } = floorHeadings(3, 2);

    expect(room.startKind).toBe('up');
    expect(room.goalKind).toBe('door');
    expect(room.doors!.map((door) => door.side)).toEqual(headings);
    expect(room.goal).toEqual(room.doors![0].cell);
  });
});
