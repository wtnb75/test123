import type { DigitOption, TitleMode } from '../types';
import { DIGIT_OPTIONS, type Rect } from './selectLayout';
import { DEMO_ATTEMPTS, DEMO_CELL_GAP, DEMO_CELL_MAX, DEMO_CELL_MIN, DEMO_DIGITS, DEMO_MARGIN } from './titleDemo';

/** The Title name's font size (px). */
export const TITLE_NAME_FONT = 44;

const NAME_CENTER = 44;
const MODE_TOP = 84;
/** The widest mode button; the row shrinks its buttons to fit the width it is given. */
const MODE_WIDTH = 78;
/** The narrowest mode button the row may shrink to. */
const MODE_MIN_WIDTH = 48;
const MODE_HEIGHT = 40;
const MODE_GAP = 8;
/** The mode row's label size (px), and the smallest it may shrink to so a label fits its button. */
export const MODE_LABEL_FONT = 16;
export const MODE_LABEL_MIN_FONT = 12;
/** The candidate toggle (💡): a 44 px square tap target at the right end of the mode row. */
const CANDIDATE_SIZE = 44;
/** The mode row is 3 modes + the toggle at most: 3 × 78 + 3 × 8 gaps + 44 = 302 px. */
const MODE_ROW_MAX = 3 * MODE_WIDTH + CANDIDATE_SIZE + 3 * MODE_GAP;
const DIGIT_TOP = 140;
const DIGIT_HEIGHT = 52;
const DIGIT_GAP = 8;
/** The space the digit row keeps inside its column, on both sides together (docs/spec.md: 桁数ボタンの幅). */
const DIGIT_ROW_INSET = 16;
const DIGIT_MAX_WIDTH = 64;
const DIGIT_SIDE_MIN_WIDTH = 40;
/** The bottom of the digit buttons, relative to `y0`. */
const DIGIT_BOTTOM = DIGIT_TOP + DIGIT_HEIGHT;
/** The top of the demo below the digit buttons, relative to `y0`. */
const DEMO_TOP = DIGIT_BOTTOM + 16;
/** The name's top to the digit buttons' bottom: the height of the two-column left block. */
const BLOCK_HEIGHT = 170;
const BLOCK_NAME_CENTER = 22;
const BLOCK_MODE_TOP = 62;
const BLOCK_DIGIT_TOP = 118;
const COLUMN_PADDING = 16;
/** The screen height below which the stacked layout would cut the digit buttons off. */
const STACKED_MIN_HEIGHT = DIGIT_BOTTOM;
/** The narrowest screen for the two-column arrangement: a fixed boundary (docs/spec.md, 配置). */
const COLUMNS_MIN_WIDTH = 504;

export type TitleArrangement = 'stacked' | 'columns';

