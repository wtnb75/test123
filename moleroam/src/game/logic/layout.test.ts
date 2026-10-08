import { describe, expect, it } from 'vitest';
import { arrowFor, type View } from './arrow';
import { clampScroll, holeCenter, startScroll } from './board';
import { placeFloatText } from './float';
import { LANDSCAPE, PORTRAIT, pickLayout } from './layout';
import { judgeStrike, type Pop } from './pop';
import { combineScroll, combineScrollIn, edgeDelta, edgeDir } from './scroll';
import { neighborHoles, planSpawn, stepSpawn } from './spawn';

/** A rand() that returns the given values in order and fails if asked for more. */
const seq = (values: number[]): (() => number) => {
    let i = 0;
    return () => {
        if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
        return values[i++];
    };
};

const sorted = (list: number[]): number[] => [...list].sort((a, b) => a - b);

describe('pickLayout', () => {
    it('is portrait for a tall phone window (390 x 844)', () => {
        expect(pickLayout(390, 844)).toBe(PORTRAIT);
    });

    it('is landscape for a wide phone window (844 x 390)', () => {
        expect(pickLayout(844, 390)).toBe(LANDSCAPE);
    });

    it('is landscape for a square window (800 x 800)', () => {
        expect(pickLayout(800, 800)).toBe(LANDSCAPE);
    });

    it('is portrait once the height is exactly 1 larger than the width (800 x 801)', () => {
        expect(pickLayout(800, 801)).toBe(PORTRAIT);
    });
});

describe('the two layouts', () => {
    it('landscape is a 1024 x 768 view over an 8 x 6 board of 2560 x 1920', () => {
        expect(LANDSCAPE).toEqual({ viewW: 1024, viewH: 768, cols: 8, rows: 6, boardW: 2560, boardH: 1920 });
    });

    it('portrait is a 768 x 1024 view over a 6 x 8 board of 1920 x 2560', () => {
        expect(PORTRAIT).toEqual({ viewW: 768, viewH: 1024, cols: 6, rows: 8, boardW: 1920, boardH: 2560 });
    });

    it('both have 48 holes, the same visible area (786,432 px^2) and the same visible share (16%) of the board', () => {
        for (const l of [LANDSCAPE, PORTRAIT]) {
            expect(l.cols * l.rows).toBe(48);
            expect(l.viewW * l.viewH).toBe(786432);
            expect((l.viewW * l.viewH) / (l.boardW * l.boardH)).toBeCloseTo(0.16, 10);
        }
    });
});

describe('portrait board geometry', () => {
    it('puts hole 0 at (160, 160), hole 5 at the right end of row 1 and hole 6 at the start of row 2', () => {
        expect(holeCenter(0, PORTRAIT)).toEqual({ x: 160, y: 160 });
        expect(holeCenter(5, PORTRAIT)).toEqual({ x: 1760, y: 160 });
        expect(holeCenter(6, PORTRAIT)).toEqual({ x: 160, y: 480 });
    });

    it('puts the last hole (47) at (1760, 2400)', () => {
        expect(holeCenter(47, PORTRAIT)).toEqual({ x: 1760, y: 2400 });
    });

    it('keeps the view inside the 1920 x 2560 board: top-left clamps to (0, 0), bottom-right to (1152, 1536)', () => {
        expect(clampScroll(-5, -5, PORTRAIT)).toEqual({ x: 0, y: 0 });
        expect(clampScroll(9999, 9999, PORTRAIT)).toEqual({ x: 1152, y: 1536 });
        expect(clampScroll(1152, 1536, PORTRAIT)).toEqual({ x: 1152, y: 1536 });
    });

    it('starts centered on the board: view top-left (576, 768)', () => {
        expect(startScroll(PORTRAIT)).toEqual({ x: 576, y: 768 });
    });

    it('uses the layout, not the landscape limits: (1200, 1600) clamps to (1152, 1536) in portrait but to (1200, 1152) in landscape', () => {
        expect(clampScroll(1200, 1600, PORTRAIT)).toEqual({ x: 1152, y: 1536 });
        expect(clampScroll(1200, 1600)).toEqual({ x: 1200, y: 1152 });
    });
});

