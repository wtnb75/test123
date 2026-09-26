import { describe, expect, it } from 'vitest';
import { computeScreenSize } from './screen';

describe('computeScreenSize', () => {
    it('matches the examples given in the spec', () => {
        expect(computeScreenSize(1920, 1080)).toEqual({ width: 1365, height: 768 });
        expect(computeScreenSize(1024, 768)).toEqual({ width: 1024, height: 768 });
        expect(computeScreenSize(390, 844)).toEqual({ width: 768, height: 1536 });
    });

    it('treats a square viewport as landscape at the 4:3 minimum', () => {
        expect(computeScreenSize(800, 800)).toEqual({ width: 1024, height: 768 });
    });

    it('widens an aspect narrower than 4:3 up to 4:3', () => {
        expect(computeScreenSize(768, 900)).toEqual({ width: 768, height: 1024 });
    });

    it('caps an aspect wider than 2:1 at 2:1 in either orientation', () => {
        expect(computeScreenSize(3000, 1000)).toEqual({ width: 1536, height: 768 });
        expect(computeScreenSize(1000, 3000)).toEqual({ width: 768, height: 1536 });
    });

    it('keeps an aspect exactly at 2:1', () => {
        expect(computeScreenSize(2000, 1000)).toEqual({ width: 1536, height: 768 });
    });

    it('rounds the long side to the nearest integer', () => {
        // 768 * 1.5004 = 1152.3 -> 1152
        expect(computeScreenSize(15004, 10000)).toEqual({ width: 1152, height: 768 });
        // 768 * 1.5010 = 1152.77 -> 1153
        expect(computeScreenSize(15010, 10000)).toEqual({ width: 1153, height: 768 });
    });

    it('falls back to 4:3 landscape for a zero-sized viewport', () => {
        expect(computeScreenSize(0, 0)).toEqual({ width: 1024, height: 768 });
    });
});
