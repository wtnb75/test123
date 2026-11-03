import { describe, expect, it } from 'vitest';
import { DEMO_RUN_SECONDS, LEECH_FIRST_AT } from './constants';
import {
    DrainParticles, StockFlash, drainStep, fieldTint, hasTether, leechDrainRate, particleCoord, particleProgress,
    tetherWidth, type DrainSource
} from './leech';

// Expected values are worked out by hand from docs/spec/leech.md: the drain is 3.6 × (1 − d/150) stock per second,
// so 3.6 at d = 0, 2.88 at 30 px, 2.16 at the 60 px orbit, 1.44 at the 90 px field edge and 0 at 150 px; the tether
// is 1 px wide at no drain and 6 px at the maximum; the red cue lasts 0.15 s from the frame stock was taken;
// particles are emitted at rate × 4 per second (at most 2 per leech per frame, 40 in all) and flow for 0.4 s.

describe('the leech and the title demo', () => {
    it('first appears no earlier than the end of a demo run, so the demo never shows one', () => {
        expect(LEECH_FIRST_AT).toBeGreaterThanOrEqual(DEMO_RUN_SECONDS);
    });
});

describe('drain rate by distance', () => {
    it.each([[0, 3.6], [30, 2.88], [45, 2.52], [60, 2.16], [90, 1.44], [120, 0.72], [149, 3.6 / 150]])(
        'is %d px -> %d per second', (d, rate) => {
            expect(leechDrainRate(d)).toBeCloseTo(rate, 9);
        }
    );

    it('drains outside the absorb field (90 px) but inside the drain range (150 px)', () => {
        expect(leechDrainRate(91)).toBeGreaterThan(0);
    });

    it('is 0 at exactly the drain radius and beyond it', () => {
        expect(leechDrainRate(150)).toBe(0);
        expect(leechDrainRate(150.001)).toBe(0);
        expect(leechDrainRate(500)).toBe(0);
    });

    it('never exceeds the maximum when the distance is (impossibly) negative', () => {
        expect(leechDrainRate(-5)).toBe(3.6);
    });
});

describe('tether width', () => {
    it('is 2 px with no drain, 6 px at the maximum and 4 px halfway (1.8 per second)', () => {
        expect(tetherWidth(0)).toBe(2);
        expect(tetherWidth(3.6)).toBe(6);
        expect(tetherWidth(1.8)).toBeCloseTo(4, 9);
    });

    it('stays within 2..6 px for rates outside 0..3.6', () => {
        expect(tetherWidth(-1)).toBe(2);
        expect(tetherWidth(12)).toBe(6);
    });
});

describe('the absorb field tint', () => {
    it.each([[0, 0], [1.8, 0.4], [2.16, 0.48], [3.6, 0.8]])('is %d per second -> ratio %d', (rate, ratio) => {
        expect(fieldTint(rate)).toBeCloseTo(ratio, 9);
    });

    it('stops at 0.8 however fast two leeches drain together, and is 0 for a negative rate', () => {
        expect(fieldTint(7.2)).toBeCloseTo(0.8, 9);
        expect(fieldTint(-1)).toBe(0);
    });
});

const DT = 1 / 60;

/** A live leech at (x, y); the player is at the origin in these tests. */
function leech(x: number, y: number): DrainSource {
    return { kind: 'leech', x, y, removed: false };
}

/** Runs `frames` updates of `dt` seconds with the player at the origin, playing, holding `stock`. */
function emit(p: DrainParticles, enemies: DrainSource[], frames: number, stock = 10, dt = DT): void {
    for (let i = 0; i < frames; i++) p.update(dt, 0, 0, enemies, true, stock);
}

