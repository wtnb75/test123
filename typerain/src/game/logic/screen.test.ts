import { describe, expect, it } from 'vitest';
import {
    computeScreenSize,
    fallDistanceFor,
    fitScale,
    floorYFor,
    promptFontSize,
    rotatePromptScale,
    wordYFor,
} from './screen';

describe('computeScreenSize', () => {
    it.each([
        [390, 844, 779],
        [375, 550, 528],
        [375, 334, 321],
        [1280, 720, 240],
        [667, 310, 240],
        [667, 150, 240],
    ])('%i x %i -> logical height %i', (w, h, height) => {
        expect(computeScreenSize(w, h)).toEqual({ width: 360, height });
    });

    it('caps the height at 800 for a very tall viewport', () => {
        expect(computeScreenSize(100, 1000).height).toBe(800);
    });

    it('uses the minimum height when the viewport has no width', () => {
        expect(computeScreenSize(0, 500).height).toBe(240);
    });
});

describe('fitScale', () => {
    it('is the smaller of the width and height ratios', () => {
        expect(fitScale(390, 844, { width: 360, height: 779 })).toBeCloseTo(1.0833, 3);
        expect(fitScale(375, 334, { width: 360, height: 321 })).toBeCloseTo(1.0405, 3);
        expect(fitScale(667, 150, { width: 360, height: 240 })).toBeCloseTo(0.625, 10);
        expect(fitScale(1280, 720, { width: 360, height: 240 })).toBe(3);
        expect(fitScale(375, 550, { width: 360, height: 528 })).toBeCloseTo(1.0417, 3);
    });
});

describe('rotatePromptScale', () => {
    const size = (w: number, h: number) => computeScreenSize(w, h);

    it('asks to rotate a landscape phone with its keyboard open (667 x 150 -> 0.625)', () => {
        expect(rotatePromptScale(667, 150, size(667, 150))).toBeCloseTo(0.625, 10);
    });

    it('does not ask at exactly 0.875 (315 x 210) but does just below it (314 x 209)', () => {
        expect(rotatePromptScale(315, 210, size(315, 210))).toBeNull();
        expect(rotatePromptScale(314, 209, size(314, 209))).not.toBeNull();
    });

    it('does not ask on a PC window (1280 x 720) or a landscape phone without the keyboard (667 x 310)', () => {
        expect(rotatePromptScale(1280, 720, size(1280, 720))).toBeNull();
        expect(rotatePromptScale(667, 310, size(667, 310))).toBeNull();
    });

    it('never asks on a portrait viewport, even a small one', () => {
        expect(rotatePromptScale(300, 400, size(300, 400))).toBeNull();
        expect(rotatePromptScale(375, 334, size(375, 334))).toBeNull();
        expect(rotatePromptScale(200, 200, size(200, 200))).toBeNull();
    });
});

describe('promptFontSize', () => {
    it('keeps about 18 px on screen: 29 at scale 0.625, 18 at scale 1', () => {
        expect(promptFontSize(0.625)).toBe(29);
        expect(promptFontSize(1)).toBe(18);
    });

    it('is capped at 30 for a tiny scale and for a scale of 0 or less', () => {
        expect(promptFontSize(0.2)).toBe(30);
        expect(promptFontSize(0)).toBe(30);
        expect(promptFontSize(-1)).toBe(30);
    });
});

describe('wordYFor', () => {
    it('keeps a word at the same share of the way down when the fall distance changes (200 -> 100)', () => {
        // Halfway down: FIELD_TOP + 100 at fall distance 200, FIELD_TOP + 50 at 100.
        expect(wordYFor(0.5, 200)).toBe(148);
        expect(wordYFor(0.5, 100)).toBe(98);
    });

    it('is the field top when a word appears and the field top + fall distance at the floor', () => {
        expect(wordYFor(0, 136)).toBe(48);
        expect(wordYFor(1, 136)).toBe(184); // bottom = 184 + 26 = 210 = the floor at height 240
    });
});

describe('floor and fall distance', () => {
    it('puts the floor 30 above the bottom and the fall distance below the field top and word height', () => {
        expect(floorYFor(240)).toBe(210);
        expect(fallDistanceFor(240)).toBe(136); // 210 - 48 - 26
        expect(floorYFor(779)).toBe(749);
        expect(fallDistanceFor(779)).toBe(675); // 749 - 48 - 26
    });
});
