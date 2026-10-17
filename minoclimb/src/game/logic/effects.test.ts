import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { cellsAfterClear, crumbleBlink, flashAlpha, hintAlpha } from './effects';

describe('crumbleBlink (CRUMBLE_TIME 2 s, 2 Hz rising to 8 Hz)', () => {
    it('is brightest at the start of the warning', () => {
        expect(crumbleBlink(0)).toBe(1);
    });

    it('is (1 + cos(0.75 pi)) / 2 at t = 0.5: 2 * 0.5 + 6 * 0.25 / 4 = 1.375 cycles, a fraction of 0.375', () => {
        expect(crumbleBlink(0.5)).toBeCloseTo((1 - Math.SQRT1_2) / 2, 12);
    });

    it('is dark at t = 1 (3.5 cycles) and brightest again at t = 2 = CRUMBLE_TIME (10 cycles)', () => {
        expect(crumbleBlink(1)).toBeCloseTo(0, 12);
        expect(crumbleBlink(P.CRUMBLE_TIME)).toBeCloseTo(1, 12);
    });

    it('stays within 0..1', () => {
        for (let i = 0; i <= 400; i++) {
            const a = crumbleBlink((i / 400) * P.CRUMBLE_TIME);
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(1);
        }
    });

    it('blinks faster later: more bright peaks in the second half than in the first', () => {
        const peaks = (from: number, to: number): number => {
            let n = 0;
            const steps = 4000;
            for (let i = 1; i < steps; i++) {
                const t = from + ((to - from) * i) / steps;
                const dt = (to - from) / steps;
                const [a, b, c] = [crumbleBlink(t - dt), crumbleBlink(t), crumbleBlink(t + dt)];
                if (b > a && b >= c && b > 0.9) n++;
            }
            return n;
        };
        const first = peaks(0, 1);
        const second = peaks(1, 2);
        // The brightness peaks at whole cycle counts 2t + 1.5t^2 = 1, 2, 3 inside (0, 1) ...
        expect(first).toBe(3);
        // ... and at 4..9 inside (1, 2); the tenth is at t = 2 exactly, the edge of the interval.
        expect(second).toBe(6);
    });
});

describe('flashAlpha', () => {
    it('is fully visible at t = 0', () => {
        expect(flashAlpha(0, P.LOCK_FLASH_TIME)).toBe(1);
        expect(flashAlpha(0, P.CLEAR_FLASH_TIME)).toBe(1);
    });

    it('is exactly 0 from t = duration on', () => {
        expect(flashAlpha(P.LOCK_FLASH_TIME, P.LOCK_FLASH_TIME)).toBe(0);
        expect(flashAlpha(P.CLEAR_FLASH_TIME, P.CLEAR_FLASH_TIME)).toBe(0);
        expect(flashAlpha(5, P.CLEAR_FLASH_TIME)).toBe(0);
    });

    it('is still visible just before the duration and halfway at half of it', () => {
        expect(flashAlpha(P.CLEAR_FLASH_TIME - 1e-6, P.CLEAR_FLASH_TIME)).toBeGreaterThan(0);
        expect(flashAlpha(P.CLEAR_FLASH_TIME / 2, P.CLEAR_FLASH_TIME)).toBeCloseTo(0.5, 9);
    });

    it('never increases as time passes', () => {
        let prev = Infinity;
        for (let i = 0; i <= 40; i++) {
            const a = flashAlpha((i / 40) * P.CLEAR_FLASH_TIME * 1.2, P.CLEAR_FLASH_TIME);
            expect(a).toBeLessThanOrEqual(prev);
            prev = a;
        }
    });

    it('treats a negative time like the start', () => {
        expect(flashAlpha(-1, P.LOCK_FLASH_TIME)).toBe(1);
    });
});

describe('hintAlpha', () => {
    const fadeStart = P.HINT_TIME - P.HINT_FADE;

    it('stays at full opacity until HINT_TIME - HINT_FADE', () => {
        expect(hintAlpha(0)).toBe(1);
        expect(hintAlpha(fadeStart - 0.01)).toBe(1);
        expect(hintAlpha(fadeStart)).toBe(1);
    });

    it('fades in a straight line to exactly 0 at HINT_TIME', () => {
        expect(hintAlpha(fadeStart + P.HINT_FADE / 2)).toBeCloseTo(0.5, 9);
        expect(hintAlpha(fadeStart + P.HINT_FADE / 4)).toBeCloseTo(0.75, 9);
        expect(hintAlpha(P.HINT_TIME)).toBe(0);
    });

    it('stays at 0 afterwards', () => {
        expect(hintAlpha(P.HINT_TIME + 0.001)).toBe(0);
        expect(hintAlpha(60)).toBe(0);
    });
});

describe('cellsAfterClear', () => {
    const cell = (c: number, r: number) => ({ c, r });

    it('keeps cells where they are when nothing was cleared', () => {
        expect(cellsAfterClear([cell(3, 10), cell(4, 10)], [])).toEqual([cell(3, 10), cell(4, 10)]);
    });

    it('moves a cell down one row per cleared row below it', () => {
        expect(cellsAfterClear([cell(2, 15)], [17])).toEqual([cell(2, 16)]);
        expect(cellsAfterClear([cell(2, 15)], [16, 19])).toEqual([cell(2, 17)]);
    });

    it('drops cells that sat in a cleared row', () => {
        expect(cellsAfterClear([cell(2, 18), cell(3, 19)], [19])).toEqual([cell(2, 19)]);
    });

    it('does not move cells below every cleared row', () => {
        expect(cellsAfterClear([cell(5, 19)], [10, 12])).toEqual([cell(5, 19)]);
    });

    it('handles a piece whose rows straddle the cleared ones', () => {
        // Vertical I at rows 15-18, rows 16 and 18 cleared: row 15 has two cleared rows below it
        // (17 after the move), row 17 has one (18).
        const cells = [15, 16, 17, 18].map((r) => cell(0, r));
        expect(cellsAfterClear(cells, [16, 18])).toEqual([cell(0, 17), cell(0, 18)]);
    });
});
