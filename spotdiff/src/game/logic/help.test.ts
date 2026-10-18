import { describe, expect, it } from 'vitest';
import {
    HELP_BUTTON_LABEL,
    HELP_DIFFS,
    HELP_HEADING,
    HELP_LINES,
    HELP_PROMPT,
    helpButtonRect,
    helpInputOpen,
    helpLayoutFor,
    helpSample,
    inHelpButton,
    titleTapTarget,
} from './help';
import { layoutFor } from './layout';
import type { LayoutKind } from './layout';
import { titleLayoutFor } from './titleLayout';
import { PARAMS } from '../params';

const KINDS: LayoutKind[] = ['portrait', 'landscape', 'wide'];

// Expected values are worked by hand from docs/spec/how-to-play.md (配置 table and テスト観点).
const BUTTON: Record<LayoutKind, { x: number; y: number; w: number; h: number; size: number }> = {
    portrait: { x: 204, y: 1568, w: 360, h: 88, size: 32 },
    landscape: { x: 720, y: 670, w: 240, h: 60, size: 28 },
    wide: { x: 1304, y: 635, w: 320, h: 110, size: 40 },
};

describe.each(KINDS)('Title "HOW TO PLAY" button (%s)', (kind) => {
    const want = BUTTON[kind];

    it('has the rectangle the spec table gives', () => {
        const b = helpButtonRect(kind);
        expect([b.x, b.y, b.w, b.h, b.size]).toEqual([want.x, want.y, want.w, want.h, want.size]);
        expect([b.cx, b.cy]).toEqual([want.x + want.w / 2, want.y + want.h / 2]);
    });

    it('counts the centre and the four corners (the edge) as inside', () => {
        expect(inHelpButton(kind, want.x + want.w / 2, want.y + want.h / 2)).toBe(true);
        for (const [x, y] of [
            [want.x, want.y],
            [want.x + want.w, want.y],
            [want.x, want.y + want.h],
            [want.x + want.w, want.y + want.h],
        ]) {
            expect(inHelpButton(kind, x, y)).toBe(true);
        }
    });

    it('counts a point 1px outside on each side as outside', () => {
        const midX = want.x + want.w / 2;
        const midY = want.y + want.h / 2;
        expect(inHelpButton(kind, want.x - 1, midY)).toBe(false);
        expect(inHelpButton(kind, want.x + want.w + 1, midY)).toBe(false);
        expect(inHelpButton(kind, midX, want.y - 1)).toBe(false);
        expect(inHelpButton(kind, midX, want.y + want.h + 1)).toBe(false);
    });

    it('fits the canvas and stays clear of the Title pictures', () => {
        const t = titleLayoutFor(kind);
        const b = helpButtonRect(kind);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(t.width);
        expect(b.y + b.h).toBeLessThanOrEqual(t.height);
        const size = PARAMS.panelSize * t.panelScale;
        for (const p of t.panels) {
            const apart = b.x + b.w <= p.x || p.x + size <= b.x || b.y + b.h <= p.y || p.y + size <= b.y;
            expect(apart).toBe(true);
        }
    });
});

describe.each(KINDS)('Title tap target (%s)', (kind) => {
    const b = BUTTON[kind];

    it('opens the Help inside the button (edge included) and starts the Game 1px outside it', () => {
        expect(titleTapTarget(kind, b.x + b.w / 2, b.y + b.h / 2)).toBe('help');
        expect(titleTapTarget(kind, b.x, b.y)).toBe('help');
        expect(titleTapTarget(kind, b.x - 1, b.y + b.h / 2)).toBe('game');
        expect(titleTapTarget(kind, b.x + b.w / 2, b.y + b.h + 1)).toBe('game');
    });

    it('starts the Game on the demo picture and on the "TAP TO START" text', () => {
        const t = titleLayoutFor(kind);
        expect(titleTapTarget(kind, t.panels[0].x + 10, t.panels[0].y + 10)).toBe('game');
        expect(titleTapTarget(kind, t.prompt.x, t.prompt.y)).toBe('game');
    });
});

describe('Title button vs the "TAP TO START" row', () => {
    it('sits below the prompt text in portrait (prompt 36px at y=1540 ends at 1558; button starts at 1568)', () => {
        const t = titleLayoutFor('portrait');
        expect(helpButtonRect('portrait').y).toBeGreaterThanOrEqual(t.prompt.y + 18);
    });

    it('sits to the right of the prompt text in landscape and wide (the prompt is centred and under ~300px wide)', () => {
        for (const kind of ['landscape', 'wide'] as const) {
            const t = titleLayoutFor(kind);
            expect(helpButtonRect(kind).x).toBeGreaterThan(t.prompt.x + 150);
        }
    });
});

