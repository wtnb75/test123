import { PARAMS } from '../params';

/** The view (what the player sees) and the board (the grid of holes) for one orientation. */
export interface Layout {
    readonly viewW: number;
    readonly viewH: number;
    readonly cols: number;
    readonly rows: number;
    readonly boardW: number;
    readonly boardH: number;
}

const make = (viewW: number, viewH: number, cols: number, rows: number): Layout => ({
    viewW,
    viewH,
    cols,
    rows,
    boardW: cols * PARAMS.holeSpacing,
    boardH: rows * PARAMS.holeSpacing,
});

/** The default layout: 1024 x 768 view over an 8 x 6 board. */
export const LANDSCAPE: Layout = make(PARAMS.viewW, PARAMS.viewH, PARAMS.boardCols, PARAMS.boardRows);

/** The portrait layout for a view `viewH` high: 768 wide over a 6 x 8 board (1920 x 2560). */
export const portraitLayout = (viewH: number): Layout =>
    make(PARAMS.portraitViewW, viewH, PARAMS.portraitBoardCols, PARAMS.portraitBoardRows);

/** The smallest portrait layout, 768 x 1024 (3:4). */
export const PORTRAIT: Layout = portraitLayout(PARAMS.portraitViewHMin);

/**
 * How far to move a menu screen's vertical positions so the group stays centered when the portrait canvas is
 * taller than its minimum (the positions are laid out for 1024 px). 0 in landscape and at the minimum height.
 */
export const verticalOffset = (layout: Layout): number =>
    layout.viewH > layout.viewW ? Math.round((layout.viewH - PARAMS.portraitViewHMin) / 2) : 0;

/**
 * The layout for a window of `width` x `height`. Portrait when the window is strictly taller than wide, with a
 * view height that follows the window shape: round(768 x height / width) (half rounds up), kept within
 * [portraitViewHMin, portraitViewHMax]. A square window counts as landscape, and so does a window whose
 * size is 0, negative or not a number (e.g. 0 x 0 right after start-up).
 */
export const pickLayout = (width: number, height: number): Layout => {
    const valid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    if (!valid || height <= width) return LANDSCAPE;
    const viewH = Math.round((PARAMS.portraitViewW * height) / width);
    return portraitLayout(Math.min(PARAMS.portraitViewHMax, Math.max(PARAMS.portraitViewHMin, viewH)));
};
