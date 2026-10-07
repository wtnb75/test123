import { describe, expect, it } from 'vitest';
import { placeFloatText } from './float';

// Screen 1024 x 768, margin 24, rise 70. A text 100 x 40 needs its center x in [74, 950]
// (24 + 50 .. 1024 - 24 - 50) and its center y in [114, 724] (24 + 20 + 70 .. 768 - 24 - 20).
const W = 100;
const H = 40;

describe('placeFloatText', () => {
    it('does not move a text that is well inside the screen', () => {
        expect(placeFloatText({ x: 512, y: 384 }, W, H)).toEqual({ x: 512, y: 384 });
    });

    it('pushes a text at the left edge in to 74 (half its width plus the margin)', () => {
        expect(placeFloatText({ x: 0, y: 384 }, W, H).x).toBe(74);
        expect(placeFloatText({ x: 73.9, y: 384 }, W, H).x).toBe(74);
    });

    it('keeps a text exactly on the allowed left and right limits', () => {
        expect(placeFloatText({ x: 74, y: 384 }, W, H).x).toBe(74);
        expect(placeFloatText({ x: 950, y: 384 }, W, H).x).toBe(950);
    });

    it('pushes a text at the right edge in to 950', () => {
        expect(placeFloatText({ x: 1024, y: 384 }, W, H).x).toBe(950);
        expect(placeFloatText({ x: 950.1, y: 384 }, W, H).x).toBe(950);
    });

    it('pushes a text at the top edge down to 114 so it still has the margin after rising 70 px', () => {
        expect(placeFloatText({ x: 512, y: 0 }, W, H).y).toBe(114);
        expect(placeFloatText({ x: 512, y: 113.9 }, W, H).y).toBe(114);
        expect(placeFloatText({ x: 512, y: 114 }, W, H).y).toBe(114);
    });

    it('pushes a text at the bottom edge up to 724 and keeps one exactly on the limit', () => {
        expect(placeFloatText({ x: 512, y: 768 }, W, H).y).toBe(724);
        expect(placeFloatText({ x: 512, y: 724 }, W, H).y).toBe(724);
        expect(placeFloatText({ x: 512, y: 724.1 }, W, H).y).toBe(724);
    });

    it('fits each axis independently (top-left corner)', () => {
        expect(placeFloatText({ x: 0, y: 0 }, W, H)).toEqual({ x: 74, y: 114 });
    });

    it('treats a text position beyond the screen like the nearest edge', () => {
        expect(placeFloatText({ x: -500, y: 2000 }, W, H)).toEqual({ x: 74, y: 724 });
    });

    it('puts a text too wide to fit at the horizontal center', () => {
        // width 1000: allowed x range is [524, 500], which is empty
        expect(placeFloatText({ x: 100, y: 384 }, 1000, H).x).toBe(512);
    });

    it('still places a text that fits in exactly one spot (height 650: y must be 24 + 325 + 70 = 419, not the center)', () => {
        expect(placeFloatText({ x: 512, y: 50 }, W, 650).y).toBe(419);
        expect(placeFloatText({ x: 512, y: 700 }, W, 650).y).toBe(419);
    });

    it('puts a text too tall to fit at the vertical center', () => {
        // height 700: allowed y range is [444, 394], which is empty
        expect(placeFloatText({ x: 512, y: 50 }, W, 700).y).toBe(384);
    });
});
