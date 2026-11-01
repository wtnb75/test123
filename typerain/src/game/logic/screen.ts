// Logical screen size and the "rotate" notice (docs/spec.md "画面の大きさ（論理サイズ）").
import {
    FIELD_TOP,
    FLOOR_FROM_BOTTOM,
    PROMPT_MAX_FONT_SIZE,
    PROMPT_REAL_FONT_SIZE,
    ROTATE_PROMPT_SCALE,
    SCREEN_HEIGHT_MAX,
    SCREEN_HEIGHT_MIN,
    SCREEN_WIDTH,
    WORD_H,
} from '../params';

export interface ScreenSize {
    width: number;
    height: number;
}

/** Logical size for a viewport: fixed width, height following the viewport's aspect ratio (clamped). */
export function computeScreenSize(viewWidth: number, viewHeight: number): ScreenSize {
    const raw = viewWidth > 0 ? Math.round((SCREEN_WIDTH * viewHeight) / viewWidth) : SCREEN_HEIGHT_MIN;
    return { width: SCREEN_WIDTH, height: Math.min(Math.max(raw, SCREEN_HEIGHT_MIN), SCREEN_HEIGHT_MAX) };
}

/** FIT scale of a logical size inside a viewport. */
export function fitScale(viewWidth: number, viewHeight: number, size: ScreenSize): number {
    return Math.min(viewWidth / size.width, viewHeight / size.height);
}

/**
 * "Rotate to portrait" shows on a landscape viewport (width > height) whose FIT scale is below
 * ROTATE_PROMPT_SCALE: returns that scale, or null when the notice should not show.
 */
export function rotatePromptScale(viewWidth: number, viewHeight: number, size: ScreenSize): number | null {
    if (viewWidth <= viewHeight) return null;
    const scale = fitScale(viewWidth, viewHeight, size);
    return scale < ROTATE_PROMPT_SCALE ? scale : null;
}

/** Logical font size of the notice: about PROMPT_REAL_FONT_SIZE on-screen px, capped to fit the canvas. */
export function promptFontSize(scale: number): number {
    if (scale <= 0) return PROMPT_MAX_FONT_SIZE;
    return Math.min(Math.ceil(PROMPT_REAL_FONT_SIZE / scale), PROMPT_MAX_FONT_SIZE);
}

/** The notice, in two lines. */
export const ROTATE_PROMPT_TEXT = 'ROTATE\n画面を縦にしてください';

/** y of the floor line for a logical height. */
export const floorYFor = (height: number): number => height - FLOOR_FROM_BOTTOM;

/** y of a word's top for its progress p (0 at the top of the field, 1 when its bottom meets the floor). */
export const wordYFor = (p: number, fallDistance: number): number => FIELD_TOP + p * fallDistance;

/** How far a word's top travels from where it appears to where its bottom reaches the floor. */
export const fallDistanceFor = (height: number): number => floorYFor(height) - FIELD_TOP - WORD_H;
