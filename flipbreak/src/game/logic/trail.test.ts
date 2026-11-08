import { describe, expect, it } from 'vitest';
import { TrailBuffer, trailAlpha } from './trail';

const FAST = 400; // px/s, above TRAIL_MIN_SPEED (300)

describe('trailAlpha', () => {
    it('fades from 0.30 (newest) to 0.05 (6th) in steps of 0.05', () => {
        expect(trailAlpha(0)).toBeCloseTo(0.3, 9);
        expect(trailAlpha(1)).toBeCloseTo(0.25, 9);
        expect(trailAlpha(5)).toBeCloseTo(0.05, 9);
    });
});

describe('TrailBuffer', () => {
    it('records nothing below TRAIL_MIN_SPEED (299) and starts at 300', () => {
        const t = new TrailBuffer();
        t.push(100, 100, 299);
        expect(t.size).toBe(0);
        t.push(100, 100, 300);
        expect(t.size).toBe(1);
    });

    it('keeps the last 6 positions, newest first', () => {
        const t = new TrailBuffer();
        for (let i = 0; i < 7; i++) t.push(100 + i * 10, 200, FAST);
        expect(t.size).toBe(6);
        expect(t.x(0)).toBe(160); // the newest
        expect(t.x(5)).toBe(110); // the oldest kept: the first (100) was dropped
        expect(t.y(0)).toBe(200);
    });

    it('keeps recording when the ball moved 79.9 px, and starts over when it moved exactly 80 px', () => {
        const t = new TrailBuffer();
        t.push(100, 100, FAST);
        t.push(179.9, 100, FAST);
        expect(t.size).toBe(2);
        const u = new TrailBuffer();
        u.push(100, 100, FAST);
        u.push(180, 100, FAST);
        expect(u.size).toBe(1);
        expect(u.x(0)).toBe(180);
    });

    it('is emptied by one slow frame and records again from one position', () => {
        const t = new TrailBuffer();
        t.push(100, 100, FAST);
        t.push(110, 100, FAST);
        t.push(120, 100, 299);
        expect(t.size).toBe(0);
        t.push(130, 100, 300);
        expect(t.size).toBe(1);
        expect(t.x(0)).toBe(130);
    });

    it('wraps around its ring correctly over many pushes', () => {
        const t = new TrailBuffer();
        for (let i = 0; i < 20; i++) t.push(i, 0, FAST);
        expect([0, 1, 2, 3, 4, 5].map((i) => t.x(i))).toEqual([19, 18, 17, 16, 15, 14]);
    });
});
