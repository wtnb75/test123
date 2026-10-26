// Layout of the play screen (`Game`) in logical pixels. The width is fixed; the height follows the
// viewport's aspect ratio, with a minimum. Pure functions, so the numbers can be tested without Phaser.

export const CANVAS_WIDTH = 480;
export const CANVAS_MIN_HEIGHT = 960;

export const TABLE_TOP = 110;
export const ROW_HEIGHT = 56;
export const BUTTON_WIDTH = 72;
export const BUTTON_HEIGHT = 44;
export const BUTTON_CENTERS_X = [40, 120, 200, 280, 360];

/** Top line: level (left), target/start/current (centre), remaining time (right). */
export const TOP_TEXT_SIZE = 26;
export const TOP_TEXT_Y = 14;
export const LEVEL_TEXT_X = 12;
export const TIMER_TEXT_RIGHT_X = 468;
export const HEADER_TEXT_X = 240;
export const HEADER_TEXT_Y = 52;

const STATUS_FROM_BOTTOM = 82;
const SCORE_FROM_BOTTOM = 48;

/** Result-screen button (「最初から」 on a loss, TITLE on a clear): fixed centre y, fits between the table and the status line. */
export const RESULT_BUTTON_X = 240;
export const RESULT_BUTTON_Y = 824;
export const RESULT_BUTTON_WIDTH = 240;
export const RESULT_BUTTON_HEIGHT = 77;

/** Logical canvas height for a viewport: fit the aspect ratio, never below CANVAS_MIN_HEIGHT. */
export function canvasHeight(viewWidth: number, viewHeight: number): number {
    if (viewWidth <= 0) return CANVAS_MIN_HEIGHT;
    return Math.max(CANVAS_MIN_HEIGHT, (CANVAS_WIDTH * viewHeight) / viewWidth);
}

/** Centre y of table row `index` (0-based). */
export function rowCenterY(index: number): number {
    return TABLE_TOP + ROW_HEIGHT / 2 + index * ROW_HEIGHT;
}

/** Centre y of the status line, measured from the bottom edge. */
export function statusY(height: number): number {
    return height - STATUS_FROM_BOTTOM;
}

/** Centre y of the score line, measured from the bottom edge. */
export function scoreY(height: number): number {
    return height - SCORE_FROM_BOTTOM;
}
