import { afterEach, describe, expect, it } from 'vitest';
import {
    DIFFICULTY_TABLE,
    MAX_GENERATION_ATTEMPTS,
    OPERATION_POOL,
    WIN_COUNT_RANGES,
    countWinningSequences,
    createTurnSlots,
    findShortestSolutionFromOptions,
    generateProblem,
    getDifficulty,
    getWinCountRange,
    winCountDistance,
    type Operation,
} from './logic';

const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const op = (label: string): Operation => {
    const found = OPERATION_POOL.find((o) => o.label === label);
    if (!found) throw new Error(`unknown operation ${label}`);
    return found;
};
const turn = (...labels: string[]): Operation[] => labels.map(op);

/** Oracle: evaluates every one of the 5^n selections and keeps the distinct prefixes that first hit the target. */
function bruteForce(initial: number, target: number, turns: Operation[][]): number {
    const seen = new Set<string>();
    const walk = (i: number, value: number, prefix: number[]): void => {
        if (i === turns.length) return;
        for (let c = 0; c <= turns[i].length; c++) {
            const next = c < turns[i].length ? turns[i][c].apply(value) : value;
            const choice = [...prefix, c];
            if (next === target) seen.add(choice.join(','));
            else walk(i + 1, next, choice);
        }
    };
    walk(0, initial, []);
    return seen.size;
}

describe('countWinningSequences: the hand-worked examples of the spec', () => {
    it('counts only +2 for one turn {+1, +2, +5, +10}', () => {
        expect(countWinningSequences(3, 5, [turn('+1', '+2', '+5', '+10')])).toBe(1);
    });

    it('counts (+2), (+1, +1) and (skip, +2) for two turns {+2, +1, +5, +10} each, not the 5 second choices after +2', () => {
        const t = turn('+2', '+1', '+5', '+10');
        expect(countWinningSequences(3, 5, [t, t])).toBe(3);
    });

    it('counts (-1, -2) and (-2, -1) from 8 to 5 for {-1, -2, +5, x2} then {-2, -1, +1, +2}', () => {
        expect(countWinningSequences(8, 5, [turn('-1', '-2', '+5', '×2'), turn('-2', '-1', '+1', '+2')])).toBe(2);
    });

    it('counts every first-turn choice that leaves the value on the target when initial equals target (0: skip, x2, x3, x5, /2)', () => {
        expect(countWinningSequences(0, 0, [turn('×2', '×3', '×5', '/2')])).toBe(5);
        expect(countWinningSequences(0, 0, [turn('+1', '+2', '×2', '/2')])).toBe(3); // skip, x2, /2 stay on 0
    });

    it('is 0 when the target cannot be reached', () => {
        expect(countWinningSequences(3, 500, [turn('+1', '+2', '+5', '+10')])).toBe(0);
    });

    it('counts the skip of the first turn when the initial value already equals the target', () => {
        // Only the skip keeps the value at 5; +1/+2/+5/+10 move it away and (no subtraction) never come back.
        expect(countWinningSequences(5, 5, [turn('+1', '+2', '+5', '+10')])).toBe(1);
        // With -1 and +1 available a later turn can also return to 5: skip, (-1, +1) and (+1, -1) win.
        expect(countWinningSequences(5, 5, [turn('-1', '+1', '+2', '+5'), turn('+1', '-1', '+2', '+5')])).toBe(3);
    });
});

describe('countWinningSequences against a brute-force oracle', () => {
    it('matches on random small problems, including ones where different choices give the same value', () => {
        const rng = seeded(99);
        let hits = 0;
        let coincide = 0;
        for (let n = 0; n < 400; n++) {
            const turnCount = 1 + Math.floor(rng() * 5);
            const slots = createTurnSlots(turnCount, OPERATION_POOL, rng);
            const turns = slots.map((s) => s.options);
            const initial = Math.floor(rng() * 5); // 0..4: ×2/×3/×5 of 0 and /2, /3 of small values coincide with skip
            const target = Math.floor(rng() * 40);
            const want = bruteForce(initial, target, turns);
            if (want > 0) hits++;
            if (turns.some((t) => new Set([...t.map((o) => o.apply(0)), 0]).size < t.length + 1)) coincide++;
            expect(countWinningSequences(initial, target, turns)).toBe(want);
        }
        expect(hits).toBeGreaterThan(100);
        expect(coincide).toBeGreaterThan(20);
    });

    it('counts different choices with the same result as different sequences (value 0: skip and x2 and x3)', () => {
        // From 0, every multiplication and the skip keep 0; only +5 reaches 5. Choices: x2, x3, x5 (0), skip (0), +5 (5).
        expect(countWinningSequences(0, 5, [turn('×2', '×3', '×5', '+5')])).toBe(1);
        // Two turns: (+5) wins at turn 1; (x2|x3|x5|skip, +5) wins at turn 2 - four different first choices.
        expect(countWinningSequences(0, 5, [turn('×2', '×3', '×5', '+5'), turn('+5', '+1', '+2', '+10')])).toBe(5);
    });
});

