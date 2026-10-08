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

/** 768 x 1024 view over a 6 x 8 board: the same visible area and the same share of the board. */
export const PORTRAIT: Layout = make(
    PARAMS.portraitViewW,
    PARAMS.portraitViewH,
    PARAMS.portraitBoardCols,
    PARAMS.portraitBoardRows,
);

/** Portrait when the window is strictly taller than wide; a square window counts as landscape. */
export const pickLayout = (width: number, height: number): Layout => (height > width ? PORTRAIT : LANDSCAPE);
