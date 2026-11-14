import { describe, it, expect } from 'vitest';
import {
    BUTTON_CENTERS_X, BUTTON_HEIGHT, BUTTON_WIDTH, canvasHeight, HEADER_TEXT_X, HEADER_TEXT_Y, LEVEL_TEXT_X,
    rowCenterY, RESULT_BUTTON_HEIGHT, RESULT_BUTTON_WIDTH, RESULT_BUTTON_X, RESULT_BUTTON_Y, scoreY, statusY,
    TABLE_TOP, TIMER_TEXT_RIGHT_X, TOP_TEXT_SIZE, TOP_TEXT_Y, ROW_HEIGHT, CANVAS_WIDTH, tableMetrics, valuePairScale,
} from './layout';
import { OPERATION_POOL } from './logic';

// The spec's numbers, written out (not taken from the constants under test).
const SPEC_CANVAS_MIN_HEIGHT = 960;
// Top edge of the result-screen status text (spec 画面・Scene 構成: 文字の上端 約 865 at H = 960).
const STATUS_TEXT_TOP = 865;

describe('canvasHeight', () => {
    it('iPhone 12 portrait (390 × 844) fits the aspect ratio: 480 × 844 ÷ 390 ≒ 1038.8', () => {
        expect(canvasHeight(390, 844)).toBeCloseTo(1038.77, 1);
    });

    it('iPhone SE portrait (375 × 550) is held at the 960 minimum', () => {
        expect(canvasHeight(375, 550)).toBe(960);
    });

    it('a landscape phone (667 × 310) is held at the 960 minimum', () => {
        expect(canvasHeight(667, 310)).toBe(960);
    });

    it('a desktop window (1280 × 720) is held at the 960 minimum', () => {
        expect(canvasHeight(1280, 720)).toBe(960);
    });

    it('a zero-width viewport falls back to the minimum height', () => {
        expect(canvasHeight(0, 844)).toBe(960);
    });
});

describe('row and bottom-anchored positions', () => {
    it('row 0 is centred at 138 and row 11 at 754; the 12-row table ends at 782', () => {
        expect(rowCenterY(0)).toBe(138);
        expect(rowCenterY(11)).toBe(754);
        expect(TABLE_TOP + 12 * ROW_HEIGHT).toBe(782);
    });

    it('at height 960 the status and score lines sit at 878 and 912 (as before)', () => {
        expect(statusY(960)).toBe(878);
        expect(scoreY(960)).toBe(912);
    });

    it('the result button sits at a fixed 824 (240 × 77), between the table and the status line', () => {
        const tableBottom = TABLE_TOP + 12 * ROW_HEIGHT;
        const buttonTop = RESULT_BUTTON_Y - RESULT_BUTTON_HEIGHT / 2;
        const buttonBottom = RESULT_BUTTON_Y + RESULT_BUTTON_HEIGHT / 2;
        expect(RESULT_BUTTON_X).toBe(240);
        expect(RESULT_BUTTON_Y).toBe(824);
        expect(RESULT_BUTTON_WIDTH).toBe(240);
        expect(RESULT_BUTTON_HEIGHT).toBe(77);
        expect(buttonTop).toBeGreaterThan(tableBottom);
        expect(buttonBottom).toBeLessThan(STATUS_TEXT_TOP);
    });

    it('the result button is at least 44 px tall on screen on iPhone SE portrait (375 × 550, scale 0.573)', () => {
        const scale = Math.min(375 / CANVAS_WIDTH, 550 / SPEC_CANVAS_MIN_HEIGHT);
        expect(RESULT_BUTTON_HEIGHT * scale).toBeGreaterThanOrEqual(44);
    });

    it('the top line is 26 px: level at x = 12, target/start/current centred at x = 240 (y = 52), time right-aligned at x = 468 (y = 14)', () => {
        expect(TOP_TEXT_SIZE).toBe(26);
        expect(LEVEL_TEXT_X).toBe(12);
        expect(TOP_TEXT_Y).toBe(14);
        expect(TIMER_TEXT_RIGHT_X).toBe(468);
        expect(HEADER_TEXT_X).toBe(240);
        expect(HEADER_TEXT_Y).toBe(52);
    });

    it('the play-area buttons are 72 × 44 logical px, centred at x = 40, 120, 200, 280, 360', () => {
        expect(BUTTON_WIDTH).toBe(72);
        expect(BUTTON_HEIGHT).toBe(44);
        expect(BUTTON_CENTERS_X).toEqual([40, 120, 200, 280, 360]);
    });

    it('at height 960 the bottom lines sit below the 12-row table and inside the canvas', () => {
        const tableBottom = TABLE_TOP + 12 * ROW_HEIGHT;
        expect(statusY(960) - tableBottom).toBeGreaterThan(40);
        expect(statusY(960)).toBeLessThan(scoreY(960));
        expect(scoreY(960)).toBeLessThan(960);
    });

    it('a taller canvas moves the bottom lines down by the same amount', () => {
        const h = canvasHeight(390, 844);
        expect(statusY(h)).toBeCloseTo(956.77, 1);
        expect(scoreY(h)).toBeCloseTo(990.77, 1);
    });

    it('on the tallest phone (390 × 844) the bottom line still sits inside the canvas', () => {
        const h = canvasHeight(390, 844);
        expect(scoreY(h)).toBeLessThan(h);
    });
});

