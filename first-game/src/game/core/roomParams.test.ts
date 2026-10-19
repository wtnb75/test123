import { describe, expect, it } from 'vitest';
import { analyzeSolvability } from './solver';
import { roomLevels } from './floorTree';
import { generateFloor, generateStage, roomParams, stageParams } from './generator';

// docs/spec/rooms-and-floors.md "部屋の難しさ": the hand-worked values (`deep` = true: a room 2 or more tree steps from room A).
describe('roomParams', () => {
  const pick = (n: number, deep: boolean) => {
    const p = roomParams(n, deep);
    return [p.width, p.height, p.bombCount, p.depthTarget];
  };

  it('stage 1: baseline 8x8, 9 bombs, depth 1; the deep room 9x9, 11 bombs, depth 2', () => {
    expect(pick(1, false)).toEqual([8, 8, 9, 1]);
    expect(pick(1, true)).toEqual([9, 9, 11, 2]);
  });

  it('stage 3: baseline 10x10, 16 bombs (the linear term), depth 2; deep 11x11, 17 bombs, depth 3', () => {
    expect(pick(3, false)).toEqual([10, 10, 16, 2]);
    expect(pick(3, true)).toEqual([11, 11, 17, 3]);
  });

  it('stage 5: baseline 12x12, 24 bombs, depth 2; deep 13x13, 25 bombs, depth 3', () => {
    expect(pick(5, false)).toEqual([12, 12, 24, 2]);
    expect(pick(5, true)).toEqual([13, 13, 25, 3]);
  });

  it('stage 10: baseline 17x17, 44 bombs, depth 4; deep 18x18, 49 bombs, depth 5', () => {
    expect(pick(10, false)).toEqual([17, 17, 44, 4]);
    expect(pick(10, true)).toEqual([18, 18, 49, 5]);
  });

  it('stage 12: the depth target is already 5, so the deep room keeps 5 (size 19 -> 20)', () => {
    expect(pick(12, false)).toEqual([19, 19, 55, 5]);
    expect(pick(12, true)).toEqual([20, 20, 61, 5]);
  });

  it('stage 20: baseline 27x27, 117 bombs, depth 5; deep 28x28, 125 bombs, depth 5', () => {
    expect(pick(20, false)).toEqual([27, 27, 117, 5]);
    expect(pick(20, true)).toEqual([28, 28, 125, 5]);
  });

  it('stage 100: baseline 107x107; deep 108x108 with round(11664 x 0.18) = 2100 bombs (the density is capped at 0.18)', () => {
    expect(pick(100, false).slice(0, 2)).toEqual([107, 107]);
    expect(pick(100, true)).toEqual([108, 108, 2100, 5]);
  });

  it('the baseline is exactly what stageParams gives (the existing call is unchanged)', () => {
    for (const n of [1, 2, 3, 7, 12, 30, 100]) {
      expect(roomParams(n, false)).toEqual(stageParams(n, Math.min(5, Math.floor(1 + n / 3))));
      expect(stageParams(n, 3)).toEqual(stageParams(n, 3, false));
    }
  });

  it('the deep room is the same bomb formula on the bigger area, with the linear term and density of stage n', () => {
    for (const n of [1, 4, 9, 15, 40]) {
      const down = roomParams(n, true);
      const density = Math.min(0.18, 0.14 + 0.001 * n);

      expect(down.bombCount).toBe(Math.max(6, 4 + 4 * n, Math.round((8 + n) * (8 + n) * density)));
    }
  });
});

