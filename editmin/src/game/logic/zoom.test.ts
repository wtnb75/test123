import { describe, expect, it } from 'vitest';
import {
    COMPACT_CELL_PX,
    GRID_PADDING,
    WHEEL_ZOOM_INTERVAL_MS,
    ZOOM_DEFAULT,
    ZOOM_MAX,
    ZOOM_MIN,
    ZOOM_STEPS,
    anchoredScroll,
    fitZoom,
    isCompact,
    maxScroll,
    nextZoom,
    wheelDirection,
    wheelMayZoom,
    zoomKeyAction,
    type ZoomKeyEvent
} from './zoom';

const mulberry32 = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

describe('the zoom parameters of the spec', () => {
    it('has the steps 6, 8, 12, 16, 24, 32, 48, 64, default 32, limits 6 and 64, compact under 20, padding 10, wheel 80 ms', () => {
        expect([...ZOOM_STEPS]).toEqual([6, 8, 12, 16, 24, 32, 48, 64]);
        expect([ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX, COMPACT_CELL_PX, GRID_PADDING, WHEEL_ZOOM_INTERVAL_MS]).toEqual([
            32, 6, 64, 20, 10, 80
        ]);
    });
});

describe('nextZoom', () => {
    it.each([
        [32, 1, 48],
        [32, -1, 24],
        [64, 1, 64],
        [6, -1, 6],
        [15, 1, 16],
        [15, -1, 12],
        [20, 1, 24],
        [20, -1, 16],
        [6, 1, 8],
        [64, -1, 48]
    ] as const)('from %i with direction %i gives %i', (current, direction, expected) => {
        expect(nextZoom(current, direction)).toBe(expected);
    });

    it('matches a plain filter over the steps for every value in 1..100, and never moves the wrong way', () => {
        for (let current = 1; current <= 100; current += 1) {
            const up = ZOOM_STEPS.filter((s) => s > current);
            const down = ZOOM_STEPS.filter((s) => s < current);
            expect(nextZoom(current, 1)).toBe(up.length ? Math.min(...up) : current);
            expect(nextZoom(current, -1)).toBe(down.length ? Math.max(...down) : current);
        }
    });
});

describe('fitZoom (padding 10 px on each side)', () => {
    it.each([
        ['50 x 50 in 900 x 760: floor(min(880 / 50, 740 / 50))', 50, 50, 900, 760, 14],
        ['12 x 12 in 900 x 760: floor(min(880 / 12, 740 / 12))', 12, 12, 900, 760, 61],
        ['2 x 2 in 900 x 760: 370 is capped at 64', 2, 2, 900, 760, 64],
        ['50 x 50 in 300 x 300: floor(280 / 50) = 5 is raised to 6', 50, 50, 300, 300, 6],
        ['the narrow side decides: 20 x 4 in 700 x 700', 20, 4, 700, 700, 34]
    ] as const)('%s', (_name, w, h, areaW, areaH, expected) => {
        expect(fitZoom(w, h, areaW, areaH)).toBe(expected);
    });

    it('is the largest side that fits, within the limits, for random boards and areas', () => {
        const rand = mulberry32(5);
        for (let n = 0; n < 500; n += 1) {
            const w = 2 + Math.floor(rand() * 49);
            const h = 2 + Math.floor(rand() * 49);
            const areaW = 100 + Math.floor(rand() * 1800);
            const areaH = 100 + Math.floor(rand() * 1200);
            const fit = fitZoom(w, h, areaW, areaH);
            const fits = (s: number) => w * s + 2 * GRID_PADDING <= areaW && h * s + 2 * GRID_PADDING <= areaH;
            expect(fit).toBeGreaterThanOrEqual(ZOOM_MIN);
            expect(fit).toBeLessThanOrEqual(ZOOM_MAX);
            if (fits(ZOOM_MIN)) {
                expect(fits(fit)).toBe(true);
                if (fit < ZOOM_MAX) expect(fits(fit + 1)).toBe(false);
            } else {
                expect(fit).toBe(ZOOM_MIN);
            }
        }
    });
});

describe('isCompact', () => {
    it('is true at 19 and false at exactly 20', () => {
        expect(isCompact(19)).toBe(true);
        expect(isCompact(20)).toBe(false);
        expect(isCompact(6)).toBe(true);
        expect(isCompact(64)).toBe(false);
    });
});

