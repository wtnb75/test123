import { describe, expect, it } from 'vitest';
import { DIRS } from './grid';
import { findPath } from './path';
import { board, EMPTY_ROWS } from './testkit';
import type { Dir, Grid } from './types';

/** Walks `path` from (x, y) over empty cells only and returns where it ends, or null if it hits anything. */
function walk(grid: Grid, x: number, y: number, path: Dir[]): { x: number; y: number } | null {
    let cx = x;
    let cy = y;
    for (const d of path) {
        cx += DIRS[d].x;
        cy += DIRS[d].y;
        if (grid[cy]?.[cx] !== 0) return null;
    }
    return { x: cx, y: cy };
}

describe('findPath', () => {
    it('is an empty path for the player\'s own cell', () => {
        const s = board(EMPTY_ROWS);
        expect(findPath(s.grid, s.px, s.py, s.px, s.py)).toEqual([]);
    });

    it('goes straight up three cells on an open board', () => {
        const s = board(EMPTY_ROWS);
        expect(findPath(s.grid, 2, 5, 2, 2)).toEqual(['up', 'up', 'up']);
    });

    it('takes the Manhattan-shortest route around a wall', () => {
        const s = board(['.....', '.....', '.....', '.....', 'xx.xx', '..@..']);
        // up through the gap at (2, 4), then left along row 3: 2 up + 2 left
        const path = findPath(s.grid, 2, 5, 0, 3);
        expect(path).toHaveLength(4);
        expect(walk(s.grid, 2, 5, path ?? [])).toEqual({ x: 0, y: 3 });
    });

    it('detours when the straight line is blocked (longer than the Manhattan distance of 2)', () => {
        const s = board(['.....', '.....', '.....', '.....', '.xx..', '..@..']);
        // target (2, 3) is straight above; (2, 4) is a fixed block, so: right, up, up, left = 4 moves
        const path = findPath(s.grid, 2, 5, 2, 3);
        expect(path).toHaveLength(4);
        expect(walk(s.grid, 2, 5, path ?? [])).toEqual({ x: 2, y: 3 });
    });

    it('returns null when the target is walled off', () => {
        const s = board(['.....', '.....', '.....', '.....', 'ooooo', '..@..']);
        expect(findPath(s.grid, 2, 5, 2, 3)).toBeNull();
    });

    it('returns null for a target holding a block', () => {
        const s = board(['.....', '.....', '.....', '.....', '.o...', '..@..']);
        expect(findPath(s.grid, 2, 5, 1, 4)).toBeNull();
    });

    it('returns null for a target holding a fixed block', () => {
        const s = board(['.....', '.....', '.....', '.....', '.x...', '..@..']);
        expect(findPath(s.grid, 2, 5, 1, 4)).toBeNull();
    });

    it('returns null for a target outside the board', () => {
        const s = board(EMPTY_ROWS);
        expect(findPath(s.grid, 2, 5, 5, 5)).toBeNull();
        expect(findPath(s.grid, 2, 5, 2, -1)).toBeNull();
    });

    it('never steps on a block or pushes one: every step of the path is an empty cell', () => {
        const s = board(['.o.x.', '..o..', 'x...o', '.o.x.', '..o..', '.@...']);
        let found = 0;
        let blocked = 0;
        for (let ty = 0; ty < 6; ty++) {
            for (let tx = 0; tx < 5; tx++) {
                const path = findPath(s.grid, s.px, s.py, tx, ty);
                if (path === null) {
                    blocked++;
                    continue;
                }
                found++;
                expect(walk(s.grid, s.px, s.py, path)).toEqual({ x: tx, y: ty });
            }
        }
        // cells holding blocks (8) can't be targets; the others are reachable, so both outcomes are exercised
        expect(blocked).toBeGreaterThan(0);
        expect(found).toBeGreaterThan(10);
    });
});
