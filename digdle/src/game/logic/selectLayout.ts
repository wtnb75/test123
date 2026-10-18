import type { DigitOption, TitleMode } from '../types';

/** The digit counts a player can pick on the Title. */
export const DIGIT_OPTIONS: readonly DigitOption[] = [2, 3, 4, 5, 6];

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** The mode carried by Scene data; anything but `hard` or `daily` (including no data at all) means `normal`. */
export const modeFromData = (data?: { mode?: unknown }): TitleMode =>
    (data?.mode === 'hard' || data?.mode === 'daily' ? data.mode : 'normal');

/** Whether `value` is one of the selectable digit counts. */
export const isDigitOption = (value: unknown): value is DigitOption =>
    typeof value === 'number' && (DIGIT_OPTIONS as readonly number[]).includes(value);

/** The digit count a key press selects on the Title, or `null` for any other key. */
export const digitFromKey = (key: string): DigitOption | null => {
    const value = /^\d$/.test(key) ? Number(key) : null;

    return isDigitOption(value) ? value : null;
};