describe('Title button tap size on real screens (canvas px x FIT scale >= 44 CSS px)', () => {
    const fit = (kind: LayoutKind, w: number, h: number) => {
        const l = layoutFor(kind);
        return Math.min(w / l.width, h / l.height);
    };

    it.each<[string, LayoutKind, number, number]>([
        ['portrait 390x844', 'portrait', 390, 844],
        ['wide 844x390', 'wide', 844, 390],
        ['wide 667x310', 'wide', 667, 310],
        ['landscape 800x600', 'landscape', 800, 600],
    ])('%s', (_name, kind, w, h) => {
        expect(helpButtonRect(kind).h * fit(kind, w, h)).toBeGreaterThanOrEqual(44);
    });
});

describe('Help input lock', () => {
    it('ignores input until 300 ms have passed, and accepts from exactly 300 ms', () => {
        expect(helpInputOpen(0)).toBe(false);
        expect(helpInputOpen(299)).toBe(false);
        expect(helpInputOpen(300)).toBe(true);
        expect(helpInputOpen(5000)).toBe(true);
    });
});

describe('Help texts', () => {
    it('shows the six lines of the spec in order, with the penalty and stage count from the parameters', () => {
        expect(HELP_LINES).toEqual([
            'Tap where the two pictures differ.',
            'A wrong tap costs 5 seconds.',
            'Find every difference to clear a stage.',
            '5 stages make 1 set.',
            'Time runs out: the set restarts.',
            'Leave the screen: the game pauses.',
        ]);
        expect(PARAMS.missPenalty).toBe(5);
        expect(PARAMS.stageCount).toBe(5);
    });

    it('uses the heading, the button label, the prompt and the six kind names of the spec', () => {
        expect(HELP_HEADING).toBe('HOW TO PLAY');
        expect(HELP_BUTTON_LABEL).toBe('HOW TO PLAY');
        expect(HELP_PROMPT).toBe('TAP TO CLOSE');
        expect(HELP_DIFFS).toEqual(['COLOR', 'MOVE', 'SIZE', 'GONE', 'EXTRA', 'SHAPE']);
    });
});

