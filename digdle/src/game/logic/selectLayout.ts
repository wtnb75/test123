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

/** The 💡 state handed over by the Title or the Game: only an explicit `true` turns the candidate line on. */
export const candidatesFromData = (data?: { candidates?: unknown }): boolean => data?.candidates === true;

/** What the Game is started with: the picked digit count, the mode and the 💡 state (docs/spec.md, 画面・Scene 構成). */
export const gameStartData = (digits: DigitOption, mode: TitleMode, candidates: boolean): { digits: DigitOption; mode: TitleMode; candidates: boolean } =>
    ({ digits, mode, candidates });

/** What the Title is reopened with from the Game: the mode and the 💡 state, both kept as the player left them. */
export const titleDataFromGame = (mode: TitleMode, candidates: boolean): { mode: TitleMode; candidates: boolean } =>
    ({ mode, candidates });

/** Whether `value` is one of the selectable digit counts. */
export const isDigitOption = (value: unknown): value is DigitOption =>
    typeof value === 'number' && (DIGIT_OPTIONS as readonly number[]).includes(value);

/** The digit count a key press selects on the Title, or `null` for any other key. */
export const digitFromKey = (key: string): DigitOption | null => {
    const value = /^\d$/.test(key) ? Number(key) : null;

    return isDigitOption(value) ? value : null;
};
