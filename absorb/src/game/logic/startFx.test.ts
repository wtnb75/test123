import { describe, expect, it } from 'vitest';
import { fadeAlpha } from './effects';
import {
    StartEffects, chargeRadius, digitAlpha, digitIndex, digitLabel, digitScale, digitTime, goAlpha, goProgress, goScale,
    hudAlpha, startRingProgress, startRingRadius, startRingWidth
} from './startFx';

// Expected values are worked out by hand from docs/spec/effects.md "演出・UI（スタート）": digits pop from
// 1.6x to 1x over 0.25 s (cubic ease-out), fade in over 0.12 s, then dim to 0.6 by the next digit; the field
// grows 0 -> 90 px over the 3 s ready (cubic ease-out); rings run 0.35 s from 10 px to 90 px (big one to 220 px,
// width 8); "GO!" lasts 0.5 s growing to 1.3x; the HUD fades in over 0.4 s.

describe('countdown digits', () => {
    it('shows 3, 2, 1 for the first, second and third second, switching at exactly 1 s and 2 s', () => {
        expect(digitIndex(0)).toBe(0);
        expect(digitIndex(0.999)).toBe(0);
        expect(digitIndex(1)).toBe(1);
        expect(digitIndex(1.999)).toBe(1);
        expect(digitIndex(2)).toBe(2);
        expect(digitIndex(2.999)).toBe(2);
        expect(digitLabel(0.016)).toBe('3');
        expect(digitLabel(1)).toBe('2');
        expect(digitLabel(2.5)).toBe('1');
    });

    it('never goes below the last digit or above the first at the edges of the clock', () => {
        expect(digitIndex(-0.5)).toBe(0);
        expect(digitIndex(3)).toBe(2);
        expect(digitIndex(10)).toBe(2);
    });

    it('measures the seconds into the current digit', () => {
        expect(digitTime(0)).toBe(0);
        expect(digitTime(1.25)).toBeCloseTo(0.25);
        expect(digitTime(2.999)).toBeCloseTo(0.999);
    });

    it('pops in at 1.6x, is 1.075x at 0.125 s and settles at exactly 0.25 s', () => {
        expect(digitScale(0)).toBeCloseTo(1.6);
        expect(digitScale(0.125)).toBeCloseTo(1.075);
        expect(digitScale(0.2499)).toBeGreaterThan(1);
        expect(digitScale(0.25)).toBe(1);
        expect(digitScale(0.9)).toBe(1);
    });

    it('fades in from 0 to full at 0.12 s, then dims towards 0.6', () => {
        expect(digitAlpha(0)).toBe(0);
        expect(digitAlpha(0.06)).toBeCloseTo(0.5);
        expect(digitAlpha(0.12)).toBeCloseTo(1);
        expect(digitAlpha(0.56)).toBeCloseTo(0.8);
        expect(digitAlpha(0.9999)).toBeCloseTo(0.6, 3);
    });

    it('starts each digit invisible even though the previous one ended dim', () => {
        expect(digitAlpha(0.9999)).toBeGreaterThan(0.5);
        expect(digitAlpha(digitTime(1))).toBe(0);
    });
});

describe('field charge', () => {
    it('is 0 at the start, 78.75 px halfway and exactly 90 px when ready ends', () => {
        expect(chargeRadius(0)).toBe(0);
        expect(chargeRadius(1.5)).toBeCloseTo(78.75);
        expect(chargeRadius(3)).toBeCloseTo(90);
    });

    it('keeps growing and never passes 90 px', () => {
        let last = -1;
        for (let t = 0; t <= 3; t += 0.05) {
            const r = chargeRadius(t);
            if (r < last) expect.fail(`shrank at T=${t}: ${last} -> ${r}`);
            last = r;
        }
        expect(chargeRadius(5)).toBeCloseTo(90);
        expect(chargeRadius(-1)).toBe(0);
    });
});

describe('HUD fade-in', () => {
    it('is 0 at the start, 0.5 at 0.2 s and full at exactly 0.4 s', () => {
        expect(hudAlpha(0)).toBe(0);
        expect(hudAlpha(0.2)).toBeCloseTo(0.5);
        expect(hudAlpha(0.4)).toBe(1);
        expect(hudAlpha(1)).toBe(1);
        expect(hudAlpha(-0.1)).toBe(0);
    });
});

