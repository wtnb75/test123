import { describe, it, expect } from 'vitest';
import { averageChannelDiff, scoreFromAverageDiff } from './score';

describe('averageChannelDiff', () => {
    it('throws when the two buffers have different lengths', () => {
        expect(() => averageChannelDiff(new Uint8ClampedArray(4), new Uint8ClampedArray(8))).toThrow();
    });

    it('returns 0 when every pixel is the background color on both sides', () => {
        const bg = new Uint8ClampedArray([255, 255, 255, 255]);
        expect(averageChannelDiff(bg, bg)).toBe(0);
    });

    it('excludes a pixel that is background on both sides, even when another pixel differs', () => {
        const a = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
        const b = new Uint8ClampedArray([255, 255, 255, 255, 100, 100, 100, 255]);
        // Only the second pixel counts: (100+100+100)/3 = 100.
        expect(averageChannelDiff(a, b)).toBeCloseTo(100, 6);
    });

    it('counts a pixel that is background on only one side', () => {
        const a = new Uint8ClampedArray([255, 255, 255, 255]);
        const b = new Uint8ClampedArray([0, 0, 0, 255]);
        expect(averageChannelDiff(a, b)).toBeCloseTo(255, 6);
    });

    it('ignores alpha differences', () => {
        const a = new Uint8ClampedArray([10, 20, 30, 0]);
        const b = new Uint8ClampedArray([10, 20, 30, 255]);
        expect(averageChannelDiff(a, b)).toBe(0);
    });
});

describe('scoreFromAverageDiff', () => {
    it('returns 100 when the actual diff is 0 (perfect match), regardless of baseline', () => {
        expect(scoreFromAverageDiff(0, 100)).toBe(100);
    });

    it('returns 0 when the actual diff equals the baseline diff (as good as placing nothing)', () => {
        expect(scoreFromAverageDiff(100, 100)).toBe(0);
    });

    it('clamps to 0 when the actual diff exceeds the baseline diff (worse than placing nothing)', () => {
        expect(scoreFromAverageDiff(150, 100)).toBe(0);
    });

    it('clamps to 100 when the actual diff is negative (defensive; should not occur in practice)', () => {
        expect(scoreFromAverageDiff(-10, 100)).toBe(100);
    });

    it('is linear at the midpoint between 0 and the baseline diff', () => {
        expect(scoreFromAverageDiff(50, 100)).toBe(50);
    });

    it('rounds to the nearest whole point', () => {
        // ratio = 33/100 = 0.33 -> 100 * (1 - 0.33) = 67
        expect(scoreFromAverageDiff(33, 100)).toBe(67);
    });

    it('returns 100 when the baseline diff is 0 and the actual diff is also 0 (avoids division by zero)', () => {
        expect(scoreFromAverageDiff(0, 0)).toBe(100);
    });

    it('returns 0 when the baseline diff is 0 but the actual diff is not (avoids division by zero)', () => {
        expect(scoreFromAverageDiff(5, 0)).toBe(0);
    });

    it('returns 0 when the baseline diff is negative (defensive; should not occur in practice)', () => {
        expect(scoreFromAverageDiff(5, -1)).toBe(0);
    });
});
