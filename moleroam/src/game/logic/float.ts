import { PARAMS } from '../params';
import type { Pt } from './board';
import { LANDSCAPE, type Layout } from './layout';

/** One axis: `value` kept in [lo, hi]; when the range is empty (the text cannot fit) use the screen center. */
const fit = (value: number, lo: number, hi: number, center: number): number =>
    lo > hi ? center : Math.min(Math.max(value, lo), hi);

/**
 * Where to start a floating text so that it, and the spot it rises to (`floatTextRisePx` higher), stay
 * `floatTextMargin` inside the screen. `at` is the text center in canvas coordinates, `w` x `h` its size.
 */
export const placeFloatText = (at: Pt, w: number, h: number, layout: Layout = LANDSCAPE): Pt => {
    const m = PARAMS.floatTextMargin;
    return {
        x: fit(at.x, m + w / 2, layout.viewW - m - w / 2, layout.viewW / 2),
        y: fit(at.y, m + h / 2 + PARAMS.floatTextRisePx, layout.viewH - m - h / 2, layout.viewH / 2),
    };
};
