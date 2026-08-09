import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';

describe('allocate validation', () => {
    it('throws when fewer than 2 candidates are given', () => {
        expect(() => allocate({ odds: [2.0], totalUnits: 5, unitPrice: 100 })).toThrow();
    });

    it('throws when an odds value is 1.0 or less', () => {
        expect(() => allocate({ odds: [1.0, 2.0], totalUnits: 5, unitPrice: 100 })).toThrow();
    });

    it('throws when an odds value is not finite', () => {
        expect(() => allocate({ odds: [Infinity, 2.0], totalUnits: 5, unitPrice: 100 })).toThrow();
    });

    it('throws when more than 20 candidates are given', () => {
        const odds = new Array(21).fill(2.0);
        expect(() => allocate({ odds, totalUnits: 21, unitPrice: 100 })).toThrow();
    });

    it('throws when totalUnits is less than the number of candidates', () => {
        expect(() => allocate({ odds: [1.5, 2.0, 3.0], totalUnits: 2, unitPrice: 100 })).toThrow();
    });

    it('throws when totalUnits is not a positive integer', () => {
        expect(() => allocate({ odds: [1.5, 2.0], totalUnits: 2.5, unitPrice: 100 })).toThrow();
        expect(() => allocate({ odds: [1.5, 2.0], totalUnits: 0, unitPrice: 100 })).toThrow();
    });

    it('throws when totalUnits exceeds the 100000 upper bound', () => {
        expect(() => allocate({ odds: [1.5, 2.0], totalUnits: 100001, unitPrice: 100 })).toThrow();
    });

    it('throws when unitPrice is below 100 or not a multiple of 100', () => {
        expect(() => allocate({ odds: [1.5, 2.0], totalUnits: 10, unitPrice: 50 })).toThrow();
        expect(() => allocate({ odds: [1.5, 2.0], totalUnits: 10, unitPrice: 150 })).toThrow();
    });

    it('throws when unitPrice is not an integer', () => {
        expect(() => allocate({ odds: [1.5, 2.0], totalUnits: 10, unitPrice: 150.5 })).toThrow();
    });
});

function bruteForceMinSpread(odds: number[], totalUnits: number, unitPrice: number): number {
    const n = odds.length;
    let best = Infinity;

    function recurse(index: number, remaining: number, units: number[]): void {
        if (index === n - 1) {
            const lastUnits = remaining;
            if (lastUnits < 1) {
                return;
            }
            const payouts = [...units, lastUnits].map((u, i) => u * odds[i] * unitPrice);
            const spread = Math.max(...payouts) - Math.min(...payouts);
            if (spread < best) {
                best = spread;
            }
            return;
        }
        const slotsLeft = n - index - 1;
        for (let u = 1; u <= remaining - slotsLeft; u += 1) {
            recurse(index + 1, remaining - u, [...units, u]);
        }
    }

    recurse(0, totalUnits, []);
    return best;
}

describe('allocate algorithm', () => {
    it('distributes units almost evenly when all odds are equal', () => {
        const result = allocate({ odds: [1.1, 1.1, 1.1, 1.1], totalUnits: 9, unitPrice: 100 });
        const units = result.candidates.map((c) => c.units);
        expect(Math.max(...units) - Math.min(...units)).toBeLessThanOrEqual(1);
        expect(units.reduce((sum, u) => sum + u, 0)).toBe(9);
    });

    it('gives every candidate at least 1 unit', () => {
        const result = allocate({ odds: [1.5, 2.0, 50.0], totalUnits: 5, unitPrice: 100 });
        expect(result.candidates.every((c) => c.units >= 1)).toBe(true);
    });

    it('keeps sum(units) === totalUnits even with skewed odds', () => {
        const result = allocate({ odds: [1.01, 3.0, 200.0], totalUnits: 30, unitPrice: 100 });
        const total = result.candidates.reduce((sum, c) => sum + c.units, 0);
        expect(total).toBe(30);
    });

    it('gives every candidate exactly 1 unit when totalUnits equals candidate count', () => {
        const result = allocate({ odds: [1.2, 3.4, 5.6], totalUnits: 3, unitPrice: 100 });
        expect(result.candidates.every((c) => c.units === 1)).toBe(true);
    });

    it('breaks ties by preferring the lowest index', () => {
        const result = allocate({ odds: [2.0, 2.0], totalUnits: 3, unitPrice: 100 });
        expect(result.candidates[0].units).toBe(2);
        expect(result.candidates[1].units).toBe(1);
    });

    it('computes payout, totalInvestment and returnRate correctly', () => {
        const result = allocate({ odds: [2.0, 2.0], totalUnits: 4, unitPrice: 100 });
        expect(result.totalInvestment).toBe(400);
        expect(result.candidates[0].payout).toBe(400);
        expect(result.candidates[0].returnRate).toBeCloseTo(1.0, 6);
        expect(result.minPayout).toBe(400);
        expect(result.maxPayout).toBe(400);
        expect(result.spread).toBe(0);
    });

    it('matches the brute-force minimal spread for small candidate counts', () => {
        const cases = [
            { odds: [1.5, 2.3, 5.0], totalUnits: 10, unitPrice: 100 },
            { odds: [1.1, 1.1, 1.1, 1.1], totalUnits: 9, unitPrice: 100 },
            { odds: [2.0, 100.0], totalUnits: 6, unitPrice: 100 }
        ];

        for (const testCase of cases) {
            const result = allocate(testCase);
            const expected = bruteForceMinSpread(testCase.odds, testCase.totalUnits, testCase.unitPrice);
            expect(result.spread).toBeCloseTo(expected, 6);
        }
    });
});
