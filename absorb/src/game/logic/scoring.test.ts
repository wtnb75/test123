import { describe, expect, it } from 'vitest';
import { releaseScore } from './scoring';

describe('releaseScore', () => {
    it('scores nothing for a release that killed nothing', () => {
        expect(releaseScore([])).toBe(0);
    });

    it('gives a single kill its plain score', () => {
        expect(releaseScore([1600])).toBe(1600);
    });

    it('multiplies two kills by 1.5', () => {
        expect(releaseScore([100, 400])).toBe(750);
    });

    it('multiplies three kills by 2.0 (three heavies = 9600 as in the spec)', () => {
        expect(releaseScore([1600, 1600, 1600])).toBe(9600);
    });

    it('keeps growing by 0.5 per extra kill', () => {
        expect(releaseScore([100, 100, 100, 100, 100])).toBe(1500);
    });

    it('rounds the multiplied score down', () => {
        // Real scores are all multiples of 100, so use made-up ones to reach a fraction: 201 * 1.5 = 301.5
        expect(releaseScore([101, 100])).toBe(301);
    });
});
