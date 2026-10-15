import { describe, expect, it } from 'vitest';
import floors from './__fixtures__/floors.json';
import threeRooms from './__fixtures__/floors.three-rooms.json';
import { buildFloorTree } from './floorTree';
import { floorHeadings, generateFloor, type Floor } from './generator';
import { createRng } from './random';
import type { Position } from './types';

/**
 * Regression for docs/spec/rooms-and-floors.md "旧実装との一致": `__fixtures__/floors.json` records the floors of the
 * room tree (seeds 1-50 at stages 1, 5, 10 and 20; `seed` is the floor's seed value); the same seed and stage must
 * give the same floor. `floors.three-rooms.json` is the record of the three-room floors this one replaced: room A of
 * a floor whose room A was not made again is the same room. Write the files again only for an intended change of
 * behavior (record them from the implementation that is to be the reference).
 */
const NO_TIME_LIMIT = 10 * 60 * 1000;

type RoomRecord = {
  width: number;
  height: number;
  start: Position;
  goal: Position;
  goalKind?: string;
  startKind?: string;
  doors?: { cell: Position; side: string }[];
  bombs: number[];
};

type FloorRecord = {
  seed: number;
  stageNo: number;
  parent: number[];
  exitHeadings: string[][];
  downRoom: number;
  extensions: number[];
  roomOrigin: Position[];
  corridors: Position[][];
  cols: number;
  rows: number;
  rooms: RoomRecord[];
};

const roomRecord = (room: Floor['rooms'][number]): RoomRecord => ({
  width: room.width,
  height: room.height,
  start: { ...room.start },
  goal: { ...room.goal },
  startKind: room.startKind,
  goalKind: room.goalKind,
  doors: room.doors?.map((d) => ({ cell: { ...d.cell }, side: d.side })),
  bombs: room.cells.flatMap((cell, index) => (cell.hasBomb ? [index] : []))
});

const record = (seed: number, stageNo: number, floor: Floor): FloorRecord => ({
  seed,
  stageNo,
  parent: floor.tree.parent,
  exitHeadings: floor.tree.exitHeadings,
  downRoom: floor.downRoom,
  extensions: floor.extensions,
  roomOrigin: floor.layout.roomOrigin.map((p) => ({ ...p })),
  corridors: floor.layout.corridors.map((c) => c.map((p) => ({ ...p }))),
  cols: floor.layout.cols,
  rows: floor.layout.rows,
  rooms: floor.rooms.map(roomRecord)
});

const recorded = floors as FloorRecord[];
const make = (stageNo: number, seed: number): Floor => generateFloor(stageNo, { seed, maxGenerationMs: NO_TIME_LIMIT });

describe('floor fixture (the room tree of a seed and stage does not change)', () => {
  it('has the floors of seeds 1-50 at stages 1, 5, 10 and 20, five rooms each', () => {
    expect(recorded).toHaveLength(200);
    expect(new Set(recorded.map((floor) => floor.stageNo))).toEqual(new Set([1, 5, 10, 20]));
    expect(recorded.every((floor) => floor.rooms.length === 5 && floor.corridors.length === 4)).toBe(true);
  });

  it('matches the recorded floors for every seed and stage', () => {
    const mismatched = recorded.filter(
      (expected) =>
        JSON.stringify(record(expected.seed, expected.stageNo, make(expected.stageNo, expected.seed))) !==
        JSON.stringify(expected)
    );
    expect(mismatched.map((m) => `${m.seed}@${m.stageNo}`)).toEqual([]);
  }, 20 * 60 * 1000);

  it('covers floors with a lengthened corridor, and floors where an exit was moved to another wall (a rebuild)', () => {
    expect(recorded.some((floor) => floor.extensions.some((x) => x > 0))).toBe(true);
    // The exit walls of an untouched floor are the first draw: rebuilt ones differ from a fresh tree.
    const rebuilt = recorded.filter((floor) => {
      const fresh = buildFloorTree(createRng(floor.seed + floor.stageNo * 9973 + 3), 5);
      return fresh.exitHeadings.flat().join() !== floor.exitHeadings.flat().join();
    });
    expect(rebuilt.length).toBeGreaterThan(0);
  });

  it('keeps room A of the three-room floors when room A was not made again (same seed and stage)', () => {
    let compared = 0;
    for (const old of threeRooms as { seed: number; stageNo: number; headings: string[]; rooms: RoomRecord[] }[]) {
      const drawn = floorHeadings(old.seed, old.stageNo).headings;
      const now = recorded.find((floor) => floor.seed === old.seed && floor.stageNo === old.stageNo);
      if (!now || old.headings.join() !== drawn.join() || now.exitHeadings[0].join() !== drawn.join()) {
        continue;
      }
      expect(now.rooms[0]).toEqual(JSON.parse(JSON.stringify(old.rooms[0])));
      compared += 1;
    }
    expect(compared).toBeGreaterThan(100);
  });
});
