import { describe, expect, it } from 'vitest';
import { combineScroll, edgeDelta, edgeDir, isDrag, keyDelta } from './scroll';

describe('combineScroll', () => {
    const at = { x: 500, y: 400 };

    it('adds key, edge and drag deltas to the current position', () => {
        const key = keyDelta(false, true, false, true, 500); // (+350, +350)
        const edge = edgeDelta({ x: 979, y: 384 }, 500); // (+150, 0)
        const drag = { x: -20, y: 30 };
        expect(combineScroll(at, key, edge, drag)).toEqual({ x: 980, y: 780 });
    });

    it('lets opposite sources cancel out', () => {
        expect(combineScroll(at, { x: 100, y: 0 }, { x: -100, y: 0 })).toEqual(at);
    });

    it('stays put with no deltas', () => {
        expect(combineScroll(at)).toEqual(at);
    });

    it('clamps the sum to the board, not each delta on its own', () => {
        // 1500 + 30 + 30 would pass the right limit 1536 only after the second delta
        expect(combineScroll({ x: 1500, y: 400 }, { x: 30, y: 0 }, { x: 30, y: 0 })).toEqual({ x: 1536, y: 400 });
        expect(combineScroll({ x: 10, y: 5 }, { x: -50, y: -50 })).toEqual({ x: 0, y: 0 });
    });

    it('lets a later delta pull back a position that an earlier one pushed beyond the limit', () => {
        // only the sum matters: 1536 + 100 - 100 is still inside
        expect(combineScroll({ x: 1536, y: 0 }, { x: 100, y: 0 }, { x: -100, y: 0 })).toEqual({ x: 1536, y: 0 });
    });
});

describe('isDrag', () => {
    it('treats a movement just under the threshold as a tap', () => {
        expect(isDrag(9.99, 0)).toBe(false);
    });

    it('treats exactly 10 px as a drag', () => {
        expect(isDrag(10, 0)).toBe(true);
        expect(isDrag(0, -10)).toBe(true);
    });

    it('measures the straight-line distance (6-8-10 triangle is exactly 10)', () => {
        expect(isDrag(6, 8)).toBe(true);
        expect(isDrag(6, 7.9)).toBe(false);
    });

    it('is not a drag when nothing moved', () => {
        expect(isDrag(0, 0)).toBe(false);
    });
});

describe('keyDelta', () => {
    it('moves 700 px in one second for a single key', () => {
        expect(keyDelta(false, true, false, false, 1000)).toEqual({ x: 700, y: 0 });
        expect(keyDelta(true, false, false, false, 1000)).toEqual({ x: -700, y: 0 });
        expect(keyDelta(false, false, true, false, 1000)).toEqual({ x: 0, y: -700 });
        expect(keyDelta(false, false, false, true, 1000)).toEqual({ x: 0, y: 700 });
    });

    it('scales with the frame time', () => {
        expect(keyDelta(false, true, false, false, 500).x).toBe(350);
        expect(keyDelta(false, true, false, false, 16).x).toBeCloseTo(11.2, 10);
    });

    it('does not normalize diagonals: each axis moves at full speed', () => {
        expect(keyDelta(false, true, false, true, 500)).toEqual({ x: 350, y: 350 });
    });

    it('cancels opposite keys on the same axis', () => {
        expect(keyDelta(true, true, true, true, 1000)).toEqual({ x: 0, y: 0 });
    });

    it('does nothing with no keys', () => {
        expect(keyDelta(false, false, false, false, 1000)).toEqual({ x: 0, y: 0 });
    });
});

describe('edgeDir', () => {
    it('is zero away from every edge', () => {
        expect(edgeDir({ x: 512, y: 384 })).toEqual({ x: 0, y: 0 });
    });

    it('is zero exactly at the inner border of the 90 px zone', () => {
        expect(edgeDir({ x: 90, y: 384 }).x).toBe(0);
        expect(edgeDir({ x: 934, y: 384 }).x).toBe(0);
        expect(edgeDir({ x: 512, y: 90 }).y).toBe(0);
        expect(edgeDir({ x: 512, y: 678 }).y).toBe(0);
    });

    it('is -1 / +1 at the canvas edges', () => {
        expect(edgeDir({ x: 0, y: 384 }).x).toBe(-1);
        expect(edgeDir({ x: 1024, y: 384 }).x).toBe(1);
        expect(edgeDir({ x: 512, y: 0 }).y).toBe(-1);
        expect(edgeDir({ x: 512, y: 768 }).y).toBe(1);
    });

    it('grows linearly: half way through the zone is +-0.5', () => {
        expect(edgeDir({ x: 45, y: 384 }).x).toBe(-0.5);
        expect(edgeDir({ x: 979, y: 384 }).x).toBe(0.5);
        expect(edgeDir({ x: 512, y: 45 }).y).toBe(-0.5);
        expect(edgeDir({ x: 512, y: 723 }).y).toBe(0.5);
    });

    it('stays within -1..1 for a position outside the canvas', () => {
        expect(edgeDir({ x: -50, y: 900 })).toEqual({ x: -1, y: 1 });
        expect(edgeDir({ x: 1100, y: -20 })).toEqual({ x: 1, y: -1 });
    });

    it('works on each axis independently (corners)', () => {
        expect(edgeDir({ x: 0, y: 0 })).toEqual({ x: -1, y: -1 });
        expect(edgeDir({ x: 1024, y: 768 })).toEqual({ x: 1, y: 1 });
        expect(edgeDir({ x: 0, y: 384 })).toEqual({ x: -1, y: 0 });
    });
});

describe('edgeDelta', () => {
    it('moves at 600 px/s at the edge', () => {
        expect(edgeDelta({ x: 0, y: 384 }, 1000)).toEqual({ x: -600, y: 0 });
    });

    it('moves at half speed half way through the zone', () => {
        expect(edgeDelta({ x: 979, y: 384 }, 500)).toEqual({ x: 150, y: 0 });
    });

    it('does not move in the middle of the canvas', () => {
        expect(edgeDelta({ x: 512, y: 384 }, 1000)).toEqual({ x: 0, y: 0 });
    });
});