describe('stock particles: emission', () => {
    // At the 60 px orbit the drain is 2.16 per second, so a frame adds 2.16 × 8 / 60 = 0.288: 0.864 after 3 frames.
    it('emits the first one on the 4th frame at the 60 px orbit (0.864 after 3 frames, 1.152 after 4)', () => {
        const p = new DrainParticles();
        const e = leech(60, 0);
        emit(p, [e], 3);
        expect(p.particles).toHaveLength(0);
        emit(p, [e], 1);
        expect(p.particles).toHaveLength(1);
        expect(p.particles[0].age).toBe(0);
    });

    it('keeps the remainder: a second one follows 3 frames later (0.152 + 3 × 0.288 = 1.016)', () => {
        const p = new DrainParticles();
        const e = leech(60, 0);
        emit(p, [e], 6);
        expect(p.particles).toHaveLength(1);
        emit(p, [e], 1);
        expect(p.particles).toHaveLength(2);
    });

    it('emits nothing at exactly the drain radius, where the drain rate is 0', () => {
        const p = new DrainParticles();
        emit(p, [leech(150, 0)], 100);
        expect(p.particles).toHaveLength(0);
    });

    it('emits outside the absorb field, from 149 px inward', () => {
        const p = new DrainParticles();
        emit(p, [leech(120, 0)], 60); // 0.72 × 8 = 5.76 per second
        expect(p.particles.length).toBeGreaterThan(0);
    });

    it('emits nothing while the stock is 0 and forgets the built-up remainder', () => {
        const p = new DrainParticles();
        const e = leech(60, 0);
        emit(p, [e], 3); // 0.864 built up
        emit(p, [e], 50, 0);
        expect(p.particles).toHaveLength(0);
        emit(p, [e], 3, 5); // would already have emitted on the 1st of these if the remainder had survived
        expect(p.particles).toHaveLength(0);
        emit(p, [e], 1, 5);
        expect(p.particles).toHaveLength(1);
    });

    it('emits with a stock of exactly 1, the smallest stock that can still be drained', () => {
        const p = new DrainParticles();
        emit(p, [leech(60, 0)], 4, 1);
        expect(p.particles).toHaveLength(1);
    });

    it('forgets the remainder of a leech that left the drain range, so it starts over on coming back', () => {
        const p = new DrainParticles();
        const e = leech(60, 0);
        emit(p, [e], 3); // 0.864 built up
        e.x = 200;
        emit(p, [e], 1); // out of range for a frame
        e.x = 60;
        emit(p, [e], 1); // 0.288 if the remainder was dropped, 1.152 if it was kept
        expect(p.particles).toHaveLength(0);
    });

    it('drops the remainder of a destroyed leech (seen again only if the object were revived)', () => {
        const p = new DrainParticles();
        const e = leech(60, 0);
        emit(p, [e], 3); // 0.864 built up
        e.removed = true;
        emit(p, [], 1); // the leech has left the list; its entry is pruned
        e.removed = false;
        emit(p, [e], 1); // 0.288 if the entry was dropped, 1.152 if it lingered
        expect(p.particles).toHaveLength(0);
    });

    it('emits nothing when not active (not playing), also forgetting the remainder', () => {
        const p = new DrainParticles();
        const e = leech(60, 0);
        emit(p, [e], 3);
        p.update(DT, 0, 0, [e], false, 10);
        emit(p, [e], 3); // 0.864 again: 1.728 would have emitted had the first 0.864 been kept
        expect(p.particles).toHaveLength(0);
    });

    it('ignores destroyed leeches and other enemies', () => {
        const p = new DrainParticles();
        const dead = { ...leech(60, 0), removed: true };
        const other: DrainSource = { kind: 'grunt', x: 60, y: 0, removed: false };
        emit(p, [dead, other], 100);
        expect(p.particles).toHaveLength(0);
    });

    // A leech touching the player drains 3.6 per second: 3.6 × 8 = 28.8 particles per second.
    it('emits at most 2 per leech per frame and drops the rest: 5.3 built up gives 2 and keeps 0.3', () => {
        const p = new DrainParticles();
        const e = leech(0, 0);
        p.update(5.3 / 28.8, 0, 0, [e], true, 10);
        expect(p.particles).toHaveLength(2);
        p.update(0.8 / 28.8, 0, 0, [e], true, 10); // 0.3 + 0.8 = 1.1 -> one more only if the 0.3 was kept (0.8 alone is not)
        expect(p.particles.filter((s) => s.age === 0)).toHaveLength(1);
    });

    it('takes 2.0 built up as exactly 2 particles with nothing kept', () => {
        const p = new DrainParticles();
        const e = leech(0, 0);
        p.update(2 / 28.8, 0, 0, [e], true, 10);
        expect(p.particles).toHaveLength(2);
        p.update(0.9 / 28.8, 0, 0, [e], true, 10);
        expect(p.particles.filter((s) => s.age === 0)).toHaveLength(0);
    });

    it('keeps at most 60 in all, dropping the oldest first', () => {
        const p = new DrainParticles();
        const enemies: DrainSource[] = [];
        for (let i = 0; i < 10; i++) enemies.push(leech(0, 0)); // 10 leeches touching the player × 2 per frame = 20 per frame
        for (let i = 0; i < 4; i++) p.update(2 / 28.8, 0, 0, enemies, true, 10); // 4 frames of 0.069 s: all inside 0.4 s
        expect(p.particles).toHaveLength(60);
        const ages = p.particles.map((s) => s.age);
        expect(ages).toEqual([...ages].sort((a, b) => b - a)); // oldest first, newest last
        expect(ages[ages.length - 1]).toBe(0); // the newest frame survived whole
    });
});

