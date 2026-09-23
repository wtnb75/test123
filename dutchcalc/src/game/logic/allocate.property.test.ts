import { describe, expect, it } from 'vitest';
import { allocate, MAX_CANDIDATES, MAX_TOTAL_UNITS, MIN_CANDIDATES, type AllocateInput } from './allocate';

// Seeded so every run sees the same inputs.
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const randomInput = (seed: number): AllocateInput => {
    const rng = lcg(seed);
    const count = MIN_CANDIDATES + Math.floor(rng() * 7);
    const odds = Array.from({ length: count }, () => Math.round((1.05 + rng() * rng() * 80) * 100) / 100);
    const totalUnits = count + Math.floor(rng() * 60);
    const unitPrice = [100, 200, 500, 1000][Math.floor(rng() * 4)];

    return { odds, totalUnits, unitPrice };
};

describe('allocate invariants on random inputs', () => {
    it('always returns a complete, consistent allocation', () => {
        for (let seed = 1; seed <= 600; seed += 1) {
            const input = randomInput(seed);
            const snapshot = structuredClone(input);
            const result = allocate(input);
            const where = `seed=${seed} ${JSON.stringify(input)}`;

            expect(input, `${where} mutated its input`).toEqual(snapshot);
            expect(result.candidates.map((c) => c.odds), `${where} odds order`).toEqual(input.odds);

            const units = result.candidates.map((c) => c.units);
            expect(units.every((u) => Number.isInteger(u) && u >= 1), `${where} units ${units}`).toBe(true);
            expect(
                units.reduce((sum, u) => sum + u, 0),
                `${where} unit total`
            ).toBe(input.totalUnits);

            expect(result.totalInvestment, where).toBe(input.totalUnits * input.unitPrice);
            const payouts = result.candidates.map((c, i) => units[i] * input.odds[i] * input.unitPrice);
            result.candidates.forEach((c, i) => {
                expect(c.payout, `${where} payout ${i}`).toBeCloseTo(payouts[i], 6);
                expect(c.returnRate, `${where} returnRate ${i}`).toBeCloseTo(payouts[i] / result.totalInvestment, 9);
            });
            expect(result.minPayout, where).toBeCloseTo(Math.min(...payouts), 6);
            expect(result.maxPayout, where).toBeCloseTo(Math.max(...payouts), 6);
            expect(result.spread, where).toBeCloseTo(Math.max(...payouts) - Math.min(...payouts), 6);
            expect(result.spread, where).toBeGreaterThanOrEqual(0);
        }
    });

    it('is deterministic for the same input', () => {
        for (let seed = 1; seed <= 50; seed += 1) {
            const input = randomInput(seed);

            expect(allocate(input), `seed=${seed}`).toEqual(allocate(input));
        }
    });

    it('never returns a worse spread than giving every candidate an equal share', () => {
        // Equal shares (remainder to the first candidates) is an obvious allocation anyone could pick.
        for (let seed = 1; seed <= 600; seed += 1) {
            const input = randomInput(seed);
            const base = Math.floor(input.totalUnits / input.odds.length);
            const extra = input.totalUnits % input.odds.length;
            const payouts = input.odds.map((o, i) => (base + (i < extra ? 1 : 0)) * o * input.unitPrice);
            const equalShareSpread = Math.max(...payouts) - Math.min(...payouts);

            expect(allocate(input).spread, `seed=${seed} ${JSON.stringify(input)}`).toBeLessThanOrEqual(equalShareSpread + 1e-6);
        }
    });
});

// For exactly two candidates the heuristic has no room to go wrong: compare with every split.
const bestTwoWaySpread = (odds: number[], totalUnits: number, unitPrice: number): number => {
    let best = Infinity;
    for (let first = 1; first < totalUnits; first += 1) {
        const a = first * odds[0] * unitPrice;
        const b = (totalUnits - first) * odds[1] * unitPrice;
        best = Math.min(best, Math.abs(a - b));
    }

    return best;
};

// Every way to split `totalUnits` into at least one unit per candidate: the smallest spread, and
// among the splits reaching it the highest minimum payout.
const bruteForceOptimum = (
    odds: number[],
    totalUnits: number,
    unitPrice: number
): { spread: number; minPayout: number } => {
    const best = { spread: Infinity, minPayout: -Infinity };
    const recurse = (index: number, remaining: number, payouts: number[]): void => {
        if (index === odds.length - 1) {
            const all = [...payouts, remaining * odds[index] * unitPrice];
            const spread = Math.max(...all) - Math.min(...all);
            const minPayout = Math.min(...all);
            if (spread < best.spread - 1e-6) {
                best.spread = spread;
                best.minPayout = minPayout;
            } else if (Math.abs(spread - best.spread) <= 1e-6 && minPayout > best.minPayout) {
                best.minPayout = minPayout;
            }
            return;
        }
        for (let units = 1; units <= remaining - (odds.length - index - 1); units += 1) {
            recurse(index + 1, remaining - units, [...payouts, units * odds[index] * unitPrice]);
        }
    };
    recurse(0, totalUnits, []);

    return best;
};

