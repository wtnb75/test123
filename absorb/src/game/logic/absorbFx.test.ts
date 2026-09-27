import { describe, expect, it } from 'vitest';
import {
    AbsorbEffects, absorbRingProgress, absorbRingRadius, edgeAlpha, edgeWidth, lerpColor, suckCoord, suckProgress,
    suckRadius, trailAlpha, trailProgress
} from './absorbFx';
import { fadeAlpha } from './effects';

// Expected values below are worked out by hand from the spec's parameters: pull 0.25 s along u²,
// bullet radius 5 px, 3 afterimages 0.03 s apart at alpha 1 - k * 0.25, outline pulse 0.15 s
// from 5 px / 1 back to 2 px / 0.7, outer ring 0.25 s from 90 px to 120 px.

describe('pulling an absorbed bullet into the player', () => {
    it('shows the pull from t = 0 up to, but not including, 0.25 s', () => {
        expect(suckProgress(0)).toBe(0);
        expect(suckProgress(0.125)).toBe(0.5);
        expect(suckProgress(0.2499)).toBeGreaterThan(0.99);
        expect(suckProgress(0.25)).toBe(-1);
        expect(suckProgress(-0.01)).toBe(-1);
    });

    it('starts where the bullet was absorbed and covers a quarter of the way at the halfway point', () => {
        expect(suckCoord(100, 200, 0)).toBe(100);
        expect(suckCoord(100, 200, 0.5)).toBe(125);
        expect(suckCoord(300, 100, 0.5)).toBe(250);
    });

    it('moves the pulled bullet in proportion to the end point it is given', () => {
        expect(suckCoord(0, 80, 0.5)).toBe(20);
        expect(suckCoord(0, 120, 0.5)).toBe(30);
    });

    it('shrinks from the enemy bullet radius toward zero', () => {
        expect(suckRadius(0)).toBe(5);
        expect(suckRadius(0.5)).toBe(2.5);
    });

    it('blends the color channel by channel from the bullet red to the field color', () => {
        expect(lerpColor(0xff5252, 0x4dd0e1, 0)).toBe(0xff5252);
        expect(lerpColor(0x000000, 0x204060, 0.5)).toBe(0x102030);
        // (255 + 77) / 2 = 166, (82 + 208) / 2 = 145, (82 + 225) / 2 = 153.5 (either neighbour is fine)
        const mid = lerpColor(0xff5252, 0x4dd0e1, 0.5);
        expect(mid >> 8).toBe(0xa691);
        expect([153, 154]).toContain(mid & 0xff);
        expect(lerpColor(0xff5252, 0x4dd0e1, 1)).toBe(0x4dd0e1);
    });
});

describe('afterimages of a pull', () => {
    it('holds each afterimage back until k trail intervals have passed', () => {
        expect(trailProgress(0, 1)).toBe(-1);
        expect(trailProgress(0.0299, 1)).toBe(-1);
        expect(trailProgress(0.03, 1)).toBeCloseTo(0);
        expect(trailProgress(0.0899, 3)).toBe(-1);
        expect(trailProgress(0.0901, 3)).toBeGreaterThanOrEqual(0);
    });

    it('shows the pull as it was k intervals earlier', () => {
        expect(trailProgress(0.155, 1)).toBeCloseTo(0.5);
        expect(trailProgress(0.185, 2)).toBeCloseTo(0.5);
    });

    it('vanishes together with the pull even though its own time has not run out', () => {
        expect(trailProgress(0.2499, 1)).toBeGreaterThan(0.8);
        expect(trailProgress(0.25, 1)).toBe(-1);
        expect(trailProgress(0.25, 3)).toBe(-1);
    });

    it('fades by 0.25 per step back', () => {
        expect(trailAlpha(1)).toBe(0.75);
        expect(trailAlpha(2)).toBe(0.5);
        expect(trailAlpha(3)).toBe(0.25);
    });
});