describe('GO! text', () => {
    it('starts at 1x and full opacity, is 1.15x and half at 0.25 s, and is gone at exactly 0.5 s', () => {
        expect(goProgress(0)).toBe(0);
        expect(goScale(goProgress(0))).toBe(1);
        expect(goAlpha(goProgress(0))).toBe(1);
        expect(goScale(goProgress(0.25))).toBeCloseTo(1.15);
        expect(goAlpha(goProgress(0.25))).toBeCloseTo(0.5);
        expect(goProgress(0.4999)).toBeGreaterThan(0);
        expect(goProgress(0.5)).toBe(-1);
        expect(goProgress(Infinity)).toBe(-1);
    });
});

describe('start rings', () => {
    it('grows the small ring from 10 px to 90 px, 50 px at 0.175 s, gone at exactly 0.35 s', () => {
        expect(startRingProgress(0)).toBe(0);
        expect(startRingRadius(false, startRingProgress(0))).toBe(10);
        expect(startRingRadius(false, startRingProgress(0.175))).toBeCloseTo(50);
        expect(fadeAlpha(startRingProgress(0))).toBe(1);
        expect(fadeAlpha(startRingProgress(0.175))).toBeCloseTo(0.5);
        expect(startRingProgress(0.3499)).toBeGreaterThan(0);
        expect(startRingProgress(0.35)).toBe(-1);
    });

    it('grows the big ring from 10 px to 220 px, 115 px at 0.175 s, and is wider', () => {
        expect(startRingRadius(true, 0)).toBe(10);
        expect(startRingRadius(true, startRingProgress(0.175))).toBeCloseTo(115);
        expect(startRingWidth(true)).toBe(8);
        expect(startRingWidth(false)).toBe(3);
    });
});

/** Runs the effects the way the scene does, one call per frame. */
function frames(fx: StartEffects, from: number, to: number, dt: number, x = 100, y = 200) {
    for (let t = from; t < to - 1e-9; t += dt) fx.update(dt, 'ready', t + dt, x, y);
}