describe('allocate optimality', () => {
    it('finds the minimum spread for every two-candidate input tried', () => {
        for (let seed = 1; seed <= 400; seed += 1) {
            const rng = lcg(seed * 7919);
            const odds = [1.05 + rng() * 60, 1.05 + rng() * 60].map((o) => Math.round(o * 100) / 100);
            const totalUnits = 2 + Math.floor(rng() * 80);
            const result = allocate({ odds, totalUnits, unitPrice: 100 });

            expect(result.spread, `seed=${seed} odds=${odds} total=${totalUnits}`).toBeCloseTo(
                bestTwoWaySpread(odds, totalUnits, 100),
                6
            );
        }
    });

    // Regression: the old greedy + "move from max to min" refinement missed these optima.
    it.each([
        [[7, 1.2, 6.1], 10, 350],
        [[18.3, 3, 21.5], 13, 1470],
        [[40.1, 20.9, 7.1], 11, 1670],
        [[47.7, 8.8, 12.6], 12, 1390],
        [[33.7, 5.9, 18.5], 11, 1350]
    ])('finds the minimum spread for odds %j with %i units', (odds, totalUnits, expectedSpread) => {
        expect(allocate({ odds, totalUnits, unitPrice: 100 }).spread).toBeCloseTo(expectedSpread, 6);
    });

    it('finds the minimum spread, preferring the highest minimum payout, for three to five candidates', () => {
        for (let seed = 1; seed <= 1500; seed += 1) {
            const rng = lcg(seed * 104729);
            const count = 3 + Math.floor(rng() * 3);
            const odds = Array.from({ length: count }, () => Math.round((1.1 + rng() * rng() * 60) * 10) / 10);
            const totalUnits = count + Math.floor(rng() * 14);
            const unitPrice = [100, 300][seed % 2];
            const result = allocate({ odds, totalUnits, unitPrice });
            const optimum = bruteForceOptimum(odds, totalUnits, unitPrice);
            const where = `seed=${seed} odds=${odds} total=${totalUnits}`;

            expect(result.spread, where).toBeCloseTo(optimum.spread, 6);
            // Among equally tight splits, the one that guarantees the highest payout wins.
            expect(result.minPayout, where).toBeCloseTo(optimum.minPayout, 6);
        }
    });

    it('handles the largest supported input (20 candidates, 100000 units)', () => {
        const odds = Array.from({ length: MAX_CANDIDATES }, (_, i) => 1.5 + i * 0.7);
        const result = allocate({ odds, totalUnits: MAX_TOTAL_UNITS, unitPrice: 100 });

        expect(result.candidates.reduce((sum, c) => sum + c.units, 0)).toBe(MAX_TOTAL_UNITS);
        // With this many units the payouts are almost perfectly level.
        expect(result.spread / result.maxPayout).toBeLessThan(1e-3);
    });
});

describe('allocate input boundaries', () => {
    const base: AllocateInput = { odds: [1.5, 2.0], totalUnits: 10, unitPrice: 100 };

    it('accepts the smallest and largest candidate counts', () => {
        expect(() => allocate({ ...base, odds: new Array(MIN_CANDIDATES).fill(2.0) })).not.toThrow();
        expect(() =>
            allocate({ ...base, odds: new Array(MAX_CANDIDATES).fill(2.0), totalUnits: MAX_CANDIDATES })
        ).not.toThrow();
    });

    it('accepts exactly one unit per candidate and the maximum total units', () => {
        expect(allocate({ ...base, totalUnits: 2 }).candidates.map((c) => c.units)).toEqual([1, 1]);
        const largest = allocate({ ...base, totalUnits: MAX_TOTAL_UNITS });
        expect(largest.candidates.reduce((sum, c) => sum + c.units, 0)).toBe(MAX_TOTAL_UNITS);
    });

    it('accepts the smallest valid odds and unit price', () => {
        expect(() => allocate({ ...base, odds: [1.01, 1.01], unitPrice: 100 })).not.toThrow();
    });

    it.each([
        ['NaN odds', { ...base, odds: [Number.NaN, 2.0] }],
        ['negative odds', { ...base, odds: [-2.0, 2.0] }],
        ['negative total units', { ...base, totalUnits: -5 }],
        ['NaN total units', { ...base, totalUnits: Number.NaN }],
        ['zero unit price', { ...base, unitPrice: 0 }],
        ['negative unit price', { ...base, unitPrice: -100 }],
        ['no candidates', { ...base, odds: [] }],
        ['candidate count over the limit', { ...base, odds: new Array(MAX_CANDIDATES + 1).fill(2.0), totalUnits: 50 }]
    ])('rejects %s', (_name, input) => {
        expect(() => allocate(input)).toThrow();
    });
});
