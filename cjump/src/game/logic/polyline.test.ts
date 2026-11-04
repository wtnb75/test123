import { describe, it, expect } from 'vitest';
import { polylineLength } from './polyline';

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
