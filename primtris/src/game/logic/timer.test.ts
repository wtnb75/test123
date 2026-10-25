import { describe, expect, it } from 'vitest';
import { WAIT_MIN_MS, WAIT_START_MS, WAIT_STEP_MS, remainingSeconds, stepWait, waitMs } from './timer';

describe('waitMs (the wait for the READY number, by the count of numbers dropped so far)', () => {
    it('is 8000 ms before any number is dropped, and 7750 ms after one', () => {
        expect(waitMs(0)).toBe(8000);
        expect(waitMs(1)).toBe(7750);
    });

    it('reaches the 2500 ms floor exactly at 22 drops, and stays there', () => {
        expect(waitMs(21)).toBe(2750);
        expect(waitMs(22)).toBe(2500);
        expect(waitMs(23)).toBe(2500); // 2250 would be below the floor
        expect(waitMs(1000)).toBe(2500);
    });

    it('uses the named constants', () => {
        expect(WAIT_START_MS).toBe(8000);
        expect(WAIT_STEP_MS).toBe(250);
        expect(WAIT_MIN_MS).toBe(2500);
    });
});

describe('stepWait (one frame of the wait)', () => {
    it('counts the frame down', () => {
        expect(stepWait(8000, 16)).toBe(7984);
    });

    it('keeps counting down while the number is held (three seconds of holding spend three seconds)', () => {
        let left = 7000;
        for (let i = 0; i < 180; i++) left = stepWait(left, 16.7);
        expect(left).toBeCloseTo(3994, 6); // 7000 − 180 × 16.7
    });

    it('never goes below 0 and then stays at 0', () => {
        expect(stepWait(10, 16)).toBe(0);
        expect(stepWait(0, 16)).toBe(0);
    });
});

describe('remainingSeconds (the HUD value: rounded down to one decimal, never below 0.0)', () => {
    it('shows 7750 ms as 7.7 and a whole 8000 ms as 8.0', () => {
        expect(remainingSeconds(7750)).toBe(7.7);
        expect(remainingSeconds(8000)).toBe(8);
    });

    it('rounds down rather than to the nearest tenth (2549 ms shows 2.5)', () => {
        expect(remainingSeconds(2549)).toBe(2.5);
        expect(remainingSeconds(2550)).toBe(2.5);
    });

    it('shows 0.0 at and below zero', () => {
        expect(remainingSeconds(0)).toBe(0);
        expect(remainingSeconds(-120)).toBe(0);
    });
});
