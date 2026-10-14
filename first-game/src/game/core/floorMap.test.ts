import { describe, expect, it } from 'vitest';
import {
  exitMarkers, floorFitsApart, floorMap, headingPairFromDraw, type FloorMap
} from './floorLayout';

// Worked by hand from docs/spec/rooms-and-floors.md ("フロアの座標（3 部屋）", "配置の条件"). Rooms are 8 x 8.
const STRAIGHT = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }];

describe('headingPairFromDraw', () => {
  it('maps k = floor(r * 12): door A1 the (k / 3)-th heading, door A2 the (k mod 3)-th of the other three', () => {
    expect(headingPairFromDraw(0)).toEqual(['E', 'S']);
    expect(headingPairFromDraw(0.34)).toEqual(['S', 'W']);
    expect(headingPairFromDraw(0.5)).toEqual(['W', 'E']);
    expect(headingPairFromDraw(0.99)).toEqual(['N', 'W']);
  });

  it('gives each of the 12 ordered pairs once for the 12 twelfths, never the same heading twice', () => {
    const pairs = Array.from({ length: 12 }, (_, k) => headingPairFromDraw((k + 0.5) / 12));

    expect(new Set(pairs.map((pair) => pair.join(''))).size).toBe(12);
    expect(pairs.every(([a, b]) => a !== b)).toBe(true);
  });
});

describe('floorMap (three rooms)', () => {
  it('right then down, straight corridors: B at (15, 1), C at (0, 14), A shifted right by 1, 23 x 22 cells', () => {
    const map = floorMap(['E', 'S'], 8, 8, [{ x: 7, y: 2 }, { x: 3, y: 7 }], [{ x: 0, y: 1 }, { x: 4, y: 0 }], [STRAIGHT, STRAIGHT]);

    // before shifting: B (14, 1), C (-1, 14); corridor 1 (8, 2)..(13, 2), corridor 2 (3, 8)..(3, 13)
    expect(map.roomOrigin).toEqual([{ x: 1, y: 0 }, { x: 15, y: 1 }, { x: 0, y: 14 }]);
    expect(map.corridors[0][0]).toEqual({ x: 9, y: 2 });
    expect(map.corridors[0][5]).toEqual({ x: 14, y: 2 });
    expect(map.corridors[1][0]).toEqual({ x: 4, y: 8 });
    expect(map.corridors[1][5]).toEqual({ x: 4, y: 13 });
    expect([map.cols, map.rows]).toEqual([23, 22]);
    expect(map.headings).toEqual(['E', 'S']);
    expect(floorFitsApart(map, 8, 8)).toBe(true);
  });

  it('left then up: room B is left of room A and room C above it; everything is shifted to a (0, 0) top-left', () => {
    const map = floorMap(['W', 'N'], 8, 8, [{ x: 0, y: 3 }, { x: 5, y: 0 }], [{ x: 7, y: 4 }, { x: 2, y: 7 }], [
      STRAIGHT,
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]
    ]);

    // B at (-14, -1) (corridor (-1, 3)..(-6, 3) + (-1, 0) - (7, 4)); C at (4, -13) as in the one-corridor example
    expect(map.roomOrigin).toEqual([{ x: 14, y: 13 }, { x: 0, y: 12 }, { x: 18, y: 0 }]);
    expect(map.corridors[0][0]).toEqual({ x: 13, y: 16 });
    expect(map.corridors[1][5]).toEqual({ x: 20, y: 8 });
    expect([map.cols, map.rows]).toEqual([26, 21]);
  });
});

