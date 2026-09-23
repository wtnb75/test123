import { describe, expect, it, vi } from 'vitest';

import {
    advanceQueue,
    createDistributionState,
    createEmptyBoxes,
    createQueue,
    generateNumber,
    getBoxOrder,
    getValidBoxes,
    isPrime,
    isCorrectPlacement,
    resolvePlacement,
    splitDigits,
    type Difficulty
} from './primtris';

describe('splitDigits', () => {
    it('splits a number into digits from top to bottom', () => {
        expect(splitDigits(1284)).toEqual([1, 2, 8, 4]);
    });
});

describe('getValidBoxes', () => {
    it('routes generated primes to P only', () => {
        expect(getValidBoxes(11)).toEqual(['P']);
        expect(getValidBoxes(13)).toEqual(['P']);
    });

    it('allows multiple correct boxes for composite factors', () => {
        expect(getValidBoxes(30)).toEqual(['x2', 'x3', 'x5']);
        expect(getValidBoxes(42)).toEqual(['x2', 'x3', 'x7']);
        expect(getValidBoxes(35)).toEqual(['x5', 'x7']);
    });

    it('routes composites without 2 3 5 7 factors to xN', () => {
        expect(getValidBoxes(121)).toEqual(['xN']);
        expect(getValidBoxes(169)).toEqual(['xN']);
    });

    it('treats one digit factors as P if they were manually checked', () => {
        expect(isCorrectPlacement(7, 'P')).toBe(true);
        expect(isCorrectPlacement(7, 'x7')).toBe(false);
    });
});

describe('isPrime', () => {
    it('handles low-value edge cases', () => {
        expect(isPrime(1)).toBe(false);
        expect(isPrime(2)).toBe(true);
        expect(isPrime(0)).toBe(false);
        expect(isPrime(-7)).toBe(false);
    });

    it('rejects even numbers greater than 2', () => {
        expect(isPrime(4)).toBe(false);
        expect(isPrime(98)).toBe(false);
    });

    it('rejects odd composites and accepts odd primes', () => {
        expect(isPrime(9)).toBe(false);
        expect(isPrime(91)).toBe(false);
        expect(isPrime(97)).toBe(true);
        expect(isPrime(997)).toBe(true);
    });
});

describe('generateNumber', () => {
    it('uses Math.random when no rng is injected', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        try {
            expect(generateNumber(2)).toBe(10);
        } finally {
            spy.mockRestore();
        }
    });

    it('returns a positive integer with the exact digit count', () => {
        expect(generateNumber(2, () => 0)).toBe(10);
        expect(generateNumber(2, () => 0.999999)).toBe(99);
        expect(generateNumber(4, () => 0)).toBe(1000);
    });

    it('never generates zero one negatives or single-digit values for easy mode', () => {
        for (const sample of [0, 0.1, 0.5, 0.9, 0.999999]) {
            const value = generateNumber(2, () => sample);
            expect(value).toBeGreaterThanOrEqual(10);
            expect(value).toBeLessThanOrEqual(99);
        }
    });
});

