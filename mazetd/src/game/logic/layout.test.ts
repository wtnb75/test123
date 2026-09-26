import { describe, expect, it } from 'vitest';
import { BOARD_RECT, BUTTONS, buttonAt, cellCenterX, cellCenterY, contains, pointToCell } from './layout';

describe('board geometry', () => {
    it('centres the 504x672 board horizontally with its top at y=96', () => {
        expect(BOARD_RECT).toEqual({ x: 18, y: 96, w: 504, h: 672 });
    });

    it('maps the top-left pixel of the board to cell (0,0)', () => {
        expect(pointToCell(18, 96)).toEqual({ col: 0, row: 0 });
    });

    it('maps the last pixel before the bottom-right edge to cell (8,11)', () => {
        expect(pointToCell(521.99, 767.99)).toEqual({ col: 8, row: 11 });
    });

    it('maps a point exactly on an inner cell border to the cell right/below it', () => {
        expect(pointToCell(18 + 56, 96 + 56)).toEqual({ col: 1, row: 1 });
    });

    it.each([
        ['left of the board', 17.99, 400],
        ['right edge of the board', 522, 400],
        ['above the board (HUD)', 200, 95.99],
        ['bottom edge of the board (panel)', 200, 768]
    ])('returns null for a point %s', (_label, x, y) => {
        expect(pointToCell(x, y)).toBeNull();
    });

    it('returns cell centres 56px apart starting at (46,124)', () => {
        expect(cellCenterX(0)).toBe(46);
        expect(cellCenterY(0)).toBe(124);
        expect(cellCenterX(4)).toBe(270);
        expect(cellCenterY(11)).toBe(740);
    });
});

describe('buttons', () => {
    it('finds each button by a point at its centre', () => {
        for (const [id, r] of Object.entries(BUTTONS)) {
            expect(buttonAt(r.x + r.w / 2, r.y + r.h / 2)).toBe(id);
        }
    });

    it('lays out wall, turret and sell left-to-right above a full-width start button, all below the board', () => {
        expect(BUTTONS.wall.x).toBeLessThan(BUTTONS.turret.x);
        expect(BUTTONS.turret.x).toBeLessThan(BUTTONS.sell.x);
        expect(BUTTONS.start.y).toBeGreaterThan(BUTTONS.wall.y + BUTTONS.wall.h);
        expect(BUTTONS.start.w).toBe(BOARD_RECT.w);
        expect(BUTTONS.wall.y).toBeGreaterThanOrEqual(BOARD_RECT.y + BOARD_RECT.h);
        expect(BUTTONS.start.y + BUTTONS.start.h).toBeLessThanOrEqual(960);
    });

    it('returns null on the board, in the HUD and in the gap between buttons', () => {
        expect(buttonAt(270, 400)).toBeNull();
        expect(buttonAt(270, 40)).toBeNull();
        const gapX = BUTTONS.wall.x + BUTTONS.wall.w + 1;
        expect(buttonAt(gapX, BUTTONS.wall.y + 5)).toBeNull();
    });

    it('treats the right/bottom edge of a rect as outside', () => {
        const r = { x: 0, y: 0, w: 10, h: 10 };
        expect(contains(r, 0, 0)).toBe(true);
        expect(contains(r, 10, 5)).toBe(false);
        expect(contains(r, 5, 10)).toBe(false);
    });
});
