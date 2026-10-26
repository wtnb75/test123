import { PROMPT_MAX_FONT_SIZE, PROMPT_REAL_FONT_SIZE, ROTATE_PROMPT_SCALE, SCREEN_HEIGHT_MAX, SCREEN_HEIGHT_MIN, SCREEN_WIDTH } from '../params';

export interface ScreenSize {
    width: number;
    height: number;
}

/** Logical size for a viewport: fixed width, height following the viewport's aspect ratio (clamped). */
export function computeScreenSize(viewWidth: number, viewHeight: number): ScreenSize {
    const raw = viewWidth > 0 ? Math.round((SCREEN_WIDTH * viewHeight) / viewWidth) : SCREEN_HEIGHT_MIN;
    const height = Math.min(Math.max(raw, SCREEN_HEIGHT_MIN), SCREEN_HEIGHT_MAX);
    return { width: SCREEN_WIDTH, height };
}

/** FIT scale of a logical size inside a viewport. */
export function fitScale(viewWidth: number, viewHeight: number, size: ScreenSize): number {
    return Math.min(viewWidth / size.width, viewHeight / size.height);
}

/**
 * Logical font size that shows the rotate prompt at about PROMPT_REAL_FONT_SIZE on-screen px at this scale,
 * capped so the text always fits the canvas (normally in two lines) and a character never outgrows the wrap width.
 */
export function promptFontSize(scale: number): number {
    if (scale <= 0) return PROMPT_MAX_FONT_SIZE;
    return Math.min(Math.ceil(PROMPT_REAL_FONT_SIZE / scale), PROMPT_MAX_FONT_SIZE);
}

/** The notice shown while the viewport is landscape and too small to read; its length sets PROMPT_MAX_FONT_SIZE. */
export const ROTATE_PROMPT_TEXT = '画面を縦にしてください';
/** Where the notice breaks when it doesn't fit one line (a natural break instead of one orphaned character). */
const ROTATE_PROMPT_LINES = ['画面を縦に', 'してください'];
const PROMPT_WRAP_WIDTH = SCREEN_WIDTH - 40;

/** The notice for a font size: one line when 1 em per character fits the wrap width, otherwise two lines. */
export function promptText(fontSize: number): string {
    return ROTATE_PROMPT_TEXT.length * fontSize <= PROMPT_WRAP_WIDTH ? ROTATE_PROMPT_TEXT : ROTATE_PROMPT_LINES.join('\n');
}

/**
 * "Rotate to portrait" shows on a landscape viewport whose FIT scale makes text unreadable: returns that scale,
 * or null when the notice should not show.
 */
export function rotatePromptScale(viewWidth: number, viewHeight: number, size: ScreenSize): number | null {
    if (viewWidth <= viewHeight) return null;
    const scale = fitScale(viewWidth, viewHeight, size);
    return scale < ROTATE_PROMPT_SCALE ? scale : null;
}
