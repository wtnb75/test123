import { describe, expect, it } from 'vitest';
import { DOOR_FRAME_COLOR, doorCellOf, roomWalls, wallThickness } from './walls';

// docs/spec/rooms-and-floors.md "壁と扉の見た目": a 2 px line round the cells (left and top before the first cell,
// right and bottom in the gap after the last one), one cell wide gap at the door, "+" in the middle of the gap.
describe('wallThickness', () => {
  it('is 2 px at the reference cell, scales with the cell and never goes under 1 px', () => {
    expect(wallThickness(30)).toBe(2);
    expect(wallThickness(15)).toBe(1);
    expect(wallThickness(6)).toBe(1);
    expect(wallThickness(60)).toBe(4);
  });
});

describe('roomWalls', () => {
  it('without a door: four bars round a 4 x 3 room of 30 px cells', () => {
    const walls = roomWalls(4, 3, 30);

    expect(walls.door).toBeUndefined();
    expect(walls.bars).toEqual([
      { x: -2, y: -2, width: 122, height: 2 }, // top: 0..120 plus the corner
      { x: -2, y: 88, width: 122, height: 2 }, // bottom: in the last gap (y 88..90)
      { x: -2, y: 0, width: 2, height: 90 }, // left
      { x: 118, y: 0, width: 2, height: 90 } // right
    ]);
  });

  it('door in the east wall next to cell (3, 1): the right bar is cut one cell wide, "+" in the middle of the gap', () => {
    const walls = roomWalls(4, 3, 30, 'E', { x: 3, y: 1 });

    expect(walls.bars).toContainEqual({ x: 118, y: 0, width: 2, height: 30 });
    expect(walls.bars).toContainEqual({ x: 118, y: 60, width: 2, height: 30 });
    expect(walls.bars).not.toContainEqual({ x: 118, y: 0, width: 2, height: 90 });
    expect(walls.door).toEqual({ x: 119, y: 45 });
  });

  it('door in the north wall next to cell (2, 0): the top bar is cut, "+" in the middle of the gap', () => {
    const walls = roomWalls(4, 3, 30, 'N', { x: 2, y: 0 });

    expect(walls.bars).toContainEqual({ x: -2, y: -2, width: 62, height: 2 });
    expect(walls.bars).toContainEqual({ x: 90, y: -2, width: 30, height: 2 });
    expect(walls.door).toEqual({ x: 75, y: -1 });
  });

  it('door in the west wall and in the south wall: the "+" sits on the wall line', () => {
    expect(roomWalls(4, 3, 30, 'W', { x: 0, y: 2 }).door).toEqual({ x: -1, y: 75 });
    expect(roomWalls(4, 3, 30, 'S', { x: 3, y: 2 }).door).toEqual({ x: 105, y: 89 });
  });

  it('door in the west wall next to (0, 1): the left bar is cut into 0..30 and 60..90', () => {
    const walls = roomWalls(4, 3, 30, 'W', { x: 0, y: 1 });

    expect(walls.bars).toContainEqual({ x: -2, y: 0, width: 2, height: 30 });
    expect(walls.bars).toContainEqual({ x: -2, y: 60, width: 2, height: 30 });
    expect(walls.bars).not.toContainEqual({ x: -2, y: 0, width: 2, height: 90 });
    expect(walls.bars).toHaveLength(5);
  });

  it('door in the south wall next to (2, 2): the bottom bar is cut into -2..60 and 90..120', () => {
    const walls = roomWalls(4, 3, 30, 'S', { x: 2, y: 2 });

    expect(walls.bars).toContainEqual({ x: -2, y: 88, width: 62, height: 2 });
    expect(walls.bars).toContainEqual({ x: 90, y: 88, width: 30, height: 2 });
    expect(walls.bars).toHaveLength(5);
  });

  it('door next to a corner cell: no zero-size bar is made on the short side', () => {
    // north wall, cell (0, 0): only the corner piece (2 px) and the rest from x = 30
    expect(roomWalls(4, 3, 30, 'N', { x: 0, y: 0 }).bars).toEqual([
      { x: -2, y: -2, width: 2, height: 2 },
      { x: 30, y: -2, width: 90, height: 2 },
      { x: -2, y: 88, width: 122, height: 2 },
      { x: -2, y: 0, width: 2, height: 90 },
      { x: 118, y: 0, width: 2, height: 90 }
    ]);
    // east wall, cell (3, 0): the right bar starts below the gap
    const east = roomWalls(4, 3, 30, 'E', { x: 3, y: 0 }).bars;
    expect(east).toContainEqual({ x: 118, y: 30, width: 2, height: 60 });
    expect(east.every((bar) => bar.width > 0 && bar.height > 0)).toBe(true);
    // east wall, cell (3, 2): the right bar ends at the gap
    const low = roomWalls(4, 3, 30, 'E', { x: 3, y: 2 }).bars;
    expect(low).toContainEqual({ x: 118, y: 0, width: 2, height: 60 });
    expect(low.every((bar) => bar.width > 0 && bar.height > 0)).toBe(true);
  });

  it('scales to a small cell: 15 px cells give a 1 px wall', () => {
    const walls = roomWalls(4, 3, 15, 'E', { x: 3, y: 0 });

    expect(walls.bars[0]).toEqual({ x: -1, y: -1, width: 61, height: 1 });
    expect(walls.door).toEqual({ x: 59.5, y: 7.5 });
  });
});

