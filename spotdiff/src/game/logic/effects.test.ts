import { describe, expect, it } from 'vitest';
import type { Phase } from './run';
import {
    MissEffects,
    clampPopupX,
    fadeAlpha,
    hitPopScale,
    isLowTime,
    lowTimeScale,
    missMarkAlpha,
    missPopupAlpha,
    missPopupRise,
    msgPopScale,
    promptAlpha,
    showFirstHint,
} from './effects';

// Expected values below are worked by hand from the spec's 演出・UI table (parameters: hitPopMs 150, hitPopFrom 0.6,
// missMarkMs 400, missPopupMs 600, missPopupRise 40, lowTimePulse 0.10 / 1000 ms, msgPop 250 ms 0.8 -> 1.15,
// promptPulse 1600 ms min 0.5, resultFadeMs 300).

describe('hitPopScale', () => {
    it('starts at 0.6 and ends at exactly 1.0 after 150 ms', () => {
        expect(hitPopScale(0)).toBeCloseTo(0.6, 12);
        expect(hitPopScale(150)).toBeCloseTo(1, 12);
    });

    it('is 0.6 + 0.4 * (1 - 0.5^3) = 0.95 half way (ease-out)', () => {
        expect(hitPopScale(75)).toBeCloseTo(0.95, 12);
    });

    it('stays at 1.0 afterwards and never goes below the start for negative time', () => {
        expect(hitPopScale(10000)).toBeCloseTo(1, 12);
        expect(hitPopScale(-50)).toBeCloseTo(0.6, 12);
    });

    it('grows monotonically', () => {
        let prev = hitPopScale(0);
        for (let ms = 5; ms <= 150; ms += 5) {
            const v = hitPopScale(ms);
            if (v < prev) expect.fail(`shrinks at ${ms} ms`);
            prev = v;
        }
    });
});

describe('miss mark and popup', () => {
    it('fades the cross linearly from 1 to 0 over 400 ms', () => {
        expect(missMarkAlpha(0)).toBe(1);
        expect(missMarkAlpha(200)).toBe(0.5);
        expect(missMarkAlpha(400)).toBe(0);
        expect(missMarkAlpha(1000)).toBe(0);
    });

    it('fades the "-5" linearly over 600 ms while rising 40 px', () => {
        expect(missPopupAlpha(0)).toBe(1);
        expect(missPopupAlpha(300)).toBe(0.5);
        expect(missPopupAlpha(600)).toBe(0);
        expect(missPopupRise(0)).toBe(0);
        expect(missPopupRise(300)).toBe(20);
        expect(missPopupRise(600)).toBe(40);
        expect(missPopupRise(900)).toBe(40);
    });
});

describe('low-time warning', () => {
    it('starts at 10 seconds shown, not at 11', () => {
        expect(isLowTime(10)).toBe(true);
        expect(isLowTime(11)).toBe(false);
        expect(isLowTime(1)).toBe(true);
        expect(isLowTime(0)).toBe(true);
    });

    it('pulses 1.0 -> 1.10 -> 1.0 over one second, starting at 1.0', () => {
        expect(lowTimeScale(0)).toBeCloseTo(1, 12);
        expect(lowTimeScale(250)).toBeCloseTo(1.05, 12);
        expect(lowTimeScale(500)).toBeCloseTo(1.1, 12);
        expect(lowTimeScale(750)).toBeCloseTo(1.05, 12);
        expect(lowTimeScale(1000)).toBeCloseTo(1, 12);
        expect(lowTimeScale(1500)).toBeCloseTo(1.1, 12);
    });
});

describe('msgPopScale', () => {
    it('goes 0.8 -> 1.15 in the first 150 ms and back to 1.0 by 250 ms', () => {
        expect(msgPopScale(0)).toBeCloseTo(0.8, 12);
        expect(msgPopScale(75)).toBeCloseTo(0.975, 12);
        expect(msgPopScale(150)).toBeCloseTo(1.15, 12);
        expect(msgPopScale(200)).toBeCloseTo(1.075, 12);
        expect(msgPopScale(250)).toBe(1);
    });

    it('is 1.0 after the pop and 0.8 for negative time', () => {
        expect(msgPopScale(1000)).toBe(1);
        expect(msgPopScale(-10)).toBeCloseTo(0.8, 12);
    });
});

