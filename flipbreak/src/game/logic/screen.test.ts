import { describe, expect, it } from 'vitest';
import { fitScale, promptFontSize, promptText, rotatePromptScale } from './screen';

describe('fitScale', () => {
    it('is the smaller of width / 360 and height / 640', () => {
        expect(fitScale(390, 844)).toBeCloseTo(1.0833, 4);
        expect(fitScale(375, 550)).toBeCloseTo(0.8594, 4);
        expect(fitScale(1280, 720)).toBeCloseTo(1.125, 4);
        expect(fitScale(667, 310)).toBeCloseTo(0.4844, 4);
        expect(fitScale(844, 390)).toBeCloseTo(0.6094, 4);
    });
});

describe('rotatePromptScale', () => {
    it('shows the notice on small landscape viewports: SE landscape (0.484) and phone landscape (0.609)', () => {
        expect(rotatePromptScale(667, 310)).toBeCloseTo(0.4844, 4);
        expect(rotatePromptScale(844, 390)).toBeCloseTo(0.6094, 4);
    });

    it('does not show it on portrait phones or the PC window', () => {
        expect(rotatePromptScale(390, 844)).toBeNull();
        expect(rotatePromptScale(375, 550)).toBeNull();
        expect(rotatePromptScale(1280, 720)).toBeNull();
    });

    it('does not show it at a scale of exactly 0.7 (500 x 448) and shows it just under (500 x 447)', () => {
        expect(rotatePromptScale(500, 448)).toBeNull();
        expect(rotatePromptScale(500, 447)).toBeCloseTo(0.6984, 4);
    });

    it('does not show it for a square viewport, however small (not landscape)', () => {
        expect(rotatePromptScale(448, 448)).toBeNull();
        expect(rotatePromptScale(100, 100)).toBeNull();
    });

    it('does not show it for a portrait viewport at any scale', () => {
        expect(rotatePromptScale(100, 200)).toBeNull();
    });

    it('shows it for a landscape viewport of height 0 (scale 0)', () => {
        expect(rotatePromptScale(500, 0)).toBe(0);
    });
});

describe('promptFontSize', () => {
    it('is the font that makes the notice about 18 px on screen, rounded up', () => {
        expect(promptFontSize(0.484)).toBe(38);
        expect(promptFontSize(0.609)).toBe(30);
        expect(promptFontSize(0.7)).toBe(26);
    });

    it('is capped at 53, and is 53 for a scale of 0 or below', () => {
        expect(promptFontSize(0.3)).toBe(53);
        expect(promptFontSize(0)).toBe(53);
        expect(promptFontSize(-1)).toBe(53);
    });
});

describe('promptText', () => {
    it('is one line while 11 characters fit in 320 px (26 -> 286)', () => {
        expect(promptText(26)).toBe('画面を縦にしてください');
    });

    it('is still one line at 29 (319 px) and two lines at 30 (330 px)', () => {
        expect(promptText(29)).toBe('画面を縦にしてください');
        expect(promptText(30)).toBe('画面を縦に\nしてください');
    });

    it('is two lines at the cap of 53, each line within 320 px (6 characters x 53 = 318)', () => {
        const lines = promptText(53).split('\n');
        expect(lines).toHaveLength(2);
        for (const line of lines) expect(line.length * 53).toBeLessThanOrEqual(320);
    });
});
