import { describe, expect, it } from 'vitest';
import { CellTimers, Countdown, PopupPool } from './effects';

describe('Countdown', () => {
    it('is inactive until started, then runs for its duration', () => {
        // Binary-exact durations so the countdown reaches exactly 0.
        const c = new Countdown(0.5);
        expect(c.active).toBe(false);
        c.start();
        expect(c.active).toBe(true);
        expect(c.progress).toBe(0);
        c.tick(0.125);
        expect(c.progress).toBe(0.25);
        c.tick(0.375);
        expect(c.active).toBe(false);
        expect(c.progress).toBe(1);
    });

    it('restarts from the full duration when started again mid-way (life flash re-count)', () => {
        const c = new Countdown(0.4);
        c.start();
        c.tick(0.3);
        c.start();
        expect(c.left).toBe(0.4);
    });

    it('never goes below zero and can be stopped early (banner dismissed by Start)', () => {
        const c = new Countdown(1);
        c.start();
        c.tick(5);
        expect(c.left).toBe(0);
        c.start();
        c.stop();
        expect(c.active).toBe(false);
    });
});

describe('PopupPool', () => {
    it('activates a slot at the given position and retires it after its lifetime', () => {
        const pool = new PopupPool(2, 0.6);
        const p = pool.spawn(10, 20);
        expect(p).toMatchObject({ x: 10, y: 20, age: 0, active: true });
        pool.tick(0.5);
        expect(pool.anyActive).toBe(true);
        pool.tick(0.1);
        expect(pool.anyActive).toBe(false);
    });

    it('reuses the oldest entry once all slots are busy', () => {
        const pool = new PopupPool(3, 0.6);
        pool.spawn(1, 0);
        pool.tick(0.1);
        pool.spawn(2, 0);
        pool.tick(0.1);
        pool.spawn(3, 0);
        const reused = pool.spawn(4, 0);
        expect(reused.x).toBe(4);
        expect(pool.items.map((p) => p.x).sort((a, b) => a - b)).toEqual([2, 3, 4]);
        expect(pool.items.filter((p) => p.active)).toHaveLength(3);
    });

    it('prefers a free slot over reusing an active one', () => {
        // Slot 1 is free but also the "oldest" (age 0); without the free-slot lookup, 2 would overwrite 1.
        const pool = new PopupPool(2, 0.6);
        pool.spawn(1, 0);
        pool.tick(0.3);
        pool.spawn(2, 0);
        expect(pool.items.filter((p) => p.active).map((p) => p.x).sort((a, b) => a - b)).toEqual([1, 2]);
    });
});

describe('CellTimers', () => {
    it('tracks each cell independently and drops it when time runs out', () => {
        const t = new CellTimers(0.75);
        t.start(1);
        t.tick(0.5);
        t.start(2);
        expect(t.size).toBe(2);
        t.tick(0.25);
        expect(t.has(1)).toBe(false);
        expect(t.has(2)).toBe(true);
        t.tick(0.5);
        expect(t.size).toBe(0);
    });

    it('removes a single cell when its turret is sold', () => {
        const t = new CellTimers(0.8);
        t.start(1);
        t.start(2);
        t.remove(1);
        expect(t.has(1)).toBe(false);
        expect(t.has(2)).toBe(true);
        expect(t.size).toBe(1);
    });

    it('does nothing when ticking with no timers', () => {
        const t = new CellTimers(0.8);
        t.tick(1);
        expect(t.size).toBe(0);
    });
});
