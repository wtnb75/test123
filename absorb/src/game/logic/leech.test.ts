import { describe, expect, it } from 'vitest';
import { DEMO_RUN_SECONDS, LEECH_FIRST_AT } from './constants';
import { StockFlash, drainStep, leechDrainRate, tetherWidth } from './leech';

// Expected values are worked out by hand from docs/spec/leech.md: the drain is 6 × (1 − d/90) stock per second,
// so 6 at d = 0, 4 at 30 px, 2 at the 60 px orbit and 0 at the 90 px field edge; the tether is 1 px wide at no drain
// and 6 px at the maximum; the red cue lasts 0.15 s from the frame stock was taken.

describe('the leech and the title demo', () => {
    it('first appears no earlier than the end of a demo run, so the demo never shows one', () => {
        expect(LEECH_FIRST_AT).toBeGreaterThanOrEqual(DEMO_RUN_SECONDS);
    });
});

describe('drain rate by distance', () => {
    it.each([[0, 6], [30, 4], [45, 3], [60, 2], [89, 6 * (1 / 90)]])('is %d px -> %d per second', (d, rate) => {
        expect(leechDrainRate(d)).toBeCloseTo(rate, 9);
    });

    it('is 0 at exactly the field radius and beyond it', () => {
        expect(leechDrainRate(90)).toBe(0);
        expect(leechDrainRate(90.001)).toBe(0);
        expect(leechDrainRate(500)).toBe(0);
    });

    it('never exceeds the maximum when the distance is (impossibly) negative', () => {
        expect(leechDrainRate(-5)).toBe(6);
    });
});

describe('tether width', () => {
    it('is 1 px with no drain, 6 px at the maximum and 3.5 px halfway (3 per second)', () => {
        expect(tetherWidth(0)).toBe(1);
        expect(tetherWidth(6)).toBe(6);
        expect(tetherWidth(3)).toBeCloseTo(3.5, 9);
    });

    it('stays within 1..6 px for rates outside 0..6', () => {
        expect(tetherWidth(-1)).toBe(1);
        expect(tetherWidth(12)).toBe(6);
    });
});

describe('the drain tally', () => {
    it('takes nothing until a whole unit has built up, then takes it: 2 per second at 60 fps is 1 on the 30th frame', () => {
        let carry = 0;
        let stock = 10;
        for (let frame = 1; frame <= 29; frame++) {
            const step = drainStep(carry, 2, 1 / 60, stock);
            expect(step.taken).toBe(0);
            carry = step.carry;
        }
        const step = drainStep(carry, 2, 1 / 60, stock);
        expect(step.taken).toBe(1);
        stock -= step.taken;
        expect(step.carry).toBeLessThan(1e-3);
        expect(stock).toBe(9);
    });

    it('carries the fraction of a unit over: 1.5 built up takes 1 and keeps 0.5', () => {
        const step = drainStep(0.5, 60, 1 / 60, 5); // 0.5 + 1 = 1.5
        expect(step.taken).toBe(1);
        expect(step.carry).toBeCloseTo(0.5, 9);
    });

    it('takes several units at once when the frame is long: 2.5 built up takes 2', () => {
        const step = drainStep(0, 5, 0.5, 9);
        expect(step.taken).toBe(2);
        expect(step.carry).toBeCloseTo(0.5, 9);
    });

    it('treats a total just under a whole unit as whole (float slack of 1e-6)', () => {
        expect(drainStep(1 - 5e-7, 0, 0.1, 5).taken).toBe(1);
        expect(drainStep(1 - 2e-6, 0, 0.1, 5).taken).toBe(0);
    });

    it('never takes more than the stock and then forgets the carry: stock 1 with 2.5 built up takes 1, carry 0', () => {
        const step = drainStep(0.5, 4, 0.5, 1);
        expect(step).toEqual({ taken: 1, carry: 0 });
    });

    it('drops the carry once the stock is 0, even when nothing was taken', () => {
        expect(drainStep(0.9, 2, 1 / 60, 0)).toEqual({ taken: 0, carry: 0 });
    });

    it('keeps the carry while some stock is left', () => {
        const step = drainStep(0.25, 2, 1 / 60, 3);
        expect(step.taken).toBe(0);
        expect(step.carry).toBeCloseTo(0.25 + 2 / 60, 9);
    });

    it('takes nothing and keeps nothing with no leech (rate 0) and no carry', () => {
        expect(drainStep(0, 0, 1 / 60, 7)).toEqual({ taken: 0, carry: 0 });
    });
});

describe('the red stock cue', () => {
    it('is not red before any drain', () => {
        const flash = new StockFlash();
        flash.update(1 / 60, 0);
        expect(flash.isRed).toBe(false);
    });

    it('is red on the frame stock is taken and until exactly 0.15 s have passed', () => {
        const flash = new StockFlash();
        flash.update(1 / 60, 1);
        expect(flash.isRed).toBe(true);
        flash.update(0.149, 0); // age 0.149
        expect(flash.isRed).toBe(true);
        flash.update(0.001, 0); // age 0.15
        expect(flash.isRed).toBe(false);
    });

    it('restarts when stock is taken again before it ends', () => {
        const flash = new StockFlash();
        flash.update(1 / 60, 1);
        flash.update(0.1, 0);
        flash.update(1 / 60, 2);
        flash.update(0.1, 0); // 0.1 after the second drain, 0.2 after the first
        expect(flash.isRed).toBe(true);
        flash.update(0.05, 0);
        expect(flash.isRed).toBe(false);
    });

    it('is not restarted by a frame that took nothing', () => {
        const flash = new StockFlash();
        flash.update(1 / 60, 1);
        flash.update(0.1, 0);
        flash.update(0.06, 0); // 0.1 + 0.06 > 0.15 and no new drain
        expect(flash.isRed).toBe(false);
    });

    it('is forgotten by clear (a restart leaves nothing)', () => {
        const flash = new StockFlash();
        flash.update(1 / 60, 1);
        flash.clear();
        expect(flash.isRed).toBe(false);
        flash.update(1 / 60, 0);
        expect(flash.isRed).toBe(false);
    });
});
