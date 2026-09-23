import { describe, expect, it } from 'vitest';
import {
    applyOperation,
    canReachTarget,
    DIFFICULTY_TABLE,
    evaluateProgress,
    findShortestSolutionFromOptions,
    findSolutionFromOptions,
    findSolutionPath,
    getDifficulty,
    OPERATION_POOL,
    pickOperations,
    type HistoryEntry,
    type Operation,
    type TurnSlot
} from './logic';

// Checks against independent oracles: the label of each operation, and exhaustive enumeration of
// every way to play a small game.

const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe('operation pool', () => {
    // The label is what the player reads, so it must describe what the operation does.
    const expected = (label: string, value: number): number => {
        const match = /^([+\-×/])(\d+)$/.exec(label);
        if (!match) {
            throw new Error(`unexpected label ${label}`);
        }
        const amount = Number(match[2]);
        switch (match[1]) {
            case '+':
                return value + amount;
            case '-':
                return value - amount;
            case '×':
                return value * amount;
            default:
                return Math.floor(value / amount);
        }
    };

    it('every operation does what its label says on values from -20 to 300', () => {
        for (const op of OPERATION_POOL) {
            for (let value = -20; value <= 300; value += 1) {
                if (op.apply(value) !== expected(op.label, value)) {
                    expect.fail(`${op.label} on ${value}: got ${op.apply(value)} expected ${expected(op.label, value)}`);
                }
            }
        }
    });

    it('has unique labels and only whole-number results', () => {
        const labels = OPERATION_POOL.map((op) => op.label);

        expect(new Set(labels).size).toBe(labels.length);
        for (const op of OPERATION_POOL) {
            for (const value of [-7, -1, 0, 1, 7, 99]) {
                expect(Number.isInteger(op.apply(value)), `${op.label} on ${value}`).toBe(true);
            }
        }
    });
});

describe('getDifficulty', () => {
    it('clamps every level into the table and keeps the ranges valid', () => {
        for (const level of [-5, 0, 1, 2, 3, 4, 5, 6, 100]) {
            const difficulty = getDifficulty(level);
            const index = Math.min(Math.max(level, 1), DIFFICULTY_TABLE.length) - 1;

            expect(difficulty, `level ${level}`).toBe(DIFFICULTY_TABLE[index]);
            expect(difficulty.initialValueMin).toBeLessThanOrEqual(difficulty.initialValueMax);
            expect(difficulty.targetMin).toBeLessThanOrEqual(difficulty.targetMax);
            expect(difficulty.maxTurns).toBeGreaterThan(0);
        }
    });

    it('never gets easier as the level rises', () => {
        for (let i = 1; i < DIFFICULTY_TABLE.length; i += 1) {
            const easier = DIFFICULTY_TABLE[i - 1];
            const harder = DIFFICULTY_TABLE[i];

            expect(harder.targetMax).toBeGreaterThanOrEqual(easier.targetMax);
            expect(harder.targetMin).toBeGreaterThanOrEqual(easier.targetMin);
            expect(harder.maxTurns).toBeLessThanOrEqual(easier.maxTurns);
        }
    });
});

describe('pickOperations', () => {
    const small: Operation[] = OPERATION_POOL.slice(0, 4);

    // Feeding the shuffle every possible sequence of random choices must produce every ordering
    // exactly once; otherwise some orderings are impossible or more likely than others.
    it('can produce each ordering of the pool exactly once', () => {
        const orderings = new Set<string>();
        for (const a of [0, 1, 2, 3]) {
            for (const b of [0, 1, 2]) {
                for (const c of [0, 1]) {
                    const picks = [a, b, c];
                    const bounds = [4, 3, 2]; // i + 1 for i = 3, 2, 1
                    let call = 0;
                    const rng = (): number => {
                        const index = call;
                        call += 1;
                        return (picks[index] + 0.5) / bounds[index];
                    };
                    orderings.add(pickOperations(small, 4, rng).map((op) => op.label).join('|'));
                }
            }
        }

        expect(orderings.size).toBe(24);
    });

    it('returns the requested number of distinct pool members without touching the pool', () => {
        const snapshot = OPERATION_POOL.map((op) => op.label);

        for (let seed = 1; seed <= 200; seed += 1) {
            const picked = pickOperations(OPERATION_POOL, 4, lcg(seed));

            expect(picked).toHaveLength(4);
            expect(new Set(picked).size).toBe(4);
            expect(picked.every((op) => OPERATION_POOL.includes(op))).toBe(true);
        }
        expect(OPERATION_POOL.map((op) => op.label)).toEqual(snapshot);
    });

    it('returns the whole pool when asked for more than it holds, and nothing for zero', () => {
        expect(pickOperations(small, 10, lcg(1))).toHaveLength(4);
        expect(pickOperations(small, 0, lcg(1))).toEqual([]);
    });
});

