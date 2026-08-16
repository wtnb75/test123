import { describe, it, expect } from 'vitest';
import { createPrng } from './prng';

describe('createPrng', () => {
    it('produces the same sequence for the same seed', () => {
        const a = createPrng(42);
        const b = createPrng(42);
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    });

    it('produces a different first value for a different seed', () => {
        const a = createPrng(1);
        const b = createPrng(2);
        expect(a()).not.toBe(b());
    });

    it('returns values within [0, 1)', () => {
        const rng = createPrng(7);
        for (let i = 0; i < 200; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});