describe('maxScroll and anchoredScroll', () => {
    it('is the board size plus both paddings minus the area, never below 0', () => {
        expect(maxScroll(50, 32, 620)).toBe(1000); // 1600 + 20 - 620
        expect(maxScroll(2, 32, 620)).toBe(0); // the board is smaller than the area
    });

    it('clamps to 0 when zooming out near the start: scroll 100, anchor 300, 32 -> 16 gives -95 -> 0', () => {
        expect(anchoredScroll(100, 300, 32, 16, 1000)).toBe(0);
    });

    it('gives 990 when zooming in from scroll 400, anchor 200, 16 -> 32 with room (max 1000), and 900 with max 900', () => {
        expect(anchoredScroll(400, 200, 16, 32, 1000)).toBeCloseTo(990, 9);
        expect(anchoredScroll(400, 200, 16, 32, 900)).toBe(900);
    });

    it('keeps the board point under the anchor when nothing is clamped, for random cases', () => {
        const rand = mulberry32(9);
        let kept = 0;
        for (let n = 0; n < 500; n += 1) {
            const old = ZOOM_STEPS[Math.floor(rand() * ZOOM_STEPS.length)];
            const next = ZOOM_STEPS[Math.floor(rand() * ZOOM_STEPS.length)];
            const scroll = Math.floor(rand() * 2000);
            const anchor = Math.floor(rand() * 600);
            const result = anchoredScroll(scroll, anchor, old, next, 1e9);
            if (result === 0) continue; // clamped
            kept += 1;
            const before = (scroll + anchor - GRID_PADDING) / old;
            const after = (result + anchor - GRID_PADDING) / next;
            expect(after).toBeCloseTo(before, 9);
        }
        expect(kept).toBeGreaterThan(200);
    });

    it('does not move the scroll position when the cell side does not change', () => {
        expect(anchoredScroll(250, 123, 32, 32, 1000)).toBeCloseTo(250, 9);
    });
});

describe('wheel', () => {
    it('zooms in for deltaY < 0, out for > 0, and does nothing for 0', () => {
        expect(wheelDirection(-1)).toBe(1);
        expect(wheelDirection(120)).toBe(-1);
        expect(wheelDirection(0)).toBe(0);
    });

    it('lets the first event through and then one per 80 ms of the last change (events at 0, 50, 80, 200 ms)', () => {
        let last: number | null = null;
        const changed: number[] = [];
        for (const t of [0, 50, 80, 200]) {
            if (wheelMayZoom(t, last)) {
                changed.push(t);
                last = t; // an ignored event does not move the reference
            }
        }
        expect(changed).toEqual([0, 80, 200]);
    });

    it('is exactly at the interval: 79.9 ms is too early, 80 ms is enough', () => {
        expect(wheelMayZoom(79.9, 0)).toBe(false);
        expect(wheelMayZoom(80, 0)).toBe(true);
    });
});

describe('zoomKeyAction', () => {
    const key = (k: string, code = '', mods: Partial<ZoomKeyEvent> = {}): ZoomKeyEvent => ({
        key: k,
        code,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        ...mods
    });

    it.each([
        ['+', 'Equal', 'in'],
        ['=', 'Equal', 'in'],
        ['Unidentified', 'NumpadAdd', 'in'],
        ['-', 'Minus', 'out'],
        ['Unidentified', 'NumpadSubtract', 'out'],
        ['0', 'Digit0', 'fit'],
        ['Insert', 'Numpad0', 'fit'] // Num Lock off reports another key
    ] as const)('%s (%s) is %s', (k, code, expected) => {
        expect(zoomKeyAction(key(k, code), false)).toBe(expected);
    });

    it('ignores other keys', () => {
        expect(zoomKeyAction(key('a', 'KeyA'), false)).toBeNull();
        expect(zoomKeyAction(key(' ', 'Space'), false)).toBeNull();
    });

    it('does nothing while typing in an input, or with ctrl, meta or alt held', () => {
        expect(zoomKeyAction(key('+', 'Equal'), true)).toBeNull();
        expect(zoomKeyAction(key('+', 'Equal', { ctrlKey: true }), false)).toBeNull();
        expect(zoomKeyAction(key('-', 'Minus', { metaKey: true }), false)).toBeNull();
        expect(zoomKeyAction(key('0', 'Digit0', { altKey: true }), false)).toBeNull();
    });
});
