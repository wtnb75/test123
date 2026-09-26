import { describe, expect, it } from 'vitest';
import { volleyAngles } from './patterns';

const from = { x: 100, y: 100 };
const below = { x: 100, y: 300 };

describe('volleyAngles', () => {
    it('fires one grunt bullet straight at the target', () => {
        const a = volleyAngles('grunt', from, below);
        expect(a).toHaveLength(1);
        expect(a[0]).toBeCloseTo(Math.PI / 2);
    });

    it('fires a shooter 3-way spread at ±15° around the aim', () => {
        const a = volleyAngles('shooter', from, below);
        expect(a).toHaveLength(3);
        expect(a[0]).toBeCloseTo(Math.PI / 2 - Math.PI / 12);
        expect(a[1]).toBeCloseTo(Math.PI / 2);
        expect(a[2]).toBeCloseTo(Math.PI / 2 + Math.PI / 12);
    });

    it('fires a heavy ring of 8 bullets 45° apart starting at 0 regardless of the target', () => {
        const a = volleyAngles('heavy', from, below);
        expect(a).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => (Math.PI * 2 * i) / 8));
    });

    it('fires nothing for a rammer', () => {
        expect(volleyAngles('rammer', from, below)).toEqual([]);
    });
});
