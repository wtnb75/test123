// Screen scale and the "rotate to portrait" notice (docs/spec.md "画面の大きさ（論理サイズ）"). Pure; no Phaser.
import { H, PROMPT_MAX_FONT_SIZE, PROMPT_REAL_FONT_SIZE, ROTATE_PROMPT_SCALE, W } from '../params';

/** FIT scale of the fixed W x H logical screen inside a viewport. */
export function fitScale(viewWidth: number, viewHeight: number): number {
    return Math.min(viewWidth / W, viewHeight / H);
}

/**
 * A landscape viewport whose FIT scale is below ROTATE_PROMPT_SCALE shows the "rotate" notice: returns that
 * scale, or null when the notice should not show.
 */
export function rotatePromptScale(viewWidth: number, viewHeight: number): number | null {
    if (viewWidth <= viewHeight) return null;
    const scale = fitScale(viewWidth, viewHeight);
    return scale < ROTATE_PROMPT_SCALE ? scale : null;
}

/** Logical font size that shows the notice at about PROMPT_REAL_FONT_SIZE on-screen px, capped so it fits. */
export function promptFontSize(scale: number): number {
    if (scale <= 0) return PROMPT_MAX_FONT_SIZE;
    return Math.min(Math.ceil(PROMPT_REAL_FONT_SIZE / scale), PROMPT_MAX_FONT_SIZE);
}

export const ROTATE_PROMPT_TEXT = '画面を縦にしてください';
/** Where the notice breaks when it does not fit one line (a natural break, not one orphaned character). */
const ROTATE_PROMPT_LINES = ['画面を縦に', 'してください'];
/** The width the notice may use: promptText and the Scene's word wrap both use it. */
export const PROMPT_WRAP_WIDTH = W - 40;

/** One line when 1 em per character fits the wrap width, otherwise two lines. */
export function promptText(fontSize: number): string {
    return ROTATE_PROMPT_TEXT.length * fontSize <= PROMPT_WRAP_WIDTH ? ROTATE_PROMPT_TEXT : ROTATE_PROMPT_LINES.join('\n');
}
