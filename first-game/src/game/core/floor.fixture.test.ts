import { describe, expect, it } from 'vitest';
import floors from './__fixtures__/floors.json';
import { floorHeadings, generateFloor, type Floor } from './generator';
import type { Position } from './types';

/**
 * Regression for docs/spec/rooms-and-floors.md "旧実装との一致": the floors generated before the floor became data
 * (rooms / doors / corridors) are recorded in `__fixtures__/floors.json` (seeds 1-50 at stages 1, 5, 10 and 20; `seed`
 * is the floor's seed value); the same seed and stage must give the same floor. The file is only to be written
 * again when a change of behavior is intended: run `record` below on the implementation that is to be the reference.
 */
const NO_TIME_LIMIT = 10 * 60 * 1000;

type FloorRecord = {
  seed: number;
  stageNo: number;
  headings: string[];
  downRoom: number;
  roomOrigin: Position[];
  corridors: Position[][];
  cols: number;
  rows: number;
  rooms: {
    width: number;
    height: number;
    start: Position;
    goal: Position;
    goalKind?: string;
    startKind?: string;
    doors?: { cell: Position; side: string }[];
    bombs: number[];
  }[];
};

const record = (seed: number, stageNo: number, floor: Floor): FloorRecord => ({
  seed,
  stageNo,
  headings: [...floor.layout.headings],
  downRoom: floor.downRoom,
  roomOrigin: floor.layout.roomOrigin.map((p) => ({ ...p })),
  corridors: floor.layout.corridors.map((c) => c.map((p) => ({ ...p }))),
  cols: floor.layout.cols,
  rows: floor.layout.rows,
  rooms: floor.rooms.map((room) => ({
    width: room.width,
    height: room.height,
    start: { ...room.start },
    goal: { ...room.goal },
    startKind: room.startKind,
    goalKind: room.goalKind,
    doors: room.doors?.map((d) => ({ cell: { ...d.cell }, side: d.side })),
    bombs: room.cells.flatMap((cell, index) => (cell.hasBomb ? [index] : []))
  }))
});

const recorded = floors as FloorRecord[];

describe('floor fixture (same seed and stage give the same floor as before the floor became data)', () => {
  it('has the floors of seeds 1-50 at stages 1, 5, 10 and 20', () => {
    expect(recorded).toHaveLength(200);
    expect(new Set(recorded.map((floor) => floor.stageNo))).toEqual(new Set([1, 5, 10, 20]));
  });

  it('matches the recorded floors for every seed and stage', () => {
    const mismatched = recorded.filter((expected) => {
      const floor = generateFloor(expected.stageNo, { seed: expected.seed, maxGenerationMs: NO_TIME_LIMIT });
      return JSON.stringify(record(expected.seed, expected.stageNo, floor)) !== JSON.stringify(expected);
    });
    expect(mismatched.map((m) => `${m.seed}@${m.stageNo}`)).toEqual([]);
  }, 20 * 60 * 1000);

  it('covers a floor whose rooms A and C were made again with door A2 opposite door A1', () => {
    const remade = recorded.filter(
      (floor) => floor.headings[1] !== floorHeadings(floor.seed, floor.stageNo).headings[1]
    );
    expect(remade.length).toBeGreaterThan(0);
  });
});
