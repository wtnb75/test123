// Render resolution and text padding (docs/spec.md "描画の解像度と文字の下端").
import { RENDER_PIXELS_MAX, RENDER_SCALE_MAX, SCREEN_WIDTH } from '../params';

/**
 * Render scale k (an integer >= 1): min(ceil(fit scale x devicePixelRatio), RENDER_SCALE_MAX), lowered
 * until SCREEN_WIDTH x height x k^2 fits RENDER_PIXELS_MAX. A fit scale or ratio that is not a finite positive
 * number gives 1.
 */
export function renderScaleFor(fitScale: number, devicePixelRatio: number, height: number): number {
    const ok = (n: number) => Number.isFinite(n) && n > 0;
    if (!ok(fitScale) || !ok(devicePixelRatio)) return 1;
    // Rounded to 6 decimals first: a product that is an integer on paper (browser zoom, e.g. 3.333… × 0.9) can come
    // out as 3.0000000000000004 and would round up to the next k.
    const product = Math.round(fitScale * devicePixelRatio * 1e6) / 1e6;
    let k = Math.min(Math.ceil(product), RENDER_SCALE_MAX);
    while (k > 1 && SCREEN_WIDTH * height * k * k > RENDER_PIXELS_MAX) k -= 1;
    return Math.max(k, 1);
}

/**
 * Camera shake intensity that looks the same at every render scale. Phaser's shake offset is
 * intensity x canvas width x zoom, and the camera matrix applies the zoom to it once more, so on screen it grows
 * with k^3 (k^2 in logical px): dividing the intensity by k^2 keeps the shake the size it was at k = 1.
 */
export function shakeIntensityFor(intensity: number, k: number): number {
    return intensity / (k * k);
}

/**
 * Vertical origin (0..1 of the padded text box) that puts the anchor `fraction` of the way down the glyph area,
 * the part above the `pad` px added under the text. With fraction 0 the top stays the top; with 0.5 the visible
 * glyphs stay centred on the position.
 */
export function glyphOriginY(fraction: number, textHeight: number, pad: number): number {
    if (textHeight <= 0) return fraction;
    return (fraction * Math.max(textHeight - pad, 0)) / textHeight;
}