describe('portrait neighbours (6 columns: no wrap to the next row)', () => {
    it('gives {4, 10, 11} for hole 5 (top-right corner), never hole 6', () => {
        expect(sorted(neighborHoles(5, PORTRAIT))).toEqual([4, 10, 11]);
        expect(neighborHoles(5, PORTRAIT)).not.toContain(6);
    });

    it('gives {0, 1, 7, 12, 13} for hole 6 (left edge of row 2), never hole 5', () => {
        expect(sorted(neighborHoles(6, PORTRAIT))).toEqual([0, 1, 7, 12, 13]);
        expect(neighborHoles(6, PORTRAIT)).not.toContain(5);
    });

    it('gives {40, 41, 46} for hole 47 (bottom-right corner)', () => {
        expect(sorted(neighborHoles(47, PORTRAIT))).toEqual([40, 41, 46]);
    });

    it('gives 8 neighbours for an inner hole (7)', () => {
        expect(sorted(neighborHoles(7, PORTRAIT))).toEqual([0, 1, 2, 6, 8, 12, 13, 14]);
    });

    it('differs from landscape for the same hole number (hole 5 has neighbours 6 and 14 in landscape)', () => {
        expect(sorted(neighborHoles(5))).toEqual([4, 6, 12, 13, 14]);
    });
});

describe('spawn plan on the portrait board', () => {
    // combo roll 0.1; anchor draw 0.115 -> index floor(0.115 * 48) = 5; neighbours drawn 0 then 0.99; kinds 0.9 x 3 (moles)
    const draws = [0.1, 0.115, 0, 0.99, 0.9, 0.9, 0.9];

    it('picks combo neighbours from the 6-column board: anchor 5 -> {5, 4, 11}, never hole 6', () => {
        const plan = planSpawn([], seq(draws), PORTRAIT);
        expect(plan.map((p) => p.hole)).toEqual([5, 4, 11]);
    });

    it('the same random values on the landscape board give different neighbours: {5, 4, 14}', () => {
        const plan = planSpawn([], seq(draws));
        expect(plan.map((p) => p.hole)).toEqual([5, 4, 14]);
    });

    it('stepSpawn passes the layout through to the plan', () => {
        const { plan } = stepSpawn(500, 500, [], seq(draws), PORTRAIT);
        expect(plan.map((p) => p.hole)).toEqual([5, 4, 11]);
    });

    it('does not choose a hole in use: with hole 4 occupied the anchor-5 combo is {5, 10, 11}', () => {
        // free list without hole 4: hole 5 is at index 4 (0.096 * 47 = 4.5); neighbours of 5 that are free: [10, 11]
        const plan = planSpawn([4], seq([0.1, 0.096, 0, 0.99, 0.9, 0.9, 0.9]), PORTRAIT);
        expect(plan.map((p) => p.hole)).toEqual([5, 10, 11]);
    });

    it('draws 7 random values for a portrait combo plan (combo roll, anchor, 2 neighbours, 3 kinds) and 7 on landscape', () => {
        for (const layout of [PORTRAIT, LANDSCAPE]) {
            let calls = 0;
            const counting = (): number => [0.1, 0.115, 0, 0.99, 0.9, 0.9, 0.9][calls++];
            planSpawn([], counting, layout);
            expect(calls).toBe(7);
        }
    });
});

describe('strikes on the portrait board', () => {
    // hole 6 is at (160, 480) in portrait and at (2080, 160) in landscape
    const pop: Pop = { hole: 6, kind: 'mole', spawnedAt: 0 };
    const now = 800;

    it('hits at the portrait hole center and exactly hitRadius (70 px) away, not beyond', () => {
        expect(judgeStrike({ x: 160, y: 480 }, [pop], now, PORTRAIT)).toBe(pop);
        expect(judgeStrike({ x: 230, y: 480 }, [pop], now, PORTRAIT)).toBe(pop);
        expect(judgeStrike({ x: 230.01, y: 480 }, [pop], now, PORTRAIT)).toBeNull();
    });

    it('the same point misses in landscape, where hole 6 is somewhere else', () => {
        expect(judgeStrike({ x: 160, y: 480 }, [pop], now)).toBeNull();
        expect(judgeStrike({ x: 2080, y: 160 }, [pop], now)).toBe(pop);
    });
});

