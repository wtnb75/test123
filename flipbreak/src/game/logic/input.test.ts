import { describe, expect, it } from 'vitest';
import { InputRouter, type PointerState } from './input';

const keys = (...codes: string[]): ReadonlySet<string> => new Set(codes);
const p = (id: number, x: number): PointerState => ({ id, x });
const none = { pointers: [] as PointerState[], keys: keys() };

describe('InputRouter keyboard', () => {
    it('raises the left flipper on ArrowLeft or KeyZ, the right one on ArrowRight or Slash', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, keys: keys('ArrowLeft'), ready: false })).toEqual({ left: true, right: false, charge: false });
        expect(r.route({ ...none, keys: keys('KeyZ'), ready: false }).left).toBe(true);
        expect(r.route({ ...none, keys: keys('ArrowRight'), ready: false })).toEqual({ left: false, right: true, charge: false });
        expect(r.route({ ...none, keys: keys('Slash'), ready: false }).right).toBe(true);
    });

    it('moves the flippers from the keyboard even while the ball is in the lane', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, keys: keys('ArrowLeft', 'ArrowRight'), ready: true })).toEqual({
            left: true,
            right: true,
            charge: false,
        });
    });

    it('charges the plunger on ArrowDown or Space only while the ball is ready', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, keys: keys('ArrowDown'), ready: true }).charge).toBe(true);
        expect(r.route({ ...none, keys: keys('Space'), ready: true }).charge).toBe(true);
        expect(r.route({ ...none, keys: keys('Space'), ready: false }).charge).toBe(false);
    });

    it('does nothing when nothing is held', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, ready: true })).toEqual({ left: false, right: false, charge: false });
        expect(r.route({ ...none, ready: false })).toEqual({ left: false, right: false, charge: false });
    });
});

describe('InputRouter touch', () => {
    it('uses the left half for the left flipper and the right half (x = 180 included) for the right one', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 179.9)], ready: false })).toEqual({ left: true, right: false, charge: false });
        expect(r.route({ ...none, pointers: [p(1, 180)], ready: false })).toEqual({ left: false, right: true, charge: false });
    });

    it('raises both flippers when fingers are on both halves', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 20), p(2, 340)], ready: false })).toEqual({ left: true, right: true, charge: false });
    });

    it('charges the plunger instead of moving a flipper while the ball is ready', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 20)], ready: true })).toEqual({ left: false, right: false, charge: true });
        expect(r.route({ ...none, pointers: [p(1, 340)], ready: true })).toEqual({ left: false, right: false, charge: true });
    });

    it('moves the flippers, and does not charge, when the ball is not ready (rising or bouncing in the lane)', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 20)], ready: false }).charge).toBe(false);
    });

    it('keeps charging while any charging finger is down, and stops when the last one is up', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 100), p(2, 200)], ready: true }).charge).toBe(true);
        expect(r.route({ ...none, pointers: [p(2, 200)], ready: true }).charge).toBe(true);
        expect(r.route({ ...none, pointers: [], ready: true }).charge).toBe(false);
    });
});

describe('InputRouter ignore-until-released', () => {
    it('ignores a finger that was down when the Scene started, until it is released and pressed again', () => {
        const r = new InputRouter();
        r.startBlock([1]);
        expect(r.route({ ...none, pointers: [p(1, 100)], ready: true }).charge).toBe(false);
        expect(r.route({ ...none, pointers: [p(1, 100)], ready: true }).charge).toBe(false);
        r.route({ ...none, pointers: [], ready: true }); // released
        expect(r.route({ ...none, pointers: [p(1, 100)], ready: true }).charge).toBe(true);
    });

    it('also keeps a started-down finger from moving a flipper until it is released', () => {
        const r = new InputRouter();
        r.startBlock([7]);
        expect(r.route({ ...none, pointers: [p(7, 20)], ready: false }).left).toBe(false);
        r.route({ ...none, pointers: [], ready: false });
        expect(r.route({ ...none, pointers: [p(7, 20)], ready: false }).left).toBe(true);
    });

    it('ignores a key that was held at the start (by code) until it is released', () => {
        const r = new InputRouter();
        r.startBlock([], ['Space', 'ArrowLeft']);
        expect(r.route({ ...none, keys: keys('Space', 'ArrowLeft'), ready: true })).toEqual({ left: false, right: false, charge: false });
        r.route({ ...none, keys: keys(), ready: true });
        expect(r.route({ ...none, keys: keys('Space'), ready: true }).charge).toBe(true);
    });

    it('does not let a finger that was holding a flipper charge the plunger when the ball comes back to the lane', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 20)], ready: false }).left).toBe(true);
        // The ball comes to rest in the lane while the finger is still down.
        expect(r.route({ ...none, pointers: [p(1, 20)], ready: true }).charge).toBe(false);
        r.route({ ...none, pointers: [], ready: true });
        expect(r.route({ ...none, pointers: [p(1, 20)], ready: true }).charge).toBe(true);
    });

    it('does the same for a charge key held while the ball was out of the lane', () => {
        const r = new InputRouter();
        r.route({ ...none, keys: keys('Space'), ready: false });
        expect(r.route({ ...none, keys: keys('Space'), ready: true }).charge).toBe(false);
        r.route({ ...none, keys: keys(), ready: true });
        expect(r.route({ ...none, keys: keys('Space'), ready: true }).charge).toBe(true);
    });

    it('does not ignore a finger pressed in the very first ready frame when nothing was blocked', () => {
        const r = new InputRouter();
        expect(r.route({ ...none, pointers: [p(1, 100)], ready: true }).charge).toBe(true);
    });

    it('keeps a finger ignored on its own only: another finger pressed later still charges', () => {
        const r = new InputRouter();
        r.startBlock([1]);
        expect(r.route({ ...none, pointers: [p(1, 100), p(2, 100)], ready: true }).charge).toBe(true);
    });

    it('does not block a finger again while the ball stays ready', () => {
        const r = new InputRouter();
        r.route({ ...none, ready: true });
        r.route({ ...none, pointers: [p(1, 100)], ready: true });
        expect(r.route({ ...none, pointers: [p(1, 100)], ready: true }).charge).toBe(true);
    });
});
