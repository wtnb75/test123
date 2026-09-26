import { describe, expect, it } from 'vitest';
import {
    announceAlpha, defeatRingProgress, defeatRingRadius, effectProgress, fadeAlpha, hitFlashVisible,
    scorePopupProgress, scorePopupRise
} from './effects';

// Expected values below are worked out by hand from the spec's parameters:
// announce fade 0.5 s, hit flash 0.06 s, rings 0.6 s from radius 48 to 160 with the second
// 0.15 s late, score popup 1 s rising 40 px.

describe('the shared time convention', () => {
    it('shows an effect from t = 0 up to, but not including, its length', () => {
        expect(effectProgress(0, 2)).toBe(0);
        expect(effectProgress(1, 2)).toBe(0.5);
        expect(effectProgress(1.999, 2)).toBeCloseTo(0.9995);
        expect(effectProgress(2, 2)).toBe(-1);
    });

    it('hides an effect that has not started yet or was never started', () => {
        expect(effectProgress(-0.001, 2)).toBe(-1);
        expect(effectProgress(Infinity, 2)).toBe(-1);
    });

    it('fades linearly from opaque to transparent', () => {
        expect(fadeAlpha(0)).toBe(1);
        expect(fadeAlpha(0.25)).toBe(0.75);
        expect(fadeAlpha(0.5)).toBe(0.5);
    });
});

describe('boss announcement', () => {
    it('stays fully opaque until its last 0.5 s', () => {
        expect(announceAlpha(1.5)).toBe(1);
        expect(announceAlpha(0.8)).toBe(1);
        expect(announceAlpha(0.5)).toBe(1);
    });

    it('fades linearly over its last 0.5 s: half opaque with 0.25 s left', () => {
        expect(announceAlpha(0.25)).toBeCloseTo(0.5);
        expect(announceAlpha(0.1)).toBeCloseTo(0.2);
    });

    it('is gone once no time is left', () => {
        expect(announceAlpha(0)).toBe(0);
        expect(announceAlpha(-0.1)).toBe(0);
    });
});

describe('boss hit flash', () => {
    it('shows for 0.06 s from the hit and is gone exactly at 0.06 s', () => {
        expect(hitFlashVisible(0)).toBe(true);
        expect(hitFlashVisible(0.059)).toBe(true);
        expect(hitFlashVisible(0.06)).toBe(false);
    });

    it('does not show before any hit', () => {
        expect(hitFlashVisible(Infinity)).toBe(false);
    });
});

describe('boss defeat rings', () => {
    it('grows the first ring from radius 48 to 160 over 0.6 s while fading out', () => {
        expect(defeatRingProgress(0, 0)).toBe(0);
        expect(defeatRingRadius(defeatRingProgress(0, 0))).toBe(48);
        expect(fadeAlpha(defeatRingProgress(0, 0))).toBe(1);
        const mid = defeatRingProgress(0.3, 0);
        expect(mid).toBeCloseTo(0.5);
        expect(defeatRingRadius(mid)).toBeCloseTo(104); // 48 + 112 / 2
        expect(fadeAlpha(mid)).toBeCloseTo(0.5);
        expect(defeatRingProgress(0.599, 0)).toBeGreaterThan(0.99);
        expect(defeatRingProgress(0.6, 0)).toBe(-1);
    });

    it('starts the second ring 0.15 s after the first and runs it for its own 0.6 s', () => {
        expect(defeatRingProgress(0.149, 1)).toBe(-1);
        expect(defeatRingProgress(0.15, 1)).toBeCloseTo(0);
        expect(defeatRingRadius(defeatRingProgress(0.45, 1))).toBeCloseTo(104);
        expect(fadeAlpha(defeatRingProgress(0.45, 1))).toBeCloseTo(0.5);
        expect(defeatRingProgress(0.7, 1)).toBeGreaterThan(0.9); // still showing after the first is gone
        expect(defeatRingProgress(0.75, 1)).toBe(-1);
    });

    it('shows nothing before any defeat', () => {
        expect(defeatRingProgress(Infinity, 0)).toBe(-1);
        expect(defeatRingProgress(Infinity, 1)).toBe(-1);
    });
});

describe('boss score popup', () => {
    it('rises 40 px over 1 s while fading out: 20 px and half opaque halfway', () => {
        expect(scorePopupRise(scorePopupProgress(0))).toBe(0);
        expect(fadeAlpha(scorePopupProgress(0))).toBe(1);
        const mid = scorePopupProgress(0.5);
        expect(scorePopupRise(mid)).toBeCloseTo(20);
        expect(fadeAlpha(mid)).toBeCloseTo(0.5);
    });

    it('is gone exactly at 1 s and before any defeat', () => {
        expect(scorePopupProgress(0.999)).toBeGreaterThan(0.99);
        expect(scorePopupProgress(1)).toBe(-1);
        expect(scorePopupProgress(Infinity)).toBe(-1);
    });
});
