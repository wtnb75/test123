import { describe, expect, it } from 'vitest';
import {
    PickupEffects, advanceBoost, boostFieldRadius, edgeIsGold, itemDropPoint, pickupRingProgress, pickupRingRadius,
    stepItem, type PowerupItem
} from './powerup';

// Expected values are worked out by hand from docs/spec/powerup.md (initial values: item radius 12, 90 px/s,
// 10 s boost, field 90 -> 135 px, blink from 8 s in half periods of 0.125 s, pickup ring 0.3 s).

const FAR = { x: 5000, y: 5000 };
const item = (x: number, y: number): PowerupItem => ({ x, y, removed: false });

describe('item falling', () => {
    it('falls straight down at 90 px/s and keeps its x', () => {
        const i = item(100, 100);
        expect(stepItem(i, 1, FAR, 90, true, 768)).toBe('falling');
        expect(i).toMatchObject({ x: 100, y: 190 });
    });

    it('falls 1.5 px per frame at 60 fps', () => {
        const i = item(100, 100);
        stepItem(i, 1 / 60, FAR, 90, true, 768);
        expect(i.y).toBeCloseTo(101.5, 10);
    });

    it('does not move on a frame of no time (paused)', () => {
        const i = item(100, 100);
        stepItem(i, 0, FAR, 90, true, 768);
        expect(i.y).toBe(100);
    });
});

describe('taking an item', () => {
    const player = { x: 0, y: 0 };

    it('takes an item exactly one field radius away, but not a hair further', () => {
        expect(stepItem(item(90, 0), 0, player, 90, true, 768)).toBe('taken');
        expect(stepItem(item(90.01, 0), 0, player, 90, true, 768)).toBe('falling');
    });

    it('takes at the boosted radius too: 135 px yes, 135.01 px no', () => {
        expect(stepItem(item(0, 135), 0, player, 135, true, 768)).toBe('taken');
        expect(stepItem(item(0, 135.01), 0, player, 135, true, 768)).toBe('falling');
    });

    it('measures the distance after the item has moved this frame', () => {
        // 90 px/s * 0.5 s = 45 px: from 100 px above the player (outside 90) to 55 px above it (inside).
        expect(stepItem(item(0, -100), 0.5, player, 90, true, 768)).toBe('taken');
        // ...and 100 px above with only 0.05 s (4.5 px) is still outside.
        expect(stepItem(item(0, -100), 0.05, player, 90, true, 768)).toBe('falling');
    });

    it('takes nothing when taking is off (ready / ending), even inside the field', () => {
        const i = item(10, 10);
        expect(stepItem(i, 0, player, 90, false, 768)).toBe('falling');
    });
});

describe('leaving the screen', () => {
    it('is still falling with its centre exactly screen height + 12 px, gone beyond', () => {
        expect(stepItem(item(100, 780), 0, FAR, 90, true, 768)).toBe('falling');
        expect(stepItem(item(100, 780.01), 0, FAR, 90, true, 768)).toBe('gone');
    });

    it('is taken, not just dropped, when it leaves the screen inside the field in the same frame', () => {
        expect(stepItem(item(100, 781), 0, { x: 100, y: 790 }, 90, true, 768)).toBe('taken');
    });
});

describe('where an item starts', () => {
    it('starts at the carrier position', () => {
        expect(itemDropPoint({ x: 400, y: 76.8 }, 768)).toEqual({ x: 400, y: 76.8 });
    });

    it('keeps x on the screen when the carrier centre is outside it', () => {
        expect(itemDropPoint({ x: -5, y: 76.8 }, 768).x).toBe(0);
        expect(itemDropPoint({ x: 773, y: 76.8 }, 768).x).toBe(768);
        expect(itemDropPoint({ x: 768, y: 76.8 }, 768).x).toBe(768);
    });
});

