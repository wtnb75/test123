import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import floors from './__fixtures__/floors.json';
import fiveRooms from './__fixtures__/floors.five-rooms.json';
import threeRooms from './__fixtures__/floors.three-rooms.json';
import { enterableDoors } from './floorLoops';
import { buildFloorTree } from './floorTree';
import { floorHeadings, generateFloor, type Floor } from './generator';
import { createRng } from './random';
import type { Position } from './types';

/**
 * Regression for docs/spec/rooms-and-floors.md "旧実装との一致": `__fixtures__/floors.json` records the floors of the
 * room tree with loops (seeds 1-50 at stages 1, 5, 10 and 20; `seed` is the floor's seed value); the same seed and
 * stage must give the same floor. `floors.five-rooms.json` is the record of the floors before loops existed: a floor
 * that got no loop is the same floor (every recorded field). `floors.three-rooms.json` is the record of the
 * three-room floors before that: room A of a floor whose room A was not made again is the same room. Write
 * `floors.json` again only for an intended change of behavior (`WRITE_FIXTURE=1`, from the implementation that is to
 * be the reference).
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

type LoopFloorRecord = FloorRecord & {
  loops: { from: number; to: number; heading: string; length: number }[];
  /** The door indices of each room the player may come into it through first. */
  enterable: number[][];
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

const record = (seed: number, stageNo: number, floor: Floor): LoopFloorRecord => ({
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
  rooms: floor.rooms.map(roomRecord),
  loops: floor.loops.map(({ from, to, heading, length }) => ({ from, to, heading, length })),
  enterable: floor.rooms.map((_, room) => enterableDoors(floor.graph, room))
});

/** The record the floors had before loops (no `loops` / `enterable`). */
const withoutLoops = ({ loops: _loops, enterable: _enterable, ...rest }: LoopFloorRecord): FloorRecord => rest;

const recorded = floors as LoopFloorRecord[];
const make = (stageNo: number, seed: number): Floor => generateFloor(stageNo, { seed, maxGenerationMs: NO_TIME_LIMIT });

describe('floor fixture (the rooms, corridors and loops of a seed and stage do not change)', () => {
  it('has the floors of seeds 1-50 at stages 1, 5, 10 and 20, five rooms each, a corridor per tree edge and per loop', () => {
    expect(recorded).toHaveLength(200);
    expect(new Set(recorded.map((floor) => floor.stageNo))).toEqual(new Set([1, 5, 10, 20]));
    expect(
      recorded.every((floor) => floor.rooms.length === 5 && floor.corridors.length === 4 + floor.loops.length)
    ).toBe(true);
  });

  // Only with WRITE_FIXTURE=1 (an intended change of behavior): records floors.json again; the comparison is skipped then.
  it.skipIf(!process.env.WRITE_FIXTURE)('writes the recorded floors again', () => {
    const all = recorded.map((expected) => record(expected.seed, expected.stageNo, make(expected.stageNo, expected.seed)));
    writeFileSync(new URL('./__fixtures__/floors.json', import.meta.url), `${JSON.stringify(all)}\n`);
  }, 20 * 60 * 1000);

  it.skipIf(!!process.env.WRITE_FIXTURE)('matches the recorded floors for every seed and stage', () => {
    const mismatched = recorded.filter(
      (expected) =>
        JSON.stringify(record(expected.seed, expected.stageNo, make(expected.stageNo, expected.seed))) !==
        JSON.stringify(expected)
    );
    expect(mismatched.map((m) => `${m.seed}@${m.stageNo}`)).toEqual([]);
  }, 20 * 60 * 1000);

  it('covers floors with no loop, one loop and two loops, and loops of every heading kind (across and down)', () => {
    const counts = recorded.map((floor) => floor.loops.length);
    expect(counts.filter((n) => n === 0).length).toBeGreaterThan(20);
    expect(counts.filter((n) => n === 1).length).toBeGreaterThan(20);
    expect(counts.filter((n) => n === 2).length).toBeGreaterThan(0);
    // The spec's range (測定: 32 / 38 / 46 / 38% have a loop, 0-8% have two; stages 1 / 5 / 10 / 20).
    for (const stageNo of [1, 5, 10, 20]) {
      const own = recorded.filter((floor) => floor.stageNo === stageNo);
      const some = own.filter((floor) => floor.loops.length >= 1).length / own.length;
      const two = own.filter((floor) => floor.loops.length === 2).length / own.length;

      expect(some).toBeGreaterThanOrEqual(0.25);
      expect(some).toBeLessThanOrEqual(0.6);
      expect(two).toBeLessThanOrEqual(0.15);
    }
    const headings = new Set(recorded.flatMap((floor) => floor.loops.map((loop) => loop.heading)));
    expect(headings.has('E') || headings.has('W')).toBe(true);
    expect(headings.has('S') || headings.has('N')).toBe(true);
  });

  it('covers floors with a lengthened corridor, and floors where an exit was moved to another wall (a rebuild)', () => {
    expect(recorded.some((floor) => floor.extensions.some((x) => x > 0))).toBe(true);
    // The exit walls of an untouched floor are the first draw: rebuilt ones differ from a fresh tree.
    const rebuilt = recorded.filter((floor) => {
      const fresh = buildFloorTree(createRng(floor.seed + floor.stageNo * 9973 + 3), 5);
      return fresh.exitHeadings.flat().join() !== floor.exitHeadings.flat().join();
    });
    expect(rebuilt.length).toBeGreaterThan(0);
  });

  it('gives a floor without a loop exactly the floor it was before loops existed (every recorded field)', () => {
    let compared = 0;
    for (const now of recorded.filter((floor) => floor.loops.length === 0)) {
      const before = (fiveRooms as FloorRecord[]).find((old) => old.seed === now.seed && old.stageNo === now.stageNo);
      expect(before).toBeDefined();
      expect(withoutLoops(now)).toEqual(before);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(80);
  });

  it('keeps the tree, the tree corridors and room A of a floor with loops (a loop adds, it does not move)', () => {
    let compared = 0;
    for (const now of recorded.filter((floor) => floor.loops.length > 0)) {
      const before = (fiveRooms as FloorRecord[]).find((old) => old.seed === now.seed && old.stageNo === now.stageNo) as FloorRecord;

      expect(now.parent).toEqual(before.parent);
      expect(now.exitHeadings).toEqual(before.exitHeadings);
      expect(now.downRoom).toBe(before.downRoom);
      expect(now.extensions).toEqual(before.extensions);
      expect(now.roomOrigin).toEqual(before.roomOrigin);
      expect(now.corridors.slice(0, 4)).toEqual(before.corridors);
      expect(now.rooms[0]).toEqual(before.rooms[0]);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(40);
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
