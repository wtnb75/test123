import { describe, expect, it } from 'vitest';
import {
  BOARD_AREA_SIDE,
  BOARD_AREA_TOP,
  CELL_MIN,
  PAD_BASE_RADIUS,
  boardArea,
  boardCell,
  cameraScrollRange,
  centerScroll,
  followScroll,
  padBaseRadius,
  roomFits
} from './boardFit';

// docs/spec/board-render.md "盤面の大きさと位置": the hand-worked values.
describe('boardArea', () => {
  const pick = (width: number, height: number) => {
    const a = boardArea(width, height);
    return [a.left, a.top, a.width, a.height, a.controlsTop, a.compact, a.comfort];
  };

  it('390x844 (compact): 350 x 644 below y = 80; the MAP button (top 724) is above the pad (top 742)', () => {
    expect(pick(390, 844)).toEqual([20, 80, 350, 644, 724, true, 44]);
  });

  it('375x550 (compact): 335 x 350; MAP top 430, pad top 448', () => {
    expect(pick(375, 550)).toEqual([20, 80, 335, 350, 430, true, 44]);
  });

  it('667x310 (compact by its height): 627 x 110; MAP top 190, pad top 208', () => {
    expect(pick(667, 310)).toEqual([20, 80, 627, 110, 190, true, 44]);
  });

  it('1280x720 (not compact): 1240 x 504; MAP top 584, pad top 596', () => {
    expect(pick(1280, 720)).toEqual([20, 80, 1240, 504, 584, false, 52]);
  });

  it('the margin and the top are the named constants, and the pad radius is 52 (41 when compact)', () => {
    expect([BOARD_AREA_SIDE, BOARD_AREA_TOP, PAD_BASE_RADIUS, padBaseRadius(false), padBaseRadius(true)]).toEqual([20, 80, 52, 52, 41]);
  });

  it('a screen too small for any area still gives a 1 px area (never zero or negative)', () => {
    const a = boardArea(30, 100);

    expect(a.width).toBe(1);
    expect(a.height).toBe(1);
    expect(boardCell(1, a)).toBe(30);
  });
});

describe('boardCell', () => {
  const cellsOf = (width: number, height: number, stages: number[]) => {
    const area = boardArea(width, height);
    return stages.map((n) => boardCell(n, area));
  };

  it('390x844: 38, 31, 30, 30 for stages 1, 3, 4, 9 (floor(350 / (8 + n)); never under 30)', () => {
    expect(cellsOf(390, 844, [1, 3, 4, 9])).toEqual([38, 31, 30, 30]);
  });

  it('375x550: 37, 30, 30, 30 (floor(335 / 9) = 37, floor(335 / 11) = 30, then 27 and 19 are raised to 30)', () => {
    expect(cellsOf(375, 550, [1, 3, 4, 9])).toEqual([37, 30, 30, 30]);
  });

  it('667x310: 30 for every stage (the area is 110 px high: floor(110 / 9) = 12 is raised to 30)', () => {
    expect(cellsOf(667, 310, [1, 3, 4, 9])).toEqual([30, 30, 30, 30]);
  });

  it('1280x720: 52, 45, 42, 30 for stages 1, 3, 4, 9; 50, 38, 31 for stages 2, 5, 8 (floor(504 / (8 + n)), at most 52)', () => {
    expect(cellsOf(1280, 720, [1, 3, 4, 9])).toEqual([52, 45, 42, 30]);
    expect(cellsOf(1280, 720, [2, 5, 8])).toEqual([50, 38, 31]);
  });

  it('is never above the comfortable size even when much more would fit (1280x720, stage 1: fit 56, cell 52)', () => {
    expect(Math.floor(504 / 9)).toBe(56);
    expect(cellsOf(1280, 720, [1])).toEqual([52]);
  });

  it('is never under 30, also for a huge stage', () => {
    expect(cellsOf(1280, 720, [100])).toEqual([CELL_MIN]);
    expect(cellsOf(390, 844, [100])).toEqual([30]);
  });

  it('is exactly the fit when it is between 30 and the comfortable size (a 10-cell room on a 350 px wide area: 35)', () => {
    // 390x844, stage 2: the largest room is 10 cells; 350 / 10 = 35 exactly.
    expect(cellsOf(390, 844, [2])).toEqual([35]);
  });
});

describe('roomFits', () => {
  it('390x844, stage 4 (cell 30): an 11 x 11 room (330 px) fits the 350 x 644 area, a 12 x 12 one (360 px) does not', () => {
    const area = boardArea(390, 844);

    expect(roomFits(11, 11, 30, area)).toBe(true);
    expect(roomFits(12, 12, 30, area)).toBe(false);
  });

  it('1280x720, stage 9 (cell 30): a 16 x 16 room (480 px) fits the 1240 x 504 area, a 17 x 17 one (510 px) does not', () => {
    const area = boardArea(1280, 720);

    expect(roomFits(16, 16, 30, area)).toBe(true);
    expect(roomFits(17, 17, 30, area)).toBe(false);
  });

  it('the border: exactly as wide as the area fits (10 x 35 = 350), 1 px more does not (10 x 36 = 360)', () => {
    const area = boardArea(390, 844);

    expect(roomFits(10, 10, 35, area)).toBe(true);
    expect(roomFits(10, 10, 36, area)).toBe(false);
  });

  it('both axes count: a room that fits the width but not the height does not fit (667x310: 110 px high)', () => {
    const area = boardArea(667, 310);

    expect(roomFits(8, 3, 30, area)).toBe(true);
    expect(roomFits(8, 4, 30, area)).toBe(false);
  });
});