describe('the boost clock', () => {
    it('stays off while there is no boost', () => {
        expect(advanceBoost(null, 1)).toBeNull();
    });

    it('adds the frame time while under 10 s', () => {
        expect(advanceBoost(0, 1 / 60)).toBeCloseTo(1 / 60, 12);
        expect(advanceBoost(9.9, 0.05)).toBeCloseTo(9.95, 10);
    });

    it('ends at exactly 10 s', () => {
        expect(advanceBoost(9.95, 0.05)).toBeNull();
        expect(advanceBoost(9.5, 0.5)).toBeNull();
    });

    it('forgives a sum of frame deltas that lands a hair under 10 s', () => {
        expect(advanceBoost(10 - 1e-7 - 1 / 60, 1 / 60)).toBeNull();
        expect(advanceBoost(10 - 1e-5 - 1 / 60, 1 / 60)).not.toBeNull();
    });

    it('lasts 599 frames at 60 fps and ends on the 600th', () => {
        let e: number | null = 0;
        for (let i = 0; i < 599; i++) e = advanceBoost(e, 1 / 60);
        expect(e).not.toBeNull();
        expect(advanceBoost(e, 1 / 60)).toBeNull();
    });

    it('lasts 199 frames of 0.05 s and ends on the 200th', () => {
        let e: number | null = 0;
        for (let i = 0; i < 199; i++) e = advanceBoost(e, 0.05);
        expect(e).not.toBeNull();
        expect(advanceBoost(e, 0.05)).toBeNull();
    });
});

describe('the boosted field radius', () => {
    it('is 90 px without a boost and 135 px with one (also the frame it was taken, clock 0)', () => {
        expect(boostFieldRadius(null)).toBe(90);
        expect(boostFieldRadius(0)).toBe(135);
        expect(boostFieldRadius(9.99)).toBe(135);
    });
});

describe('the field edge colour', () => {
    it('is the normal colour with no boost', () => {
        expect(edgeIsGold(null)).toBe(false);
    });

    it('is gold from the start up to the blink, and at 8 s (half period 0)', () => {
        expect(edgeIsGold(0)).toBe(true);
        expect(edgeIsGold(7.99)).toBe(true);
        expect(edgeIsGold(8)).toBe(true);
        expect(edgeIsGold(8.124)).toBe(true);
    });

    it('alternates every 0.125 s from 8 s: normal in odd half periods, gold in even ones', () => {
        expect(edgeIsGold(8.125)).toBe(false);
        expect(edgeIsGold(8.249)).toBe(false);
        expect(edgeIsGold(8.25)).toBe(true);
        expect(edgeIsGold(9.99)).toBe(false); // half period 15
    });
});

describe('the pickup ring', () => {
    it('shows for 0.3 s: progress 0 at the start, 0.5 at 0.15 s, gone at exactly 0.3 s', () => {
        expect(pickupRingProgress(0)).toBe(0);
        expect(pickupRingProgress(0.15)).toBeCloseTo(0.5, 10);
        expect(pickupRingProgress(0.299)).toBeLessThan(1);
        expect(pickupRingProgress(0.299)).toBeGreaterThan(0.99);
        expect(pickupRingProgress(0.3)).toBe(-1);
        expect(pickupRingProgress(Infinity)).toBe(-1);
    });

    it('grows from the normal field to the boosted field', () => {
        expect(pickupRingRadius(0)).toBe(90);
        expect(pickupRingRadius(0.5)).toBe(112.5);
        expect(pickupRingRadius(1)).toBe(135);
    });
});

describe('PickupEffects', () => {
    it('starts at 0 when an item was taken, then ages with the frames', () => {
        const fx = new PickupEffects();
        fx.update(0.016, 1, true);
        expect(fx.ringAge).toBe(0);
        fx.update(0.1, 0, true);
        expect(fx.ringAge).toBeCloseTo(0.1, 10);
    });

    it('restarts when another item is taken while the ring plays', () => {
        const fx = new PickupEffects();
        fx.update(0.016, 1, true);
        fx.update(0.2, 0, true);
        fx.update(0.016, 2, true); // two in one frame still one ring
        expect(fx.ringAge).toBe(0);
    });

    it('does not age on a frame of no time (paused)', () => {
        const fx = new PickupEffects();
        fx.update(0.016, 1, true);
        fx.update(0.1, 0, true);
        const age = fx.ringAge;
        fx.update(0, 0, true);
        expect(fx.ringAge).toBe(age);
    });

    it('plays nothing before any item is taken', () => {
        const fx = new PickupEffects();
        fx.update(0.1, 0, true);
        expect(pickupRingProgress(fx.ringAge)).toBe(-1);
    });

    it('clears and starts nothing when the frame is not playing (the frame the run ends)', () => {
        const fx = new PickupEffects();
        fx.update(0.016, 1, true);
        fx.update(0.016, 0, false);
        expect(pickupRingProgress(fx.ringAge)).toBe(-1);
        fx.update(0.016, 1, false);
        expect(pickupRingProgress(fx.ringAge)).toBe(-1);
    });

    it('clear() leaves nothing playing (a restart)', () => {
        const fx = new PickupEffects();
        fx.update(0.016, 1, true);
        fx.clear();
        expect(fx.ringAge).toBe(Infinity);
    });
});
