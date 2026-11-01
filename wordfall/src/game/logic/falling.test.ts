import { describe, expect, it } from 'vitest';
import { fallDistance, hasLanded, stepSpawn } from './falling';

describe('stepSpawn (one letter per interval)', () => {
    it('spawns nothing before the interval is full', () => {
        expect(stepSpawn(0, 649, 650)).toEqual({ count: 0, accMs: 649 });
    });

    it('spawns one at exactly the interval and carries nothing over', () => {
        expect(stepSpawn(0, 650, 650)).toEqual({ count: 1, accMs: 0 });
    });

    it('adds the carry-over from earlier frames', () => {
        expect(stepSpawn(500, 150, 650)).toEqual({ count: 1, accMs: 0 });
        expect(stepSpawn(500, 149, 650)).toEqual({ count: 0, accMs: 649 });
    });

    it('catches up after a long frame without dropping letters', () => {
        expect(stepSpawn(0, 1300, 650)).toEqual({ count: 2, accMs: 0 });
        expect(stepSpawn(100, 2000, 650)).toEqual({ count: 3, accMs: 150 });
    });
});

describe('fallDistance / hasLanded', () => {
    it('moves speed x field height x seconds', () => {
        expect(fallDistance(0.25, 218, 1)).toBeCloseTo(54.5, 10);
        expect(fallDistance(0.25, 218, 0.5)).toBeCloseTo(27.25, 10);
        expect(fallDistance(0.63, 469, 0)).toBe(0);
    });

    it('removes a letter in the frame its centre reaches the removal line, not before', () => {
        expect(hasLanded(377.9, 378)).toBe(false);
        expect(hasLanded(378, 378)).toBe(true);
        expect(hasLanded(400, 378)).toBe(true);
    });
});
