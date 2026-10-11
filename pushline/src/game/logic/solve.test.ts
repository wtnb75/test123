import { describe, expect, it } from 'vitest';
import { move } from './rules';
import { minClearMoves, minClearPlan, targetSolve } from './solve';
import { board, oracleMin, render, seeded } from './testkit';

describe('minClearPlan', () => {
    it('returns the shortest moves, ending with the push that completes the line', () => {
        const s = board(['.....', '.....', '...@.', '....o', '.....', 'oooo.']);
        expect(minClearPlan(s.grid, s.px, s.py, 5)).toEqual(['right', 'down', 'down']);
    });

    it('is a single move when one push completes a row', () => {
        const s = board(['.....', '.....', '.....', '....@', '....o', 'oooo.']);
        expect(minClearPlan(s.grid, s.px, s.py, 3)).toEqual(['down']);
    });

    it('returns null when no clear is in reach, for a zero limit, and when the budget runs out', () => {
        const none = board(['.....', '.....', '.....', '.....', '.....', '..@..']);
        expect(minClearPlan(none.grid, none.px, none.py, 12)).toBeNull();
        const s = board(['.....', '.....', '.....', '@....', '....o', 'oooo.']);
        expect(minClearPlan(s.grid, s.px, s.py, 0)).toBeNull();
        expect(minClearPlan(s.grid, s.px, s.py, 5, 3)).toBeNull();
    });

    it('plays out on the real rules: no clear before the last move, a clear on it', () => {
        const rng = seeded(4242);
        let played = 0;
        for (let i = 0; i < 80; i++) {
            const cells: string[] = Array.from({ length: 30 }, () => {
                const r = rng();
                return r < 0.55 ? '.' : r < 0.9 ? 'o' : 'x';
            });
            cells[Math.floor(rng() * 30)] = '@';
            const rows = [0, 1, 2, 3, 4, 5].map((y) => cells.slice(y * 5, y * 5 + 5).join(''));
            const s = board(rows, { moves: 100 });
            const plan = minClearPlan(s.grid, s.px, s.py, 7, 1000000);
            if (!plan) continue;
            // the independent brute-force search agrees that no shorter way exists
            expect(plan.length).toBe(oracleMin(rows, 7, 1000000));
            const deps = { rng: seeded(i), now: () => 0 };
            plan.forEach((dir, n) => {
                const res = move(s, dir, deps);
                expect(res.moved).toBe(true);
                expect(res.clearedRows.length + res.clearedCols.length > 0).toBe(n === plan.length - 1);
            });
            played++;
        }
        expect(played).toBeGreaterThan(5);
    });
});

describe('targetSolve', () => {
    it.each([
        [0, 6], [1, 6], [2, 7], [3, 7], [4, 8], [6, 9], [7, 9], [8, 10], [9, 10], [10, 10], [100, 10],
    ])('is %i lines -> %i', (score, expected) => {
        expect(targetSolve(score)).toBe(expected);
    });
});

describe('minClearMoves', () => {
    it('is 1 when a single push completes a row', () => {
        const s = board(['.....', '.....', '.....', '....@', '....o', 'oooo.']);
        expect(minClearMoves(s.grid, s.px, s.py, 3)).toBe(1);
    });

    it('is 2 when the block must be pushed twice', () => {
        const s = board(['.....', '.....', '....@', '....o', '.....', 'oooo.']);
        expect(minClearMoves(s.grid, s.px, s.py, 2)).toBe(2);
        expect(minClearMoves(s.grid, s.px, s.py, 1)).toBeNull();
    });

    it('counts the walk to the pushing position: 4 steps + 1 push = 5', () => {
        const s = board(['.....', '.....', '.....', '@....', '....o', 'oooo.']);
        expect(minClearMoves(s.grid, s.px, s.py, 5)).toBe(5);
        expect(minClearMoves(s.grid, s.px, s.py, 4)).toBeNull();
    });

    it('finds a completed column as well as a row', () => {
        const s = board(['....o', '....o', '....o', '....o', '....o', '..@o.']);
        expect(minClearMoves(s.grid, s.px, s.py, 2)).toBe(1);
    });

    it('returns null for a limit of 0', () => {
        const s = board(['.....', '.....', '.....', '....@', '....o', 'oooo.']);
        expect(minClearMoves(s.grid, s.px, s.py, 0)).toBeNull();
    });

    it('returns null when no clear exists', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '..@..']);
        expect(minClearMoves(s.grid, s.px, s.py, 12)).toBeNull();
    });

    it('returns null when the search runs out of its node budget', () => {
        const s = board(['.....', '.....', '.....', '@....', '....o', 'oooo.']);
        expect(minClearMoves(s.grid, s.px, s.py, 5, 3)).toBeNull();
    });

    it('does not modify the board it searches', () => {
        const s = board(['.....', '.....', '.....', '@....', '....o', 'oooo.']);
        const before = render(s);
        minClearMoves(s.grid, s.px, s.py, 5);
        expect(render(s)).toEqual(before);
    });

    it('agrees with the independent oracle on random boards', () => {
        const rng = seeded(777);
        let found = 0;
        let none = 0;
        for (let i = 0; i < 120; i++) {
            const cells: string[] = Array.from({ length: 30 }, () => {
                const r = rng();
                return r < 0.55 ? '.' : r < 0.9 ? 'o' : 'x';
            });
            cells[Math.floor(rng() * 30)] = '@';
            const rows = [0, 1, 2, 3, 4, 5].map((y) => cells.slice(y * 5, y * 5 + 5).join(''));
            const s = board(rows);
            const mine = minClearMoves(s.grid, s.px, s.py, 7, 1000000);
            const reference = oracleMin(rows, 7, 1000000);
            if (mine !== reference) expect.fail(`${rows.join('/')}: got ${mine}, oracle ${reference}`);
            if (reference === null) none++;
            else found++;
        }
        expect(found).toBeGreaterThan(0);
        expect(none).toBeGreaterThan(0);
    });
});
