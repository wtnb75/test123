import { describe, expect, it } from 'vitest';
import { arrowFor, isInView, type View } from './arrow';

// A view whose center is (1512, 884). The arrow rectangle is 40 px inside: half sizes 472 x 344.
const view: View = { x: 1000, y: 500, w: 1024, h: 768 };

describe('isInView', () => {
    it('counts the border as inside', () => {
        expect(isInView({ x: 1000, y: 500 }, view)).toBe(true);
        expect(isInView({ x: 2024, y: 1268 }, view)).toBe(true);
    });

    it('is outside just beyond any edge', () => {
        expect(isInView({ x: 999.9, y: 800 }, view)).toBe(false);
        expect(isInView({ x: 2024.1, y: 800 }, view)).toBe(false);
        expect(isInView({ x: 1500, y: 499.9 }, view)).toBe(false);
        expect(isInView({ x: 1500, y: 1268.1 }, view)).toBe(false);
    });
});

describe('arrowFor', () => {
    it('gives no arrow for a target in view, including on the border', () => {
        expect(arrowFor({ x: 1500, y: 800 }, view)).toBeNull();
        expect(arrowFor({ x: 1000, y: 500 }, view)).toBeNull();
    });

    it('points right from the right edge of the inset rectangle', () => {
        const a = arrowFor({ x: 3000, y: 884 }, view)!;
        expect(a.x).toBeCloseTo(984, 9);
        expect(a.y).toBeCloseTo(384, 9);
        expect(a.angle).toBeCloseTo(0, 9);
    });

    it('points left from the left edge', () => {
        const a = arrowFor({ x: 0, y: 884 }, view)!;
        expect(a.x).toBeCloseTo(40, 9);
        expect(a.y).toBeCloseTo(384, 9);
        expect(Math.abs(a.angle)).toBeCloseTo(Math.PI, 9);
    });

    it('points up from the top edge', () => {
        const a = arrowFor({ x: 1512, y: -500 }, view)!;
        expect(a.x).toBeCloseTo(512, 9);
        expect(a.y).toBeCloseTo(40, 9);
        expect(a.angle).toBeCloseTo(-Math.PI / 2, 9);
    });

    it('points down from the bottom edge', () => {
        const a = arrowFor({ x: 1512, y: 3000 }, view)!;
        expect(a.x).toBeCloseTo(512, 9);
        expect(a.y).toBeCloseTo(728, 9);
        expect(a.angle).toBeCloseTo(Math.PI / 2, 9);
    });

    it('cuts a 45 degree line at the nearer edge of the inset rectangle (bottom, not right)', () => {
        const a = arrowFor({ x: 3512, y: 2884 }, view)!;
        expect(a.x).toBeCloseTo(856, 9);
        expect(a.y).toBeCloseTo(728, 9);
        expect(a.angle).toBeCloseTo(Math.PI / 4, 9);
    });

    it('lies on the line from the view center to the target (hand-worked: dx 988, dy 616)', () => {
        const a = arrowFor({ x: 2500, y: 1500 }, view)!;
        expect(a.x).toBeCloseTo(984, 9);
        expect(a.y).toBeCloseTo(384 + (616 * 472) / 988, 9);
        expect(a.angle).toBeCloseTo(Math.atan2(616, 988), 9);
    });

    it('still gives an arrow for a target one pixel outside the view', () => {
        const a = arrowFor({ x: 2025, y: 884 }, view)!;
        expect(a.x).toBeCloseTo(984, 9);
        expect(a.y).toBeCloseTo(384, 9);
    });
});
