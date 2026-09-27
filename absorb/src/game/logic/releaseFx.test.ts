import { describe, expect, it } from 'vitest';
import {
    ReleaseEffects, releaseRingMaxRadius, releaseRingProgress, releaseRingRadius, releaseRingWidth, startsShake
} from './releaseFx';
import { fadeAlpha } from './effects';
import type { Release } from './world';

// Expected values below are worked out by hand from the spec's parameters: ring 0.35 s, final radius
// 100 + 120 × n / 50 (n = bullets released), width 2 + 6 × n / 50, growing from the 10 px player
// radius; the camera shakes only for n = 50.

describe('release ring size', () => {
    it('reaches 220 px for a full release, 160 px for 25 and 102.4 px for a single bullet', () => {
        expect(releaseRingMaxRadius(50)).toBe(220);
        expect(releaseRingMaxRadius(25)).toBe(160);
        expect(releaseRingMaxRadius(1)).toBeCloseTo(102.4);
    });

    it('is 8 px thick for a full release, 5 px for 25 and 2.12 px for one bullet', () => {
        expect(releaseRingWidth(50)).toBe(8);
        expect(releaseRingWidth(25)).toBe(5);
        expect(releaseRingWidth(1)).toBeCloseTo(2.12);
    });

    it('grows from the player radius: 10 px at the start, 115 px halfway for a full release', () => {
        expect(releaseRingRadius(50, 0)).toBe(10);
        expect(releaseRingRadius(50, 0.5)).toBe(115);
        expect(releaseRingRadius(1, 0)).toBe(10);
    });
});

describe('release ring over time', () => {
    it('shows from t = 0 up to, but not including, 0.35 s', () => {
        expect(releaseRingProgress(0)).toBe(0);
        expect(releaseRingProgress(0.175)).toBeCloseTo(0.5);
        expect(releaseRingProgress(0.3499)).toBeGreaterThan(0.99);
        expect(releaseRingProgress(0.35)).toBe(-1);
    });

    it('fades from fully opaque to transparent', () => {
        expect(fadeAlpha(releaseRingProgress(0))).toBe(1);
        expect(fadeAlpha(releaseRingProgress(0.175))).toBeCloseTo(0.5);
    });
});

describe('tracking release effects', () => {
    const release = (count: number, x = 100): Release => ({ x, y: 200, count });

    it('starts with no rings', () => {
        expect(new ReleaseEffects().rings).toHaveLength(0);
    });

    it('starts one ring per release at t = 0, fixed where it fired', () => {
        const fx = new ReleaseEffects();
        fx.update(0.016, [release(10, 1), release(50, 2)]);
        expect(fx.rings).toEqual([
            { x: 1, y: 200, count: 10, age: 0 },
            { x: 2, y: 200, count: 50, age: 0 }
        ]);
    });

    it('ages each ring on its own and drops it once 0.35 s old', () => {
        const fx = new ReleaseEffects();
        fx.update(0.016, [release(10, 1)]);
        fx.update(0.25, [release(10, 2)]);
        expect(fx.rings.map((r) => r.age)).toEqual([0.25, 0]);
        fx.update(0.125, []);
        expect(fx.rings.map((r) => r.x)).toEqual([2]);
        fx.update(0.25, []);
        expect(fx.rings).toHaveLength(0);
    });

    it('drops a ring at exactly 0.35 s and keeps one just short of it', () => {
        const fx = new ReleaseEffects();
        fx.update(0.016, [release(10, 1), release(10, 2)]);
        fx.rings[0].age = 0.35;
        fx.rings[1].age = 0.3499;
        fx.update(0, []);
        expect(fx.rings.map((r) => r.x)).toEqual([2]);
    });

    it('clears the rings on demand, as a restart does', () => {
        const fx = new ReleaseEffects();
        fx.update(0.016, [release(50)]);
        fx.clear();
        expect(fx.rings).toHaveLength(0);
    });
});

describe('deciding to shake the camera', () => {
    const release = (count: number): Release => ({ x: 0, y: 0, count });

    it('shakes for a full 50-bullet release', () => {
        expect(startsShake([release(50)])).toBe(true);
    });

    it('does not shake for 49 bullets or for a frame without releases', () => {
        expect(startsShake([release(49)])).toBe(false);
        expect(startsShake([])).toBe(false);
    });

    it('shakes when a full release shares the frame with a smaller one', () => {
        expect(startsShake([release(49), release(50)])).toBe(true);
    });
});
