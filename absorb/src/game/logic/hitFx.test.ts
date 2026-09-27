import { describe, expect, it } from 'vitest';
import {
    HitEffects, edgeFrames, hitEdgeAlpha, hitEdgeFade, hitRingAlpha, hitRingProgress, hitRingRadius, hitTintAlpha,
    type EdgeRect
} from './hitFx';

// Expected values below are worked out by hand from the spec's parameters: tint 0.25 fading over
// 0.2 s; edge band 64 px wide, 0.7 at the edge fading inward and over 0.4 s; ring from the 10 px
// player radius to 140 px over 0.35 s.

describe('full-screen red tint', () => {
    it('starts at 0.25 and halves by 0.1 s', () => {
        expect(hitTintAlpha(0)).toBe(0.25);
        expect(hitTintAlpha(0.1)).toBeCloseTo(0.125);
    });

    it('is gone at exactly 0.2 s and when no hit is playing', () => {
        expect(hitTintAlpha(0.1999)).toBeGreaterThan(0);
        expect(hitTintAlpha(0.2)).toBe(0);
        expect(hitTintAlpha(Infinity)).toBe(0);
    });
});

describe('red edge band', () => {
    it('is 0.7 at the edge, 0.35 at 32 px in and 0 from 64 px in', () => {
        expect(hitEdgeAlpha(0, 0)).toBe(0.7);
        expect(hitEdgeAlpha(0, 32)).toBeCloseTo(0.35);
        expect(hitEdgeAlpha(0, 64)).toBe(0);
        expect(hitEdgeAlpha(0, 100)).toBe(0);
    });

    it('halves at the edge by 0.2 s and is gone at exactly 0.4 s', () => {
        expect(hitEdgeAlpha(0.2, 0)).toBeCloseTo(0.35);
        expect(hitEdgeAlpha(0.3999, 0)).toBeGreaterThan(0);
        expect(hitEdgeAlpha(0.4, 0)).toBe(0);
        expect(hitEdgeAlpha(Infinity, 0)).toBe(0);
    });
});

describe('edge band drawn once, faded as a whole', () => {
    const W = 1365;
    const H = 768;
    const PAD = 6;
    const frames = edgeFrames(W, H, PAD);
    const covering = (x: number, y: number): EdgeRect[] =>
        frames.filter((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

    it('fades from 1 to 0 over 0.4 s, gone at exactly 0.4 s', () => {
        expect(hitEdgeFade(0)).toBe(1);
        expect(hitEdgeFade(0.2)).toBeCloseTo(0.5);
        expect(hitEdgeFade(0.4)).toBe(0);
        expect(hitEdgeFade(Infinity)).toBe(0);
    });

    it('tiles the band exactly: the rectangles add up to its area, from 6 px outside to 64 px inside', () => {
        const area = frames.reduce((sum, r) => sum + r.w * r.h, 0);
        // (1365 + 12) × (768 + 12) − (1365 − 128) × (768 − 128)
        expect(area).toBe(1377 * 780 - 1237 * 640);
    });

    it('covers each band point exactly once, with the band opacity of its frame\'s outer side', () => {
        const points: [number, number, number][] = [
            // x, y, distance to the nearest edge of the frame expected to cover it
            [-5, 400, 0], [0, 0, 0], [3, 3, 0], [1364, 767, 0], [600, -6, 0],
            [32, 400, 32], [400, 33, 32], [1365 - 35, 700, 32], [60, 60, 60], [700, 767 - 63, 60]
        ];
        for (const [x, y, d] of points) {
            const hit = covering(x, y);
            if (hit.length !== 1) expect.fail(`(${x}, ${y}) is covered by ${hit.length} frames`);
            expect(hit[0].alpha).toBeCloseTo(hitEdgeAlpha(0, d));
        }
    });

    it('leaves the inside of the screen, 64 px from every edge, uncovered', () => {
        expect(covering(64, 400)).toHaveLength(0);
        expect(covering(682, 384)).toHaveLength(0);
        expect(covering(1365 - 65, 767 - 64)).toHaveLength(0);
    });

    it('matches the spec opacity at any moment: frame opacity × fade = band opacity at that time', () => {
        const edge = covering(0, 400)[0];
        expect(edge.alpha * hitEdgeFade(0.2)).toBeCloseTo(hitEdgeAlpha(0.2, 0));
    });
});

describe('red hit ring', () => {
    it('grows from the player radius: 10 px at the start, 75 px halfway, fading to half', () => {
        expect(hitRingRadius(hitRingProgress(0))).toBe(10);
        expect(hitRingAlpha(hitRingProgress(0))).toBe(1);
        const half = hitRingProgress(0.175);
        expect(hitRingRadius(half)).toBeCloseTo(75);
        expect(hitRingAlpha(half)).toBeCloseTo(0.5);
    });

    it('is gone at exactly 0.35 s', () => {
        expect(hitRingProgress(0.3499)).toBeGreaterThan(0.99);
        expect(hitRingProgress(0.35)).toBe(-1);
    });
});

describe('tracking the hit effect', () => {
    it('starts with nothing playing', () => {
        const fx = new HitEffects();
        expect(fx.age).toBe(Infinity);
        expect(hitTintAlpha(fx.age)).toBe(0);
    });

    it('starts all three at t = 0 at the hit position in the frame of the hit', () => {
        const fx = new HitEffects();
        fx.update(0.016, [{ x: 300, y: 500 }]);
        expect(fx.age).toBe(0);
        expect([fx.x, fx.y]).toEqual([300, 500]);
        expect(hitTintAlpha(fx.age)).toBe(0.25);
        expect(hitEdgeAlpha(fx.age, 0)).toBe(0.7);
        expect(hitRingProgress(fx.age)).toBe(0);
    });

    it('keeps ageing with no phase to consult, so the run ending cannot cut it short', () => {
        const fx = new HitEffects();
        fx.update(0.016, [{ x: 300, y: 500 }]);
        for (let i = 0; i < 3; i++) fx.update(0.1, []);
        expect(fx.age).toBeCloseTo(0.3);
        expect(hitEdgeAlpha(fx.age, 0)).toBeGreaterThan(0);
    });

    it('ages while nothing new happens and keeps the ring where the hit was', () => {
        const fx = new HitEffects();
        fx.update(0.016, [{ x: 300, y: 500 }]);
        fx.update(0.1, []);
        expect(fx.age).toBeCloseTo(0.1);
        expect([fx.x, fx.y]).toEqual([300, 500]);
    });

    it('restarts from the new position on another hit', () => {
        const fx = new HitEffects();
        fx.update(0.016, [{ x: 300, y: 500 }]);
        fx.update(0.1, [{ x: 100, y: 200 }]);
        expect(fx.age).toBe(0);
        expect([fx.x, fx.y]).toEqual([100, 200]);
    });

    it('clears on demand, as a restart does', () => {
        const fx = new HitEffects();
        fx.update(0.016, [{ x: 300, y: 500 }]);
        fx.clear();
        expect(fx.age).toBe(Infinity);
    });
});
