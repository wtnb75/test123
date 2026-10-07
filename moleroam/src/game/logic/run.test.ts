import { describe, expect, it } from 'vitest';
import { displaySeconds, remainingMs } from './run';

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
