import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, HOLE_COUNT, clampScroll, holeCenter, startScroll } from './board';

describe('board size', () => {
    it('has 8 x 6 = 48 holes on a 2560 x 1920 board', () => {
        expect(HOLE_COUNT).toBe(48);
        expect(BOARD_W).toBe(2560);
        expect(BOARD_H).toBe(1920);
    });
});

describe('holeCenter', () => {
    it('puts hole 0 half a spacing from the top-left corner', () => {
        expect(holeCenter(0)).toEqual({ x: 160, y: 160 });
    });

    it('puts the last hole of the first row at column 7', () => {
        expect(holeCenter(7)).toEqual({ x: 2400, y: 160 });
    });

    it('wraps to the second row at hole 8 (row-major order)', () => {
        expect(holeCenter(8)).toEqual({ x: 160, y: 480 });
    });

    it('puts the last hole in the bottom-right cell', () => {
        expect(holeCenter(47)).toEqual({ x: 2400, y: 1760 });
    });
});

describe('clampScroll', () => {
    it('leaves a position inside the board unchanged', () => {
        expect(clampScroll(100, 200)).toEqual({ x: 100, y: 200 });
    });

    it('stops at the top-left corner of the board', () => {
        expect(clampScroll(-5, -1000)).toEqual({ x: 0, y: 0 });
    });

    it('stops where the view reaches the bottom-right corner (2560 - 1024, 1920 - 768)', () => {
        expect(clampScroll(9999, 9999)).toEqual({ x: 1536, y: 1152 });
    });

    it('clamps each axis independently', () => {
        expect(clampScroll(-1, 5000)).toEqual({ x: 0, y: 1152 });
    });

    it('accepts exactly the limits', () => {
        expect(clampScroll(0, 0)).toEqual({ x: 0, y: 0 });
        expect(clampScroll(1536, 1152)).toEqual({ x: 1536, y: 1152 });
    });
});

describe('startScroll', () => {
    it('centers the view on the board', () => {
        expect(startScroll()).toEqual({ x: 768, y: 576 });
    });
});
