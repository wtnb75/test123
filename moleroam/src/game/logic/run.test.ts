import { describe, expect, it } from 'vitest';
import { displaySeconds, isLowTime, remainingMs, timePulseScale } from './run';

describe('isLowTime', () => {
    it('is low exactly when the displayed seconds reach 10 (10.000 s)', () => {
        expect(isLowTime(10000)).toBe(true);
    });

    it('is not low one millisecond above 10 s, where 11 is still displayed', () => {
        expect(isLowTime(10001)).toBe(false);
    });

    it('is low at 0 and not low at the start of the round', () => {
        expect(isLowTime(0)).toBe(true);
        expect(isLowTime(60000)).toBe(false);
    });
});

describe('timePulseScale', () => {
    it('is 1 outside the low-time phase, whatever the fraction of the second', () => {
        expect(timePulseScale(30000)).toBe(1);
        expect(timePulseScale(10001)).toBe(1);
        expect(timePulseScale(15999)).toBe(1);
    });

    it('is 1.0 at a whole-second boundary, including exactly 10.000 s and 0 s', () => {
        expect(timePulseScale(10000)).toBe(1);
        expect(timePulseScale(9000)).toBe(1);
        expect(timePulseScale(0)).toBe(1);
    });

    it('is almost 1.2 just after a second changes (9.999 s -> 1 + 0.2 * 0.999)', () => {
        expect(timePulseScale(9999)).toBeCloseTo(1.1998, 10);
    });

    it('shrinks linearly through the second (9.5 s -> 1.1, 5.5 s -> 1.1, 0.001 s -> 1.0002)', () => {
        expect(timePulseScale(9500)).toBeCloseTo(1.1, 10);
        expect(timePulseScale(5500)).toBeCloseTo(1.1, 10);
        expect(timePulseScale(1)).toBeCloseTo(1.0002, 10);
    });
});

describe('remainingMs', () => {
    it('is the full 60 seconds at the start', () => {
        expect(remainingMs(0)).toBe(60000);
    });

    it('counts down with elapsed time', () => {
        expect(remainingMs(59999)).toBe(1);
    });

    it('reaches exactly 0 at 60 seconds', () => {
        expect(remainingMs(60000)).toBe(0);
    });

    it('never goes negative after the end', () => {
        expect(remainingMs(70000)).toBe(0);
    });
});

describe('displaySeconds', () => {
    it('rounds up so 59.001 s reads 60', () => {
        expect(displaySeconds(59001)).toBe(60);
    });

    it('shows 1 for exactly 1 s and for the last millisecond', () => {
        expect(displaySeconds(1000)).toBe(1);
        expect(displaySeconds(1)).toBe(1);
    });

    it('shows 0 only when no time is left', () => {
        expect(displaySeconds(0)).toBe(0);
        expect(displaySeconds(-5)).toBe(0);
    });

    it('reads 60 at the start and 1 one millisecond before the end', () => {
        expect(displaySeconds(remainingMs(0))).toBe(60);
        expect(displaySeconds(remainingMs(59999))).toBe(1);
    });
});
