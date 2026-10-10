import { describe, expect, it } from 'vitest';
import { minClearMoves, targetSolve } from './solve';
import { board, oracleMin, render, seeded } from './testkit';

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
