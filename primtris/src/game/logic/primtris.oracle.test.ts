import { describe, expect, it } from 'vitest';
import {
    advanceQueue,
    BOX_ORDER,
    createDistributionState,
    createEmptyBoxes,
    createQueue,
    generateNumber,
    getBoxOrder,
    getValidBoxes,
    isCorrectPlacement,
    isPrime,
    resolvePlacement,
    splitDigits,
    type BoxKey,
    type Difficulty
} from './primtris';

// Checks against independent oracles: a sieve, the definition of each box, and counting arguments.

const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const LIMIT = 99_999;
const SIEVE = (() => {
    const flags = new Array<boolean>(LIMIT + 1).fill(true);
    flags[0] = false;
    flags[1] = false;
    for (let i = 2; i * i <= LIMIT; i += 1) {
        if (flags[i]) {
            for (let j = i * i; j <= LIMIT; j += i) {
                flags[j] = false;
            }
        }
    }

    return flags;
})();

describe('number classification', () => {
    it('isPrime agrees with a sieve for every number below 100000', () => {
        for (let value = 0; value <= LIMIT; value += 1) {
            if (isPrime(value) !== SIEVE[value]) {
                expect.fail(`isPrime(${value}) should be ${SIEVE[value]}`);
            }
        }
    });

    it('isPrime rejects negative numbers', () => {
        for (const value of [-13, -2, -1]) {
            expect(isPrime(value), String(value)).toBe(false);
        }
    });

    it('getValidBoxes follows the box definitions for every number from 10 to 99999', () => {
        for (let value = 10; value <= LIMIT; value += 1) {
            const factorBoxes = ([2, 3, 5, 7] as const)
                .filter((p) => value % p === 0)
                .map((p) => `x${p}` as BoxKey);
            const expected: BoxKey[] = SIEVE[value] ? ['P'] : factorBoxes.length > 0 ? factorBoxes : ['xN'];

            if (getValidBoxes(value).join() !== expected.join()) {
                expect.fail(`${value}: got ${getValidBoxes(value)} expected ${expected}`);
            }
        }
    });

    it('every number has at least one valid box, primes only fit P, and xN never mixes with other boxes', () => {
        for (let value = 10; value <= LIMIT; value += 1) {
            const boxes = getValidBoxes(value);
            const exclusive = boxes.includes('P') || boxes.includes('xN');
            const fitsExactlyTheValidBoxes = BOX_ORDER.every((box) => isCorrectPlacement(value, box) === boxes.includes(box));

            if (boxes.length === 0 || boxes.includes('P') !== SIEVE[value] || (exclusive && boxes.length !== 1) || !fitsExactlyTheValidBoxes) {
                expect.fail(`${value}: boxes ${boxes} break the rules`);
            }
        }
    });

    it('offers xN only from three digits, and every number fits one of the offered boxes', () => {
        expect(getBoxOrder(1)).toEqual(['x2', 'x3', 'x5', 'x7', 'P']);
        expect(getBoxOrder(2)).toEqual(['x2', 'x3', 'x5', 'x7', 'P']);
        for (const digits of [3, 4, 5]) {
            expect(getBoxOrder(digits)).toEqual([...BOX_ORDER]);
        }

        // With two digits every number fits one of the offered boxes: no composite avoids 2, 3, 5 and 7
        // below 121, so xN is never needed.
        const twoDigit = new Set(getBoxOrder(2));
        for (let value = 10; value <= 99; value += 1) {
            expect(getValidBoxes(value).some((box) => twoDigit.has(box)), String(value)).toBe(true);
        }
        for (let digits = 3; digits <= 5; digits += 1) {
            const offered = new Set(getBoxOrder(digits));
            for (let value = 10 ** (digits - 1); value < 10 ** digits; value += 37) {
                expect(getValidBoxes(value).every((box) => offered.has(box)), String(value)).toBe(true);
            }
        }
    });

    it('splitDigits returns the decimal digits in order', () => {
        expect(splitDigits(0)).toEqual([0]);
        expect(splitDigits(90210)).toEqual([9, 0, 2, 1, 0]);
    });
});

describe('generateNumber', () => {
    it.each([1, 2, 3, 4])('covers every %i-digit number exactly once as the random value sweeps [0, 1)', (digits) => {
        const low = 10 ** (digits - 1);
        const span = 9 * low;
        const seen = new Set<number>();

        for (let k = 0; k < span; k += 1) {
            const value = generateNumber(digits, () => (k + 0.5) / span);
            expect(value, `k=${k}`).toBeGreaterThanOrEqual(low);
            expect(value, `k=${k}`).toBeLessThan(10 * low);
            seen.add(value);
        }

        expect(seen.size).toBe(span);
    });
});

