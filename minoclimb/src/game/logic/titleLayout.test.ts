import { describe, expect, it } from 'vitest';
import { HEIGHT, P, WIDTH } from '../params';
import { DEMO_WINDOW, TITLE_LAYOUT } from './titleLayout';

/** The scale Phaser's FIT gives the 360 x 720 canvas in a window of `w` x `h` CSS px. */
const fitScale = (w: number, h: number): number => Math.min(w / WIDTH, h / HEIGHT);
const cssLength = (logical: number, w: number, h: number): number => logical * fitScale(w, h);
const buttonCss = (w: number, h: number): { width: number; height: number } => ({
    width: cssLength(P.START_W, w, h),
    height: cssLength(P.START_H, w, h),
});

describe('fitScale (Phaser FIT)', () => {
    it('is the smaller of the width and height ratios', () => {
        expect(fitScale(375, 550)).toBeCloseTo(0.7639, 4); // height limits
        expect(fitScale(667, 310)).toBeCloseTo(0.4306, 4);
        expect(fitScale(390, 844)).toBeCloseTo(1.0833, 4); // width limits
        expect(fitScale(1280, 720)).toBeCloseTo(1, 9);
    });
});

describe('the hand-worked layout table of the spec', () => {
    const rows: {
        w: number; h: number; name: number; windowW: number; windowH: number; cell: number;
        buttonW: number; buttonH: number;
    }[] = [
        { w: 375, h: 550, name: 33.6, windowW: 201.7, windowH: 403.3, cell: 20.2, buttonW: 152.8, buttonH: 48.9 },
        { w: 667, h: 310, name: 18.9, windowW: 113.7, windowH: 227.3, cell: 11.4, buttonW: 86.1, buttonH: 27.6 },
        { w: 390, h: 844, name: 47.7, windowW: 286.0, windowH: 572.0, cell: 28.6, buttonW: 216.7, buttonH: 69.3 },
        { w: 1280, h: 720, name: 44.0, windowW: 264, windowH: 528, cell: 26.4, buttonW: 200, buttonH: 64 },
    ];

    it.each(rows)('matches $w x $h', ({ w, h, name, windowW, windowH, cell, buttonW, buttonH }) => {
        expect(cssLength(TITLE_LAYOUT.nameSize, w, h)).toBeCloseTo(name, 1);
        expect(cssLength(DEMO_WINDOW.width, w, h)).toBeCloseTo(windowW, 1);
        expect(cssLength(DEMO_WINDOW.height, w, h)).toBeCloseTo(windowH, 1);
        expect(cssLength(P.CELL * DEMO_WINDOW.scale, w, h)).toBeCloseTo(cell, 1);
        const button = buttonCss(w, h);
        expect(button.width).toBeCloseTo(buttonW, 1);
        expect(button.height).toBeCloseTo(buttonH, 1);
    });

    it('keeps the START button at least 44 CSS px high on the smallest target screen (375 x 550)', () => {
        expect(buttonCss(375, 550).height).toBeGreaterThanOrEqual(44);
    });
});

describe('the Title layout', () => {
    const nameTop = TITLE_LAYOUT.nameY - TITLE_LAYOUT.nameSize / 2;
    const nameBottom = TITLE_LAYOUT.nameY + TITLE_LAYOUT.nameSize / 2;
    const windowBottom = DEMO_WINDOW.y + DEMO_WINDOW.height;
    const buttonTop = TITLE_LAYOUT.buttonY - P.START_H / 2;
    const buttonBottom = TITLE_LAYOUT.buttonY + P.START_H / 2;

    it('stacks the name, the demo window and the button without overlap', () => {
        expect(nameTop).toBeGreaterThanOrEqual(0);
        expect(nameBottom).toBe(70);
        expect(nameBottom).toBeLessThan(DEMO_WINDOW.y);
        expect(windowBottom).toBe(624);
        expect(windowBottom).toBeLessThan(buttonTop);
        expect(buttonTop).toBe(640);
        expect(buttonBottom).toBeLessThanOrEqual(HEIGHT);
    });

    it('keeps the window and the button inside the canvas, centred', () => {
        expect(DEMO_WINDOW.x).toBeGreaterThanOrEqual(0);
        expect(DEMO_WINDOW.x + DEMO_WINDOW.width).toBeLessThanOrEqual(WIDTH);
        expect(DEMO_WINDOW.x + DEMO_WINDOW.width / 2).toBe(WIDTH / 2);
        expect(TITLE_LAYOUT.centerX - P.START_W / 2).toBeGreaterThanOrEqual(0);
        expect(TITLE_LAYOUT.centerX).toBe(WIDTH / 2);
    });

    it('shrinks the board by the same factor in both directions', () => {
        expect(DEMO_WINDOW.scale).toBeCloseTo(264 / 360, 9);
        expect(DEMO_WINDOW.width / WIDTH).toBeCloseTo(DEMO_WINDOW.height / HEIGHT, 9);
    });

    it('keeps the parameter constraints of the spec: fade < hold < run', () => {
        expect(P.DEMO_FADE_MS).toBeLessThan(P.DEMO_END_HOLD_MS);
        expect(P.DEMO_END_HOLD_MS).toBeLessThan(P.DEMO_RUN_MS);
    });
});
