import { describe, expect, it } from 'vitest';
import { between, dateToYmd, mulberry32, seedFor, shuffle } from './random';

describe('mulberry32', () => {
    it('yields the same sequence for the same seed', () => {
        const a = mulberry32(12345);
        const b = mulberry32(12345);
        for (let i = 0; i < 20; i++) expect(a()).toBe(b());
    });

    it('yields a different sequence for a different seed', () => {
        const a = Array.from({ length: 5 }, mulberry32(1));
        const b = Array.from({ length: 5 }, mulberry32(2));
        expect(a).not.toEqual(b);
    });

    it('stays within [0, 1)', () => {
        const rng = mulberry32(99);
        for (let i = 0; i < 5000; i++) {
            const v = rng();
            if (v < 0 || v >= 1) expect.fail(`out of range: ${v} at ${i}`);
        }
    });
});

describe('seedFor', () => {
    it('is deterministic for the same (date, set, stage)', () => {
        expect(seedFor(20261006, 3, 2)).toBe(seedFor(20261006, 3, 2));
    });

    it('does not collide when set number and stage are swapped', () => {
        expect(seedFor(20261006, 1, 2)).not.toBe(seedFor(20261006, 2, 1));
    });

    it('gives a distinct seed to every (date, set, stage) in a realistic grid', () => {
        const seen = new Set<number>();
        let count = 0;
        for (const d of [20261006, 20261007, 20270101]) {
            for (let n = 1; n <= 30; n++) {
                for (let s = 1; s <= 5; s++) {
                    seen.add(seedFor(d, n, s));
                    count++;
                }
            }
        }
        expect(seen.size).toBe(count);
    });

    it('does not collide when only the date differs', () => {
        expect(seedFor(20261006, 1, 1)).not.toBe(seedFor(20261007, 1, 1));
    });
});

describe('dateToYmd', () => {
    it('packs a local date as YYYYMMDD', () => {
        expect(dateToYmd(new Date(2026, 9, 6))).toBe(20261006);
    });

    it('zero-pads month and day via the arithmetic packing', () => {
        expect(dateToYmd(new Date(2027, 0, 1))).toBe(20270101);
    });
});

describe('between', () => {
    it('maps the unit interval onto [min, max)', () => {
        expect(between(() => 0, 10, 20)).toBe(10);
        expect(between(() => 0.5, 10, 20)).toBe(15);
    });
});

describe('shuffle', () => {
    it('returns a permutation and leaves the input untouched', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8];
        const out = shuffle(input, mulberry32(7));
        expect([...out].sort((a, b) => a - b)).toEqual(input);
        expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('is deterministic for the same seed and actually reorders for some seed', () => {
        const input = Array.from({ length: 10 }, (_, i) => i);
        expect(shuffle(input, mulberry32(3))).toEqual(shuffle(input, mulberry32(3)));
        const reordered = [1, 2, 3, 4, 5].some((seed) => shuffle(input, mulberry32(seed)).join() !== input.join());
        expect(reordered).toBe(true);
    });

    it('handles empty and single-element arrays', () => {
        expect(shuffle([], mulberry32(1))).toEqual([]);
        expect(shuffle(['x'], mulberry32(1))).toEqual(['x']);
    });
});
