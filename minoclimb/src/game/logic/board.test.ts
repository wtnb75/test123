import { describe, expect, it } from 'vitest';
import { P } from '../params';
import {
    canPlace, clearLines, createGrid, isSolid, landingRow, lockPiece, type Grid, type Piece,
} from './board';
import { shapeCells } from './pieces';

const I = 0;
const O = 1;

const fillRow = (grid: Grid, row: number, except: number[] = []): void => {
    for (let c = 0; c < P.COLS; c++) {
        if (!except.includes(c)) grid[row][c] = 3;
    }
};

const piece = (kind: number, rot: number, col: number, y: number): Piece => ({
    kind, rot, cells: shapeCells(kind, rot), col, y,
});

describe('createGrid', () => {
    it('is ROWS x COLS and empty', () => {
        const grid = createGrid();
        expect(grid).toHaveLength(P.ROWS);
        expect(grid.every((row) => row.length === P.COLS && row.every((v) => v === 0))).toBe(true);
    });

    it('creates independent rows', () => {
        const grid = createGrid();
        grid[0][0] = 1;
        expect(grid[1][0]).toBe(0);
    });
});

describe('isSolid', () => {
    it('treats cells outside the left and right edges as walls', () => {
        const grid = createGrid();
        expect(isSolid(grid, -1, 5)).toBe(true);
        expect(isSolid(grid, P.COLS, 5)).toBe(true);
        expect(isSolid(grid, 0, 5)).toBe(false);
        expect(isSolid(grid, P.COLS - 1, 5)).toBe(false);
    });

    it('treats the row below the last row as the floor', () => {
        const grid = createGrid();
        expect(isSolid(grid, 3, P.ROWS)).toBe(true);
        expect(isSolid(grid, 3, P.ROWS - 1)).toBe(false);
    });

    it('treats rows above row 0 as empty space, but side walls still apply there', () => {
        const grid = createGrid();
        expect(isSolid(grid, 3, -1)).toBe(false);
        expect(isSolid(grid, 3, -50)).toBe(false);
        expect(isSolid(grid, -1, -5)).toBe(true);
    });

    it('is true for a locked cell', () => {
        const grid = createGrid();
        grid[7][4] = 2;
        expect(isSolid(grid, 4, 7)).toBe(true);
    });
});

describe('canPlace', () => {
    it('accepts a free spot and rejects walls, the floor and locked cells', () => {
        const grid = createGrid();
        const horizontalI = shapeCells(I, 0);
        expect(canPlace(grid, horizontalI, 0, 0)).toBe(true);
        expect(canPlace(grid, horizontalI, -1, 0)).toBe(false);
        expect(canPlace(grid, horizontalI, P.COLS - 3, 0)).toBe(false);
        expect(canPlace(grid, horizontalI, 0, P.ROWS)).toBe(false);
        grid[4][2] = 1;
        expect(canPlace(grid, horizontalI, 0, 4)).toBe(false);
        expect(canPlace(grid, horizontalI, 0, 3)).toBe(true);
    });

    it('accepts rows partly above the field', () => {
        expect(canPlace(createGrid(), shapeCells(I, 1), 0, -3)).toBe(true);
    });
});

describe('landingRow', () => {
    it('stops on the floor of an empty field', () => {
        const grid = createGrid();
        expect(landingRow(grid, shapeCells(I, 0), 3, -4)).toBe(P.ROWS - 1);
        expect(landingRow(grid, shapeCells(I, 1), 3, -4)).toBe(P.ROWS - 4);
        expect(landingRow(grid, shapeCells(O, 0), 3, -4)).toBe(P.ROWS - 2);
    });

    it('stops on top of a locked cell', () => {
        const grid = createGrid();
        grid[15][0] = 1;
        // O at columns 0-1: its bottom row must stay above row 15.
        expect(landingRow(grid, shapeCells(O, 0), 0, -4)).toBe(13);
        // The neighbouring columns are free, so O at columns 1-2 falls to the floor.
        expect(landingRow(grid, shapeCells(O, 0), 1, -4)).toBe(P.ROWS - 2);
    });

    it('works at the wall columns for the widest piece', () => {
        const grid = createGrid();
        expect(landingRow(grid, shapeCells(I, 0), 0, -4)).toBe(P.ROWS - 1);
        expect(landingRow(grid, shapeCells(I, 0), P.COLS - 4, -4)).toBe(P.ROWS - 1);
    });

    it('returns the start row when the piece cannot move', () => {
        const grid = createGrid();
        grid[1][3] = 1;
        expect(landingRow(grid, shapeCells(I, 0), 0, 0)).toBe(0);
    });
});

describe('lockPiece', () => {
    it('writes the kind + 1 into exactly the piece cells', () => {
        const grid = createGrid();
        lockPiece(grid, piece(2, 0, 3, 0), 10); // T: (0,0) (1,0) (2,0) (1,1)
        const filled: string[] = [];
        grid.forEach((row, r) => row.forEach((v, c) => {
            if (v !== 0) filled.push(`${c},${r}:${v}`);
        }));
        expect(filled.sort()).toEqual(['3,10:3', '4,10:3', '4,11:3', '5,10:3']);
    });

    it('drops cells that are above row 0', () => {
        const grid = createGrid();
        lockPiece(grid, piece(I, 1, 2, 0), -2); // vertical I at rows -2..1
        expect(grid[0][2]).toBe(1);
        expect(grid[1][2]).toBe(1);
        expect(grid.flat().filter((v) => v !== 0)).toHaveLength(2);
    });
});

describe('clearLines', () => {
    it('does nothing when no row is full', () => {
        const grid = createGrid();
        fillRow(grid, 19, [4]);
        const before = JSON.stringify(grid);
        expect(clearLines(grid)).toEqual([]);
        expect(JSON.stringify(grid)).toBe(before);
    });

    it('removes one full row and drops everything above it by one', () => {
        const grid = createGrid();
        fillRow(grid, 19);
        grid[18][2] = 5;
        grid[10][7] = 6;
        expect(clearLines(grid)).toEqual([19]);
        expect(grid).toHaveLength(P.ROWS);
        expect(grid[19][2]).toBe(5);
        expect(grid[11][7]).toBe(6);
        expect(grid[10][7]).toBe(0);
        expect(grid[0].every((v) => v === 0)).toBe(true);
    });

    it('removes adjacent full rows together', () => {
        const grid = createGrid();
        fillRow(grid, 19);
        fillRow(grid, 18);
        grid[17][1] = 4;
        expect(clearLines(grid)).toEqual([18, 19]);
        expect(grid[19][1]).toBe(4);
        expect(grid.flat().filter((v) => v !== 0)).toHaveLength(1);
    });

    it('removes separated full rows and keeps the rows in between', () => {
        const grid = createGrid();
        fillRow(grid, 19);
        fillRow(grid, 17);
        grid[18][0] = 7;
        grid[16][9] = 8;
        expect(clearLines(grid)).toEqual([17, 19]);
        // Row 18 had one cell; it ends up directly above the floor row's old place, shifted by 1.
        expect(grid[19][0]).toBe(7);
        expect(grid[18][9]).toBe(8);
        expect(grid.flat().filter((v) => v !== 0)).toHaveLength(2);
    });

    it('clears the top row too', () => {
        const grid = createGrid();
        fillRow(grid, 0);
        expect(clearLines(grid)).toEqual([0]);
        expect(grid.flat().every((v) => v === 0)).toBe(true);
    });
});
