import { describe, expect, it } from 'vitest';
import { generateColHints, generateRowHints } from './hints';
import { analyzePuzzle } from './solver';
import type { BinaryCell } from './types';

// Oracle: on a 4 × 4 board every grid is enumerated, so the number of solutions of any hint pair
// is known exactly. The solver's `solvable` and `unique` must agree with that count.
const SIZE = 4;
const CELLS = SIZE * SIZE;

const gridOf = (bits: number): BinaryCell[][] =>
    Array.from({ length: SIZE }, (_, y) =>
        Array.from({ length: SIZE }, (_, x) => ((bits >> (y * SIZE + x)) & 1) as BinaryCell),
    );

const keyOf = (rows: number[][], cols: number[][]): string =>
    `${rows.map((r) => r.join(',')).join(';')}|${cols.map((c) => c.join(',')).join(';')}`;

const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('solver against exhaustive search on 4 × 4 boards', () => {
    it('gives the same solvable and unique answers as counting every solution', { timeout: 60000 }, () => {
        const solutionCount = new Map<string, number>();
        for (let bits = 0; bits < 1 << CELLS; bits += 1) {
            const grid = gridOf(bits);
            const key = keyOf(generateRowHints(grid), generateColHints(grid));
            solutionCount.set(key, (solutionCount.get(key) ?? 0) + 1);
        }

        // Rows from one grid and columns from another: most such pairs have no solution, some have one or two.
        const rnd = mulberry32(2024);
        const seen = new Set<number>();
        for (let i = 0; i < 3000; i += 1) {
            const a = gridOf(Math.floor(rnd() * (1 << CELLS)));
            const b = gridOf(Math.floor(rnd() * (1 << CELLS)));
            const rows = generateRowHints(a);
            const cols = generateColHints(b);
            const count = solutionCount.get(keyOf(rows, cols)) ?? 0;

            const result = analyzePuzzle(a, rows, cols, 3000);
            if (result.timedOut) {
                expect.fail(`timed out on a 4 × 4 board: rows ${JSON.stringify(rows)} cols ${JSON.stringify(cols)}`);
            }
            if (result.solvable !== (count > 0) || result.unique !== (count === 1)) {
                expect.fail(
                    `mismatch: rows ${JSON.stringify(rows)} cols ${JSON.stringify(cols)} count ${count} ` +
                        `solvable ${result.solvable} unique ${result.unique}`,
                );
            }
            seen.add(Math.min(count, 2));
        }

        // Guard against a vacuous run: every outcome class must have been exercised.
        expect([...seen].sort()).toEqual([0, 1, 2]);
    });
});
