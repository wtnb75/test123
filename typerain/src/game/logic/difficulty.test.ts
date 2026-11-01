import { describe, expect, it } from 'vitest';
import { fallSpeedAt, maxLenAt, spawnIntervalAt } from './difficulty';

describe('fallSpeedAt', () => {
    it('starts at 0.084 fall distances per second', () => {
        expect(fallSpeedAt(0)).toBeCloseTo(0.084, 10);
    });

    it('grows 0.0014 per second (0.224 at 100 s)', () => {
        expect(fallSpeedAt(100)).toBeCloseTo(0.224, 10);
    });

    it('stops at the cap 0.28 from 140 s on and never exceeds it', () => {
        expect(fallSpeedAt(139)).toBeLessThan(0.28);
        expect(fallSpeedAt(140)).toBeCloseTo(0.28, 10);
        expect(fallSpeedAt(1000)).toBe(0.28);
    });
});

describe('spawnIntervalAt', () => {
    it('is 2.4 s at the start, 1.6 s at 40 s', () => {
        expect(spawnIntervalAt(0)).toBeCloseTo(2.4, 10);
        expect(spawnIntervalAt(40)).toBeCloseTo(1.6, 10);
    });

    it('bottoms out at 0.8 s from 80 s on and never goes below', () => {
        expect(spawnIntervalAt(79)).toBeGreaterThan(0.8);
        expect(spawnIntervalAt(80)).toBeCloseTo(0.8, 10);
        expect(spawnIntervalAt(500)).toBe(0.8);
    });
});

describe('maxLenAt', () => {
    it('starts at 4 letters and grows by one every 20 s', () => {
        expect(maxLenAt(0)).toBe(4);
        expect(maxLenAt(19.9)).toBe(4);
        expect(maxLenAt(20)).toBe(5);
        expect(maxLenAt(79.9)).toBe(7);
    });

    it('stops at 8 letters from 80 s on', () => {
        expect(maxLenAt(80)).toBe(8);
        expect(maxLenAt(1000)).toBe(8);
    });
});
