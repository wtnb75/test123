import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import {
    BUTTON_H, BUTTON_W, buttonAt, cellAt, classifyGesture, inRect, LANDSCAPE, layoutFor, orientationOf, pickLayout,
    PORTRAIT, type Layout, type Rect,
} from './layout';

describe('orientationOf', () => {
    it('is portrait when the window is taller than wide', () => {
        expect(orientationOf(390, 844)).toBe('portrait');
        expect(orientationOf(500, 501)).toBe('portrait');
    });

    it('is landscape when the window is wider than tall', () => {
        expect(orientationOf(844, 390)).toBe('landscape');
        expect(orientationOf(501, 500)).toBe('landscape');
    });

    it('is landscape for a square window', () => {
        expect(orientationOf(500, 500)).toBe('landscape');
    });
});

describe('pickLayout / layoutFor', () => {
    it('gives the portrait canvas of 480 x 800 and the landscape canvas of 960 x 600', () => {
        expect([pickLayout(390, 844).viewW, pickLayout(390, 844).viewH]).toEqual([480, 800]);
        expect([pickLayout(844, 390).viewW, pickLayout(844, 390).viewH]).toEqual([960, 600]);
    });

    it('maps an orientation to its layout', () => {
        expect(layoutFor('portrait')).toBe(PORTRAIT);
        expect(layoutFor('landscape')).toBe(LANDSCAPE);
    });

    it('places the board at (40, 110) in portrait and (280, 60) in landscape', () => {
        expect([PORTRAIT.boardX, PORTRAIT.boardY]).toEqual([40, 110]);
        expect([LANDSCAPE.boardX, LANDSCAPE.boardY]).toEqual([280, 60]);
    });
});

describe('cellAt', () => {
    // the 5-column starting board (cols is required: the width the board has now)
    const C = PARAMS.cols;

    it('maps the first cell\'s corners (portrait)', () => {
        expect(cellAt(PORTRAIT, 40, 110, C)).toEqual({ x: 0, y: 0 });
        expect(cellAt(PORTRAIT, 119, 189, C)).toEqual({ x: 0, y: 0 });
        expect(cellAt(PORTRAIT, 120, 110, C)).toEqual({ x: 1, y: 0 });
        expect(cellAt(PORTRAIT, 40, 190, C)).toEqual({ x: 0, y: 1 });
    });

    it('maps the last cell and the other two corners (portrait)', () => {
        expect(cellAt(PORTRAIT, 439, 589, C)).toEqual({ x: 4, y: 5 });
        expect(cellAt(PORTRAIT, 439, 110, C)).toEqual({ x: 4, y: 0 });
        expect(cellAt(PORTRAIT, 40, 589, C)).toEqual({ x: 0, y: 5 });
    });

    it('is null just outside the board on every side (portrait)', () => {
        expect(cellAt(PORTRAIT, 39, 300, C)).toBeNull();
        expect(cellAt(PORTRAIT, 440, 300, C)).toBeNull();
        expect(cellAt(PORTRAIT, 200, 109, C)).toBeNull();
        expect(cellAt(PORTRAIT, 200, 590, C)).toBeNull();
    });

    it('uses the landscape origin in landscape', () => {
        expect(cellAt(LANDSCAPE, 280, 60, C)).toEqual({ x: 0, y: 0 });
        expect(cellAt(LANDSCAPE, 679, 539, C)).toEqual({ x: 4, y: 5 });
        expect(cellAt(LANDSCAPE, 679, 60, C)).toEqual({ x: 4, y: 0 });
        expect(cellAt(LANDSCAPE, 280, 539, C)).toEqual({ x: 0, y: 5 });
        expect(cellAt(LANDSCAPE, 279, 300, C)).toBeNull();
        expect(cellAt(LANDSCAPE, 400, 59, C)).toBeNull();
        expect(cellAt(LANDSCAPE, 400, 540, C)).toBeNull();
        expect(cellAt(LANDSCAPE, 680, 300, C)).toBeNull();
        expect(cellAt(LANDSCAPE, 100, 100, C)).toBeNull();
    });

    it('is null in the canvas margin outside the canvas', () => {
        expect(cellAt(PORTRAIT, -10, -10, C)).toBeNull();
        expect(cellAt(PORTRAIT, 5000, 5000, C)).toBeNull();
    });
});