describe('start effects over time', () => {
    it('starts one small ring on the very first ready frame, at the player position', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 120, 640);
        expect(fx.rings).toEqual([{ x: 120, y: 640, age: 0, big: false }]);
    });

    it('never starts a fourth ring when the clock is already at or past 3 s on the first frame', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 3.5, 0, 0);
        expect(fx.rings).toHaveLength(1);
        fx.update(0.016, 'ready', 3.6, 0, 0);
        expect(fx.rings.filter((r) => r.age === 0)).toHaveLength(0);
    });

    it('starts exactly one ring per digit: three during the whole ready, and none for a clock at or past 3 s', () => {
        const fx = new StartEffects();
        let starts = 0;
        for (let t = 0.016; t < 3; t += 0.016) {
            fx.update(0.016, 'ready', t, 100, 200);
            starts += fx.rings.filter((r) => r.age === 0).length;
        }
        expect(starts).toBe(3);
        fx.update(0.016, 'ready', 3, 100, 200);
        expect(fx.rings.filter((r) => r.age === 0)).toHaveLength(0);
    });

    it('starts a ring on the frame T reaches 1 s exactly and not before', () => {
        const fx = new StartEffects();
        const startedNow = () => fx.rings.filter((r) => r.age === 0).length;
        fx.update(0.016, 'ready', 0.016, 0, 0);
        expect(startedNow()).toBe(1);
        fx.update(0.5, 'ready', 0.516, 0, 0);
        fx.update(0.4839, 'ready', 0.9999, 0, 0);
        expect(startedNow()).toBe(0);
        fx.update(0.0001, 'ready', 1, 50, 60);
        expect(fx.rings.filter((r) => r.x === 50 && r.y === 60 && r.age === 0)).toHaveLength(1);
    });

    it('keeps a ring where it started while the player moves on', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 100, 200);
        fx.update(0.1, 'ready', 0.116, 300, 400);
        expect(fx.rings[0].x).toBe(100);
        expect(fx.rings[0].y).toBe(200);
        expect(fx.rings[0].age).toBeCloseTo(0.1);
    });

    it('drops a ring once it is 0.35 s old', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.34, 'ready', 0.356, 0, 0);
        expect(fx.rings).toHaveLength(1);
        fx.update(0.01, 'ready', 0.366, 0, 0);
        expect(fx.rings).toHaveLength(0);
    });

    it('does not start a second ring for the same digit however many frames it lasts', () => {
        const fx = new StartEffects();
        frames(fx, 0, 0.9, 0.016);
        expect(fx.rings.length).toBeLessThanOrEqual(1);
        fx.update(0.016, 'ready', 0.95, 0, 0);
        expect(fx.rings.filter((r) => r.age === 0)).toHaveLength(0);
    });

    it('plays GO! and the big ring to the end when the run ends while they show, then removes them', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.016, 'playing', 0, 10, 20);
        fx.update(0.25, 'ending', 0, 10, 20);
        expect(goProgress(fx.goAge)).toBeCloseTo(0.5);
        expect(fx.rings.filter((r) => r.big && r.age > 0.2 && r.age < 0.3)).toHaveLength(1);
        fx.update(0.25, 'ending', 0.25, 10, 20);
        expect(goProgress(fx.goAge)).toBe(-1);
        expect(fx.rings).toHaveLength(0);
        fx.update(0.25, 'over', 0.5, 10, 20);
        expect(fx.rings).toHaveLength(0);
    });

    it('starts GO! and the big ring on the frame ready turns into playing, at the player position', () => {
        const fx = new StartEffects();
        frames(fx, 0, 2.98, 0.016);
        fx.update(0.016, 'playing', 0, 200, 700);
        expect(fx.goAge).toBe(0);
        expect(fx.rings).toContainEqual({ x: 200, y: 700, age: 0, big: true });
    });

    it('counts GO! up from that frame and stops it after 0.5 s', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.016, 'playing', 0, 0, 0);
        fx.update(0.25, 'playing', 0.25, 0, 0);
        expect(goProgress(fx.goAge)).toBeCloseTo(0.5);
        fx.update(0.25, 'playing', 0.5, 0, 0);
        expect(goProgress(fx.goAge)).toBe(-1);
    });

    it('does not start GO! again while playing goes on', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.016, 'playing', 0, 0, 0);
        fx.update(0.2, 'playing', 0.2, 0, 0);
        fx.update(0.016, 'playing', 0.216, 0, 0);
        expect(fx.goAge).toBeCloseTo(0.216);
        expect(fx.rings.filter((r) => r.big)).toHaveLength(1);
    });

    it('shows no GO! before the start and no small ring during playing', () => {
        const fx = new StartEffects();
        expect(goProgress(fx.goAge)).toBe(-1);
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.016, 'playing', 0, 0, 0);
        fx.update(0.5, 'playing', 0.5, 0, 0);
        fx.update(0.5, 'playing', 1, 0, 0);
        expect(fx.rings).toHaveLength(0);
    });

    it('does not start GO! when the phase was not ready before (a run that starts elsewhere)', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ending', 0, 0, 0);
        fx.update(0.016, 'playing', 0, 0, 0);
        expect(goProgress(fx.goAge)).toBe(-1);
    });

    it('stands still when no time passes (a paused frame) and starts nothing twice', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.05, 'ready', 0.066, 0, 0);
        const age = fx.rings[0].age;
        fx.update(0, 'ready', 0.066, 0, 0);
        fx.update(0, 'ready', 0.066, 0, 0);
        expect(fx.rings).toHaveLength(1);
        expect(fx.rings[0].age).toBe(age);
    });

    it('starts over after a restart: clear() drops everything and the first frame rings again', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.016, 'playing', 0, 0, 0);
        fx.clear();
        expect(fx.rings).toHaveLength(0);
        expect(goProgress(fx.goAge)).toBe(-1);
        fx.update(0.016, 'ready', 0.016, 5, 6);
        expect(fx.rings).toEqual([{ x: 5, y: 6, age: 0, big: false }]);
        fx.update(0.016, 'playing', 0, 5, 6);
        expect(fx.goAge).toBe(0);
    });

    it('counts the next run from a fresh ready after clear(), whatever phase came before', () => {
        const fx = new StartEffects();
        fx.update(0.016, 'ready', 0.016, 0, 0);
        fx.update(0.016, 'playing', 0, 0, 0);
        fx.clear();
        fx.update(0.016, 'playing', 0, 1, 2);
        expect(fx.goAge).toBe(0);
    });
});