describe('stock particles: the cap', () => {
    it('holds 60 exactly when 60 are emitted and drops one when 61 are', () => {
        const sixty: DrainSource[] = [];
        for (let i = 0; i < 60; i++) sixty.push(leech(0, 0)); // all touching the player: 1.5 each per frame -> 1 particle each
        const a = new DrainParticles();
        a.update(1.5 / 28.8, 0, 0, sixty, true, 10);
        expect(a.particles).toHaveLength(60);
        const b = new DrainParticles();
        b.update(1.5 / 28.8, 0, 0, [...sixty, leech(0, 0)], true, 10);
        expect(b.particles).toHaveLength(60);
    });
});

describe('stock particles: flow', () => {
    function oneParticle(e: DrainSource): DrainParticles {
        const p = new DrainParticles();
        emit(p, [e], 4);
        expect(p.particles).toHaveLength(1);
        return p;
    }

    it('lives exactly 0.4 s: still there after 0.399 s, gone after 0.4 s', () => {
        const a = oneParticle(leech(60, 0));
        a.update(0.399, 0, 0, [], false, 0);
        expect(a.particles).toHaveLength(1);
        const b = oneParticle(leech(60, 0));
        b.update(0.4, 0, 0, [], false, 0);
        expect(b.particles).toHaveLength(0);
    });

    it('ends at the leech and follows it while it is alive', () => {
        const e = leech(60, 0);
        const p = oneParticle(e);
        e.x = 100;
        e.y = 20;
        p.update(0.1, 0, 0, [e], false, 0);
        expect([p.particles[0].endX, p.particles[0].endY]).toEqual([100, 20]);
    });

    it('keeps flowing to the last place the leech was seen once it is destroyed', () => {
        const e = leech(60, 0);
        const p = oneParticle(e);
        e.x = 80;
        p.update(0.1, 0, 0, [e], false, 0);
        e.removed = true;
        e.x = 500;
        p.update(0.1, 0, 0, [e], false, 0);
        expect(p.particles).toHaveLength(1);
        expect(p.particles[0].endX).toBe(80);
    });

    it('keeps flowing while nothing new is emitted (e.g. the ending)', () => {
        const p = oneParticle(leech(60, 0));
        p.update(0.2, 0, 0, [leech(60, 0)], false, 10);
        expect(p.particles).toHaveLength(1);
        expect(p.particles[0].age).toBeCloseTo(0.2, 9);
    });

    it('is emptied by clear, with no remainder left over', () => {
        const e = leech(60, 0);
        const p = new DrainParticles();
        emit(p, [e], 3);
        p.clear();
        emit(p, [e], 3);
        expect(p.particles).toHaveLength(0); // the 3 frames before the clear did not carry over
    });
});

describe('which leeches get a tether', () => {
    it('is every leech inside the drain range, the 150 px edge included, even beyond the 90 px field', () => {
        expect(hasTether(0)).toBe(true);
        expect(hasTether(91)).toBe(true);
        expect(hasTether(150)).toBe(true);
    });

    it('is none beyond 150 px', () => {
        expect(hasTether(150.001)).toBe(false);
        expect(hasTether(400)).toBe(false);
    });
});

describe('stock particle position', () => {
    it('is the player at age 0, the midpoint at 0.2 s and the leech from 0.4 s', () => {
        expect(particleCoord(100, 300, 0)).toBe(100);
        expect(particleCoord(100, 300, 0.2)).toBeCloseTo(200, 9);
        expect(particleCoord(100, 300, 0.4)).toBe(300);
        expect(particleCoord(300, 100, 0.2)).toBeCloseTo(200, 9); // also toward a smaller coordinate
    });
});

describe('stock particle progress', () => {
    it('is 0 at the player, 0.5 at half the time and 1 at 0.4 s, clamped outside', () => {
        expect(particleProgress(0)).toBe(0);
        expect(particleProgress(0.2)).toBeCloseTo(0.5, 9);
        expect(particleProgress(0.4)).toBe(1);
        expect(particleProgress(1)).toBe(1);
        expect(particleProgress(-1)).toBe(0);
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