describe('winCountDistance and the ranges', () => {
    const range = { min: 50, max: 800 };

    it('is 0 from the lower bound to the upper bound, bounds included', () => {
        for (const c of [50, 51, 400, 799, 800]) expect(winCountDistance(c, range)).toBe(0);
    });

    it('measures by the log ratio just outside the range', () => {
        expect(winCountDistance(49, range)).toBeCloseTo(Math.log(50 / 49), 12);
        expect(winCountDistance(801, range)).toBeCloseTo(Math.log(801 / 800), 12);
        expect(winCountDistance(25, range)).toBeCloseTo(Math.log(2), 12);
        expect(winCountDistance(1600, range)).toBeCloseTo(Math.log(2), 12);
    });

    it('gives the per-level ranges of the spec, and the Lv.5 range for every later level', () => {
        expect(WIN_COUNT_RANGES).toEqual([
            { min: 500000, max: 2200000 },
            { min: 6000, max: 42000 },
            { min: 500, max: 5500 },
            { min: 50, max: 800 },
            { min: 15, max: 480 },
        ]);
        expect([1, 2, 3, 4, 5].map((l) => getWinCountRange(l))).toEqual(WIN_COUNT_RANGES);
        expect(getWinCountRange(6)).toEqual({ min: 15, max: 480 });
        expect(getWinCountRange(99)).toEqual({ min: 15, max: 480 });
        expect(getWinCountRange(0)).toEqual({ min: 500000, max: 2200000 }); // never used, but safe
    });
});