describe('floorFitsApart', () => {
  const base: FloorMap = {
    headings: ['E', 'S'],
    roomOrigin: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }],
    corridors: [[{ x: 8, y: 3 }, { x: 9, y: 3 }], [{ x: 3, y: 8 }, { x: 3, y: 9 }]],
    cols: 28,
    rows: 28
  };

  it('keeps apart rooms and corridors that have a free row or column between them', () => {
    expect(floorFitsApart(base, 8, 8)).toBe(true);
  });

  it('two rooms that touch at the side are not apart: B at x = 14..21 and C at x = 6..13 share the row y = 14', () => {
    // door A1 (7, 7) / door B (0, 0): B at (14, 7); door A2 (6, 7) / door C (0, 0): C at (6, 14)
    const map = floorMap(['E', 'S'], 8, 8, [{ x: 7, y: 7 }, { x: 6, y: 7 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }], [STRAIGHT, STRAIGHT]);

    expect(floorFitsApart(map, 8, 8)).toBe(false);
  });

  it('two rooms that touch only at a corner are not apart (B at (8, 8)), one empty column between them is (B at (9, 9))', () => {
    const near = { ...base, roomOrigin: [{ x: 0, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 20 }] } as FloorMap;
    const far = { ...base, roomOrigin: [{ x: 0, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 20 }] } as FloorMap;

    expect(floorFitsApart({ ...near, corridors: [[], []] }, 8, 8)).toBe(false);
    expect(floorFitsApart({ ...far, corridors: [[], []] }, 8, 8)).toBe(true);
  });

  it('a corridor cell inside a room is not apart', () => {
    expect(floorFitsApart({ ...base, corridors: [[{ x: 3, y: 3 }], base.corridors[1]] }, 8, 8)).toBe(false);
  });

  it('a corridor next to a room it does not join is not apart (diagonals too), a corridor next to its own end is fine', () => {
    // room C is x 0..7, y 20..27: (8, 19) touches its corner diagonally; room B is x 20..27, y 0..7: (19, 8) the same
    expect(floorFitsApart({ ...base, corridors: [[{ x: 8, y: 19 }], base.corridors[1]] }, 8, 8)).toBe(false);
    expect(floorFitsApart({ ...base, corridors: [base.corridors[0], [{ x: 19, y: 8 }]] }, 8, 8)).toBe(false);
    expect(floorFitsApart({ ...base, corridors: [[{ x: 19, y: 3 }], base.corridors[1]] }, 8, 8)).toBe(true);
    expect(floorFitsApart({ ...base, corridors: [base.corridors[0], [{ x: 3, y: 19 }]] }, 8, 8)).toBe(true);
  });

  it('the two corridors may not share a cell or a side, a diagonal is allowed', () => {
    const c0 = [{ x: 9, y: 3 }];

    expect(floorFitsApart({ ...base, corridors: [c0, [{ x: 9, y: 3 }]] }, 8, 8)).toBe(false);
    expect(floorFitsApart({ ...base, corridors: [c0, [{ x: 9, y: 4 }]] }, 8, 8)).toBe(false);
    expect(floorFitsApart({ ...base, corridors: [c0, [{ x: 10, y: 4 }]] }, 8, 8)).toBe(true);
  });
});

describe('exitMarkers', () => {
  // a screen 300 x 400 at scroll (0, 0): the centre is (150, 200); pad 30
  const camera = { left: 0, top: 0, width: 300, height: 400 };

  it('shows nothing for an exit on the screen, the border included', () => {
    expect(exitMarkers([{ x: 100, y: 100, label: 'DOOR' }, { x: 300, y: 200, label: 'GOAL' }], camera)).toEqual([]);
  });

  it('points right / down from the centre and puts the arrow 30 px inside the border', () => {
    // right: 500 right of the centre, t = (300 - 30 - 150) / 500 = 0.24 -> x = 270
    const [right] = exitMarkers([{ x: 650, y: 200, label: 'DOOR' }], camera);
    expect(right.text).toBe('DOOR →');
    expect(right.x).toBeCloseTo(270, 6);
    expect(right.y).toBe(200);
    // down: 700 below the centre, t = (400 - 30 - 200) / 700 -> y = 370
    const [down] = exitMarkers([{ x: 150, y: 900, label: 'GOAL' }], camera);
    expect(down.text).toBe('GOAL ↓');
    expect(down.x).toBe(150);
    expect(down.y).toBeCloseTo(370, 6);
  });

  it('two doors in the same direction make one marker: the one nearer the centre', () => {
    const markers = exitMarkers([{ x: 900, y: 210, label: 'DOOR' }, { x: 650, y: 200, label: 'DOOR' }], camera);

    expect(markers).toHaveLength(1);
    expect(markers[0].text).toBe('DOOR →');
    expect(markers[0].x).toBeCloseTo(270, 6);
  });

  it('equally near doors in the same direction: the earlier one is kept', () => {
    const markers = exitMarkers([{ x: 650, y: 190, label: 'DOOR' }, { x: 650, y: 210, label: 'DOOR' }], camera);

    expect(markers).toHaveLength(1);
    expect(markers[0].y).toBeLessThan(200);
  });

  it('two doors in different directions give two markers, in the order of the exits', () => {
    const markers = exitMarkers([{ x: 650, y: 200, label: 'DOOR' }, { x: 150, y: 900, label: 'DOOR' }], camera);

    expect(markers.map((marker) => marker.text)).toEqual(['DOOR →', 'DOOR ↓']);
  });

  it('follows the camera scroll', () => {
    expect(exitMarkers([{ x: 650, y: 200, label: 'DOOR' }], { ...camera, left: 400 })).toEqual([]);
  });
});
