import { describe, expect, it } from 'vitest';
import {
  HEADING_VECTOR, cameraBounds, cellAtWorld, exitArrowDirection, floorLayout, oppositeHeading
} from './floorLayout';

// Worked by hand from docs/spec/rooms-and-floors.md ("フロアの座標"). Rooms are 8 x 8. A corridor cell is
// (forward, right) and lies at `eA + d * (1 + forward) + n * right` (n = d turned 90 degrees clockwise).
const STRAIGHT_E_SES = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 }];

describe('headings', () => {
  it('the opposite heading is across', () => {
    expect(oppositeHeading('E')).toBe('W');
    expect(oppositeHeading('S')).toBe('N');
    expect(oppositeHeading('W')).toBe('E');
    expect(oppositeHeading('N')).toBe('S');
  });

  it('has the vectors of the spec', () => {
    expect(HEADING_VECTOR).toEqual({ E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 }, N: { x: 0, y: -1 } });
  });
});

describe('floorLayout', () => {
  it('heading right, door A (7, 2), door B (0, 1): room B at (12, 3), nothing is shifted', () => {
    const layout = floorLayout('E', 8, 8, { x: 7, y: 2 }, { x: 0, y: 1 }, STRAIGHT_E_SES);

    expect(layout.corridor).toEqual([
      { x: 8, y: 2 }, { x: 9, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }
    ]);
    expect(layout.roomOrigin).toEqual([{ x: 0, y: 0 }, { x: 12, y: 3 }]);
    expect([layout.cols, layout.rows]).toEqual([20, 11]);
  });

  it('heading right with the corridor turning left: room B is above room A and everything is shifted down by 3', () => {
    const shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 1, y: -2 }, { x: 2, y: -2 }, { x: 3, y: -2 }];
    const layout = floorLayout('E', 8, 8, { x: 7, y: 5 }, { x: 0, y: 6 }, shape);

    expect(layout.corridor).toEqual([
      { x: 8, y: 8 }, { x: 9, y: 8 }, { x: 9, y: 7 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }
    ]);
    expect(layout.roomOrigin).toEqual([{ x: 0, y: 3 }, { x: 12, y: 0 }]);
    expect([layout.cols, layout.rows]).toEqual([20, 11]);
  });

  it('heading down: the corridor goes down from door A (3, 7), room B is left of room A and everything is shifted right by 3', () => {
    const layout = floorLayout('S', 8, 8, { x: 3, y: 7 }, { x: 4, y: 0 }, STRAIGHT_E_SES);

    expect(layout.corridor).toEqual([
      { x: 6, y: 8 }, { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }, { x: 4, y: 11 }
    ]);
    expect(layout.roomOrigin).toEqual([{ x: 3, y: 0 }, { x: 0, y: 12 }]);
    expect([layout.cols, layout.rows]).toEqual([11, 20]);
  });

  it('heading left: room B is left of the corridor, door B in its right wall', () => {
    const layout = floorLayout('W', 8, 8, { x: 0, y: 3 }, { x: 7, y: 4 }, [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }
    ]);

    // corridor (before shifting): (-1, 3) .. (-6, 3); room B at (-6, 3) + (-1, 0) - (7, 4) = (-14, -1); shifted by (14, 1)
    expect(layout.roomOrigin).toEqual([{ x: 14, y: 1 }, { x: 0, y: 0 }]);
    expect(layout.corridor[0]).toEqual({ x: 13, y: 4 });
    expect(layout.corridor[5]).toEqual({ x: 8, y: 4 });
    expect([layout.cols, layout.rows]).toEqual([22, 9]);
  });

  it('heading left with a bend: "right of the heading" is up, so a right turn goes to smaller y', () => {
    const layout = floorLayout('W', 8, 8, { x: 0, y: 3 }, { x: 7, y: 4 }, [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }
    ]);

    // before shifting: (-1, 3) (-2, 3) (-2, 2) (-3, 2) (-4, 2) (-5, 2); room B at (-5, 2) + (-1, 0) - (7, 4) = (-13, -2)
    expect(layout.corridor).toEqual([
      { x: 12, y: 5 }, { x: 11, y: 5 }, { x: 11, y: 4 }, { x: 10, y: 4 }, { x: 9, y: 4 }, { x: 8, y: 4 }
    ]);
    expect(layout.roomOrigin).toEqual([{ x: 13, y: 2 }, { x: 0, y: 0 }]);
    expect([layout.cols, layout.rows]).toEqual([21, 10]);
  });

  it('heading up: the corridor turns right after two cells; room B is above and everything is shifted down by 13', () => {
    const layout = floorLayout('N', 8, 8, { x: 5, y: 0 }, { x: 2, y: 7 }, [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }
    ]);

    // corridor before shifting: (5, -1) (5, -2) (6, -2) (6, -3) (6, -4) (6, -5); room B at (6, -5) + (0, -1) - (2, 7) = (4, -13)
    expect(layout.roomOrigin).toEqual([{ x: 0, y: 13 }, { x: 4, y: 0 }]);
    expect(layout.corridor[0]).toEqual({ x: 5, y: 12 });
    expect(layout.corridor[5]).toEqual({ x: 6, y: 8 });
    expect([layout.cols, layout.rows]).toEqual([12, 21]);
  });

  it('puts door B right after the last corridor cell, on the far side, for every heading', () => {
    for (const heading of ['E', 'S', 'W', 'N'] as const) {
      const d = HEADING_VECTOR[heading];
      const doorB = { x: 3, y: 2 };
      const layout = floorLayout(heading, 8, 8, { x: 4, y: 4 }, doorB, [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 2, y: -1 }, { x: 3, y: -1 }, { x: 4, y: -1 }
      ]);
      const last = layout.corridor[5];
      const originB = layout.roomOrigin[1];

      expect({ x: originB.x + doorB.x, y: originB.y + doorB.y }).toEqual({ x: last.x + d.x, y: last.y + d.y });
    }
  });
});

