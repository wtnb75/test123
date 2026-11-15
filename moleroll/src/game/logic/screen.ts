// Logical screen size (docs/spec.md "画面の大きさ（論理サイズ）").
import { SCREEN_LONG_SIDE_MAX_PX, SCREEN_LONG_SIDE_MIN_PX, SCREEN_SHORT_SIDE_PX } from '../params';

export interface ScreenSize {
    width: number;
    height: number;
}

/**
 * The short side stays SCREEN_SHORT_SIDE_PX; the long side follows the viewport's aspect ratio, kept in
 * [SCREEN_LONG_SIDE_MIN_PX, SCREEN_LONG_SIDE_MAX_PX]. A portrait viewport (width < height) gives a tall
 * screen, anything else (including a square) a wide one. An unknown (0) size gives a square.
 */
export function computeScreenSize(viewWidth: number, viewHeight: number): ScreenSize {
    if (viewWidth <= 0 || viewHeight <= 0) return { width: SCREEN_SHORT_SIDE_PX, height: SCREEN_SHORT_SIDE_PX };
    const clampLong = (long: number) => Math.min(Math.max(Math.round(long), SCREEN_LONG_SIDE_MIN_PX), SCREEN_LONG_SIDE_MAX_PX);
    if (viewWidth < viewHeight) {
        return { width: SCREEN_SHORT_SIDE_PX, height: clampLong((SCREEN_SHORT_SIDE_PX * viewHeight) / viewWidth) };
    }
    return { width: clampLong((SCREEN_SHORT_SIDE_PX * viewWidth) / viewHeight), height: SCREEN_SHORT_SIDE_PX };
}