describe('field outline pulse', () => {
    it('rests at 2 px and 0.7 opacity when no pulse is playing', () => {
        expect(edgeWidth(Infinity)).toBe(2);
        expect(edgeAlpha(Infinity)).toBe(0.7);
    });

    it('jumps to 5 px and full opacity, then eases back linearly', () => {
        expect(edgeWidth(0)).toBe(5);
        expect(edgeAlpha(0)).toBe(1);
        expect(edgeWidth(0.075)).toBeCloseTo(3.5);
        expect(edgeAlpha(0.075)).toBeCloseTo(0.85);
    });

    it('is back to rest exactly at 0.15 s', () => {
        expect(edgeWidth(0.1499)).toBeGreaterThan(2);
        expect(edgeWidth(0.15)).toBe(2);
        expect(edgeAlpha(0.15)).toBe(0.7);
    });
});

describe('outer ring', () => {
    it('grows from the field edge at 90 px to 120 px', () => {
        expect(absorbRingProgress(0)).toBe(0);
        expect(absorbRingRadius(0)).toBe(90);
        expect(absorbRingProgress(0.125)).toBe(0.5);
        expect(absorbRingRadius(0.5)).toBe(105);
    });

    it('fades from fully opaque to transparent', () => {
        expect(fadeAlpha(absorbRingProgress(0))).toBe(1);
        expect(fadeAlpha(absorbRingProgress(0.125))).toBe(0.5);
    });

    it('is gone exactly at 0.25 s', () => {
        expect(absorbRingProgress(0.2499)).toBeGreaterThan(0.99);
        expect(absorbRingProgress(0.25)).toBe(-1);
    });
});

describe('tracking the absorb effects', () => {
    const P = (x: number, y: number) => ({ x, y });

    it('starts with nothing playing', () => {
        const fx = new AbsorbEffects();
        expect(fx.sucks).toHaveLength(0);
        expect(fx.pulseAge).toBe(Infinity);
        expect(fx.ringAge).toBe(Infinity);
    });

    it('starts one pull per bullet but a single pulse and ring, all at t = 0 in the triggering frame', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, [P(1, 2), P(3, 4)], true);
        expect(fx.sucks).toEqual([{ x: 1, y: 2, age: 0 }, { x: 3, y: 4, age: 0 }]);
        expect(fx.pulseAge).toBe(0);
        expect(fx.ringAge).toBe(0);
    });

    it('ages everything while nothing new is absorbed', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, [P(0, 0)], true);
        fx.update(0.1, [], true);
        expect(fx.sucks[0].age).toBeCloseTo(0.1);
        expect(fx.pulseAge).toBeCloseTo(0.1);
        expect(fx.ringAge).toBeCloseTo(0.1);
    });

    it('restarts the pulse and ring on a new absorb while older pulls keep their own age', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, [P(0, 0)], true);
        fx.update(0.1, [P(5, 5)], true);
        expect(fx.pulseAge).toBe(0);
        expect(fx.ringAge).toBe(0);
        expect(fx.sucks.map((s) => s.age)).toEqual([0.1, 0]);
    });

    it('drops a pull once it is 0.25 s old and keeps the younger ones', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, [P(0, 0)], true);
        fx.update(0.125, [P(1, 1)], true);
        fx.update(0.125, [], true);
        expect(fx.sucks).toEqual([{ x: 1, y: 1, age: 0.125 }]);
        fx.update(0.0625, [], true);
        expect(fx.sucks).toHaveLength(1);
        fx.update(0.0625, [], true);
        expect(fx.sucks).toHaveLength(0);
    });

    it('clears everything, and starts nothing, in a frame that is no longer playing', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, [P(0, 0)], true);
        fx.update(0.016, [P(1, 1)], false);
        expect(fx.sucks).toHaveLength(0);
        expect(fx.pulseAge).toBe(Infinity);
        expect(fx.ringAge).toBe(Infinity);
    });

    it('clears everything on demand, as a restart does', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, [P(0, 0)], true);
        fx.clear();
        expect(fx.sucks).toHaveLength(0);
        expect(fx.pulseAge).toBe(Infinity);
        expect(fx.ringAge).toBe(Infinity);
    });
});
