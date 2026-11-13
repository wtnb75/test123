import { describe, expect, it } from 'vitest';
import { AbsorbEffects, absorbRingProgress, absorbRingRadius, edgeAlpha, edgeWidth } from './absorbFx';

// docs/spec/powerup.md: the outer absorb ring grows by the same 30 px (ABSORB_RING_MAX_RADIUS 120 - FIELD_RADIUS 90) from the
// field radius it started at: 90 -> 120 normally, 135 -> 165 when started during a boost.

describe('the outer absorb ring radius', () => {
    it('grows from 90 px to 120 px without a boost', () => {
        expect(absorbRingRadius(0)).toBe(90);
        expect(absorbRingRadius(0.5)).toBe(105);
    });

    it('grows from 135 px to 165 px when it started at the boosted radius', () => {
        expect(absorbRingRadius(0, 135)).toBe(135);
        expect(absorbRingRadius(0.5, 135)).toBe(150);
        expect(absorbRingRadius(1, 135)).toBe(165);
    });
});

describe('the ring base radius of AbsorbEffects', () => {
    const bullet = [{ x: 0, y: 0 }];

    it('is the normal field radius unless told otherwise', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, bullet, true);
        expect(fx.ringBase).toBe(90);
    });

    it('takes the radius of the frame the ring started in', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, bullet, true, 135);
        expect(fx.ringBase).toBe(135);
        expect(absorbRingProgress(fx.ringAge)).toBe(0);
    });

    it('keeps that radius for the whole ring even if the boost ends meanwhile', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, bullet, true, 135);
        fx.update(0.1, [], true, 90);
        expect(fx.ringBase).toBe(135);
        expect(absorbRingRadius(absorbRingProgress(fx.ringAge), fx.ringBase)).toBeCloseTo(135 + 30 * (0.1 / 0.25), 10);
    });

    it('starts again from the radius of the frame a later bullet is absorbed in', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, bullet, true, 90);
        fx.update(0.1, bullet, true, 135);
        expect(fx.ringBase).toBe(135);
        expect(fx.ringAge).toBe(0);
    });

    it('does not change the pulse: the edge width and opacity follow the age only', () => {
        const fx = new AbsorbEffects();
        fx.update(0.016, bullet, true, 135);
        expect(edgeWidth(fx.pulseAge)).toBe(5);
        expect(edgeAlpha(fx.pulseAge)).toBe(1);
    });
});
