import { describe, expect, it } from 'vitest';
import { computeGameLayout } from './gameLayout';
import { computeStatsLayout, type Rect } from './statsLayout';

/** Attempts per digit count (spec: ルール). */
const ROWS_BY_DIGITS: Record<number, number> = { 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 };

const layoutFor = (width: number, height: number, digits = 4) =>
    computeGameLayout(width, height, ROWS_BY_DIGITS[digits], digits);

const statsFor = (width: number, height: number, oneLineWidth: number, empty = false, digits = 4) =>
    computeStatsLayout({ layout: layoutFor(width, height, digits), oneLineWidth, empty });

const overlaps = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The "choose digits again" button of the existing result screen: 240 x 44 at y = H - 70, centred. */
const reselectRect = (width: number, height: number): Rect => ({ x: (width - 240) / 2, y: height - 70, width: 240, height: 44 });

describe('computeStatsLayout: portrait (hand-worked)', () => {
    it('SE (375 x 550): the button is at 428..472 and the one-line stats are centred at y 410', () => {
        const stats = statsFor(375, 550, 300, false, 6);
        expect(stats.kind).toBe('one');
        expect(stats.button).toEqual({ x: 107.5, y: 428, width: 160, height: 44 });
        expect(stats.lineCenters).toEqual([410]);
        expect(stats.centerX).toBe(187.5);
    });

    it('SE N=6: the one-line stats (400..420) stay 15 px below the board bottom (385)', () => {
        const layout = layoutFor(375, 550, 6);
        expect(layout.boardStartY + layout.boardHeight).toBe(385);
        expect(computeStatsLayout({ layout, oneLineWidth: 300, empty: false }).lineCenters[0] - 10 - 385).toBe(15);
    });

    it('390 x 844: the button is at 722..766 and the stats are centred at y 704', () => {
        const stats = statsFor(390, 844, 300);
        expect(stats.button.y).toBe(722);
        expect(stats.lineCenters).toEqual([704]);
        expect(stats.centerX).toBe(195);
    });

    it('the button sits 8 px above the "choose digits again" button, with the same centre x', () => {
        const stats = statsFor(375, 550, 300);
        const reselect = reselectRect(375, 550);
        expect(reselect.y - (stats.button.y + stats.button.height)).toBe(8);
        expect(stats.button.x + stats.button.width / 2).toBe(reselect.x + reselect.width / 2);
        expect(overlaps(stats.button, reselect)).toBe(false);
    });

    it('a line exactly W - 24 wide stays on one line; one px wider breaks into two', () => {
        expect(statsFor(375, 550, 351).kind).toBe('one');
        expect(statsFor(375, 550, 352).kind).toBe('two');
    });

    it('two lines grow upwards: centres 30 and 10 px above the button gap (390 and 410 on SE)', () => {
        const stats = statsFor(375, 550, 400);
        expect(stats.lineCenters).toEqual([390, 410]);
    });

    it('the empty state is one line in the one-line position even when its width is large', () => {
        const stats = statsFor(375, 550, 999, true);
        expect(stats.kind).toBe('empty');
        expect(stats.lineCenters).toEqual([410]);
    });

    it.each([[375, 550], [390, 844]])('%i x %i: for N=2..6 the one-line stats and the button do not touch the board', (width, height) => {
        for (const digits of [2, 3, 4, 5, 6]) {
            const layout = layoutFor(width, height, digits);
            const stats = computeStatsLayout({ layout, oneLineWidth: 300, empty: false });
            expect(stats.lineCenters[0] - 10).toBeGreaterThanOrEqual(layout.boardStartY + layout.boardHeight);
        }
    });

    it('SE N=6: two lines may touch the board bottom by 5 px at most (outside the guarantee)', () => {
        const layout = layoutFor(375, 550, 6);
        const stats = computeStatsLayout({ layout, oneLineWidth: 400, empty: false });
        expect(385 - (stats.lineCenters[0] - 10)).toBe(5);
    });
});

describe('computeStatsLayout: landscape (hand-worked)', () => {
    it('667 x 310: panel 514..654, centre x 584, four lines from y 85, button 173..217', () => {
        const stats = statsFor(667, 310, 300);
        expect(stats.kind).toBe('rows');
        expect(stats.centerX).toBe(584);
        expect(stats.lineCenters).toEqual([95, 115, 135, 155]);
        expect(stats.button).toEqual({ x: 514, y: 173, width: 140, height: 44 });
    });

    it('667 x 310: the button does not overlap the "choose digits again" button (x 213..453, y 240..284)', () => {
        expect(overlaps(statsFor(667, 310, 300).button, reselectRect(667, 310))).toBe(false);
    });

    it('1280 x 720: panel 1046..1266, centre x 1156, four lines from y 290, button 378..422', () => {
        const stats = statsFor(1280, 720, 300);
        expect(stats.centerX).toBe(1156);
        expect(stats.lineCenters).toEqual([300, 320, 340, 360]);
        expect(stats.button).toEqual({ x: 1046, y: 378, width: 220, height: 44 });
    });

    it('the empty state is one line at the first line position, the button stays where it is', () => {
        const stats = statsFor(667, 310, 300, true);
        expect(stats.kind).toBe('empty');
        expect(stats.lineCenters).toEqual([95]);
        expect(stats.button.y).toBe(173);
    });

    it.each([[667, 310], [1280, 720]])('%i x %i: for N=2..6 the lines and the button stay clear of the board and of the reselect button', (width, height) => {
        for (const digits of [2, 3, 4, 5, 6]) {
            const layout = layoutFor(width, height, digits);
            const stats = computeStatsLayout({ layout, oneLineWidth: 300, empty: false });
            const board: Rect = { x: layout.boardStartX, y: layout.boardStartY, width: layout.boardWidth, height: layout.boardHeight };
            const lines: Rect = {
                x: stats.centerX - 50, y: stats.lineCenters[0] - 10, width: 100, height: stats.lineCenters.length * 20
            };
            expect(overlaps(stats.button, board)).toBe(false);
            expect(overlaps(lines, board)).toBe(false);
            expect(overlaps(stats.button, reselectRect(width, height))).toBe(false);
            expect(overlaps(lines, reselectRect(width, height))).toBe(false);
            expect(overlaps(lines, stats.button)).toBe(false);
        }
    });

    it('portrait: the button and one-line stats do not overlap the board rectangle', () => {
        const layout = layoutFor(375, 550, 6);
        const stats = computeStatsLayout({ layout, oneLineWidth: 300, empty: false });
        const board: Rect = { x: layout.boardStartX, y: layout.boardStartY, width: layout.boardWidth, height: layout.boardHeight };
        expect(overlaps(stats.button, board)).toBe(false);
        expect(overlaps({ x: 0, y: 400, width: 375, height: 20 }, board)).toBe(false);
    });

    it('a short screen keeps the first line at least 8 px below the top of the board area (y 68)', () => {
        expect(statsFor(600, 200, 300).lineCenters[0]).toBe(78);
    });

    it('an odd panel width puts the centre at floor(width / 2) from the panel start', () => {
        const layout = { ...layoutFor(667, 310), rightPanelWidth: 141, keyboardStartX: 513 };
        expect(computeStatsLayout({ layout, oneLineWidth: 300, empty: false }).centerX).toBe(583);
    });
});