describe('inRect / buttonAt', () => {
    const r: Rect = { x: 10, y: 20, w: 30, h: 40 };

    it('includes the top-left corner and excludes the bottom-right edge', () => {
        expect(inRect(r, 10, 20)).toBe(true);
        expect(inRect(r, 39.9, 59.9)).toBe(true);
        expect(inRect(r, 40, 30)).toBe(false);
        expect(inRect(r, 20, 60)).toBe(false);
        expect(inRect(r, 9.9, 30)).toBe(false);
    });

    it('finds Undo and Quit in portrait', () => {
        expect(buttonAt(PORTRAIT, 130, 700)).toBe('undo');
        expect(buttonAt(PORTRAIT, 350, 700)).toBe('quit');
        expect(buttonAt(PORTRAIT, 30, 660)).toBe('undo');
        expect(buttonAt(PORTRAIT, 240, 700)).toBeNull(); // the gap between them
        expect(buttonAt(PORTRAIT, 130, 500)).toBeNull();
    });

    it('finds Undo and Quit in landscape', () => {
        expect(buttonAt(LANDSCAPE, 820, 220)).toBe('undo');
        expect(buttonAt(LANDSCAPE, 820, 340)).toBe('quit');
        expect(buttonAt(LANDSCAPE, 820, 280)).toBeNull();
    });
});

describe('classifyGesture', () => {
    it('is a tap below the threshold on both axes', () => {
        expect(classifyGesture(0, 0)).toEqual({ kind: 'tap' });
        expect(classifyGesture(23, 23)).toEqual({ kind: 'tap' });
        expect(classifyGesture(-23, 0)).toEqual({ kind: 'tap' });
    });

    it('is a swipe at exactly 24 px on either axis', () => {
        expect(classifyGesture(24, 0)).toEqual({ kind: 'swipe', dir: 'right' });
        expect(classifyGesture(-24, 0)).toEqual({ kind: 'swipe', dir: 'left' });
        expect(classifyGesture(0, 24)).toEqual({ kind: 'swipe', dir: 'down' });
        expect(classifyGesture(0, -24)).toEqual({ kind: 'swipe', dir: 'up' });
    });

    it('goes along the axis with the larger movement', () => {
        expect(classifyGesture(40, 10)).toEqual({ kind: 'swipe', dir: 'right' });
        expect(classifyGesture(10, -40)).toEqual({ kind: 'swipe', dir: 'up' });
        expect(classifyGesture(-50, 49)).toEqual({ kind: 'swipe', dir: 'left' });
    });

    it('prefers the vertical axis on a tie', () => {
        expect(classifyGesture(30, 30)).toEqual({ kind: 'swipe', dir: 'down' });
        expect(classifyGesture(-30, -30)).toEqual({ kind: 'swipe', dir: 'up' });
    });

    it('takes the threshold as an argument', () => {
        expect(classifyGesture(10, 0, 10)).toEqual({ kind: 'swipe', dir: 'right' });
        expect(classifyGesture(9, 0, 10)).toEqual({ kind: 'tap' });
    });
});

// Font sizes of the HUD rows (FONT_SIZE.hud / FONT_SIZE.best in scenes/ui.ts, which this logic test does not import).
const HUD_FONT_PX = 32;
const BEST_FONT_PX = 26;

