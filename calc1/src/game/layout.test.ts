import { describe, it, expect } from 'vitest';
import {
    actionY, canvasHeight, rowCenterY, scoreY, statusY, TABLE_TOP, ROW_HEIGHT, CANVAS_MIN_HEIGHT,
} from './layout';

describe('canvasHeight', () => {
    it('iPhone 12 portrait (390 × 844) fits the aspect ratio: 480 × 844 ÷ 390 ≒ 1038.8', () => {
        expect(canvasHeight(390, 844)).toBeCloseTo(1038.77, 1);
    });

    it('iPhone SE portrait (375 × 550) is held at the 960 minimum', () => {
        expect(canvasHeight(375, 550)).toBe(CANVAS_MIN_HEIGHT);
    });

    it('a landscape phone (667 × 310) is held at the 960 minimum', () => {
        expect(canvasHeight(667, 310)).toBe(CANVAS_MIN_HEIGHT);
    });

    it('a desktop window (1280 × 720) is held at the 960 minimum', () => {
        expect(canvasHeight(1280, 720)).toBe(CANVAS_MIN_HEIGHT);
    });

    it('a zero-width viewport falls back to the minimum height', () => {
        expect(canvasHeight(0, 844)).toBe(CANVAS_MIN_HEIGHT);
    });
});

describe('row and bottom-anchored positions', () => {
    it('row 0 is centred at 138 and row 11 at 754; the 12-row table ends at 782', () => {
        expect(rowCenterY(0)).toBe(138);
        expect(rowCenterY(11)).toBe(754);
        expect(TABLE_TOP + 12 * ROW_HEIGHT).toBe(782);
    });

    it('at height 960 the status, score and action lines sit at 878, 912 and 928 (as before)', () => {
        expect(statusY(960)).toBe(878);
        expect(scoreY(960)).toBe(912);
        expect(actionY(960)).toBe(928);
    });

    it('at height 960 the bottom lines sit below the 12-row table and inside the canvas', () => {
        const tableBottom = TABLE_TOP + 12 * ROW_HEIGHT;
        expect(statusY(960) - tableBottom).toBeGreaterThan(40);
        expect(statusY(960)).toBeLessThan(scoreY(960));
        expect(scoreY(960)).toBeLessThan(actionY(960));
        expect(actionY(960)).toBeLessThan(960);
    });

    it('a taller canvas moves the bottom lines down by the same amount', () => {
        const h = canvasHeight(390, 844);
        expect(statusY(h)).toBeCloseTo(956.77, 1);
        expect(scoreY(h)).toBeCloseTo(990.77, 1);
    });
});
