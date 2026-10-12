import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { cellsAfterClear, flashAlpha, hintAlpha } from './effects';

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