describe('queue helpers', () => {
    const difficulty: Difficulty = { digitCount: 2, boxCapacity: 12 };

    it('creates current plus next two values', () => {
        const samples = [0, 0.1, 0.2];
        let index = 0;
        const queue = createQueue(difficulty, () => samples[index++]);

        expect(queue).toEqual({
            current: 10,
            next: [19, 28]
        });
    });

    it('advances the queue by one and appends a new value', () => {
        const queue = { current: 10, next: [19, 28] };
        const advanced = advanceQueue(queue, difficulty, () => 0.3);

        expect(advanced).toEqual({
            current: 19,
            next: [28, 37]
        });
    });

    it('excludes xN from target selection in 2-digit balanced generation', () => {
        const distribution = createDistributionState();
        let queue = createQueue(difficulty, Math.random, distribution);

        const samples = [queue.current, ...queue.next];

        for (let count = 0; count < 300; count += 1) {
            queue = advanceQueue(queue, difficulty, Math.random, distribution);
            samples.push(queue.next[1]);
        }

        for (const value of samples) {
            expect(value).toBeGreaterThanOrEqual(10);
            expect(value).toBeLessThanOrEqual(99);
            expect(getValidBoxes(value)).not.toEqual(['xN']);
        }
    });

    it('uses P fallback generation when balanced attempts cannot hit P', () => {
        const distribution = createDistributionState();
        distribution.counts.x2 = 10;
        distribution.counts.x3 = 10;
        distribution.counts.x5 = 10;
        distribution.counts.x7 = 10;
        distribution.counts.P = 0;

        const queue = createQueue(difficulty, () => 0, distribution);

        expect(queue.current).toBe(11);
        expect(getValidBoxes(queue.current)).toEqual(['P']);
    });

    it('builds an xN number from prime candidates in 3-digit mode when balanced attempts cannot hit xN', () => {
        const hardDifficulty: Difficulty = { digitCount: 3, boxCapacity: 9 };
        const distribution = createDistributionState();
        distribution.counts.x2 = 10;
        distribution.counts.x3 = 10;
        distribution.counts.x5 = 10;
        distribution.counts.x7 = 10;
        distribution.counts.P = 10;
        distribution.counts.xN = 0;

        const queue = createQueue(hardDifficulty, () => 0, distribution);

        expect(queue.current).toBe(121);
        expect(getValidBoxes(queue.current)).toEqual(['xN']);
    });

    it('scans for the first xN number when no candidate product fits the digit range', () => {
        const hardDifficulty: Difficulty = { digitCount: 3, boxCapacity: 9 };
        const distribution = createDistributionState();
        for (const box of ['x2', 'x3', 'x5', 'x7', 'P'] as const) {
            distribution.counts[box] = 10;
        }

        // 0.999999 always picks 37 * 37 = 1369 (4 digits) and generateNumber gives 999 (x3).
        const queue = createQueue(hardDifficulty, () => 0.999999, distribution);

        expect(queue.current).toBe(121);
        expect(getValidBoxes(queue.current)).toEqual(['xN']);
    });

    it('scans for the first prime when no attempt lands on a prime in range', () => {
        const distribution = createDistributionState();
        for (const box of ['x2', 'x3', 'x5', 'x7'] as const) {
            distribution.counts[box] = 10;
        }

        // 0.999999 always starts from 99, whose next odd value 101 is out of the 2-digit range.
        const queue = createQueue(difficulty, () => 0.999999, distribution);

        expect(queue.current).toBe(11);
    });

    it('steps through odd values to find a prime when the start value is an odd composite', () => {
        const distribution = createDistributionState();
        for (const box of ['x2', 'x3', 'x5', 'x7'] as const) {
            distribution.counts[box] = 10;
        }

        // 0.06 gives 15 (odd composite); the search then walks to 17.
        const queue = createQueue(difficulty, () => 0.06, distribution);

        expect(queue.current).toBe(17);
    });

    it('falls back to the smallest multiple when a divisor box has no valid number in range', () => {
        const oneDigit: Difficulty = { digitCount: 1, boxCapacity: 12 };
        const distribution = createDistributionState();
        for (const box of ['x2', 'x3', 'x5', 'P'] as const) {
            distribution.counts[box] = 10;
        }

        // The only 1-digit multiple of 7 is the prime 7, which routes to P, not x7.
        const queue = createQueue(oneDigit, () => 0, distribution);

        expect(queue.current).toBe(7);
    });

    it('generates without balancing when no distribution state is given', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        try {
            const queue = createQueue(difficulty);
            expect(queue).toEqual({ current: 10, next: [10, 10] });
            expect(advanceQueue(queue, difficulty).next).toEqual([10, 10]);
        } finally {
            spy.mockRestore();
        }
    });

    it('records the generated number in the distribution state', () => {
        const distribution = createDistributionState();

        createQueue(difficulty, () => 0.5, distribution);

        expect(distribution.generated).toBe(3);
        const total = Object.values(distribution.counts).reduce((sum, count) => sum + count, 0);
        expect(total).toBeGreaterThanOrEqual(3);
    });

    it('covers divisor-target generation path for factor boxes', () => {
        const distribution = createDistributionState();
        distribution.counts.x2 = 0;
        distribution.counts.x3 = 10;
        distribution.counts.x5 = 10;
        distribution.counts.x7 = 10;
        distribution.counts.P = 10;

        const queue = createQueue(difficulty, () => 0.02, distribution);

        expect(getValidBoxes(queue.current)).toContain('x2');
        expect(queue.current).toBeGreaterThanOrEqual(10);
        expect(queue.current).toBeLessThanOrEqual(99);
    });
});

describe('getBoxOrder', () => {
    it('removes xN in 2-digit mode', () => {
        expect(getBoxOrder(2)).toEqual(['x2', 'x3', 'x5', 'x7', 'P']);
    });

    it('keeps xN for 3-digit and above', () => {
        expect(getBoxOrder(3)).toEqual(['x2', 'x3', 'x5', 'x7', 'xN', 'P']);
    });
});

describe('resolvePlacement', () => {
    it('adds digits to the chosen box on an incorrect placement and checks overflow after append', () => {
        const boxes = createEmptyBoxes();
        const result = resolvePlacement(14, 'x3', boxes, 1);

        expect(result.isCorrect).toBe(false);
        expect(result.boxes.x3).toEqual([1, 4]);
        expect(result.gameOver).toBe(true);
        expect(result.scoreDelta).toBe(1);
    });

    it('clears matching digits on a correct placement without keeping the input digits', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 4];

        const result = resolvePlacement(12, 'x3', boxes, 12);

        expect(result.isCorrect).toBe(true);
        expect(result.boxes.x3).toEqual([4]);
        expect(result.clearedDigits).toEqual([1]);
        expect(result.gameOver).toBe(false);
    });

    it('clears only one matching digit per input digit and removes the newest match first', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 4, 1];

        const result = resolvePlacement(12, 'x3', boxes, 12);

        expect(result.boxes.x3).toEqual([1, 4]);
        expect(result.clearedDigits).toEqual([1]);
    });

    it('scores completed drops the same way for correct and incorrect inputs', () => {
        const boxes = createEmptyBoxes();

        expect(resolvePlacement(11, 'P', boxes, 12).scoreDelta).toBe(1);
        expect(resolvePlacement(14, 'x3', boxes, 12).scoreDelta).toBe(1);
    });
});
