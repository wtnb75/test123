import { describe, expect, it } from 'vitest';
import { scoreBumpScale, scorePopFontSize, scorePopText, tierAfterCatch, tierColor } from './combo';

describe('tierAfterCatch', () => {
    it('gives a caught enemy ball tier 1, whatever tier it carried', () => {
        expect(tierAfterCatch(false, 1)).toBe(1);
        expect(tierAfterCatch(false, 3)).toBe(1);
    });

    it('raises a caught own ball by one: 1 -> 2, 2 -> 3, 3 -> 4', () => {
        expect(tierAfterCatch(true, 1)).toBe(2);
        expect(tierAfterCatch(true, 2)).toBe(3);
        expect(tierAfterCatch(true, 3)).toBe(4);
    });

    it('stops at the cap of 4', () => {
        expect(tierAfterCatch(true, 4)).toBe(4);
    });
});

describe('tierColor', () => {
    it('is cyan, green, yellow, orange for tiers 1 to 4', () => {
        expect([1, 2, 3, 4].map(tierColor)).toEqual([0x4ae0ff, 0x69f0ae, 0xffeb3b, 0xff9100]);
    });

    it('keeps out-of-range tiers on the nearest colour', () => {
        expect(tierColor(0)).toBe(0x4ae0ff);
        expect(tierColor(9)).toBe(0xff9100);
    });
});

describe('scorePopText', () => {
    it('is +N at tier 1 and +N ×k from tier 2', () => {
        expect(scorePopText(30, 1)).toBe('+30');
        expect(scorePopText(60, 2)).toBe('+60 ×2');
        expect(scorePopText(90, 3)).toBe('+90 ×3');
        expect(scorePopText(80, 4)).toBe('+80 ×4');
    });
});

describe('scorePopFontSize', () => {
    it('is 28 at tier 1 and grows by 4 per tier up to 40', () => {
        expect([1, 2, 3, 4].map(scorePopFontSize)).toEqual([28, 32, 36, 40]);
    });
});

describe('scoreBumpScale', () => {
    it('starts at 1.3, is 1.15 halfway and is 1.0 at exactly 0.25 s', () => {
        expect(scoreBumpScale(0)).toBeCloseTo(1.3, 12);
        expect(scoreBumpScale(0.125)).toBeCloseTo(1.15, 12);
        expect(scoreBumpScale(0.25)).toBe(1);
    });

    it('stays at 1.0 afterwards and at 1.3 for a negative elapsed time', () => {
        expect(scoreBumpScale(0.3)).toBe(1);
        expect(scoreBumpScale(-1)).toBeCloseTo(1.3, 12);
    });
});
