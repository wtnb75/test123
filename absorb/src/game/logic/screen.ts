/** Size of the game world for one run, in game pixels. */
export interface ScreenSize {
    width: number;
    height: number;
}

export const SCREEN_SHORT_SIDE = 768;
const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 2;

/**
 * Game world size matching the viewport's orientation: the short side is always 768 and the
 * long side follows the viewport's aspect ratio, clamped to 4:3 .. 2:1. Square viewports count
 * as landscape.
 */
export function computeScreenSize(viewWidth: number, viewHeight: number): ScreenSize {
    const landscape = viewWidth >= viewHeight;
    const long = Math.max(viewWidth, viewHeight);
    const short = Math.min(viewWidth, viewHeight);
    const aspect = short > 0 ? long / short : MIN_ASPECT;
    const clamped = Math.min(Math.max(aspect, MIN_ASPECT), MAX_ASPECT);
    const longSide = Math.round(SCREEN_SHORT_SIDE * clamped);
    return landscape
        ? { width: longSide, height: SCREEN_SHORT_SIDE }
        : { width: SCREEN_SHORT_SIDE, height: longSide };
}
