import { PARAMS } from '../params';

export interface Pt {
    x: number;
    y: number;
}

export const HOLE_COUNT = PARAMS.boardCols * PARAMS.boardRows;
export const BOARD_W = PARAMS.boardCols * PARAMS.holeSpacing;
export const BOARD_H = PARAMS.boardRows * PARAMS.holeSpacing;

/** Center of hole `index` (0-based, row-major). */
export const holeCenter = (index: number): Pt => ({
    x: PARAMS.holeSpacing / 2 + (index % PARAMS.boardCols) * PARAMS.holeSpacing,
    y: PARAMS.holeSpacing / 2 + Math.floor(index / PARAMS.boardCols) * PARAMS.holeSpacing,
});

/** Keeps a view whose top-left is (x, y) inside the board. */
export const clampScroll = (x: number, y: number): Pt => ({
    x: Math.min(Math.max(x, 0), BOARD_W - PARAMS.viewW),
    y: Math.min(Math.max(y, 0), BOARD_H - PARAMS.viewH),
});

/** Top-left of the view when the view center is the board center. */
export const startScroll = (): Pt => ({
    x: (BOARD_W - PARAMS.viewW) / 2,
    y: (BOARD_H - PARAMS.viewH) / 2,
});
