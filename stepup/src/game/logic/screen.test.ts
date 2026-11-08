import { describe, expect, it } from 'vitest';
import { computeScreenSize, fitScale, promptFontSize, rotatePromptScale, ROTATE_PROMPT_TEXT } from './screen';

describe('computeScreenSize (width 360, height follows the aspect ratio in [520, 780])', () => {
    it.each([
        [390, 844, 779],
        [375, 550, 528],
        [1280, 720, 520],
        [667, 310, 520],
        [320, 700, 780],
    ])('%i x %i -> 360 x %i', (w, h, expected) => {
        expect(computeScreenSize(w, h)).toEqual({ width: 360, height: expected });
    });

    it('uses the lower limit for a zero-width viewport', () => {
        expect(computeScreenSize(0, 500).height).toBe(520);
    });
});

describe('fitScale', () => {
    it('is the smaller of the two ratios', () => {
        expect(fitScale(390, 844, { width: 360, height: 779 })).toBeCloseTo(1.0833, 3);
        expect(fitScale(1280, 720, { width: 360, height: 520 })).toBeCloseTo(1.3846, 3);
        expect(fitScale(667, 310, { width: 360, height: 520 })).toBeCloseTo(0.5962, 3);
    });
});

describe('rotatePromptScale (landscape and scale < 0.875)', () => {
    const size = { width: 360, height: 520 };

    it('shows the notice on small landscape screens', () => {
        expect(rotatePromptScale(667, 310, size)).toBeCloseTo(0.596, 3);
        expect(rotatePromptScale(844, 390, size)).toBeCloseTo(0.75, 3);
    });

    it('does not show it on a PC window or on 1024 x 768', () => {
        expect(rotatePromptScale(1280, 720, size)).toBeNull();
        expect(rotatePromptScale(1024, 768, size)).toBeNull();
    });

    it('does not show it exactly at 0.875, and does just below (600 x 455 vs 600 x 454)', () => {
        expect(rotatePromptScale(600, 455, size)).toBeNull();
        expect(rotatePromptScale(600, 454, size)).toBeCloseTo(0.873, 3);
    });

    it('never shows it on a portrait or square viewport', () => {
        expect(rotatePromptScale(300, 600, size)).toBeNull();
        expect(rotatePromptScale(300, 300, size)).toBeNull();
    });
});

describe('promptFontSize (about 18 real px, at most 53 logical)', () => {
    it('is ceil(18 / scale)', () => {
        expect(promptFontSize(0.596)).toBe(31);
        expect(promptFontSize(1)).toBe(18);
    });

    it('is capped at 53, also for a scale of 0 or below', () => {
        expect(promptFontSize(0.2)).toBe(53);
        expect(promptFontSize(0)).toBe(53);
        expect(promptFontSize(-1)).toBe(53);
    });
});

describe('ROTATE_PROMPT_TEXT', () => {
    it('is two lines', () => {
        expect(ROTATE_PROMPT_TEXT.split('\n')).toEqual(['画面を縦に', 'してください']);
    });
});