// Hand worked from the spec's example: heading right-then-down floor, room A's top-left at (20, 170) px and
// room B's at (380, 80) px, cells 30 px, a floor 20 x 11 cells.
describe('cellAtWorld', () => {
  it('maps a screen point to the cell of the room it is over (room A and room B of the example)', () => {
    expect(cellAtWorld(65, 215, 20, 170, 30)).toEqual({ x: 1, y: 1 });
    expect(cellAtWorld(410, 110, 380, 80, 30)).toEqual({ x: 1, y: 1 });
  });

  it('a point left of or above the room is outside (negative), and the edge between cells belongs to the next cell', () => {
    expect(cellAtWorld(19, 169, 20, 170, 30)).toEqual({ x: -1, y: -1 });
    expect(cellAtWorld(50, 200, 20, 170, 30)).toEqual({ x: 1, y: 1 });
    expect(cellAtWorld(49, 199, 20, 170, 30)).toEqual({ x: 0, y: 0 });
  });
});

describe('cameraBounds', () => {
  const margins = { side: 20, top: 80, bottom: 40 };

  it('is the floor rectangle plus the margins: 20 x 11 cells -> 640 x 450 on a small screen', () => {
    expect(cameraBounds(20, 11, 30, margins, { width: 390, height: 300 })).toEqual({ width: 640, height: 450 });
  });

  it('is never smaller than the screen', () => {
    expect(cameraBounds(20, 11, 30, margins, { width: 1280, height: 720 })).toEqual({ width: 1280, height: 720 });
    expect(cameraBounds(20, 11, 30, margins, { width: 700, height: 300 })).toEqual({ width: 700, height: 450 });
  });
});

describe('exitArrowDirection', () => {
  it('points the 8 directions from the centre (300, 200) to the exit, as in the spec', () => {
    const toward = (x: number, y: number) => exitArrowDirection(x - 300, y - 200);

    expect(toward(500, 200)).toBe('→');
    expect(toward(300, 500)).toBe('↓');
    expect(toward(100, 200)).toBe('←');
    expect(toward(300, 20)).toBe('↑');
    expect(toward(500, 500)).toBe('↘');
    expect(toward(100, 500)).toBe('↙');
    expect(toward(100, 20)).toBe('↖');
    expect(toward(500, 20)).toBe('↗');
  });
});