// Random small games: `turns` turns, each offering four operations.
const randomGame = (seed: number): { initial: number; target: number; turnOptions: Operation[][] } => {
    const rng = lcg(seed);
    const turns = 1 + Math.floor(rng() * 5);
    const turnOptions = Array.from({ length: turns }, () => pickOperations(OPERATION_POOL, 4, rng));
    const initial = 1 + Math.floor(rng() * 20);

    // Half the targets are reachable by construction, the rest are arbitrary (often unreachable).
    let target = 1 + Math.floor(rng() * 300);
    if (rng() < 0.5) {
        target = initial;
        for (const options of turnOptions) {
            if (rng() < 0.8) {
                target = options[Math.floor(rng() * options.length)].apply(target);
            }
        }
    }

    return { initial, target, turnOptions };
};

// Fewest turns in which some sequence of choices (an option or skipping) reaches the target.
const fewestTurns = (initial: number, target: number, turnOptions: Operation[][]): number => {
    if (initial === target) {
        return 0;
    }
    let best = Infinity;
    const visit = (turn: number, value: number): void => {
        if (turn >= turnOptions.length) {
            return;
        }
        for (const next of [value, ...turnOptions[turn].map((op) => op.apply(value))]) {
            if (next === target) {
                best = Math.min(best, turn + 1);
            } else {
                visit(turn + 1, next);
            }
        }
    };
    visit(0, initial);

    return best;
};

// A path is valid when each step really is one of that turn's options (or a skip) applied to the
// previous value, and the last step lands on the target.
const expectValidPath = (
    where: string,
    path: HistoryEntry[],
    initial: number,
    target: number,
    turnOptions: Operation[][]
): void => {
    let value = initial;
    path.forEach((entry, turn) => {
        expect(entry.options, `${where} turn ${turn} options`).toBe(turnOptions[turn]);
        if (entry.operation === null) {
            expect(entry.resultValue, `${where} skip at turn ${turn}`).toBe(value);
        } else {
            expect(turnOptions[turn], `${where} turn ${turn}`).toContain(entry.operation);
            expect(entry.resultValue, `${where} turn ${turn}`).toBe(entry.operation.apply(value));
        }
        value = entry.resultValue;
    });
    expect(value, `${where} ends on the target`).toBe(target);
};

describe('solutions constrained to the offered options', () => {
    it('findShortestSolutionFromOptions finds a solution in the fewest turns, or none', () => {
        let solved = 0;

        for (let seed = 1; seed <= 1500; seed += 1) {
            const { initial, target, turnOptions } = randomGame(seed);
            const where = `seed=${seed} ${initial}->${target}`;
            const minimum = fewestTurns(initial, target, turnOptions);
            const path = findShortestSolutionFromOptions(initial, target, turnOptions);

            if (minimum === Infinity) {
                expect(path, where).toBeNull();
                continue;
            }
            solved += 1;
            expect(path, where).not.toBeNull();
            expect(path!.length, where).toBe(minimum);
            expectValidPath(where, path!, initial, target, turnOptions);
        }

        expect(solved).toBeGreaterThan(300);
    });

    it('findSolutionFromOptions finds some valid solution exactly when one exists', () => {
        for (let seed = 1; seed <= 1500; seed += 1) {
            const { initial, target, turnOptions } = randomGame(seed);
            const where = `seed=${seed} ${initial}->${target}`;
            const minimum = fewestTurns(initial, target, turnOptions);
            const path = findSolutionFromOptions(initial, target, turnOptions);

            if (minimum === Infinity) {
                expect(path, where).toBeNull();
                continue;
            }
            expect(path, where).not.toBeNull();
            expect(path!.length, where).toBeLessThanOrEqual(turnOptions.length);
            expect(path!.length, where).toBeGreaterThanOrEqual(minimum);
            expectValidPath(where, path!, initial, target, turnOptions);
        }
    });

    it('both return an empty path when the game starts on the target', () => {
        const turnOptions = [OPERATION_POOL.slice(0, 4)];

        expect(findShortestSolutionFromOptions(7, 7, turnOptions)).toEqual([]);
        expect(findSolutionFromOptions(7, 7, turnOptions)).toEqual([]);
        expect(findShortestSolutionFromOptions(7, 8, [])).toBeNull();
    });
});

