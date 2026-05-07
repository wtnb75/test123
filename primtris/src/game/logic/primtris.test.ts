import { describe, expect, it } from 'vitest';

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
    });
});

describe('generateNumber', () => {
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

    it('uses xN fallback generation in 3-digit mode when balanced attempts cannot hit xN', () => {
        const hardDifficulty: Difficulty = { digitCount: 3, boxCapacity: 9 };
        const distribution = createDistributionState();
        distribution.counts.x2 = 10;
        distribution.counts.x3 = 10;
        distribution.counts.x5 = 10;
        distribution.counts.x7 = 10;
        distribution.counts.P = 10;
        distribution.counts.xN = 0;

        const queue = createQueue(hardDifficulty, () => 0, distribution);

        expect(getValidBoxes(queue.current)).toEqual(['xN']);
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