describe('tableMetrics (result-fit)', () => {
    it('the play table keeps 72-wide buttons at x = 40..360 and the value column from x = 404', () => {
        const m = tableMetrics('play');
        expect(m.buttonWidth).toBe(72);
        expect(m.buttonCenters).toEqual([40, 120, 200, 280, 360]);
        expect(m.valueX).toBe(404);
    });

    it('the result table uses 56-wide buttons at x = 32, 92, 152, 212, 272 and a value column from x = 308', () => {
        const m = tableMetrics('result');
        expect(m.buttonWidth).toBe(56);
        expect(m.buttonCenters).toEqual([32, 92, 152, 212, 272]);
        expect(m.valueX).toBe(308);
        expect(m.valueRight).toBe(476);
    });

    it('result buttons keep a 4 px gap, start at the left edge 4 and end at 300', () => {
        const m = tableMetrics('result');
        const edges = m.buttonCenters.map((c) => [c - m.buttonWidth / 2, c + m.buttonWidth / 2]);
        expect(edges[0][0]).toBe(4);
        expect(edges[4][1]).toBe(300);
        for (let i = 1; i < edges.length; i++) {
            expect(edges[i][0] - edges[i - 1][1]).toBe(4);
        }
    });

    it('every operation label has at most 3 characters, so it fits the 56 px result button at 25 px', () => {
        // Spec (result-fit): the widest label is "+10" (3 chars, about 42 px); a 4-character label would not fit.
        for (const op of OPERATION_POOL) {
            if (op.label.length > 3) expect.fail(`label too long for the result button: ${op.label}`);
        }
        expect(Math.max(...OPERATION_POOL.map((op) => op.label.length))).toBe(3);
    });

    it('the result value column is 168 px wide (476 − 308)', () => {
        const m = tableMetrics('result');
        expect(m.valueRight - m.valueX).toBe(168);
    });
});

describe('valuePairScale (result-fit)', () => {
    it('does not shrink a 5-digit history (78) with a 4-digit correct value (67): 145 ≤ 162', () => {
        expect(valuePairScale(78, 67)).toBe(1);
    });

    it('does not shrink when the pair is exactly 162 wide', () => {
        expect(valuePairScale(100, 62)).toBe(1);
    });

    it('shrinks a hair when the pair is 162.1 wide (below 1, close to 1)', () => {
        const f = valuePairScale(100, 62.1);
        expect(f).toBeLessThan(1);
        expect(f).toBeGreaterThan(0.99);
    });

    it('shrinks a negative 7-character history (102.7) with a 4-digit correct value (66.7) to about 0.956', () => {
        const f = valuePairScale(102.7, 66.7);
        expect(f).toBeCloseTo(162 / 169.4, 4);
        expect(f).toBeCloseTo(0.956, 3);
    });

    it('after shrinking, history + 6 + correct is exactly the 168 px column', () => {
        const f = valuePairScale(102.7, 66.7);
        expect((102.7 + 66.7) * f + 6).toBeCloseTo(168, 6);
    });

    it('returns 1 when both widths are 0', () => {
        expect(valuePairScale(0, 0)).toBe(1);
    });

    it('has no lower bound: a very wide pair shrinks well below 0.7', () => {
        expect(valuePairScale(400, 200)).toBeCloseTo(162 / 600, 6);
    });
});
