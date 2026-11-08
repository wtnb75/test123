import { describe, expect, it } from 'vitest';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../params';
import { contrastRatio, luminance, saturation } from './color';

describe('luminance and contrastRatio (WCAG)', () => {
    it('is 0 for black and 1 for white, and the contrast of white on black is 21', () => {
        expect(luminance(0x000000)).toBe(0);
        expect(luminance(0xffffff)).toBeCloseTo(1, 10);
        expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 10);
    });

    it('does not depend on the order of the two colours', () => {
        expect(contrastRatio(0x3a4460, 0xffffff)).toBe(contrastRatio(0xffffff, 0x3a4460));
    });

    it('is 1 for the same colour', () => {
        expect(contrastRatio(0x2f6fd6, 0x2f6fd6)).toBe(1);
    });

    it('weights green most: pure green is brighter than pure red, which is brighter than pure blue', () => {
        expect(luminance(0x00ff00)).toBeCloseTo(0.7152, 4);
        expect(luminance(0xff0000)).toBeCloseTo(0.2126, 4);
        expect(luminance(0x0000ff)).toBeCloseTo(0.0722, 4);
    });

    it('is about 9.65 for white on 0x3a4460 (hand-worked)', () => {
        expect(contrastRatio(0xffffff, 0x3a4460)).toBeGreaterThan(9.6);
        expect(contrastRatio(0xffffff, 0x3a4460)).toBeLessThan(9.7);
    });
});

describe('saturation', () => {
    it('is 0 for grey and black, 1 for a pure colour', () => {
        expect(saturation(0x000000)).toBe(0);
        expect(saturation(0x808080)).toBe(0);
        expect(saturation(0xff0000)).toBe(1);
    });

    it('is (max - min) / max: 0x3a4460 is (96 - 58) / 96', () => {
        expect(saturation(0x3a4460)).toBeCloseTo(38 / 96, 10);
    });
});

describe('Result button colours (spec: the quiet button keeps white text at 4.5:1 or more)', () => {
    it('keeps white text readable on every look of both buttons', () => {
        for (const set of [PRIMARY_BUTTON, SECONDARY_BUTTON]) {
            for (const fill of Object.values(set)) {
                if (contrastRatio(0xffffff, fill) < 4.5) expect.fail(`white on 0x${fill.toString(16)} is below 4.5:1`);
            }
        }
    });

    it('makes the primary button brighter and more saturated than the quiet one', () => {
        expect(luminance(PRIMARY_BUTTON.normal)).toBeGreaterThan(luminance(SECONDARY_BUTTON.normal));
        expect(saturation(PRIMARY_BUTTON.normal)).toBeGreaterThan(saturation(SECONDARY_BUTTON.normal));
    });
});
