import { describe, expect, it } from 'vitest';
import { computeScreenSize, fitScale, promptFontSize, rotatePromptScale } from './screen';

describe('computeScreenSize (docs/spec.md "手計算の例")', () => {
    it('follows the viewport aspect ratio at 360 wide: phone portrait 390 x 844 -> 779', () => {
        expect(computeScreenSize(390, 844)).toEqual({ width: 360, height: 779 });
    });

    it('fits iPhone SE portrait 375 x 550 as 360 x 528', () => {
        expect(computeScreenSize(375, 550)).toEqual({ width: 360, height: 528 });
    });

    it('uses the minimum height 520 for landscape screens (PC 1280 x 720, phone 667 x 310)', () => {
        expect(computeScreenSize(1280, 720).height).toBe(520);
        expect(computeScreenSize(667, 310).height).toBe(520);
    });

    it('caps very tall viewports at 800 and uses the minimum for a zero width', () => {
        expect(computeScreenSize(360, 3000).height).toBe(800);
        expect(computeScreenSize(0, 500).height).toBe(520);
    });
});

describe('fitScale', () => {
    it('is the smaller of the width and height ratios', () => {
        expect(fitScale(390, 844, { width: 360, height: 779 })).toBeCloseTo(1.0833, 4);
        expect(fitScale(375, 550, { width: 360, height: 528 })).toBeCloseTo(1.0417, 4);
        expect(fitScale(1280, 720, { width: 360, height: 520 })).toBeCloseTo(1.3846, 4);
        expect(fitScale(667, 310, { width: 360, height: 520 })).toBeCloseTo(0.5962, 4);
    });
});

describe('rotatePromptScale', () => {
    const size = { width: 360, height: 520 };

    it('shows the notice on small landscape screens and returns their scale', () => {
        expect(rotatePromptScale(667, 310, size)).toBeCloseTo(0.5962, 4);
        expect(rotatePromptScale(844, 390, size)).toBeCloseTo(0.75, 4);
    });

    it('does not show it on large landscape screens (PC, tablet)', () => {
        expect(rotatePromptScale(1280, 720, size)).toBeNull();
        expect(rotatePromptScale(1024, 768, size)).toBeNull();
    });

    it('does not show it at exactly 0.875 (600 x 455) and does just below (600 x 454)', () => {
        expect(rotatePromptScale(600, 455, size)).toBeNull();
        expect(rotatePromptScale(600, 454, size)).toBeCloseTo(0.8731, 4);
    });

    it('never shows it for a portrait or square viewport', () => {
        expect(rotatePromptScale(375, 550, { width: 360, height: 528 })).toBeNull();
        expect(rotatePromptScale(200, 300, size)).toBeNull();
        expect(rotatePromptScale(300, 300, size)).toBeNull();
    });
});

describe('promptFontSize', () => {
    it('aims for 18 on-screen px: ceil(18 / scale)', () => {
        expect(promptFontSize(0.596)).toBe(31);
        expect(promptFontSize(1)).toBe(18);
    });

    it('is capped at 53 for very small scales, and 53 for a scale of 0 or less', () => {
        expect(promptFontSize(0.2)).toBe(53);
        expect(promptFontSize(0)).toBe(53);
        expect(promptFontSize(-1)).toBe(53);
    });

    it('reaches the cap exactly where 18 / scale passes 53', () => {
        expect(promptFontSize(18 / 53)).toBe(53);
        expect(promptFontSize(18 / 52.5)).toBe(53);
        expect(promptFontSize(18 / 52)).toBe(52);
    });
});