export interface DemoLayout {
    cell: number;
    gap: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface TitleLayout {
    arrangement: TitleArrangement;
    name: { x: number; y: number };
    modeButtons: Record<TitleMode, Rect>;
    /** The 💡 toggle at the right end of the mode row. */
    candidateButton: Rect;
    digitButtons: { digit: DigitOption; rect: Rect }[];
    /** `null` when the free area is too small (the Title is then drawn without the demo). */
    demo: DemoLayout | null;
}

const boardSize = (cell: number): { width: number; height: number } => ({
    width: DEMO_DIGITS * cell + (DEMO_DIGITS - 1) * DEMO_CELL_GAP,
    height: DEMO_ATTEMPTS * cell + (DEMO_ATTEMPTS - 1) * DEMO_CELL_GAP
});

const demoCell = (availableHeight: number): number =>
    Math.min(DEMO_CELL_MAX, Math.floor((availableHeight - (DEMO_ATTEMPTS - 1) * DEMO_CELL_GAP) / DEMO_ATTEMPTS));

/** The digit button width a column of `columnWidth` px would give (before the 64 px cap and the 1 px floor). */
const rawDigitWidth = (columnWidth: number): number =>
    Math.floor((columnWidth - DIGIT_ROW_INSET - (DIGIT_OPTIONS.length - 1) * DIGIT_GAP) / DIGIT_OPTIONS.length);

const digitWidth = (columnWidth: number): number => Math.max(1, Math.min(DIGIT_MAX_WIDTH, rawDigitWidth(columnWidth)));

/** The mode row's width in a column of `columnWidth` px: the full 302 px, or the column when it is narrower. */
export const modeRowWidth = (columnWidth: number): number => Math.min(MODE_ROW_MAX, columnWidth);

/** One mode button's width in a row of `rowWidth` px: the 3 mode buttons share what the toggle leaves. */
export const modeButtonWidth = (rowWidth: number): number =>
    Math.max(MODE_MIN_WIDTH, Math.min(MODE_WIDTH, Math.floor((rowWidth - CANDIDATE_SIZE - 3 * MODE_GAP) / 3)));

/** The room a mode label has inside its button: the button's width less 4 px on each side (docs/spec.md, 配置). */
const MODE_LABEL_INSET = 4;
export const modeLabelRoom = (buttonWidth: number): number => buttonWidth - 2 * MODE_LABEL_INSET;

/**
 * The mode label's font size: the largest size from 16 px down to 12 px whose width fits `maxWidth`.
 * `widthAt(size)` measures the label at that size (the Scene passes its text object's measurement).
 */
export const modeLabelFontSize = (widthAt: (size: number) => number, maxWidth: number): number => {
    let size = MODE_LABEL_FONT;

    while (size > MODE_LABEL_MIN_FONT && widthAt(size) > maxWidth) {
        size -= 1;
    }

    return size;
};

/**
 * The mode buttons and the 💡 toggle, centred at `cx` in a column of `columnWidth`; the digit row and the name too.
 * `nameY`, `modeTop`, `digitTop` are absolute.
 */
const placeBlock = (
    cx: number,
    columnWidth: number,
    digitW: number,
    nameY: number,
    modeTop: number,
    digitTop: number
): Pick<TitleLayout, 'name' | 'modeButtons' | 'candidateButton' | 'digitButtons'> => {
    const rowWidth = modeRowWidth(columnWidth);
    const rowLeft = Math.floor(cx - rowWidth / 2);
    const modeW = modeButtonWidth(rowWidth);
    const modeStep = modeW + MODE_GAP;
    const digitRowWidth = DIGIT_OPTIONS.length * digitW + (DIGIT_OPTIONS.length - 1) * DIGIT_GAP;
    const digitLeft = Math.floor(cx - digitRowWidth / 2);

    return {
        name: { x: cx, y: nameY },
        modeButtons: {
            normal: { x: rowLeft, y: modeTop, width: modeW, height: MODE_HEIGHT },
            hard: { x: rowLeft + modeStep, y: modeTop, width: modeW, height: MODE_HEIGHT },
            daily: { x: rowLeft + 2 * modeStep, y: modeTop, width: modeW, height: MODE_HEIGHT }
        },
        // Centred on the mode buttons: 44 px high against their 40 px.
        candidateButton: {
            x: rowLeft + rowWidth - CANDIDATE_SIZE,
            y: modeTop - (CANDIDATE_SIZE - MODE_HEIGHT) / 2,
            width: CANDIDATE_SIZE,
            height: CANDIDATE_SIZE
        },
        digitButtons: DIGIT_OPTIONS.map((digit, index) => ({
            digit,
            rect: { x: digitLeft + index * (digitW + DIGIT_GAP), y: digitTop, width: digitW, height: DIGIT_HEIGHT }
        }))
    };
};

const stacked = (width: number, height: number, cell: number | null): TitleLayout => {
    const board = cell === null ? null : boardSize(cell);
    const totalHeight = DEMO_TOP + (board === null ? 0 : board.height + DEMO_MARGIN);
    const y0 = Math.max(0, Math.floor((height - totalHeight) / 3));
    const cx = Math.floor(width / 2);

    return {
        arrangement: 'stacked',
        ...placeBlock(cx, width, digitWidth(width), y0 + NAME_CENTER, y0 + MODE_TOP, y0 + DIGIT_TOP),
        demo: cell === null || board === null
            ? null
            : { cell, gap: DEMO_CELL_GAP, left: Math.floor(cx - board.width / 2), top: y0 + DEMO_TOP, ...board }
    };
};

const columns = (width: number, height: number, cell: number | null): TitleLayout => {
    const top0 = Math.max(0, Math.floor((height - BLOCK_HEIGHT) / 2));
    const columnWidth = Math.floor(width / 2) - COLUMN_PADDING;
    const board = cell === null ? null : boardSize(cell);
    const demoCx = Math.floor((width * 3) / 4);

    return {
        arrangement: 'columns',
        ...placeBlock(
            Math.floor(width / 4),
            columnWidth,
            digitWidth(columnWidth),
            top0 + BLOCK_NAME_CENTER,
            top0 + BLOCK_MODE_TOP,
            top0 + BLOCK_DIGIT_TOP
        ),
        demo: cell === null || board === null
            ? null
            : {
                cell,
                gap: DEMO_CELL_GAP,
                left: Math.floor(demoCx - board.width / 2),
                top: Math.floor((height - board.height) / 2),
                ...board
            }
    };
};

/**
 * Positions of every Title element (and the demo board) for a `width` x `height` screen.
 * Stacked is preferred; the two-column arrangement is used when only it leaves room for the demo
 * (or, without a demo, when the screen is too low for the stacked digit buttons and wide enough for the left column).
 */
export const computeTitleLayout = (width: number, height: number): TitleLayout => {
    const stackedCell = demoCell(height - DEMO_TOP - DEMO_MARGIN);

    if (stackedCell >= DEMO_CELL_MIN) {
        return stacked(width, height, stackedCell);
    }

    const columnWidth = Math.floor(width / 2) - COLUMN_PADDING;
    const sideCell = demoCell(height - 2 * DEMO_MARGIN);
    const sideDigitsFit = rawDigitWidth(columnWidth) >= DIGIT_SIDE_MIN_WIDTH;

    if (sideDigitsFit && sideCell >= DEMO_CELL_MIN) {
        return columns(width, height, sideCell);
    }

    const canColumnsWithoutDemo = height < STACKED_MIN_HEIGHT && width >= COLUMNS_MIN_WIDTH;

    return canColumnsWithoutDemo ? columns(width, height, null) : stacked(width, height, null);
};
