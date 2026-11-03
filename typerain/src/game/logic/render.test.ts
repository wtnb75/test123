import { describe, expect, it } from 'vitest';
import { glyphOriginY, renderScaleFor, shakeIntensityFor } from './render';

describe('renderScaleFor', () => {
    it.each([
        [3.0, 1, 240, 3], // 1280 x 720, DPR 1
        [3.0, 2, 240, 4], // DPR 2: ceil 6, capped at RENDER_SCALE_MAX
        [1.083, 3, 779, 3], // phone: k = 4 would be 4 487 040 px
        [1.083, 1, 779, 2],
        [0.625, 1, 240, 1], // rotate notice screen
    ])('fit %f, DPR %f, H %i -> k %i', (fit, dpr, height, k) => {
        expect(renderScaleFor(fit, dpr, height)).toBe(k);
    });

    it('rounds up at the boundary: 2.0 gives 2, 2.01 gives 3', () => {
        expect(renderScaleFor(2, 1, 240)).toBe(2);
        expect(renderScaleFor(2.01, 1, 240)).toBe(3);
    });

    it('ignores float noise past an exact integer product (1.0000000000000002 x 2 is 2 on paper -> k 2, not 3)', () => {
        expect(1.0000000000000002 * 2).toBeGreaterThan(2); // the premise: the raw product is just above 2
        expect(renderScaleFor(1.0000000000000002, 2, 240)).toBe(2);
    });

    it('keeps k = 3 and drops k = 4 at H = 800 (2 592 000 px vs 4 608 000 px)', () => {
        expect(renderScaleFor(3, 1, 800)).toBe(3);
        expect(renderScaleFor(4, 1, 800)).toBe(3);
    });

    it('steps down more than once until the pixel cap holds (H 1500: k 4 = 8 640 000, k 3 = 4 860 000, k 2 = 2 160 000 -> 2)', () => {
        expect(renderScaleFor(4, 1, 1500)).toBe(2);
    });

    it('never goes below 1 for a small fit scale (0.4 -> ceil 1)', () => {
        expect(renderScaleFor(0.4, 1, 240)).toBe(1);
    });

    it.each([
        [0, 1],
        [-1, 2],
        [Number.NaN, 2],
        [1, 0],
        [1, Number.NaN],
        [1, undefined as unknown as number],
        [Number.POSITIVE_INFINITY, 1],
    ])('uses 1 for fit %f and DPR %f that are not finite positive numbers', (fit, dpr) => {
        expect(renderScaleFor(fit, dpr, 240)).toBe(1);
    });
});

describe('shakeIntensityFor', () => {
    it('is unchanged at k = 1 and divided by k squared otherwise (0.01 at k = 3 -> 0.01 / 9)', () => {
        expect(shakeIntensityFor(0.01, 1)).toBe(0.01);
        expect(shakeIntensityFor(0.01, 3)).toBeCloseTo(0.01 / 9, 12);
        expect(shakeIntensityFor(0.004, 2)).toBeCloseTo(0.001, 12);
    });
});

describe('glyphOriginY', () => {
    it('keeps the top at the top for fraction 0', () => {
        expect(glyphOriginY(0, 32, 6)).toBe(0);
    });

    it('moves the centre up so the visible glyphs (26 of 32) stay centred: 0.5 -> 13/32', () => {
        expect(glyphOriginY(0.5, 32, 6)).toBeCloseTo(0.40625, 10);
    });

    it('reaches the glyph bottom (not the padded bottom) for fraction 1', () => {
        expect(glyphOriginY(1, 32, 6)).toBeCloseTo(26 / 32, 10);
    });

    it('returns the fraction itself for an empty box', () => {
        expect(glyphOriginY(0.5, 0, 6)).toBe(0.5);
    });

    it('never goes negative when the padding is larger than the box', () => {
        expect(glyphOriginY(0.5, 4, 6)).toBe(0);
    });
});
