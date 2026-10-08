import { PARAMS } from '../params';
import { LANDSCAPE, type Layout } from './layout';

export interface Pt {
    x: number;
    y: number;
}

// The landscape (default) board. Both layouts have the same number of holes.
export const HOLE_COUNT = LANDSCAPE.cols * LANDSCAPE.rows;
export const BOARD_W = LANDSCAPE.boardW;
export const BOARD_H = LANDSCAPE.boardH;

/** Center of hole `index` (0-based, row-major) in `layout` (landscape when omitted). */
export const holeCenter = (index: number, layout: Layout = LANDSCAPE): Pt => ({
    x: PARAMS.holeSpacing / 2 + (index % layout.cols) * PARAMS.holeSpacing,
    y: PARAMS.holeSpacing / 2 + Math.floor(index / layout.cols) * PARAMS.holeSpacing,
});

/** Keeps a view whose top-left is (x, y) inside the board. */
export const clampScroll = (x: number, y: number, layout: Layout = LANDSCAPE): Pt => ({
    x: Math.min(Math.max(x, 0), layout.boardW - layout.viewW),
    y: Math.min(Math.max(y, 0), layout.boardH - layout.viewH),
});

/** Top-left of the view when the view center is the board center. */
export const startScroll = (layout: Layout = LANDSCAPE): Pt => ({
    x: (layout.boardW - layout.viewW) / 2,
    y: (layout.boardH - layout.viewH) / 2,
});