describe('scrolling in portrait', () => {
    it('edge scroll uses the 768 x 1024 canvas: +1 at the right edge, 0 at the inner border, +0.5 half way', () => {
        expect(edgeDir({ x: 768, y: 500 }, PORTRAIT).x).toBe(1);
        expect(edgeDir({ x: 678, y: 500 }, PORTRAIT).x).toBe(0);
        expect(edgeDir({ x: 723, y: 500 }, PORTRAIT).x).toBe(0.5);
    });

    it('edge scroll uses the canvas height: +1 at the bottom, 0 at the inner border, +0.5 half way', () => {
        expect(edgeDir({ x: 400, y: 1024 }, PORTRAIT).y).toBe(1);
        expect(edgeDir({ x: 400, y: 934 }, PORTRAIT).y).toBe(0);
        expect(edgeDir({ x: 400, y: 979 }, PORTRAIT).y).toBe(0.5);
    });

    it('the landscape defaults still apply when no layout is given (x = 768 is not in the 1024 canvas edge zone)', () => {
        expect(edgeDir({ x: 768, y: 500 }).x).toBe(0);
    });

    it('edge-scroll movement uses the layout: at the portrait right edge 1000 ms moves 600 px, in landscape (default) 0', () => {
        expect(edgeDelta({ x: 768, y: 500 }, 1000, PORTRAIT)).toEqual({ x: 600, y: 0 });
        expect(edgeDelta({ x: 768, y: 500 }, 1000)).toEqual({ x: 0, y: 0 });
    });

    it('combines deltas and clamps to the portrait board: (1100, 1500) + (100, 100) -> (1152, 1536)', () => {
        expect(combineScrollIn(PORTRAIT, { x: 1100, y: 1500 }, [{ x: 100, y: 100 }])).toEqual({ x: 1152, y: 1536 });
    });

    it('adds several sources inside the board: (500, 700) + (30, -20) + (-10, 5) -> (520, 685)', () => {
        expect(combineScrollIn(PORTRAIT, { x: 500, y: 700 }, [{ x: 30, y: -20 }, { x: -10, y: 5 }])).toEqual({ x: 520, y: 685 });
    });

    it('combineScroll (no layout) is the landscape version', () => {
        expect(combineScroll({ x: 1500, y: 1100 }, { x: 100, y: 100 })).toEqual({ x: 1536, y: 1152 });
    });
});

describe('arrows and floating texts in the portrait view', () => {
    // the view is { 768 x 1024 } at (500, 700): center (884, 1212), arrow rectangle 40 px inside: half sizes 344 x 472
    const view: View = { x: 500, y: 700, w: 768, h: 1024 };

    it('points right from the right edge of the inset rectangle for a hole at (1760, 1212)', () => {
        const a = arrowFor({ x: 1760, y: 1212 }, view)!;
        expect(a.x).toBeCloseTo(728, 9);
        expect(a.y).toBeCloseTo(512, 9);
        expect(a.angle).toBeCloseTo(0, 9);
    });

    it('points up from the top edge of the inset rectangle for a hole at (884, 160)', () => {
        const a = arrowFor({ x: 884, y: 160 }, view)!;
        expect(a.x).toBeCloseTo(384, 9);
        expect(a.y).toBeCloseTo(40, 9);
        expect(a.angle).toBeCloseTo(-Math.PI / 2, 9);
    });

    it('gives no arrow for a hole inside the portrait view', () => {
        expect(arrowFor({ x: 900, y: 1500 }, view)).toBeNull();
    });

    it('keeps floating texts inside the 768 x 1024 screen (text 100 x 40)', () => {
        expect(placeFloatText({ x: 0, y: 512 }, 100, 40, PORTRAIT).x).toBe(74);
        expect(placeFloatText({ x: 768, y: 512 }, 100, 40, PORTRAIT).x).toBe(694);
        expect(placeFloatText({ x: 384, y: 0 }, 100, 40, PORTRAIT).y).toBe(114);
        expect(placeFloatText({ x: 384, y: 1024 }, 100, 40, PORTRAIT).y).toBe(980);
        expect(placeFloatText({ x: 384, y: 512 }, 100, 40, PORTRAIT)).toEqual({ x: 384, y: 512 });
    });

    it('puts a text too wide or too tall for the portrait screen at its center (384, 512), not the landscape center', () => {
        expect(placeFloatText({ x: 100, y: 300 }, 1000, 40, PORTRAIT).x).toBe(384);
        expect(placeFloatText({ x: 300, y: 100 }, 100, 1000, PORTRAIT).y).toBe(512);
    });
});

describe('landscape stays the same (regression)', () => {
    it('an explicit landscape layout gives the same results as the default for geometry and neighbours', () => {
        expect(holeCenter(7, LANDSCAPE)).toEqual(holeCenter(7));
        expect(holeCenter(7)).toEqual({ x: 2400, y: 160 });
        expect(clampScroll(9999, 9999, LANDSCAPE)).toEqual(clampScroll(9999, 9999));
        expect(clampScroll(9999, 9999)).toEqual({ x: 1536, y: 1152 });
        expect(startScroll(LANDSCAPE)).toEqual(startScroll());
        expect(startScroll()).toEqual({ x: 768, y: 576 });
        expect(sorted(neighborHoles(7, LANDSCAPE))).toEqual(sorted(neighborHoles(7)));
        expect(sorted(neighborHoles(7))).toEqual([6, 14, 15]);
    });

    it('an explicit landscape layout draws the same plan as the default for the same random values', () => {
        const values = [0.1, 0.115, 0, 0.99, 0.9, 0.9, 0.9];
        expect(planSpawn([], seq(values), LANDSCAPE)).toEqual(planSpawn([], seq(values)));
    });
});
