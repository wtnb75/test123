import { describe, expect, it } from 'vitest';
import {
    cloneGrid, colFull, countKind, emptyGrid, fullLineExists, inBounds, key, pick, reachableFrom, rowFull,
} from './grid';
import { board, EMPTY_ROWS } from './testkit';
import { FIXED, MOVABLE } from './types';

describe('emptyGrid', () => {
    it('is 6 rows of 5 empty cells by default', () => {
        const g = emptyGrid();
        expect(g).toHaveLength(6);
        expect(g.every((row) => row.length === 5 && row.every((c) => c === 0))).toBe(true);
    });

    it('creates independent rows', () => {
        const g = emptyGrid();
        g[0][0] = MOVABLE;
        expect(g[1][0]).toBe(0);
    });
});

describe('cloneGrid', () => {
    it('copies cells without sharing rows', () => {
        const g = emptyGrid();
        const c = cloneGrid(g);
        c[2][3] = FIXED;
        expect(g[2][3]).toBe(0);
        expect(c[2][3]).toBe(FIXED);
    });
});

describe('inBounds', () => {
    const g = emptyGrid();

    it('accepts the four corners', () => {
        expect([[0, 0], [4, 0], [0, 5], [4, 5]].every(([x, y]) => inBounds(g, x, y))).toBe(true);
    });

    it('rejects one step outside on every side', () => {
        expect([[-1, 0], [5, 0], [0, -1], [0, 6]].some(([x, y]) => inBounds(g, x, y))).toBe(false);
    });
});

describe('rowFull / colFull / fullLineExists', () => {
    it('a row of blocks (movable and fixed mixed) is full', () => {
        const s = board(['.....', '.....', '.....', '.....', 'oxoxo', '..@..']);
        expect(rowFull(s.grid, 4)).toBe(true);
        expect(fullLineExists(s.grid)).toBe(true);
    });

    it('a row with one empty cell is not full', () => {
        const s = board(['.....', '.....', '.....', '.....', 'oxo.o', '..@..']);
        expect(rowFull(s.grid, 4)).toBe(false);
        expect(fullLineExists(s.grid)).toBe(false);
    });

    it('a column of six blocks is full', () => {
        const s = board(['o....', 'x....', 'o....', 'x....', 'o....', 'x.@..']);
        expect(colFull(s.grid, 0)).toBe(true);
        expect(fullLineExists(s.grid)).toBe(true);
    });

    it('the player\'s cell is empty, so the line it stands in is never full', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', 'oo@oo']);
        expect(rowFull(s.grid, 5)).toBe(false);
        expect(fullLineExists(s.grid)).toBe(false);
    });

    it('an empty board has no full line', () => {
        expect(fullLineExists(board(EMPTY_ROWS).grid)).toBe(false);
    });
});

describe('countKind', () => {
    it('counts movable and fixed blocks separately', () => {
        const s = board(['o....', 'x....', 'o....', '.....', '....x', '..@.o']);
        expect(countKind(s.grid, MOVABLE)).toBe(3);
        expect(countKind(s.grid, FIXED)).toBe(2);
    });
});

describe('reachableFrom', () => {
    it('reaches every empty cell on an open board', () => {
        const s = board(EMPTY_ROWS);
        expect(reachableFrom(s.grid, s.px, s.py).size).toBe(30);
    });

    it('does not pass through blocks', () => {
        const s = board(['.....', '.....', '.....', '.....', 'ooooo', '..@..']);
        const seen = reachableFrom(s.grid, s.px, s.py);
        expect(seen.size).toBe(5);
        expect(seen.has(key(2, 3))).toBe(false);
        expect(seen.has(key(0, 5))).toBe(true);
    });

    it('moves only in the four directions (no diagonal squeeze)', () => {
        // (0, 4) touches the player's cell (1, 5) only diagonally; its three neighbours are fixed blocks
        const s = board(['.....', '.....', '.....', 'x....', '.x...', 'x@...']);
        const seen = reachableFrom(s.grid, s.px, s.py);
        expect(seen.has(key(0, 4))).toBe(false);
        expect(seen.size).toBe(26);
    });

    it('a walled-in player reaches only its own cell', () => {
        const s = board(['.....', '.....', '.....', '.....', '..o..', '.o@o.']);
        expect(reachableFrom(s.grid, s.px, s.py).size).toBe(1);
    });
});

describe('pick', () => {
    it('chooses the element at floor(rng * length)', () => {
        expect(pick(['a', 'b', 'c'], () => 0)).toBe('a');
        expect(pick(['a', 'b', 'c'], () => 0.5)).toBe('b');
        expect(pick(['a', 'b', 'c'], () => 0.999)).toBe('c');
    });
});
