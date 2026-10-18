import { describe, it, expect } from 'vitest';
import { polylineLength, polylinePointAt } from './polyline';

const TRIANGLE = [
    { x: 0, y: 0 },
    { x: 3, y: 4 },
    { x: 3, y: 10 }
];

describe('polylineLength', () => {
    it('sums the segment lengths (5 + 6 = 11)', () => {
        expect(polylineLength(TRIANGLE)).toBe(11);
    });

    it('is 0 for a single point', () => {
        expect(polylineLength([{ x: 7, y: 7 }])).toBe(0);
    });
});

describe('polylinePointAt', () => {
    it('returns the first point at ratio 0 and the last point at ratio 1', () => {
        expect(polylinePointAt(TRIANGLE, 0)).toEqual({ x: 0, y: 0 });
        expect(polylinePointAt(TRIANGLE, 1)).toEqual({ x: 3, y: 10 });
    });

    it('returns the corner at the arc-length ratio 5/11', () => {
        const p = polylinePointAt(TRIANGLE, 5 / 11);
        expect(p.x).toBeCloseTo(3, 9);
        expect(p.y).toBeCloseTo(4, 9);
    });

    it('returns a point 3 units into the second segment at ratio 8/11', () => {
        const p = polylinePointAt(TRIANGLE, 8 / 11);
        expect(p.x).toBeCloseTo(3, 9);
        expect(p.y).toBeCloseTo(7, 9);
    });

    it('clamps ratios outside 0-1', () => {
        expect(polylinePointAt(TRIANGLE, -0.5)).toEqual({ x: 0, y: 0 });
        expect(polylinePointAt(TRIANGLE, 2)).toEqual({ x: 3, y: 10 });
    });

    it('does not throw for a single point or a zero-length polyline', () => {
        expect(polylinePointAt([{ x: 1, y: 2 }], 0.5)).toEqual({ x: 1, y: 2 });
        expect(
            polylinePointAt(
                [
                    { x: 4, y: 4 },
                    { x: 4, y: 4 }
                ],
                0.5
            )
        ).toEqual({ x: 4, y: 4 });
    });

    it('skips a zero-length leading segment without dividing by zero', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 10, y: 0 }
        ];
        expect(polylinePointAt(points, 0)).toEqual({ x: 0, y: 0 });
        expect(polylinePointAt(points, 0.5)).toEqual({ x: 5, y: 0 });
    });
});