describe('door frame posts', () => {
  it('east wall, door cell (3, 1), 30 px cells: two 12 x 2 posts across the wall line at both ends of the gap', () => {
    expect(roomWalls(4, 3, 30, 'E', { x: 3, y: 1 }).posts).toEqual([
      { x: 113, y: 30, width: 12, height: 2 },
      { x: 113, y: 58, width: 12, height: 2 }
    ]);
  });

  it('north wall, door cell (2, 0): the posts stand across the top line, 2 x 12', () => {
    expect(roomWalls(4, 3, 30, 'N', { x: 2, y: 0 }).posts).toEqual([
      { x: 60, y: -7, width: 2, height: 12 },
      { x: 88, y: -7, width: 2, height: 12 }
    ]);
  });

  it('west and south walls: the posts are centred on the wall line', () => {
    expect(roomWalls(4, 3, 30, 'W', { x: 0, y: 2 }).posts).toEqual([
      { x: -7, y: 60, width: 12, height: 2 },
      { x: -7, y: 88, width: 12, height: 2 }
    ]);
    expect(roomWalls(4, 3, 30, 'S', { x: 3, y: 2 }).posts).toEqual([
      { x: 90, y: 83, width: 2, height: 12 },
      { x: 118, y: 83, width: 2, height: 12 }
    ]);
  });

  it('shrinks with the cell (15 px: 6 px long) and has none without a door', () => {
    expect(roomWalls(4, 3, 15, 'E', { x: 3, y: 0 }).posts?.[0]).toEqual({ x: 56.5, y: 0, width: 6, height: 1 });
    expect(roomWalls(4, 3, 30).posts).toBeUndefined();
    expect(DOOR_FRAME_COLOR).toBe(0x74b9ff);
  });
});

describe('doorCellOf', () => {
  const base = { goal: { x: 7, y: 2 }, start: { x: 1, y: 1 } };

  it('is the goal in room A, the start in room B, and nothing for a room without a door', () => {
    expect(doorCellOf({ ...base, goalKind: 'door', startKind: 'up' })).toEqual({ x: 7, y: 2 });
    expect(doorCellOf({ ...base, goalKind: 'down', startKind: 'door' })).toEqual({ x: 1, y: 1 });
    expect(doorCellOf({ ...base, goalKind: 'down', startKind: 'up' })).toBeUndefined();
    expect(doorCellOf(base)).toBeUndefined();
  });
});
