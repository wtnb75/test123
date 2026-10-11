import type { DigitOption, GameMode } from '../types';

/** The digit counts a player can pick on the Title. */
export const DIGIT_OPTIONS: readonly DigitOption[] = [2, 3, 4, 5, 6];

/** A screen narrower than this lays the digit buttons out as a 3 + 2 grid. */
export const TITLE_NARROW_WIDTH = 560;

const NAME_MIN_Y = 72;
const NAME_Y_RATIO = 0.15;
const SUBTITLE_OFFSET = 58;
const HINT_OFFSET = 42;
const MODE_ROW_OFFSET = 52;
const MODE_BUTTON_WIDTH = 130;
const MODE_BUTTON_HEIGHT = 44;
const MODE_BUTTON_GAP = 16;
const DIGIT_ROW_OFFSET = 28;
const DIGIT_BUTTON_HEIGHT = 64;
const DIGIT_WIDE_WIDTH = 100;
const DIGIT_WIDE_GAP = 16;
const DIGIT_NARROW_WIDTH = 90;
const DIGIT_NARROW_GAP = 12;
const DIGIT_NARROW_COLUMNS = 3;

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SelectLayout {
    narrow: boolean;
    nameY: number;
    subtitleY: number;
    hintY: number;
    modeButtons: Record<GameMode, Rect>;
    digitButtons: { digit: DigitOption; rect: Rect }[];
}

/** The mode carried by Scene data; anything but `hard` (including no data at all) means `normal`. */
export const modeFromData = (data?: { mode?: unknown }): GameMode => (data?.mode === 'hard' ? 'hard' : 'normal');

/** Whether `value` is one of the selectable digit counts. */
export const isDigitOption = (value: unknown): value is DigitOption =>
    typeof value === 'number' && (DIGIT_OPTIONS as readonly number[]).includes(value);

/** The digit count a key press selects on the Title, or `null` for any other key. */
export const digitFromKey = (key: string): DigitOption | null => {
    const value = /^\d$/.test(key) ? Number(key) : null;

    return isDigitOption(value) ? value : null;
};

/**
 * Positions of every Title element for a screen of `width` x `height`.
 * The name, subtitle, hint and the mode buttons are centred horizontally.
 */
export const computeSelectLayout = (width: number, height: number): SelectLayout => {
    const narrow = width < TITLE_NARROW_WIDTH;
    const nameY = Math.max(NAME_MIN_Y, Math.floor(height * NAME_Y_RATIO));
    const subtitleY = nameY + SUBTITLE_OFFSET;
    const hintY = subtitleY + HINT_OFFSET;

    const modeY = hintY + MODE_ROW_OFFSET;
    const modeTotalWidth = MODE_BUTTON_WIDTH * 2 + MODE_BUTTON_GAP;
    const modeStartX = (width - modeTotalWidth) / 2;
    const modeButtons: Record<GameMode, Rect> = {
        normal: { x: modeStartX, y: modeY, width: MODE_BUTTON_WIDTH, height: MODE_BUTTON_HEIGHT },
        hard: {
            x: modeStartX + MODE_BUTTON_WIDTH + MODE_BUTTON_GAP,
            y: modeY,
            width: MODE_BUTTON_WIDTH,
            height: MODE_BUTTON_HEIGHT
        }
    };

    const buttonWidth = narrow ? DIGIT_NARROW_WIDTH : DIGIT_WIDE_WIDTH;
    const gap = narrow ? DIGIT_NARROW_GAP : DIGIT_WIDE_GAP;
    const columns = narrow ? DIGIT_NARROW_COLUMNS : DIGIT_OPTIONS.length;
    const rowTop = modeY + MODE_BUTTON_HEIGHT + DIGIT_ROW_OFFSET;
    const gridWidth = columns * buttonWidth + (columns - 1) * gap;
    const startX = (width - gridWidth) / 2;

    const digitButtons = DIGIT_OPTIONS.map((digit, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);

        return {
            digit,
            rect: {
                x: startX + column * (buttonWidth + gap),
                y: rowTop + row * (DIGIT_BUTTON_HEIGHT + gap),
                width: buttonWidth,
                height: DIGIT_BUTTON_HEIGHT
            }
        };
    });

    return { narrow, nameY, subtitleY, hintY, modeButtons, digitButtons };
};
