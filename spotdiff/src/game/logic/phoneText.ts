import { PARAMS } from '../params';

/** Guards `ceil(x / s)` against float noise right on an integer (e.g. 14 / (14 / 36)). */
const CEIL_EPSILON = 1e-9;

export interface PortraitText {
    /** Canvas font size of the HUD. */
    hud: number;
    /** Canvas font size of the message line, HINT and RESET. */
    row: number;
    /** True when the HUD text grew past the base size: the set number is left out then. */
    dropSet: boolean;
}

export interface HudFit {
    /** True when the HUD shows no set number. */
    dropSet: boolean;
    /** Scale (<= 1) that makes the HUD fit its maximum width. */
    scale: number;
}

/** FIT scale of the portrait canvas on screen: the smaller of width / 768 and height / 1664 (CSS px of the displayed canvas). */
export const portraitScale = (displayWidth: number, displayHeight: number): number => {
    const s = Math.min(displayWidth / PARAMS.portrait.width, displayHeight / PARAMS.portrait.height);
    // no display size yet (headless, not laid out): behave as on a big screen
    return s > 0 ? s : 1;
};

const sizeFor = (realMinPx: number, s: number): number =>
    Math.max(PARAMS.portraitRowTextSize, Math.ceil(realMinPx / s - CEIL_EPSILON));

/** Row text sizes on the portrait layout so that they stay readable at on-screen scale `s` (never below today's base size). */
export const portraitTextSizes = (s: number): PortraitText => {
    const hud = sizeFor(PARAMS.hudRealMinPx, s);
    return { hud, row: sizeFor(PARAMS.rowRealMinPx, s), dropSet: hud > PARAMS.portraitRowTextSize };
};

const scaleToFit = (width: number, maxWidth: number): number => (width > maxWidth ? maxWidth / width : 1);

/**
 * Portrait HUD fit: shrink to the maximum width, but never below `hudRealMinPx` on screen. If the text with the set number
 * would need to shrink more than that, show it without the set number (shrunk as far as that floor allows).
 */
export const fitHud = (withSetWidth: number, withoutSetWidth: number, maxWidth: number, fontSize: number, s: number, forceDrop: boolean): HudFit => {
    const floor = Math.min(1, PARAMS.hudRealMinPx / (fontSize * s));
    if (!forceDrop) {
        const scale = scaleToFit(withSetWidth, maxWidth);
        if (scale >= floor) return { dropSet: false, scale };
    }
    return { dropSet: true, scale: Math.max(scaleToFit(withoutSetWidth, maxWidth), floor) };
};