describe('prompt pulse and Result fade', () => {
    it('breathes between 0.5 and 1.0 with period 1600 ms, at full opacity at t = 0', () => {
        expect(promptAlpha(0)).toBeCloseTo(1, 12);
        expect(promptAlpha(400)).toBeCloseTo(0.75, 12);
        expect(promptAlpha(800)).toBeCloseTo(0.5, 12);
        expect(promptAlpha(1600)).toBeCloseTo(1, 12);
    });

    it('stays within [0.5, 1] at any time', () => {
        for (let ms = 0; ms <= 3200; ms += 37) {
            const a = promptAlpha(ms);
            if (a < 0.5 - 1e-12 || a > 1 + 1e-12) expect.fail(`alpha ${a} at ${ms} ms`);
        }
    });

    it('fades in linearly over 300 ms', () => {
        expect(fadeAlpha(0)).toBe(0);
        expect(fadeAlpha(150)).toBe(0.5);
        expect(fadeAlpha(300)).toBe(1);
        expect(fadeAlpha(5000)).toBe(1);
    });

    it('multiplies fade and prompt breathing: at 150 ms 0.5 times the pulse value', () => {
        expect(fadeAlpha(150) * promptAlpha(150)).toBeCloseTo(0.5 * (0.5 + (0.5 * (1 + Math.cos((2 * Math.PI * 150) / 1600))) / 2), 12);
    });
});

describe('clampPopupX', () => {
    it('keeps the "-5" centre 40 px inside both canvas edges', () => {
        expect(clampPopupX(10, 768)).toBe(40);
        expect(clampPopupX(40, 768)).toBe(40);
        expect(clampPopupX(384, 768)).toBe(384);
        expect(clampPopupX(728, 768)).toBe(728);
        expect(clampPopupX(760, 768)).toBe(728);
        expect(clampPopupX(1000, 1024)).toBe(984);
    });
});

describe('showFirstHint', () => {
    const run = (over: Partial<{ setNo: number; stageNo: number; phase: Phase; found: number }> = {}) => ({
        setNo: 1,
        stageNo: 1,
        phase: 'play' as Phase,
        ...over,
        found: { size: over.found ?? 0 },
    });

    it('shows in stage 1 of set 1 while playing with nothing found', () => {
        expect(showFirstHint(run())).toBe(true);
    });

    it('goes away after the first difference is found', () => {
        expect(showFirstHint(run({ found: 1 }))).toBe(false);
    });

    it('is not shown in other stages, other sets, or outside play', () => {
        expect(showFirstHint(run({ stageNo: 2 }))).toBe(false);
        expect(showFirstHint(run({ setNo: 2 }))).toBe(false);
        for (const phase of ['clear', 'won', 'over', 'paused'] as const) expect(showFirstHint(run({ phase }))).toBe(false);
    });
});

describe('MissEffects', () => {
    it('starts an effect at t = 0 and skips the tick of the frame it was created in', () => {
        const m = new MissEffects();
        m.add(1, 10, 20);
        m.tick(16);
        expect(m.items[0]).toMatchObject({ panel: 1, x: 10, y: 20, ms: 0 });
        m.tick(16);
        expect(m.items[0].ms).toBe(16);
    });

    it('drops an effect at exactly 600 ms (the longer of the cross 400 ms and the popup 600 ms)', () => {
        const m = new MissEffects();
        m.add(0, 1, 1);
        m.tick(1); // creation frame
        m.tick(599);
        expect(m.items).toHaveLength(1);
        m.tick(1);
        expect(m.items).toHaveLength(0);
    });

    it('keeps at most 4 and replaces the oldest first', () => {
        const m = new MissEffects();
        for (let i = 0; i < 6; i++) m.add(i % 2, i, 0);
        expect(m.items.map((e) => e.x)).toEqual([2, 3, 4, 5]);
    });

    it('lets independent effects age independently', () => {
        const m = new MissEffects();
        m.add(0, 1, 1);
        m.tick(1);
        m.tick(300);
        m.add(1, 2, 2);
        m.tick(100);
        expect(m.items.map((e) => e.ms)).toEqual([400, 0]);
    });

    it('is emptied by clear', () => {
        const m = new MissEffects();
        m.add(0, 1, 1);
        m.add(1, 2, 2);
        m.clear();
        expect(m.items).toHaveLength(0);
    });
});
