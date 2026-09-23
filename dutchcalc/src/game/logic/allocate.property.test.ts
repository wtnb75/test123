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

    // Known gap, found by comparing with brute force: with 3 or more candidates about 5-8% of
    // random inputs end up with a larger spread than the best split (for example odds
    // [40.1, 20.9, 7.1] with 11 units gives spread 2260 instead of 1670), because the refinement
    // only ever tries moving a unit from the highest to the lowest payout.
    it.todo('finds the minimum spread for three or more candidates');
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