describe('the rooms a floor makes', () => {
  it('makes the rooms 2 or more tree steps from room A (and only them) one cell bigger: stage 1, 5 and 10, several seeds', () => {
    let deepRooms = 0;
    for (const stageNo of [1, 5, 10]) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const floor = generateFloor(stageNo, { seed, maxGenerationMs: 600_000, maxLoops: 0 });
        const levels = roomLevels(floor.tree.parent);

        floor.rooms.forEach((room, index) => {
          const deep = levels[index] >= 2;
          expect(room.width).toBe(7 + stageNo + (deep ? 1 : 0));
          expect(room.height).toBe(7 + stageNo + (deep ? 1 : 0));
          const bombs = room.cells.filter((cell) => cell.hasBomb).length;
          expect(bombs).toBe(roomParams(stageNo, deep).bombCount);
          deepRooms += deep ? 1 : 0;
        });
        // RoomCount - 3 = 2 deep rooms in a floor of five.
        expect(levels.filter((level) => level >= 2)).toHaveLength(2);
      }
    }
    expect(deepRooms).toBe(36);
  });

  it('makes room A the same size and board as a room made alone for the Title demo (room A is not changed)', () => {
    let same = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      const floor = generateFloor(3, { seed, maxGenerationMs: 600_000, maxLoops: 0 });
      const alone = generateStage(3, { seed, maxGenerationMs: 600_000 });

      if (floor.layout.headings.join() === alone.doors?.map((d) => d.side).join()) {
        expect(floor.rooms[0].width).toBe(alone.width);
        expect(floor.rooms[0].cells.map((c) => c.hasBomb)).toEqual(alone.cells.map((c) => c.hasBomb));
        same += 1;
      }
    }
    // The comparison ran (the guard against a loop that checks nothing).
    expect(same).toBeGreaterThan(0);
  });

  it('a dead end and the down-stairs room are sized by their level only, and the down-stairs room is solvable from its entry', () => {
    let deadEnds = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      const floor = generateFloor(5, { seed, maxGenerationMs: 600_000, maxLoops: 0 });
      const levels = roomLevels(floor.tree.parent);

      floor.rooms.forEach((room, index) => {
        if (index > 0 && room.goalKind === 'none') {
          expect(room.width).toBe(levels[index] >= 2 ? 13 : 12);
          deadEnds += 1;
        }
      });
      expect(floor.rooms[floor.downRoom].width).toBe(levels[floor.downRoom] >= 2 ? 13 : 12);
      expect(analyzeSolvability(floor.rooms[floor.downRoom]).solvable).toBe(true);
    }
    expect(deadEnds).toBeGreaterThan(0);
  });

  it('a deep room that cannot be made at all falls back to the +1 size of stage n - 1 (depth 1); the down-stairs alone do not make it deep', () => {
    // maxRetries 0: no candidate; the fallback uses stage max(1, n - 1) with the room kind kept.
    const room = generateStage(5, { seed: 3, role: 'B', heading: 'E', withDown: true, deep: true, maxRetries: 0 });
    const plain = generateStage(5, { seed: 3, role: 'B', heading: 'E', withDown: false, maxRetries: 0 });
    const shallowDown = generateStage(5, { seed: 3, role: 'B', heading: 'E', withDown: true, maxRetries: 0 });

    expect(room.width).toBe(7 + 4 + 1);
    expect(plain.width).toBe(7 + 4);
    expect(shallowDown.width).toBe(7 + 4);
    expect(room.stageNo).toBe(5);
    expect(room.generation.depthTarget).toBe(1);
  });

  it('a deep room starts from the depth target + 1 (at most 5) and a baseline room from the baseline target', () => {
    // maxRetries 1: the only candidate is tried at the starting target, which the stage records.
    const deep = generateStage(3, { seed: 7, role: 'B', heading: 'E', withDown: false, deep: true, maxRetries: 1 });
    const base = generateStage(3, { seed: 7, role: 'B', heading: 'E', withDown: false, maxRetries: 1 });
    const capped = generateStage(12, { seed: 7, role: 'B', heading: 'E', withDown: false, deep: true, maxRetries: 1 });

    // Stage 3: baseline target floor(1 + 3 / 3) = 2; the deep room 3. Stage 12: 5 already, the deep room stays at 5.
    expect(deep.generation.depthTarget).toBe(3);
    expect(base.generation.depthTarget).toBe(2);
    expect(capped.generation.depthTarget).toBe(5);
    expect(deep.width).toBe(11);
    expect(base.width).toBe(10);
  });

  it('room A is never deep, even when asked: it stays the baseline size (the Title demo makes the same room A)', () => {
    const asked = generateStage(3, { seed: 7, deep: true, maxRetries: 1 });
    const plain = generateStage(3, { seed: 7, maxRetries: 1 });

    expect(asked.width).toBe(10);
    expect(asked.cells.map((c) => c.hasBomb)).toEqual(plain.cells.map((c) => c.hasBomb));
  });
});
