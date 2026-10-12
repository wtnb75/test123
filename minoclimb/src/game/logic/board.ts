// The play field: a grid of locked cells. Pure logic, no Phaser.
import { P } from '../params';
import type { Cell } from './pieces';

/** rows x cols; 0 = empty, otherwise (mino kind + 1). */
export type Grid = number[][];

export interface Piece {
    kind: number;
    rot: number;
    cells: readonly Cell[];
    /** Column of the bounding box's left edge. */
    col: number;
    /** Row of the bounding box's top edge (fractional while falling). */
    y: number;
}

export const createGrid = (): Grid =>
    Array.from({ length: P.ROWS }, () => Array<number>(P.COLS).fill(0));

/** Walls left/right and a floor below the last row are solid; there is no ceiling. */
export const isSolid = (grid: Grid, c: number, r: number): boolean => {
    if (c < 0 || c >= P.COLS || r >= P.ROWS) return true;
    if (r < 0) return false;
    return grid[r][c] !== 0;
};

export const canPlace = (grid: Grid, cells: readonly Cell[], col: number, row: number): boolean =>
    cells.every(({ c, r }) => !isSolid(grid, col + c, row + r));

/** The row the piece stops at when dropped straight down from its current row. */
export const landingRow = (grid: Grid, cells: readonly Cell[], col: number, fromRow: number): number => {
    let row = fromRow;
    while (canPlace(grid, cells, col, row + 1)) row++;
    return row;
};

/** Writes the piece into the grid (cells above row 0 are dropped). */
export const lockPiece = (grid: Grid, piece: Piece, row: number): void => {
    for (const { c, r } of piece.cells) {
        const rr = row + r;
        if (rr >= 0 && rr < P.ROWS) grid[rr][piece.col + c] = piece.kind + 1;
    }
};

/** Removes every full row (rows above fall down). Returns the cleared row indices in ascending order. */
export const clearLines = (grid: Grid): number[] => {
    const cleared: number[] = [];
    grid.forEach((row, r) => {
        if (row.every((v) => v !== 0)) cleared.push(r);
    });
    for (const r of cleared) {
        grid.splice(r, 1);
        grid.unshift(Array<number>(P.COLS).fill(0));
    }
    return cleared;
};
