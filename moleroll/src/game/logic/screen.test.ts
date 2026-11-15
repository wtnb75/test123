import { describe, expect, it } from 'vitest';
import { resultInputOpen, shouldHandleKey } from './guard';
import { computeScreenSize } from './screen';

describe('computeScreenSize', () => {
    it.each([
        [390, 844, 540, 1169],
        [375, 550, 540, 792],
        [300, 400, 540, 720],
        [667, 310, 1162, 540],
        [1280, 720, 960, 540],
        [1000, 1000, 540, 540],
    ])('a %i × %i viewport → %i × %i', (vw, vh, w, h) => {
        expect(computeScreenSize(vw, vh)).toEqual({ width: w, height: h });
    });

    it('caps a very tall viewport at 1170 on the long side', () => {
        expect(computeScreenSize(390, 1000)).toEqual({ width: 540, height: 1170 });
    });

    it('caps a very wide viewport at 1170 on the long side', () => {
        expect(computeScreenSize(2000, 500)).toEqual({ width: 1170, height: 540 });
    });

    it('is a square while the viewport size is unknown (0)', () => {
        expect(computeScreenSize(0, 800)).toEqual({ width: 540, height: 540 });
        expect(computeScreenSize(800, 0)).toEqual({ width: 540, height: 540 });
    });
});

describe('shouldHandleKey', () => {
    it('counts a fresh key press but not an auto-repeat', () => {
        expect(shouldHandleKey(false)).toBe(true);
        expect(shouldHandleKey(true)).toBe(false);
    });
});

describe('resultInputOpen', () => {
    it('stays closed for the first 0.3 s and opens at exactly 0.3 s', () => {
        expect(resultInputOpen(0)).toBe(false);
        expect(resultInputOpen(0.299)).toBe(false);
        expect(resultInputOpen(0.3)).toBe(true);
        expect(resultInputOpen(5)).toBe(true);
    });
});
