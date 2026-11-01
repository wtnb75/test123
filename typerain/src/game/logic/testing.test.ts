import { describe, expect, it } from 'vitest';
import { seededRng, seqRng } from './testing';

describe('seqRng', () => {
    it('returns the scripted numbers in order, then the fallback forever', () => {
        const rng = seqRng([0.1, 0.9], 0.5);
        expect([rng(), rng(), rng(), rng()]).toEqual([0.1, 0.9, 0.5, 0.5]);
    });

    it('falls back to 0 when no fallback is given', () => {
        expect(seqRng([])()).toBe(0);
    });
});

describe('seededRng', () => {
    it('repeats the same numbers for the same seed, all inside [0, 1)', () => {
        const a = seededRng(42);
        const b = seededRng(42);
        for (let i = 0; i < 100; i++) {
            const x = a();
            expect(x).toBe(b());
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(1);
        }
    });

    it('gives different numbers for different seeds', () => {
        expect(seededRng(1)()).not.toBe(seededRng(2)());
    });
});
