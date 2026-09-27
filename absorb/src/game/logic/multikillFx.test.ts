import { describe, expect, it } from 'vitest';
import { fadeAlpha } from './effects';
import {
    MultiKillEffects, counterCenter, counterFontSize, counterLabel, multiKillColor, multiplierLabel, popScale,
    resultFontSize, resultLabel, resultProgress, resultRise, resultStart, reusesCounterSpot, topLimit
} from './multikillFx';
import type { ScreenSize } from './screen';
import type { MultiKillUpdate, Settlement } from './world';

// Expected values below are worked out by hand from the spec's parameters: multiplier 1 + 0.5 (k − 1),
// size 24 + 4 (k − 2) px capped at 48, white / yellow from 3 / orange from 5, counter 30 px above the
// kill, 16 px edge margin, HUD band 48 px, pop 1.4 → 1 over 0.15 s, result rises 40 px over 1 s,
// boss offset 50 px.

const SCREEN: ScreenSize = { width: 1365, height: 768 };
const NO_BOSS = topLimit(false);
const WITH_BOSS = topLimit(true);

describe('multi-kill labels, sizes and colours', () => {
    it('writes the multiplier with one decimal: ×1.5, ×2.0, ×2.5', () => {
        expect(multiplierLabel(2)).toBe('×1.5');
        expect(multiplierLabel(3)).toBe('×2.0');
        expect(multiplierLabel(4)).toBe('×2.5');
    });

    it('reads "k HIT ×m" for the counter and "+points" for the result', () => {
        expect(counterLabel(3)).toBe('3 HIT ×2.0');
        expect(resultLabel(1800)).toBe('+1800');
    });

    it('grows the text 4 px per kill from 24 px, stopping at 48 px', () => {
        expect(counterFontSize(2)).toBe(24);
        expect(counterFontSize(3)).toBe(28);
        expect(counterFontSize(8)).toBe(48);
        expect(counterFontSize(9)).toBe(48);
    });

    it('makes the result 1.5 times the counter: 36 px for 2 kills, 72 px from 8', () => {
        expect(resultFontSize(2)).toBe(36);
        expect(resultFontSize(9)).toBe(72);
    });

    it('is white for 2, yellow for 3 and 4, orange from 5', () => {
        expect(multiKillColor(2)).toBe(0xffffff);
        expect(multiKillColor(3)).toBe(0xffd54f);
        expect(multiKillColor(4)).toBe(0xffd54f);
        expect(multiKillColor(5)).toBe(0xffa726);
        expect(multiKillColor(12)).toBe(0xffa726);
    });
});

describe('counter placement', () => {
    it('stays under the HUD band, and also under the 16 px boss HP bar while a boss is out', () => {
        expect(NO_BOSS).toBe(48);
        expect(WITH_BOSS).toBe(64);
        // 64 + 30 / 2 = 79
        expect(counterCenter(600, 60, 120, 30, SCREEN, WITH_BOSS).y).toBe(79);
        // 64 + 40 + 45 / 2 = 126.5
        expect(resultStart({ x: 600, y: 79 }, false, 150, 45, SCREEN, WITH_BOSS).y).toBe(126.5);
    });

    it('sits 30 px above the kill when there is room', () => {
        expect(counterCenter(600, 400, 120, 30, SCREEN, NO_BOSS)).toEqual({ x: 600, y: 370 });
    });

    it('keeps a 120 px wide text between x = 76 and x = 1289', () => {
        expect(counterCenter(10, 400, 120, 30, SCREEN, NO_BOSS).x).toBe(76);
        expect(counterCenter(76, 400, 120, 30, SCREEN, NO_BOSS).x).toBe(76);
        expect(counterCenter(1360, 400, 120, 30, SCREEN, NO_BOSS).x).toBe(1289);
    });

    it('keeps the text below the HUD band and above the bottom edge', () => {
        // 48 + 30 / 2 = 63 at the top; 768 − 15 = 753 at the bottom.
        expect(counterCenter(600, 60, 120, 30, SCREEN, NO_BOSS).y).toBe(63);
        expect(counterCenter(600, 800, 120, 30, SCREEN, NO_BOSS).y).toBe(753);
    });

    it('centres text wider than the screen allows', () => {
        expect(counterCenter(10, 400, 1400, 30, SCREEN, NO_BOSS).x).toBe(682.5);
        // Only the axis whose range is empty is centred; the other is still clamped as usual.
        expect(counterCenter(10, 60, 1400, 30, SCREEN, NO_BOSS)).toEqual({ x: 682.5, y: 63 });
        expect(counterCenter(600, 60, 120, 800, SCREEN, NO_BOSS).y).toBe(384);
        expect(resultStart({ x: 600, y: 60 }, false, 1400, 800, SCREEN, NO_BOSS)).toEqual({ x: 682.5, y: 384 });
    });

    it('writes into the point it is given instead of making a new one', () => {
        const out = { x: 0, y: 0 };
        expect(counterCenter(600, 400, 120, 30, SCREEN, NO_BOSS, out)).toBe(out);
        expect(out).toEqual({ x: 600, y: 370 });
    });
});

