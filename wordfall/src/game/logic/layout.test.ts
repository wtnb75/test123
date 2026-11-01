import { describe, expect, it } from 'vitest';
import { columnX, fieldGeometry, traySlotAt, traySlotRect } from './layout';

describe('fieldGeometry (docs/spec.md "H = 528 のときの配置の手計算")', () => {
    it('lays out H = 528', () => {
        expect(fieldGeometry(528)).toEqual({
            floorY: 398,
            fieldHeight: 218,
            spawnY: 200,
            removeY: 378,
            trayHeight: 92,
            trayTop: 430,
            hintY: 414,
        });
    });

    it('lays out H = 779', () => {
        const g = fieldGeometry(779);
        expect(g.floorY).toBe(649);
        expect(g.fieldHeight).toBe(469);
        expect(g.removeY).toBe(629);
        expect(g.trayTop).toBe(681);
    });
});

describe('columnX', () => {
    it('centres 7 columns across the 360 px width', () => {
        expect(columnX(0, 7)).toBeCloseTo(25.714, 3);
        expect(columnX(3, 7)).toBeCloseTo(180, 10);
        expect(columnX(6, 7)).toBeCloseTo(334.286, 3);
    });
});

describe('traySlotRect', () => {
    it('places the 10 slots in 2 rows of 5, row by row', () => {
        expect(traySlotRect(0, 528)).toEqual({ x: 2, y: 430, w: 68, h: 44 });
        expect(traySlotRect(4, 528)).toEqual({ x: 290, y: 430, w: 68, h: 44 });
        expect(traySlotRect(5, 528)).toEqual({ x: 2, y: 478, w: 68, h: 44 });
        expect(traySlotRect(9, 528)).toEqual({ x: 290, y: 478, w: 68, h: 44 });
    });
});

describe('traySlotAt', () => {
    it('finds the slot under a point inside it', () => {
        expect(traySlotAt(36, 440, 528)).toBe(0);
        expect(traySlotAt(330, 500, 528)).toBe(9);
    });

    it('gives the gap between two rows to the nearer row: y 475 -> row 0, y 476 -> row 1', () => {
        expect(traySlotAt(36, 475, 528)).toBe(0);
        expect(traySlotAt(36, 476, 528)).toBe(5);
    });

    it('gives the gap between two columns to the nearer slot: x 71.9 -> col 0, x 72 -> col 1', () => {
        expect(traySlotAt(71.9, 440, 528)).toBe(0);
        expect(traySlotAt(72, 440, 528)).toBe(1);
    });

    it('is -1 outside the tray: above, below, left and right', () => {
        expect(traySlotAt(36, 429, 528)).toBe(-1);
        expect(traySlotAt(36, 430, 528)).toBe(0);
        expect(traySlotAt(36, 521.9, 528)).toBe(5);
        expect(traySlotAt(36, 522, 528)).toBe(-1);
        expect(traySlotAt(-1, 440, 528)).toBe(-1);
        expect(traySlotAt(360, 440, 528)).toBe(-1);
    });

    it('follows the screen height (H = 779 puts the tray lower)', () => {
        expect(traySlotAt(36, 440, 779)).toBe(-1);
        expect(traySlotAt(36, 690, 779)).toBe(0);
    });
});