describe('centerScroll', () => {
  it('390x844, stage 1 (cell 38): room A (8 x 8) at (20, 80) scrolls to (-23, -170); it then shows at x 43..347, y 250..554', () => {
    const scroll = centerScroll({ x: 20, y: 80 }, 8, 8, 38, boardArea(390, 844));

    expect(scroll).toEqual({ x: -23, y: -170 });
    expect([20 - scroll.x, 20 + 8 * 38 - scroll.x, 80 - scroll.y, 80 + 8 * 38 - scroll.y]).toEqual([43, 347, 250, 554]);
  });

  it('1280x720, stage 1 (cell 52): (20, 80), 8 x 8 -> (-412, -44): the middle of the board is the middle of the area', () => {
    const scroll = centerScroll({ x: 20, y: 80 }, 8, 8, 52, boardArea(1280, 720));

    expect(scroll).toEqual({ x: -412, y: -44 });
  });

  it('a room further down the floor scrolls by the same amount more: origin (260, 440) on 390x844 -> (217, 190)', () => {
    expect(centerScroll({ x: 260, y: 440 }, 8, 8, 38, boardArea(390, 844))).toEqual({ x: 217, y: 190 });
  });

  it('rounds .5 up to the larger whole number (375x550, cell 37: -19.5 -> -19; the y is -27)', () => {
    expect(centerScroll({ x: 20, y: 80 }, 8, 8, 37, boardArea(375, 550))).toEqual({ x: -19, y: -27 });
  });
});

describe('followScroll', () => {
  const screen = { width: 390, height: 844 };
  const floorRange = { minX: 0, maxX: 250, minY: 0, maxY: 176 };

  it('puts the screen centre on the point (195, 422 from the corner) when the range allows it', () => {
    expect(followScroll({ x: 295, y: 522 }, screen, floorRange)).toEqual({ x: 100, y: 100 });
  });

  it('stops at the floor\'s edge: a point near the left or top edge scrolls to 0, not past it into the blank margin', () => {
    expect(followScroll({ x: 40, y: 60 }, screen, floorRange)).toEqual({ x: 0, y: 0 });
  });

  it('stops at the far edge too (x 250, y 176)', () => {
    expect(followScroll({ x: 900, y: 900 }, screen, floorRange)).toEqual({ x: 250, y: 176 });
  });

  it('with the range widened to a centring scroll (-380) the same point would scroll past the edge: the follow must be given the floor\'s own range', () => {
    const widened = cameraScrollRange(20, 10, 30, { side: 20, top: 80, bottom: 40 }, screen, [{ x: -380, y: -100 }]);
    const own = cameraScrollRange(20, 10, 30, { side: 20, top: 80, bottom: 40 }, screen, []);

    // x: 40 - 195 = -155 (inside -380..250); y: 60 - 422 = -362, held at the widened minimum -100.
    expect(followScroll({ x: 40, y: 60 }, screen, widened)).toEqual({ x: -155, y: -100 });
    expect(followScroll({ x: 40, y: 60 }, screen, own)).toEqual({ x: 0, y: 0 });
  });
});

describe('cameraScrollRange', () => {
  const margins = { side: 20, top: 80, bottom: 40 };

  it('without centring scrolls: the floor rectangle with its margins, never less than the screen (x 0..250, y 0..0)', () => {
    // 20 x 10 cells of 30 px: 600 + 40 = 640 wide (390 screen -> 250), 300 + 120 = 420 high (844 screen -> none).
    expect(cameraScrollRange(20, 10, 30, margins, { width: 390, height: 844 }, [])).toEqual({ minX: 0, maxX: 250, minY: 0, maxY: 0 });
  });

  it('a centring scroll below 0 widens the range to it (-23, -170); the other end stays', () => {
    expect(cameraScrollRange(20, 10, 30, margins, { width: 390, height: 844 }, [{ x: -23, y: -170 }])).toEqual({
      minX: -23,
      maxX: 250,
      minY: -170,
      maxY: 0
    });
  });

  it('a centring scroll past the far end widens that end (300, 10 -> max 300 and 10)', () => {
    expect(cameraScrollRange(20, 10, 30, margins, { width: 390, height: 844 }, [{ x: 300, y: 10 }])).toEqual({
      minX: 0,
      maxX: 300,
      minY: 0,
      maxY: 10
    });
  });

  it('a centring scroll inside the range changes nothing, and the range takes every room (the lowest and the highest)', () => {
    const inside = cameraScrollRange(20, 10, 30, margins, { width: 390, height: 844 }, [{ x: 100, y: 0 }]);
    const several = cameraScrollRange(20, 10, 30, margins, { width: 390, height: 844 }, [{ x: -5, y: -3 }, { x: 260, y: 7 }]);

    expect(inside).toEqual({ minX: 0, maxX: 250, minY: 0, maxY: 0 });
    expect(several).toEqual({ minX: -5, maxX: 260, minY: -3, maxY: 7 });
  });

  it('a floor taller than the screen keeps its own height (30 rows of 30 px + 120 = 1020; screen 844 -> 176)', () => {
    expect(cameraScrollRange(10, 30, 30, margins, { width: 390, height: 844 }, [])).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 176 });
  });

  it('the cell scales the floor: 20 x 10 cells of 44 px are 880 + 40 = 920 wide (390 screen -> 530)', () => {
    expect(cameraScrollRange(20, 10, 44, margins, { width: 390, height: 844 }, []).maxX).toBe(530);
  });
});