describe('Help layout, worked by hand from the spec table', () => {
    it('portrait: texts at the table rows, figure 2 x 3', () => {
        const t = helpLayoutFor('portrait');
        expect([t.width, t.height]).toEqual([768, 1664]);
        expect(t.heading).toEqual({ x: 384, y: 110 });
        expect(t.body.map((p) => p.y)).toEqual([200, 288, 376, 464, 552, 640]);
        expect(t.body.every((p) => p.x === 40)).toBe(true);
        expect(t.bodyWrap).toBe(688);
        expect(t.prompt).toEqual({ x: 384, y: 1540 });
        expect(t.cells.map((c) => c.name)).toEqual(['COLOR', 'MOVE', 'SIZE', 'GONE', 'EXTRA', 'SHAPE']);
        // EXTRA is the 5th cell: row 3, column 1 -> swatches x=60..180 and 204..324, y=1198..1318
        const extra = t.cells[4];
        expect(extra.left).toEqual({ x: 60, y: 1198 });
        expect(extra.right).toEqual({ x: 204, y: 1198 });
        expect(extra.label).toEqual({ x: 192, y: 1348 });
        // MOVE is the 2nd cell: row 1, column 2 -> swatches x=444..564 and 588..708
        expect(t.cells[1].left).toEqual({ x: 444, y: 790 });
        expect(t.cells[1].right).toEqual({ x: 588, y: 790 });
    });

    it('landscape: figure 2 x 3 on the right of the text', () => {
        const t = helpLayoutFor('landscape');
        expect(t.heading).toEqual({ x: 512, y: 50 });
        expect(t.body.map((p) => p.y)).toEqual([110, 182, 254, 326, 398, 470]);
        expect(t.cells[0].left).toEqual({ x: 562, y: 130 });
        expect(t.cells[0].right).toEqual({ x: 658, y: 130 });
        expect(t.cells[3].left).toEqual({ x: 782, y: 280 });
        expect(t.cells[5].right).toEqual({ x: 878, y: 430 });
        expect(t.prompt).toEqual({ x: 512, y: 700 });
    });

    it('wide: figure 3 x 2, GONE is row 2 column 1', () => {
        const t = helpLayoutFor('wide');
        expect(t.heading).toEqual({ x: 832, y: 50 });
        expect(t.body.map((p) => p.y)).toEqual([110, 174, 238, 302, 366, 430]);
        expect(t.cells[0].left).toEqual({ x: 896, y: 130 });
        expect(t.cells[1].right).toEqual({ x: 1248, y: 130 });
        expect(t.cells[2].right).toEqual({ x: 1488, y: 130 });
        const gone = t.cells[3];
        expect(gone.name).toBe('GONE');
        expect(gone.left).toEqual({ x: 896, y: 330 });
        expect(gone.right).toEqual({ x: 1008, y: 330 });
        expect(gone.label).toEqual({ x: 1000, y: 456 });
        expect(t.cells[5].right).toEqual({ x: 1488, y: 330 });
    });

    // Every number of the 配置 table, worked by hand: swatch x = column centre -/+ (gap/2) -/+ swatch, label y = row top + label dy.
    const FULL: Record<
        LayoutKind,
        {
            scalars: [number, number, number, number, number, number]; // bodyX, bodySize, bodyWrap, headingSize, labelSize, swatch
            cells: [string, [number, number], [number, number], [number, number]][];
        }
    > = {
        portrait: {
            scalars: [40, 32, 688, 56, 32, 120],
            cells: [
                ['COLOR', [60, 790], [204, 790], [192, 940]],
                ['MOVE', [444, 790], [588, 790], [576, 940]],
                ['SIZE', [60, 994], [204, 994], [192, 1144]],
                ['GONE', [444, 994], [588, 994], [576, 1144]],
                ['EXTRA', [60, 1198], [204, 1198], [192, 1348]],
                ['SHAPE', [444, 1198], [588, 1198], [576, 1348]],
            ],
        },
        landscape: {
            scalars: [40, 28, 460, 48, 24, 80],
            cells: [
                ['COLOR', [562, 130], [658, 130], [650, 232]],
                ['MOVE', [782, 130], [878, 130], [870, 232]],
                ['SIZE', [562, 280], [658, 280], [650, 382]],
                ['GONE', [782, 280], [878, 280], [870, 382]],
                ['EXTRA', [562, 430], [658, 430], [650, 532]],
                ['SHAPE', [782, 430], [878, 430], [870, 532]],
            ],
        },
        wide: {
            scalars: [60, 32, 800, 56, 32, 96],
            cells: [
                ['COLOR', [896, 130], [1008, 130], [1000, 256]],
                ['MOVE', [1136, 130], [1248, 130], [1240, 256]],
                ['SIZE', [1376, 130], [1488, 130], [1480, 256]],
                ['GONE', [896, 330], [1008, 330], [1000, 456]],
                ['EXTRA', [1136, 330], [1248, 330], [1240, 456]],
                ['SHAPE', [1376, 330], [1488, 330], [1480, 456]],
            ],
        },
    };

    it.each(KINDS)('%s: every size, wrap width and cell position equals the hand-worked table', (kind) => {
        const t = helpLayoutFor(kind);
        const want = FULL[kind];
        expect([t.body[0].x, t.bodySize, t.bodyWrap, t.headingSize, t.labelSize, t.swatch]).toEqual(want.scalars);
        expect(t.body.every((p) => p.x === want.scalars[0])).toBe(true);
        expect(t.cells.map((c) => [c.name, [c.left.x, c.left.y], [c.right.x, c.right.y], [c.label.x, c.label.y]])).toEqual(
            want.cells,
        );
    });

    it.each(KINDS)('%s: everything fits the canvas and nothing overlaps', (kind) => {
        const t = helpLayoutFor(kind);
        const swatches = t.cells.flatMap((c) => [c.left, c.right]);
        for (const p of swatches) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x + t.swatch).toBeLessThanOrEqual(t.width);
            expect(p.y + t.swatch).toBeLessThanOrEqual(t.height);
        }
        // the two swatches of a cell do not touch each other, and cells do not overlap
        const boxes = swatches.map((p) => ({ x0: p.x, x1: p.x + t.swatch, y0: p.y, y1: p.y + t.swatch }));
        boxes.forEach((a, i) =>
            boxes.slice(i + 1).forEach((b) => {
                const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
                if (!apart) expect.fail(`swatches ${i} overlap`);
            }),
        );
        // each name is under its swatches and above the next row
        for (const c of t.cells) {
            expect(c.label.y - t.labelSize / 2).toBeGreaterThanOrEqual(c.left.y + t.swatch);
            expect(c.label.y + t.labelSize / 2).toBeLessThanOrEqual(t.height);
        }
        // the six lines (at most two wrapped rows each) stay clear of the figure and of the prompt
        const figureLeft = Math.min(...swatches.map((p) => p.x));
        const lastLineBottom = t.body[5].y + 2 * t.bodySize;
        const figureTop = Math.min(...swatches.map((p) => p.y));
        const figureBottom = Math.max(...t.cells.map((c) => c.label.y + t.labelSize / 2));
        expect(t.body[0].x + t.bodyWrap).toBeLessThanOrEqual(kind === 'portrait' ? t.width : figureLeft);
        if (kind === 'portrait') expect(lastLineBottom).toBeLessThanOrEqual(figureTop);
        expect(figureBottom).toBeLessThanOrEqual(t.prompt.y - 18);
        expect(lastLineBottom).toBeLessThanOrEqual(t.prompt.y - 18);
        // the heading is above the first line
        expect(t.heading.y + t.headingSize / 2).toBeLessThanOrEqual(t.body[0].y);
        // consecutive lines leave room for two wrapped rows
        expect(t.body[1].y - t.body[0].y).toBeGreaterThanOrEqual(kind === 'wide' ? t.bodySize : 2 * t.bodySize);
    });

    it('keeps every text at 32px or more on the portrait and wide layouts, and at 24px or more on landscape', () => {
        for (const kind of ['portrait', 'wide'] as const) {
            const t = helpLayoutFor(kind);
            expect(Math.min(t.headingSize, t.bodySize, t.labelSize)).toBeGreaterThanOrEqual(32);
            expect(helpButtonRect(kind).size).toBeGreaterThanOrEqual(32);
        }
        const l = helpLayoutFor('landscape');
        expect(Math.min(l.headingSize, l.bodySize, l.labelSize)).toBeGreaterThanOrEqual(24);
    });
});

