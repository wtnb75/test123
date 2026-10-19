/** Where the Game board, keyboard and title go on a `width` x `height` screen (spec: Game layout). */
export interface LayoutMetrics {
    width: number;
    height: number;
    keyboardDock: 'right' | 'bottom';
    leftTitleX: number;
    leftTitleY: number;
    boardCenterX: number;
    boardStartX: number;
    boardStartY: number;
    boardWidth: number;
    boardHeight: number;
    boardGap: number;
    boardCellSize: number;
    keyboardStartX: number;
    keyboardStartY: number;
    keyboardCols: number;
    keyboardRows: number;
    keyboardButtonHeight: number;
    keyboardButtonWidth: number;
    keyboardGap: number;
    /** The width of the right panel (the keyboard dock); 0 when the keyboard is at the bottom. */
    rightPanelWidth: number;
}

/** The top of the board area; the strip above it (y 0..BOARD_TOP) holds the notice. */
export const BOARD_TOP = 60;
/** The smallest height of a portrait key, so a key is at least 44 px to tap. */
export const MIN_PORTRAIT_KEY_HEIGHT = 44;
const MAX_PORTRAIT_KEY_HEIGHT = 54;

export const computeGameLayout = (width: number, height: number, rows: number, cols: number): LayoutMetrics => {
    const outerMargin = Math.max(8, Math.min(14, Math.floor(width * 0.02)));
    const leftTitleWidth = Math.max(36, Math.min(62, Math.floor(width * 0.07)));
    const panelGap = Math.max(6, Math.min(12, Math.floor(width * 0.02)));

    const keyboardDock: 'right' | 'bottom' = height > width ? 'bottom' : 'right';
    const keyboardCols = keyboardDock === 'right' ? 2 : 4;
    const keyboardRows = keyboardDock === 'right' ? 6 : 3;
    const keyboardGap = 8;

    const rightPanelWidth = keyboardDock === 'right'
        ? Math.max(140, Math.min(220, Math.floor(width * 0.20)))
        : 0;

    const keyboardButtonWidth = keyboardDock === 'right'
        ? Math.floor((rightPanelWidth - keyboardGap * (keyboardCols - 1)) / keyboardCols)
        : Math.max(52, Math.floor((width - (outerMargin * 2) - leftTitleWidth - panelGap - keyboardGap * (keyboardCols - 1)) / keyboardCols));

    const keyboardButtonHeight = keyboardDock === 'right'
        ? Math.max(36, Math.min(64, Math.floor((height - 120 - keyboardGap * (keyboardRows - 1)) / keyboardRows)))
        : Math.max(
            MIN_PORTRAIT_KEY_HEIGHT,
            Math.min(MAX_PORTRAIT_KEY_HEIGHT, Math.floor((height * 0.22 - keyboardGap * (keyboardRows - 1)) / keyboardRows))
        );

    const bottomKeyboardHeight = keyboardDock === 'bottom'
        ? keyboardRows * keyboardButtonHeight + (keyboardRows - 1) * keyboardGap
        : 0;

    const boardBottom = keyboardDock === 'bottom'
        ? height - outerMargin - bottomKeyboardHeight - panelGap
        : height - outerMargin;
    const boardLeft = outerMargin + leftTitleWidth + panelGap;
    const boardRight = width - rightPanelWidth - panelGap - outerMargin;
    const boardHeightLimit = Math.max(120, boardBottom - BOARD_TOP);
    const boardWidthLimit = Math.max(120, boardRight - boardLeft);

    const boardGap = Math.max(4, Math.min(10, Math.floor(boardHeightLimit / (rows * 7))));
    const cellByHeight = Math.floor((boardHeightLimit - boardGap * (rows - 1)) / rows);
    const cellByWidth = Math.floor((boardWidthLimit - boardGap * (cols - 1)) / cols);
    const boardCellSize = Math.max(28, Math.min(92, cellByHeight, cellByWidth));

    const boardWidth = cols * boardCellSize + (cols - 1) * boardGap;
    const boardHeight = rows * boardCellSize + (rows - 1) * boardGap;
    const boardStartX = boardLeft + Math.max(0, Math.floor((boardWidthLimit - boardWidth) / 2));
    const boardStartY = BOARD_TOP + Math.max(0, Math.floor((boardHeightLimit - boardHeight) / 2));

    const keyboardHeight = keyboardRows * keyboardButtonHeight + (keyboardRows - 1) * keyboardGap;
    const keyboardWidth = keyboardCols * keyboardButtonWidth + (keyboardCols - 1) * keyboardGap;
    const keyboardStartX = keyboardDock === 'right'
        ? width - outerMargin - rightPanelWidth
        : width - outerMargin - keyboardWidth;
    const keyboardStartY = keyboardDock === 'right'
        ? Math.max(72, Math.floor((height - keyboardHeight) / 2))
        : height - outerMargin - keyboardHeight;

    return {
        width,
        height,
        keyboardDock,
        leftTitleX: outerMargin + Math.floor(leftTitleWidth / 2),
        leftTitleY: Math.floor(height / 2),
        boardCenterX: boardStartX + boardWidth / 2,
        boardStartX,
        boardStartY,
        boardWidth,
        boardHeight,
        boardGap,
        boardCellSize,
        keyboardStartX,
        keyboardStartY,
        keyboardCols,
        keyboardRows,
        keyboardButtonHeight,
        keyboardButtonWidth,
        keyboardGap,
        rightPanelWidth
    };
};

/** Where the invalid-input notice goes: the strip above the board, between the 🏠 and ◀️ icons. */
export interface ToastPlacement {
    centerX: number;
    centerY: number;
    /** The wrap width of the text. */
    textWidth: number;
    /** The widest the background may be: inside the icons' outer edges (x 56 and width - 56). */
    maxBoxWidth: number;
}

export const TOAST_CENTER_Y = BOARD_TOP / 2;
export const TOAST_PADDING_X = 14;
export const TOAST_PADDING_Y = 4;
export const TOAST_MAX_BOX_HEIGHT = 58;
export const TOAST_FONT_SIZE = 16;
export const TOAST_MIN_FONT_SIZE = 12;
const MIN_TOAST_TEXT_WIDTH = 20;

export const computeToastPlacement = (width: number): ToastPlacement => {
    // An even width keeps both edges on whole pixels around the whole-pixel centre.
    const maxBoxWidth = Math.max(2, Math.floor((width - 112) / 2) * 2);

    return {
        centerX: Math.floor(width / 2),
        centerY: TOAST_CENTER_Y,
        // At least one glyph wide: Phaser's advanced wrap throws for a narrower width.
        textWidth: Math.max(MIN_TOAST_TEXT_WIDTH, maxBoxWidth - TOAST_PADDING_X * 2),
        maxBoxWidth
    };
};

/** The background width for text `textWidth` px wide: padded, rounded up to an even number, at most `maxBoxWidth`. */
export const toastBoxWidth = (textWidth: number, maxBoxWidth: number): number =>
    Math.min(Math.ceil((textWidth + TOAST_PADDING_X * 2) / 2) * 2, maxBoxWidth);

/**
 * The font size of the notice: 16 px, or 1 px smaller at a time (down to 12 px) until the
 * background (`boxHeightAt(fontSize)`) is at most 58 px tall. At 12 px it stays even if still taller.
 */
export const pickToastFontSize = (boxHeightAt: (fontSize: number) => number): number => {
    let size = TOAST_FONT_SIZE;
    while (size > TOAST_MIN_FONT_SIZE && boxHeightAt(size) > TOAST_MAX_BOX_HEIGHT) {
        size -= 1;
    }
    return size;
};