describe.each<[string, Layout]>([['portrait', PORTRAIT], ['landscape', LANDSCAPE]])('%s layout geometry', (_name, l) => {
    const canvas: Rect = { x: 0, y: 0, w: l.viewW, h: l.viewH };
    const board: Rect = { x: l.boardX, y: l.boardY, w: PARAMS.cols * PARAMS.cellSize, h: PARAMS.rows * PARAMS.cellSize };
    const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= canvas.w && r.y + r.h <= canvas.h;
    const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const buttons: Rect[] = [l.undoButton, l.quitButton, l.titleButton, l.resultRetry, l.resultToTitle];

    it('keeps the 400 x 480 board inside the canvas', () => {
        expect([board.w, board.h]).toEqual([400, 480]);
        expect(inside(board)).toBe(true);
    });

    it('keeps every button inside the canvas and at least 200 x 80', () => {
        buttons.forEach((b) => {
            expect(inside(b)).toBe(true);
            expect(b.w).toBeGreaterThanOrEqual(BUTTON_W);
            expect(b.h).toBeGreaterThanOrEqual(BUTTON_H);
        });
    });

    it('does not let the Undo and Quit buttons touch the board or each other', () => {
        expect(overlap(l.undoButton, board)).toBe(false);
        expect(overlap(l.quitButton, board)).toBe(false);
        expect(overlap(l.undoButton, l.quitButton)).toBe(false);
    });

    it('does not let the Result buttons touch each other', () => {
        expect(overlap(l.resultRetry, l.resultToTitle)).toBe(false);
    });

    it('keeps the HUD anchors inside the canvas', () => {
        [l.hudMoves, l.hudLines].forEach((h) => {
            expect(h.x).toBeGreaterThanOrEqual(0);
            expect(h.x).toBeLessThanOrEqual(l.viewW);
            expect(h.y).toBeGreaterThanOrEqual(0);
            expect(h.y).toBeLessThanOrEqual(l.viewH);
        });
    });

    // The HUD best row ("ベスト 123 更新!"): at most 9 em wide at the best font size, 1.3 em high, centred on hudBest.
    const bestBox = (): Rect => {
        const w = 9 * BEST_FONT_PX;
        const h = 1.3 * BEST_FONT_PX;
        return { x: l.hudBest.x - w / 2, y: l.hudBest.y - h / 2, w, h };
    };

    it('keeps the HUD best row inside the canvas and clear of the board, the Undo / Quit buttons and the lines counter', () => {
        const box = bestBox();
        expect(inside(box)).toBe(true);
        expect(overlap(box, board)).toBe(false);
        expect(overlap(box, l.undoButton)).toBe(false);
        expect(overlap(box, l.quitButton)).toBe(false);
        // a generous box for "ライン 123" at the HUD font size, and for the moves counter "手数 40/40"
        const hudBox = (h: { x: number; y: number; originX: number }, ems: number): Rect => {
            const w = ems * HUD_FONT_PX;
            return { x: h.x - h.originX * w, y: h.y - HUD_FONT_PX, w, h: 2 * HUD_FONT_PX };
        };
        expect(overlap(box, hudBox(l.hudLines, 6.5))).toBe(false);
        expect(overlap(box, hudBox(l.hudMoves, 7))).toBe(false);
    });

    it('keeps the existing HUD anchors where they were (regression)', () => {
        const expected = l.orientation === 'portrait'
            ? [{ x: 40, y: 40, originX: 0 }, { x: 440, y: 40, originX: 1 }]
            : [{ x: 140, y: 200, originX: 0.5 }, { x: 140, y: 280, originX: 0.5 }];
        expect([l.hudMoves, l.hudLines]).toEqual(expected);
        expect(l.hudBest).toEqual(l.orientation === 'portrait' ? { x: 240, y: 625 } : { x: 140, y: 340 });
    });

    it('keeps the title name and the result lines on the canvas', () => {
        expect(inRect(canvas, l.titleName.x, l.titleName.y)).toBe(true);
        expect(inRect(canvas, l.resultLines.x, l.resultLines.y)).toBe(true);
    });

    // A generous box for the 8-letter name: 0.65 em per letter, one em high.
    const nameBox = (): Rect => {
        const w = 8 * 0.65 * l.titleFontPx;
        return { x: l.titleName.x - w / 2, y: l.titleName.y - l.titleFontPx / 2, w, h: l.titleFontPx };
    };

    it('puts the Title demo board where the Game board is (same boardX / boardY)', () => {
        // The Title draws its demo on the layout's board position, which Game also uses.
        expect([l.boardX, l.boardY]).toEqual(l.orientation === 'portrait' ? [40, 110] : [280, 60]);
    });

    it('keeps the Title name and Start button inside the canvas and off the demo board', () => {
        expect(inside(nameBox())).toBe(true);
        expect(inside(l.titleButton)).toBe(true);
        expect(overlap(nameBox(), board)).toBe(false);
        expect(overlap(l.titleButton, board)).toBe(false);
        expect(overlap(nameBox(), l.titleButton)).toBe(false);
    });

    it('places the Start button as specified: below the board (portrait), in the right margin (landscape)', () => {
        const centre = { x: l.titleButton.x + l.titleButton.w / 2, y: l.titleButton.y + l.titleButton.h / 2 };
        expect(centre).toEqual(l.orientation === 'portrait' ? { x: 240, y: 690 } : { x: 820, y: 300 });
        expect(l.titleName).toEqual(l.orientation === 'portrait' ? { x: 240, y: 60 } : { x: 140, y: 300 });
    });
});
