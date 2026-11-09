import { describe, expect, it } from 'vitest';
import { canPlaceMine, canSetStart, forbiddenZone, toBoardText, zoneHasMine, type Grid } from './board';

/** A grid of the given size with mines at the given row-major indices. */
function gridWith(width: number, height: number, mines: number[] = []): Grid {
    const cells = Array.from({ length: width * height }, (_, i) => ({ hasMine: mines.includes(i) }));
    return { width, height, cells };
}

const sorted = (set: Set<number>): number[] => [...set].sort((a, b) => a - b);

describe('forbiddenZone', () => {
    it('covers 9 cells when the start cell is in the middle', () => {
        expect(sorted(forbiddenZone(12, 5, 5))).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
    });

    it('covers 6 cells when the start cell is on an edge', () => {
        expect(sorted(forbiddenZone(2, 5, 5))).toEqual([1, 2, 3, 6, 7, 8]);
    });

    it('covers 4 cells when the start cell is in a corner', () => {
        expect(sorted(forbiddenZone(0, 5, 5))).toEqual([0, 1, 5, 6]);
        expect(sorted(forbiddenZone(24, 5, 5))).toEqual([18, 19, 23, 24]);
    });

    it('covers the whole board when it is 2 x 2', () => {
        for (let start = 0; start < 4; start += 1) {
            expect(sorted(forbiddenZone(start, 2, 2))).toEqual([0, 1, 2, 3]);
        }
    });

    it('matches a brute-force "within one cell" rule on every start of several board sizes', () => {
        let checked = 0;
        for (const [w, h] of [[2, 2], [3, 4], [5, 3], [4, 4]]) {
            for (let start = 0; start < w * h; start += 1) {
                const sx = start % w;
                const sy = Math.floor(start / w);
                const expected: number[] = [];
                for (let i = 0; i < w * h; i += 1) {
                    if (Math.abs((i % w) - sx) <= 1 && Math.abs(Math.floor(i / w) - sy) <= 1) {
                        expected.push(i);
                    }
                }
                if (JSON.stringify(sorted(forbiddenZone(start, w, h))) !== JSON.stringify(expected)) {
                    expect.fail(`zone mismatch for start ${start} on ${w} x ${h}`);
                }
                checked += 1;
            }
        }
        expect(checked).toBe(4 + 12 + 15 + 16);
    });
});

describe('zoneHasMine / canSetStart', () => {
    it('rejects a start cell whose zone holds a mine on the zone boundary', () => {
        const grid = gridWith(5, 5, [0]);
        // Start 6 (x1,y1) has cell 0 as a diagonal neighbour.
        expect(zoneHasMine(grid, 6)).toBe(true);
        expect(canSetStart(grid, 6)).toBe(false);
    });

    it('accepts a start cell one step further from the mine', () => {
        const grid = gridWith(5, 5, [0]);
        // Start 7 (x2,y1) is two columns away from cell 0.
        expect(zoneHasMine(grid, 7)).toBe(false);
        expect(canSetStart(grid, 7)).toBe(true);
    });

    it('rejects a mine on the start cell itself', () => {
        expect(canSetStart(gridWith(5, 5, [12]), 12)).toBe(false);
    });

    it('accepts any start cell on a board without mines', () => {
        const grid = gridWith(3, 3);
        for (let start = 0; start < 9; start += 1) {
            expect(canSetStart(grid, start)).toBe(true);
        }
    });

    it('does not change the board', () => {
        const grid = gridWith(5, 5, [0, 24]);
        const before = JSON.stringify(grid);
        canSetStart(grid, 12);
        expect(JSON.stringify(grid)).toBe(before);
    });
});

describe('canPlaceMine', () => {
    it('allows every cell while no start cell is set', () => {
        const grid = gridWith(5, 5);
        for (let i = 0; i < 25; i += 1) {
            expect(canPlaceMine(grid, null, i)).toBe(true);
        }
    });

    it('refuses the start cell and its 8 neighbours', () => {
        const grid = gridWith(5, 5);
        for (const i of [6, 7, 8, 11, 12, 13, 16, 17, 18]) {
            expect(canPlaceMine(grid, 12, i)).toBe(false);
        }
    });

    it('allows the cells just outside the zone', () => {
        const grid = gridWith(5, 5);
        // Cell 14 is two columns right of start 12; cell 2 is two rows above; 0 and 24 are corners.
        for (const i of [0, 2, 4, 5, 9, 10, 14, 15, 19, 20, 22, 24]) {
            expect(canPlaceMine(grid, 12, i)).toBe(true);
        }
    });

    it('refuses 6 cells and allows the cells beyond them when the start cell is on an edge', () => {
        const grid = gridWith(5, 5);
        for (const i of [1, 2, 3, 6, 7, 8]) {
            expect(canPlaceMine(grid, 2, i)).toBe(false);
        }
        for (const i of [0, 4, 5, 9, 12]) {
            expect(canPlaceMine(grid, 2, i)).toBe(true);
        }
    });

    it('uses only the cells that exist when the start cell is in a corner', () => {
        const grid = gridWith(5, 5);
        expect(canPlaceMine(grid, 0, 6)).toBe(false);
        expect(canPlaceMine(grid, 0, 2)).toBe(true);
        expect(canPlaceMine(grid, 0, 10)).toBe(true);
    });
});

describe('toBoardText', () => {
    it('writes X for the start cell, B for mines and the adjacent count elsewhere, row by row', () => {
        // Mines at the top-left and bottom-right of a 3 x 3 board, start at the top-right.
        expect(toBoardText(gridWith(3, 3, [0, 8]), 2)).toBe('B 1 X\n1 2 1\n0 1 B');
    });

    it('has no X when no start cell is set', () => {
        expect(toBoardText(gridWith(3, 3, [0, 8]), null)).toBe('B 1 0\n1 2 1\n0 1 B');
    });

    it('writes 0 everywhere on a board without mines', () => {
        expect(toBoardText(gridWith(3, 2), null)).toBe('0 0 0\n0 0 0');
    });

    it('does not end with a line break and uses one line per row', () => {
        const text = toBoardText(gridWith(4, 3, [5]), null);
        expect(text.endsWith('\n')).toBe(false);
        expect(text.split('\n')).toHaveLength(3);
        expect(text).toBe('1 1 1 0\n1 B 1 0\n1 1 1 0');
    });

    it('writes X when the start cell and a mine are the same cell', () => {
        expect(toBoardText(gridWith(2, 2, [0]), 0)).toBe('X 1\n1 1');
    });

    it('counts at most 3 in a corner, 5 on an edge and 8 in the middle', () => {
        const full = gridWith(3, 3, [0, 1, 2, 3, 5, 6, 7, 8]);
        expect(toBoardText(full, null)).toBe('B B B\nB 8 B\nB B B');
        const corner = gridWith(3, 3, [1, 3, 4]);
        expect(toBoardText(corner, null).split('\n')[0]).toBe('3 B 2');
        const edge = gridWith(3, 3, [0, 2, 3, 4, 5]);
        expect(toBoardText(edge, null).split('\n')[0]).toBe('B 5 B');
    });

    it('does not change the board', () => {
        const grid = gridWith(3, 3, [4]);
        const before = JSON.stringify(grid);
        toBoardText(grid, 0);
        expect(JSON.stringify(grid)).toBe(before);
    });
});