describe('Help figure samples (spec 図の見本)', () => {
    const S = 100;
    const main = (shapes: ReturnType<typeof helpSample>['left']) => shapes.filter((s) => s.kind !== 'rect');
    const squares = (shapes: ReturnType<typeof helpSample>['left']) => shapes.filter((s) => s.kind === 'rect');

    it('puts the same small square in both pictures of every figure', () => {
        for (const name of HELP_DIFFS) {
            const { left, right } = helpSample(name, S);
            expect(squares(left)).toEqual(squares(right));
            expect(squares(left)).toEqual([{ kind: 'rect', x: 84, y: 84, size: 8, hue: 40, sat: 0.7, light: 0.5 }]);
        }
    });

    it('COLOR changes only the hue (205 -> 330)', () => {
        const { left, right } = helpSample('COLOR', S);
        expect(main(left)).toEqual([{ kind: 'circle', x: 50, y: 50, size: 20, hue: 205, sat: 0.7, light: 0.5 }]);
        expect(main(right)).toEqual([{ ...main(left)[0], hue: 330 }]);
    });

    it('MOVE changes only the centre x (0.38 -> 0.62)', () => {
        const { left, right } = helpSample('MOVE', S);
        expect(main(left)[0].x).toBeCloseTo(38);
        expect(main(right)[0].x).toBeCloseTo(62);
        expect({ ...main(right)[0], x: 0 }).toEqual({ ...main(left)[0], x: 0 });
    });

    it('SIZE changes only the radius (0.2 -> 0.32)', () => {
        const { left, right } = helpSample('SIZE', S);
        expect(main(left)[0].size).toBeCloseTo(20);
        expect(main(right)[0].size).toBeCloseTo(32);
        expect({ ...main(right)[0], size: 0 }).toEqual({ ...main(left)[0], size: 0 });
    });

    it('GONE has the main shape only on the left, EXTRA only on the right', () => {
        const gone = helpSample('GONE', S);
        expect(main(gone.left)).toHaveLength(1);
        expect(main(gone.right)).toHaveLength(0);
        const extra = helpSample('EXTRA', S);
        expect(main(extra.left)).toHaveLength(0);
        expect(main(extra.right)).toEqual(main(gone.left));
    });

    it('SHAPE changes only the kind (circle -> triangle)', () => {
        const { left, right } = helpSample('SHAPE', S);
        expect(main(left)[0].kind).toBe('circle');
        expect(main(right)[0].kind).toBe('triangle');
        expect({ ...main(right)[0], kind: 'circle' }).toEqual(main(left)[0]);
    });

    it('keeps every shape inside the swatch and the main shape clear of the square', () => {
        for (const name of HELP_DIFFS) {
            const { left, right } = helpSample(name, S);
            for (const pic of [left, right]) {
                for (const s of pic) {
                    if (s.x - s.size < 0 || s.x + s.size > S || s.y - s.size < 0 || s.y + s.size > S) {
                        expect.fail(`${name}: ${s.kind} leaves the swatch`);
                    }
                }
                // the square's circumscribed circle (radius size * sqrt(2)) must not touch the main shape's circle
                for (const m of main(pic)) {
                    const q = squares(pic)[0];
                    if (Math.hypot(m.x - q.x, m.y - q.y) <= m.size + q.size * Math.SQRT2) {
                        expect.fail(`${name}: main shape touches the square`);
                    }
                }
            }
        }
    });

    it('is the same every time and scales with the swatch side', () => {
        expect(helpSample('MOVE', S)).toEqual(helpSample('MOVE', S));
        const big = helpSample('SIZE', 200);
        expect(main(big.right)[0].size).toBeCloseTo(64);
    });
});