describe('generateProblem', () => {
    const replay = (path: ReturnType<typeof findShortestSolutionFromOptions>, initial: number): number => {
        let v = initial;
        for (const e of path ?? []) v = e.operation === null ? v : e.operation.apply(v);
        return v;
    };

    it.each([1, 2, 3, 4, 5, 6, 9])('level %i: gives a solvable problem within the level table and the win-count range', (level) => {
        const rng = seeded(level * 1000 + 3);
        const diff = getDifficulty(level);
        const range = getWinCountRange(level);
        for (let n = 0; n < 12; n++) {
            const p = generateProblem(level, rng);
            expect(p.slots).toHaveLength(diff.maxTurns);
            expect(p.initialValue).toBeGreaterThanOrEqual(diff.initialValueMin);
            expect(p.initialValue).toBeLessThanOrEqual(diff.initialValueMax);
            expect(p.targetValue).toBeGreaterThanOrEqual(diff.targetMin);
            expect(p.targetValue).toBeLessThanOrEqual(diff.targetMax);
            expect(p.slots.every((s) => s.selected === null && s.options.length === 4)).toBe(true);
            const count = countWinningSequences(p.initialValue, p.targetValue, p.slots.map((s) => s.options));
            expect(count).toBeGreaterThanOrEqual(range.min);
            expect(count).toBeLessThanOrEqual(range.max);
            expect(replay(p.shortestPath, p.initialValue)).toBe(p.targetValue);
        }
    });

    it('is deterministic for the same random numbers', () => {
        expect(generateProblem(4, seeded(5))).toEqual(generateProblem(4, seeded(5)));
    });

    describe('when no attempt lands in the range', () => {
        const saved = [...WIN_COUNT_RANGES];
        afterEach(() => {
            saved.forEach((r, i) => {
                WIN_COUNT_RANGES[i] = r;
            });
        });

        it('takes the solvable problem closest to the range in log terms, the earlier one on a tie', () => {
            WIN_COUNT_RANGES[3] = { min: 1e12, max: 2e12 }; // out of reach: every solvable attempt is below the range
            const diff = getDifficulty(4);
            // Replay the attempts with the same random numbers (value, target, then the options of every turn).
            const rng = seeded(21);
            const between = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
            let best: { count: number; initial: number; target: number } | null = null;
            for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
                const initial = between(diff.initialValueMin, diff.initialValueMax);
                const target = between(diff.targetMin, diff.targetMax);
                const slots = createTurnSlots(diff.maxTurns, OPERATION_POOL, rng);
                const turns = slots.map((s) => s.options);
                if (findShortestSolutionFromOptions(initial, target, turns) === null) continue;
                const count = countWinningSequences(initial, target, turns);
                // The closest to a range far above is the one with the most winning sequences; a tie keeps the first.
                if (best === null || count > best.count) best = { count, initial, target };
            }
            const got = generateProblem(4, seeded(21));
            expect(best).not.toBeNull();
            expect([got.initialValue, got.targetValue]).toEqual([best!.initial, best!.target]);
            expect(countWinningSequences(got.initialValue, got.targetValue, got.slots.map((s) => s.options))).toBe(best!.count);
        });

        it('keeps the first of two attempts at the same distance', () => {
            // Lv.5 with the range {1, 1}: a count of 1 is accepted at once, otherwise the smallest count is closest.
            WIN_COUNT_RANGES[4] = { min: 1, max: 1 };
            const diff = getDifficulty(5);
            for (let seed = 1; seed <= 400; seed++) {
                const rng = seeded(seed);
                const between = (lo: number, hi: number) => Math.floor(rng() * (hi - lo + 1)) + lo;
                const found: { count: number; initial: number; target: number }[] = [];
                for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
                    const initial = between(diff.initialValueMin, diff.initialValueMax);
                    const target = between(diff.targetMin, diff.targetMax);
                    const turns = createTurnSlots(diff.maxTurns, OPERATION_POOL, rng).map((sl) => sl.options);
                    if (findShortestSolutionFromOptions(initial, target, turns) === null) continue;
                    found.push({ count: countWinningSequences(initial, target, turns), initial, target });
                }
                const min = Math.min(...found.map((f) => f.count));
                if (min === 1) continue; // accepted at once: not a tie case
                const atMin = found.filter((f) => f.count === min);
                if (atMin.length < 2) continue;
                const got = generateProblem(5, seeded(seed));
                expect([got.initialValue, got.targetValue]).toEqual([atMin[0].initial, atMin[0].target]);
                return;
            }
            expect.fail('no seed with a tie found');
        });

        it('uses exactly MAX_GENERATION_ATTEMPTS attempts before settling', () => {
            WIN_COUNT_RANGES[3] = { min: 1e12, max: 2e12 };
            const base = seeded(77);
            let calls = 0;
            generateProblem(4, () => {
                calls++;
                return base();
            });
            // Per attempt: initial and target, then the shuffle of every turn (11 swaps for the 12-operation pool).
            expect(calls).toBe(200 * (2 + getDifficulty(4).maxTurns * (OPERATION_POOL.length - 1)));
        });

        it('on the far side too: below a range that sits under every count, the smallest count is closest', () => {
            WIN_COUNT_RANGES[3] = { min: 1, max: 1 }; // only exactly one winning sequence is accepted
            const diff = getDifficulty(4);
            const rng = seeded(34);
            const between = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
            let best: { count: number; initial: number; target: number } | null = null;
            for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
                const initial = between(diff.initialValueMin, diff.initialValueMax);
                const target = between(diff.targetMin, diff.targetMax);
                const slots = createTurnSlots(diff.maxTurns, OPERATION_POOL, rng);
                const turns = slots.map((s) => s.options);
                if (findShortestSolutionFromOptions(initial, target, turns) === null) continue;
                const count = countWinningSequences(initial, target, turns);
                if (count === 1) {
                    best = { count, initial, target };
                    break; // in range: accepted at once
                }
                if (best === null || count < best.count) best = { count, initial, target };
            }
            const got = generateProblem(4, seeded(34));
            expect([got.initialValue, got.targetValue]).toEqual([best!.initial, best!.target]);
        });
    });

    describe('when no attempt is even solvable', () => {
        const saved = { ...DIFFICULTY_TABLE[0] };
        afterEach(() => {
            DIFFICULTY_TABLE[0] = saved;
        });

        it('falls back to the first option of the first turn reaching the target', () => {
            // One turn and a target nothing can reach: every attempt is unsolvable.
            DIFFICULTY_TABLE[0] = { ...saved, maxTurns: 1, targetMin: 100000, targetMax: 100001 };
            const p = generateProblem(1, seeded(8));
            const first = p.slots[0].options[0];
            expect(p.targetValue).toBe(first.apply(p.initialValue));
            expect(p.shortestPath).toHaveLength(1);
            expect(p.shortestPath[0].operation).toBe(first);
            expect(p.shortestPath[0].resultValue).toBe(p.targetValue);
        });
    });
});
