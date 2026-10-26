import { describe, expect, it } from 'vitest';
import { SCREEN_HEIGHT_MIN, SCREEN_WIDTH } from '../params';
import { computeScreenSize, fitScale, promptFontSize, promptText, ROTATE_PROMPT_TEXT, rotatePromptScale } from './screen';

describe('computeScreenSize', () => {
    it('keeps the width at 540 and follows a phone portrait aspect (390 x 844 -> 540 x 1169)', () => {
        expect(computeScreenSize(390, 844)).toEqual({ width: 540, height: 1169 });
    });

    it('fits an iPhone SE portrait viewport without bars (375 x 550 -> 540 x 792)', () => {
        expect(computeScreenSize(375, 550)).toEqual({ width: 540, height: 792 });
    });

    it('clamps a landscape viewport to the minimum height (1280 x 720 -> 540 x 756)', () => {
        expect(computeScreenSize(1280, 720)).toEqual({ width: 540, height: 756 });
    });

    it('clamps a very tall viewport to the maximum height (390 x 1000 -> 540 x 1170)', () => {
        expect(computeScreenSize(390, 1000)).toEqual({ width: 540, height: 1170 });
    });

    it('falls back to the minimum height for a zero-width viewport', () => {
        expect(computeScreenSize(0, 800)).toEqual({ width: 540, height: 756 });
    });
});

describe('fitScale', () => {
    it('is the smaller of the width and height ratios', () => {
        expect(fitScale(1280, 720, { width: 540, height: 756 })).toBeCloseTo(720 / 756, 10);
        expect(fitScale(270, 2000, { width: 540, height: 756 })).toBeCloseTo(0.5, 10);
    });
});

describe('promptFontSize', () => {
    it('sizes the prompt to about 18 on-screen px on an iPhone SE in landscape (scale 0.41 -> 44)', () => {
        // 18 / 0.41 = 43.9 -> 44 logical px, 44 * 0.41 = 18.04 on screen
        expect(promptFontSize(0.41)).toBe(44);
    });

    it('is exact where 18 divides evenly (0.5 -> 36, 0.25 -> 72)', () => {
        expect(promptFontSize(0.5)).toBe(36);
        expect(promptFontSize(0.25)).toBe(72);
    });

    it('stays at 34 or more everywhere the prompt can show (scale just under 0.54)', () => {
        expect(promptFontSize(0.5399)).toBe(34); // 18 / 0.5399 = 33.34
    });

    it('stays at or above 18 on-screen px wherever the cap is not reached', () => {
        for (const scale of [0.22, 0.33, 0.41, 0.53]) {
            expect(promptFontSize(scale) * scale, `scale ${scale}`).toBeGreaterThanOrEqual(18);
        }
    });

    it('stops at the 83 cap below scale 18 / 83 (about 0.217): 0.22 -> 82, 0.2 -> 83 instead of 90', () => {
        expect(promptFontSize(0.22)).toBe(82); // 18 / 0.22 = 81.8
        expect(promptFontSize(0.2)).toBe(83);
        expect(promptFontSize(0.03)).toBe(83);
    });

    it('uses the cap for a zero or negative scale instead of an infinite size', () => {
        expect(promptFontSize(0)).toBe(83);
        expect(promptFontSize(-1)).toBe(83);
    });

    it('at the cap the notice needs 2 lines at 1 em per character and fits the shortest canvas even as 3', () => {
        const wrapWidth = SCREEN_WIDTH - 40;
        const cap = promptFontSize(0.01);
        // A character never outgrows the wrap width, so Phaser's advanced wrap can't throw.
        expect(cap).toBeLessThanOrEqual(wrapWidth);
        const perLine = Math.floor(wrapWidth / cap);
        expect(Math.ceil(ROTATE_PROMPT_TEXT.length / perLine)).toBe(2);
        // Even one line more (a font slightly wider than 1 em) at a generous 1.3 line height fits 756.
        expect(3 * cap * 1.3).toBeLessThanOrEqual(SCREEN_HEIGHT_MIN);
    });
});

describe('promptText', () => {
    const TWO_LINES = '画面を縦に\nしてください';

    it('keeps one line while 11 characters fit 500 px (44, and 45: 11 x 45 = 495)', () => {
        expect(promptText(44)).toBe('画面を縦にしてください');
        expect(promptText(45)).toBe('画面を縦にしてください');
    });

    it('a line exactly 500 px wide still counts as fitting (boundary included)', () => {
        expect(promptText(500 / 11)).toBe(ROTATE_PROMPT_TEXT); // 11 * (500 / 11) === 500 in floating point
    });

    it('breaks at the natural point from 46 (11 x 46 = 506)', () => {
        expect(promptText(46)).toBe(TWO_LINES);
    });

    it('is two lines at the 83 cap, each within 500 px (83 x 6 = 498)', () => {
        expect(promptText(83)).toBe(TWO_LINES);
        for (const line of TWO_LINES.split('\n')) expect(line.length * 83).toBeLessThanOrEqual(SCREEN_WIDTH - 40);
    });

    it('SE landscape keeping the 792-high layout: scale 310/792 gives 46, so two lines', () => {
        const size = promptFontSize(310 / 792); // 18 / 0.3914 = 45.99
        expect(size).toBe(46);
        expect(promptText(size)).toBe(TWO_LINES);
    });
});

describe('rotatePromptScale', () => {
    it('shows the notice on an iPhone SE landscape viewport and returns its scale (0.41)', () => {
        expect(rotatePromptScale(667, 310, { width: 540, height: 756 })).toBeCloseTo(310 / 756, 10);
    });

    it('does not show it on a PC viewport (scale 0.95)', () => {
        expect(rotatePromptScale(1280, 720, { width: 540, height: 756 })).toBeNull();
    });

    it('never shows it on a portrait viewport, however small', () => {
        expect(rotatePromptScale(200, 300, { width: 540, height: 756 })).toBeNull();
    });

    it('never shows it on a square viewport (not landscape)', () => {
        expect(rotatePromptScale(300, 300, { width: 540, height: 756 })).toBeNull();
    });

    it('does not show it at exactly scale 0.54, and shows it just below', () => {
        // Height ratio 540 / 1000 = 0.54 exactly; the width ratio (1000 / 540) is larger.
        expect(rotatePromptScale(1000, 540, { width: 540, height: 1000 })).toBeNull();
        expect(rotatePromptScale(1000, 539, { width: 540, height: 1000 })).toBeCloseTo(0.539, 10);
    });

    it('returns 0 for a zero-height landscape view (promptFontSize then uses its cap)', () => {
        expect(rotatePromptScale(800, 0, { width: 540, height: 756 })).toBe(0);
        expect(promptFontSize(0)).toBe(83);
    });
});