describe('result placement', () => {
    it('starts where its counter was', () => {
        expect(resultStart({ x: 600, y: 370 }, false, 150, 45, SCREEN, NO_BOSS)).toEqual({ x: 600, y: 370 });
    });

    it('lifts 50 px higher only when the last kill was the boss', () => {
        expect(resultStart({ x: 600, y: 370 }, true, 150, 45, SCREEN, NO_BOSS).y).toBe(320);
    });

    it('starts low enough that its 40 px rise stays below the HUD band', () => {
        // 48 + 40 + 45 / 2 = 110.5
        expect(resultStart({ x: 600, y: 63 }, false, 150, 45, SCREEN, NO_BOSS).y).toBe(110.5);
        expect(resultStart({ x: 600, y: 120 }, true, 150, 45, SCREEN, NO_BOSS).y).toBe(110.5);
    });

    it('keeps its own width inside the screen edges', () => {
        // 16 + 150 / 2 = 91
        expect(resultStart({ x: 76, y: 370 }, false, 150, 45, SCREEN, NO_BOSS).x).toBe(91);
    });
});

describe('where a result starts', () => {
    it('starts from the counter as last drawn when no kill came since', () => {
        expect(reusesCounterSpot(3, 3)).toBe(true);
    });

    // Regression: the last bullet often makes a kill and settles its release in the same frame; the
    // counter on screen then still shows the previous kill, so the result must start from the new one.
    it('does not reuse the counter spot when the settling frame added a kill', () => {
        expect(reusesCounterSpot(2, 3)).toBe(false);
    });

    it('has nothing to reuse when the counter was never drawn', () => {
        expect(reusesCounterSpot(undefined, 2)).toBe(false);
    });
});

describe('multi-kill timing', () => {
    it('pops from 1.4 back to 1 over 0.15 s', () => {
        expect(popScale(0)).toBeCloseTo(1.4);
        expect(popScale(0.075)).toBeCloseTo(1.2);
        expect(popScale(0.15)).toBe(1);
        expect(popScale(Infinity)).toBe(1);
    });

    it('rises 20 px at half opacity halfway through its 1 s, and is gone at exactly 1 s', () => {
        const p = resultProgress(0.5);
        expect(resultRise(p)).toBeCloseTo(20);
        expect(fadeAlpha(p)).toBeCloseTo(0.5);
        expect(resultProgress(0.9999)).toBeGreaterThan(0.99);
        expect(resultProgress(1)).toBe(-1);
    });
});

describe('tracking multi-kill counters and results', () => {
    const upd = (id: number, kills: number, x = 100, y = 200): MultiKillUpdate => ({ id, kills, x, y });
    const settle = (id: number, kills: number, score = 300, lastIsBoss = false): Settlement =>
        ({ id, kills, score, x: 100, y: 200, lastIsBoss });

    it('shows no counter for the first kill, and one from the second', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 1)], []);
        expect(fx.counters).toHaveLength(0);
        fx.update(0.016, [upd(1, 2)], []);
        expect(fx.counters).toEqual([{ id: 1, kills: 2, x: 100, y: 200, age: 0 }]);
    });

    it('moves the counter to the newest kill and restarts its pop', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 2)], []);
        fx.update(0.1, [], []);
        expect(fx.counters[0].age).toBeCloseTo(0.1);
        fx.update(0.016, [upd(1, 3, 400, 300)], []);
        expect(fx.counters[0]).toEqual({ id: 1, kills: 3, x: 400, y: 300, age: 0 });
    });

    it('keeps one counter per release', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 2), upd(2, 2, 500)], []);
        expect(fx.counters.map((c) => c.id)).toEqual([1, 2]);
    });

    it('turns the counter into a result when the release settles with 2 or more kills', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 3)], []);
        fx.update(0.016, [], [settle(1, 3, 1200, true)]);
        expect(fx.counters).toHaveLength(0);
        expect(fx.results).toEqual([{ id: 1, kills: 3, score: 1200, x: 100, y: 200, lastIsBoss: true, age: 0 }]);
    });

    it('shows nothing when a release settles with 1 kill or none', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 1)], [settle(1, 1, 100)]);
        fx.update(0.016, [], [settle(2, 0, 0)]);
        expect(fx.counters).toHaveLength(0);
        expect(fx.results).toHaveLength(0);
    });

    // The settlement carries the release's latest kill (World guarantees it matches the last update),
    // so the result is anchored where the counter would have been.
    it('goes straight to the result, anchored on the settlement, when the last kill and the settlement share a frame', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 2, 400, 300)], [{ id: 1, kills: 2, score: 300, x: 400, y: 300, lastIsBoss: false }]);
        expect(fx.counters).toHaveLength(0);
        expect(fx.results).toHaveLength(1);
        expect(fx.results[0]).toMatchObject({ id: 1, x: 400, y: 300 });
    });

    it('settling one release leaves the counter of another release alone', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 2), upd(2, 2)], []);
        fx.update(0.016, [], [settle(1, 2)]);
        expect(fx.counters.map((c) => c.id)).toEqual([2]);
    });

    it('drops a result at exactly 1 s and keeps one just short of it', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [], [settle(1, 2), settle(2, 2)]);
        fx.results[0].age = 1;
        fx.results[1].age = 0.9999;
        fx.update(0, [], []);
        expect(fx.results).toHaveLength(1);
        expect(fx.results[0].age).toBe(0.9999);
    });

    it('clears everything on demand, as a restart does', () => {
        const fx = new MultiKillEffects();
        fx.update(0.016, [upd(1, 2)], [settle(2, 3)]);
        fx.clear();
        expect(fx.counters).toHaveLength(0);
        expect(fx.results).toHaveLength(0);
    });
});