describe('queue generation', () => {
    const difficulties: Difficulty[] = [
        { digitCount: 2, boxCapacity: 12 },
        { digitCount: 3, boxCapacity: 9 },
        { digitCount: 4, boxCapacity: 9 }
    ];

    it.each(difficulties)('advanceQueue shifts the queue by one and draws a number of the right size ($digitCount digits)', (difficulty) => {
        const rng = lcg(difficulty.digitCount);
        let queue = createQueue(difficulty, rng);

        for (let step = 0; step < 200; step += 1) {
            const before = queue;
            queue = advanceQueue(queue, difficulty, rng);

            expect(queue.current).toBe(before.next[0]);
            expect(queue.next[0]).toBe(before.next[1]);
            expect(String(queue.next[1])).toHaveLength(difficulty.digitCount);
        }
    });

    it.each(difficulties)('balanced generation keeps every offered box in rotation ($digitCount digits)', (difficulty) => {
        // Each draw is valid for a box with the lowest count, so the lowest count can never fall
        // behind floor(draws / number of boxes), as in round-robin.
        for (let seed = 1; seed <= 25; seed += 1) {
            const rng = lcg(seed * 131 + difficulty.digitCount);
            const distribution = createDistributionState();
            const active = getBoxOrder(difficulty.digitCount);
            let queue = createQueue(difficulty, rng, distribution);

            for (let draw = 3; draw <= 300; draw += 1) {
                const lowest = Math.min(...active.map((box) => distribution.counts[box]));
                const where = `seed=${seed} digits=${difficulty.digitCount} draw=${draw}`;

                expect(distribution.generated, where).toBe(draw);
                expect(lowest, where).toBeGreaterThanOrEqual(Math.floor(draw / active.length));
                queue = advanceQueue(queue, difficulty, rng, distribution);
                expect(String(queue.next[1]), where).toHaveLength(difficulty.digitCount);
                expect(getValidBoxes(queue.next[1]).some((box) => active.includes(box)), where).toBe(true);
            }
        }
    });

    it('records every generated number under each of its valid boxes', () => {
        const distribution = createDistributionState();
        const difficulty: Difficulty = { digitCount: 3, boxCapacity: 9 };
        const rng = lcg(5);
        const drawn: number[] = [];
        let queue = createQueue(difficulty, rng, distribution);
        drawn.push(queue.current, ...queue.next);
        for (let i = 0; i < 100; i += 1) {
            queue = advanceQueue(queue, difficulty, rng, distribution);
            drawn.push(queue.next[1]);
        }

        for (const box of BOX_ORDER) {
            const expected = drawn.filter((value) => getValidBoxes(value).includes(box)).length;
            expect(distribution.counts[box], box).toBe(expected);
        }
    });
});

describe('resolvePlacement', () => {
    const randomBoxes = (rng: () => number, capacity: number): Record<BoxKey, number[]> => {
        const boxes = createEmptyBoxes();
        for (const key of BOX_ORDER) {
            boxes[key] = Array.from({ length: Math.floor(rng() * (capacity + 1)) }, () => Math.floor(rng() * 10));
        }

        return boxes;
    };

    // Remove, for each digit of the value, its most recently added copy from the box.
    const lastOccurrenceRemoval = (box: number[], value: number): { left: number[]; cleared: number[] } => {
        const budget = new Map<number, number>();
        const wanted = new Map<number, number>();
        const budgetTotals = new Map<number, number>();
        for (const digit of splitDigits(value)) {
            wanted.set(digit, (wanted.get(digit) ?? 0) + 1);
        }
        for (const [digit, count] of wanted) {
            const removable = Math.min(count, box.filter((d) => d === digit).length);
            budget.set(digit, removable);
            budgetTotals.set(digit, removable);
        }

        const keep = box.map(() => true);
        for (let i = box.length - 1; i >= 0; i -= 1) {
            const remaining = budget.get(box[i]) ?? 0;
            if (remaining > 0) {
                keep[i] = false;
                budget.set(box[i], remaining - 1);
            }
        }
        // One cleared digit per removed copy.
        const cleared = [...budgetTotals].flatMap(([digit, count]) => new Array<number>(count).fill(digit));

        return { left: box.filter((_, i) => keep[i]), cleared };
    };

    it('clears the newest matching digits on a correct placement and leaves the other boxes alone', () => {
        let correct = 0;

        for (let seed = 1; seed <= 2000; seed += 1) {
            const rng = lcg(seed);
            const capacity = 8;
            const boxes = randomBoxes(rng, capacity);
            const snapshot = structuredClone(boxes);
            const value = generateNumber(2 + Math.floor(rng() * 3), rng);
            const box = BOX_ORDER[Math.floor(rng() * BOX_ORDER.length)];
            const result = resolvePlacement(value, box, boxes, capacity);
            const where = `seed=${seed} value=${value} box=${box}`;

            expect(boxes, `${where} mutated its input`).toEqual(snapshot);
            expect(result.isCorrect, where).toBe(isCorrectPlacement(value, box));
            expect(result.scoreDelta, where).toBe(1);

            for (const other of BOX_ORDER) {
                if (other !== box) {
                    expect(result.boxes[other], `${where} touched ${other}`).toEqual(snapshot[other]);
                }
            }

            if (result.isCorrect) {
                correct += 1;
                const expected = lastOccurrenceRemoval(snapshot[box], value);
                expect(result.boxes[box], where).toEqual(expected.left);
                expect(result.clearedDigits.slice().sort(), where).toEqual(expected.cleared.slice().sort());
                expect(result.gameOver, where).toBe(false);
            } else {
                expect(result.boxes[box], where).toEqual([...snapshot[box], ...splitDigits(value)]);
                expect(result.clearedDigits, where).toEqual([]);
                expect(result.gameOver, where).toBe(result.boxes[box].length > capacity);
            }
        }

        expect(correct).toBeGreaterThan(100);
    });

    it('a wrong placement ends the game exactly when the box would exceed its capacity', () => {
        for (let capacity = 0; capacity <= 6; capacity += 1) {
            for (let filled = 0; filled <= capacity; filled += 1) {
                const boxes = createEmptyBoxes();
                boxes.x3 = new Array<number>(filled).fill(9);
                const result = resolvePlacement(14, 'x3', boxes, capacity); // 14 is not a multiple of 3
                const expectedLength = filled + 2;

                expect(result.boxes.x3).toHaveLength(expectedLength);
                expect(result.gameOver, `capacity=${capacity} filled=${filled}`).toBe(expectedLength > capacity);
            }
        }
    });

    it('a correct placement never ends the game even when the box is full', () => {
        const boxes = createEmptyBoxes();
        boxes.x2 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

        expect(resolvePlacement(12, 'x2', boxes, 3).gameOver).toBe(false);
    });
});