describe('findSolutionPath against a breadth-first oracle', () => {
    // Fewest operations from `initial` to `target` using any operation of the pool at each step,
    // ignoring values outside +-1,000,000 as the game does.
    const fewestOperations = (initial: number, target: number, pool: Operation[], limit: number): number => {
        if (initial === target) {
            return 0;
        }
        let frontier = new Set<number>([initial]);
        const seen = new Set<number>([initial]);
        for (let steps = 1; steps <= limit; steps += 1) {
            const next = new Set<number>();
            for (const value of frontier) {
                for (const op of pool) {
                    const result = op.apply(value);
                    if (Math.abs(result) > 1_000_000) {
                        continue;
                    }
                    if (result === target) {
                        return steps;
                    }
                    if (!seen.has(result)) {
                        seen.add(result);
                        next.add(result);
                    }
                }
            }
            frontier = next;
        }

        return Infinity;
    };

    it('returns a shortest valid path within the turn limit, or null', () => {
        let solved = 0;

        for (let seed = 1; seed <= 600; seed += 1) {
            const rng = lcg(seed * 977);
            const pool = pickOperations(OPERATION_POOL, 2 + Math.floor(rng() * 5), rng);
            const initial = 1 + Math.floor(rng() * 20);
            const target = 1 + Math.floor(rng() * 300);
            const maxTurns = 1 + Math.floor(rng() * 8);
            const where = `seed=${seed} ${initial}->${target} in ${maxTurns} with ${pool.map((op) => op.label)}`;
            const minimum = fewestOperations(initial, target, pool, maxTurns);
            const path = findSolutionPath(initial, target, pool, maxTurns);

            expect(canReachTarget(initial, target, pool, maxTurns), where).toBe(minimum !== Infinity);
            if (minimum === Infinity) {
                expect(path, where).toBeNull();
                continue;
            }
            solved += 1;
            expect(path, where).not.toBeNull();
            expect(path!.length, where).toBe(minimum);

            let value = initial;
            for (const entry of path!) {
                expect(pool, where).toContain(entry.operation);
                expect(entry.resultValue, where).toBe(entry.operation!.apply(value));
                value = entry.resultValue;
            }
            expect(value, where).toBe(target);
        }

        expect(solved).toBeGreaterThan(100);
    });

    it('does not follow values beyond one million', () => {
        const times5: Operation = { label: '×5', apply: (v) => v * 5 };

        // 1 * 5^9 = 1,953,125 is out of range, so the target 1,953,125 cannot be reached.
        expect(findSolutionPath(1, 1_953_125, [times5], 20)).toBeNull();
        expect(findSolutionPath(1, 390_625, [times5], 20)).toHaveLength(8);
    });
});

describe('evaluateProgress against a replay', () => {
    const randomSlots = (rng: () => number): TurnSlot[] =>
        Array.from({ length: 1 + Math.floor(rng() * 8) }, () => {
            const options = pickOperations(OPERATION_POOL, 4, rng);
            const choice = Math.floor(rng() * 5);

            return { options, selected: choice === 4 ? null : options[choice] };
        });

    it('applies the chosen operations in order and stops changing the value once the target is hit', () => {
        for (let seed = 1; seed <= 800; seed += 1) {
            const rng = lcg(seed * 31);
            const slots = randomSlots(rng);
            const initial = 1 + Math.floor(rng() * 20);
            const target = rng() < 0.5 ? initial + Math.floor(rng() * 40) : 1 + Math.floor(rng() * 300);
            const snapshot = slots.map((s) => s.selected?.label ?? null);
            const result = evaluateProgress(initial, target, slots);
            const where = `seed=${seed} ${initial}->${target}`;

            // Independent replay.
            let value = initial;
            let wonAt: number | null = null;
            const values: number[] = [];
            slots.forEach((slot, i) => {
                if (wonAt === null) {
                    value = slot.selected ? slot.selected.apply(value) : value;
                    if (value === target) {
                        wonAt = i + 1;
                    }
                }
                values.push(value);
            });

            expect(slots.map((s) => s.selected?.label ?? null), `${where} mutated slots`).toEqual(snapshot);
            expect(result.rows.map((r) => r.value), where).toEqual(values);
            expect(result.rows.map((r) => r.turn), where).toEqual(slots.map((_, i) => i + 1));
            expect(result.won, where).toBe(wonAt !== null);
            expect(result.wonAtTurn, where).toBe(wonAt);
            expect(result.currentValue, where).toBe(value);
            result.rows.forEach((row, i) => {
                const skipped = wonAt !== null && i + 1 > wonAt;
                expect(row.isAutoSkip, `${where} row ${i + 1}`).toBe(skipped);
                expect(row.selected, `${where} row ${i + 1}`).toBe(skipped ? null : slots[i].selected);
            });
        }
    });

    it('agrees with applyOperation for a single chosen operation', () => {
        const [op] = OPERATION_POOL;
        const result = evaluateProgress(5, 100, [{ options: [op], selected: op }]);

        expect(result.currentValue).toBe(applyOperation(5, op));
    });
});
