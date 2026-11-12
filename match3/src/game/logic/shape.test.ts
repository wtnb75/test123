import { describe, expect, it } from 'vitest';
import { CELL, MARK_BAR_MIN, MARK_RING_MIN, MARK_THICKNESS, SHAPE_AREA_MIN_RATIO, SHAPE_BOX } from '../params';
import { RAINBOW, type Kind } from './board';
import {
    gemShape,
    insidePolygon,
    markFits,
    markSpec,
    outlineCenter,
    polygonArea,
    SHAPES,
    shapeAnchor,
    shapeOutline,
    shinePlacement,
    type Mark,
    type Shape,
} from './shape';

const MID = CELL / 2;
const CIRCLE_AREA = Math.PI * 18 * 18;
const MARKED: Kind[] = ['lineRow', 'lineCol', 'bomb'];

describe('gemShape', () => {
    it('gives colours 0 to 5 circle, square, triangle, diamond, hexagon and star in that order', () => {
        expect([0, 1, 2, 3, 4, 5].map(gemShape)).toEqual(['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star']);
    });

    it('gives the six colours six different shapes', () => {
        expect(new Set([0, 1, 2, 3, 4, 5].map(gemShape)).size).toBe(6);
    });

    it('makes the colour stone and an unknown colour number round', () => {
        expect(gemShape(RAINBOW)).toBe('circle');
        expect(gemShape(6)).toBe('circle');
    });
});

describe('polygon helpers', () => {
    const square = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
    ];

    it('computes the area of a 4 x 4 square as 16 whichever way it is wound', () => {
        expect(polygonArea(square)).toBe(16);
        expect(polygonArea([...square].reverse())).toBe(16);
    });

    it('finds the mean of the vertices', () => {
        expect(outlineCenter(square)).toEqual({ x: 2, y: 2 });
    });

    it('tells inside from outside, including a concave notch', () => {
        expect(insidePolygon({ x: 2, y: 2 }, square)).toBe(true);
        expect(insidePolygon({ x: 5, y: 2 }, square)).toBe(false);
        expect(insidePolygon({ x: 2, y: -1 }, square)).toBe(false);
        // An arrow-head shape: the notch at the top middle is outside.
        const notch = [
            { x: 0, y: 0 },
            { x: 2, y: 3 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ];
        expect(insidePolygon({ x: 2, y: 1 }, notch)).toBe(false);
        expect(insidePolygon({ x: 2, y: 3.5 }, notch)).toBe(true);
    });
});

describe('shapeOutline', () => {
    it('keeps every outline inside the 40 x 40 box around the cell centre', () => {
        const lo = MID - SHAPE_BOX / 2;
        const hi = MID + SHAPE_BOX / 2;
        for (const shape of SHAPES) {
            for (const p of shapeOutline(shape)) {
                if (p.x < lo - 1e-9 || p.x > hi + 1e-9 || p.y < lo - 1e-9 || p.y > hi + 1e-9) {
                    expect.fail(`${shape} has a vertex outside the box: ${p.x}, ${p.y}`);
                }
            }
        }
    });

    it('keeps every outline at least 60% of the round stone and shows the area of each shape by hand', () => {
        const area = (s: Shape) => polygonArea(shapeOutline(s));
        for (const shape of SHAPES) expect(area(shape)).toBeGreaterThanOrEqual(CIRCLE_AREA * SHAPE_AREA_MIN_RATIO);
        expect(area('diamond')).toBeCloseTo(800, 6); // diagonals 40 x 40: 40 * 40 / 2
        expect(area('triangle')).toBeCloseTo((Math.sqrt(3) / 4) * 1600, 6); // side 40
        expect(area('hexagon')).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * 400, 6); // circumradius 20
        expect(area('star')).toBeCloseTo(10 * 0.5 * 20 * 12 * Math.sin(Math.PI / 5), 6); // 10 triangles 20, 12, 36 degrees
        // 32 x 32 minus the corners (radius 6); the arcs are 6-step polygons, so a little smaller than the true 993.1.
        expect(Math.abs(area('square') - (1024 - (4 - Math.PI) * 36))).toBeLessThan(2);
        expect(area('circle')).toBeCloseTo(CIRCLE_AREA, -1); // radius 18, 48-gon
    });

    it('puts the triangle apex up, a flat base down, and both ends of the base on the box edge', () => {
        const [apex, right, left] = shapeOutline('triangle');
        expect(apex.x).toBeCloseTo(MID, 9);
        expect(apex.y).toBeCloseTo(MID - 17.3205, 3);
        expect(right.y).toBeCloseTo(MID + 17.3205, 3);
        expect(left.y).toBeCloseTo(right.y, 9);
        expect(right.x - left.x).toBeCloseTo(40, 9);
    });

    it('puts the diamond corners on the four box edges and the star apex straight up', () => {
        expect(shapeOutline('diamond')).toEqual([
            { x: 22, y: 2 },
            { x: 42, y: 22 },
            { x: 22, y: 42 },
            { x: 2, y: 22 },
        ]);
        const star = shapeOutline('star');
        expect(star).toHaveLength(10);
        expect(star[0].x).toBeCloseTo(MID, 9);
        expect(star[0].y).toBeCloseTo(MID - 20, 9);
    });

    it('points the hexagon up and down with six corners on a circle of radius 20', () => {
        const hex = shapeOutline('hexagon');
        expect(hex).toHaveLength(6);
        expect(hex[0].y).toBeCloseTo(MID - 20, 9);
        expect(hex[3].y).toBeCloseTo(MID + 20, 9);
        for (const p of hex) expect(Math.hypot(p.x - MID, p.y - MID)).toBeCloseTo(20, 9);
    });

    it('centres every outline but the triangle on the cell and the triangle by its centroid', () => {
        for (const shape of SHAPES) {
            const c = outlineCenter(shapeOutline(shape));
            expect(c.x).toBeCloseTo(MID, 9);
            if (shape === 'triangle') expect(c.y).toBeCloseTo(MID - 17.3205 + (2 / 3) * 34.641, 3);
            else expect(c.y).toBeCloseTo(MID, 9);
        }
    });
});

describe('shapeOutline as a fan', () => {
    it('is star-shaped around its centre: every fan triangle winds the same way (the fill needs that)', () => {
        for (const shape of SHAPES) {
            const pts = shapeOutline(shape);
            const c = outlineCenter(pts);
            const signs = pts.map((a, i) => {
                const b = pts[(i + 1) % pts.length];
                return Math.sign((a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x));
            });
            if (!signs.every((s) => s === signs[0] && s !== 0)) expect.fail(`${shape} is not star-shaped around its centre`);
        }
    });

    it('gives the six shapes six different vertex counts, so they cannot be mistaken for each other', () => {
        const counts = SHAPES.map((s) => shapeOutline(s).length);
        expect(new Set(counts).size).toBe(6);
        expect(shapeOutline('triangle')).toHaveLength(3);
        expect(shapeOutline('diamond')).toHaveLength(4);
        expect(shapeOutline('hexagon')).toHaveLength(6);
        expect(shapeOutline('star')).toHaveLength(10);
    });
});

describe('shapeAnchor', () => {
    it('is the cell centre, except the triangle where it is the centroid 5.77 below it', () => {
        for (const shape of SHAPES) {
            const a = shapeAnchor(shape);
            expect(a.x).toBeCloseTo(MID, 9);
            expect(a.y).toBeCloseTo(shape === 'triangle' ? MID + 5.7735 : MID, 3);
        }
    });
});

describe('markFits', () => {
    const outline = shapeOutline('circle');

    it('accepts a bar and a ring well inside, and rejects a bar or ring that crosses the outline', () => {
        expect(markFits({ type: 'bar', x: MID - 5, y: MID - 1, w: 10, h: 2 }, outline)).toBe(true);
        expect(markFits({ type: 'bar', x: MID - 20, y: MID - 1, w: 40, h: 2 }, outline)).toBe(false);
        expect(markFits({ type: 'ring', x: MID, y: MID, r: 9 }, outline)).toBe(true);
        expect(markFits({ type: 'ring', x: MID, y: MID, r: 16 }, outline)).toBe(false);
    });

    it('counts the dark outline of the mark: a bar whose plain rectangle fits but whose outline does not is rejected', () => {
        // Half-length 16.5: the plain end (16.5, 2.5 off the middle) is inside radius 18, the 2 px outline end is not.
        const bar: Mark = { type: 'bar', x: MID - 16.5, y: MID - 2.5, w: 33, h: 5 };
        expect(Math.hypot(16.5, 2.5)).toBeLessThan(18);
        expect(Math.hypot(18.5, 4.5)).toBeGreaterThan(18);
        expect(markFits(bar, outline)).toBe(false);
    });

    it('counts the dark outline on every side of a bar, not only the right and bottom', () => {
        // Each bar touches the circle only on one side: plain edge at 16.5 from the centre (inside 18), outline at 18.5.
        const left: Mark = { type: 'bar', x: MID - 16.5, y: MID - 1, w: 10, h: 2 };
        const right: Mark = { type: 'bar', x: MID + 6.5, y: MID - 1, w: 10, h: 2 };
        const top: Mark = { type: 'bar', x: MID - 1, y: MID - 16.5, w: 2, h: 10 };
        const bottom: Mark = { type: 'bar', x: MID - 1, y: MID + 6.5, w: 2, h: 10 };
        for (const bar of [left, right, top, bottom]) expect(markFits(bar, outline)).toBe(false);
        expect(markFits({ type: 'bar', x: MID - 14, y: MID - 1, w: 10, h: 2 }, outline)).toBe(true);
    });
});

describe('markSpec', () => {
    it('gives a normal stone and a colour stone no mark', () => {
        for (const shape of SHAPES) {
            expect(markSpec(shape, 'normal')).toBeNull();
            expect(markSpec(shape, 'rainbow')).toBeNull();
        }
    });

    it('keeps the base size on the round stone: a 26 x 5 bar and a ring of radius 9 around the centre', () => {
        expect(markSpec('circle', 'lineRow')).toEqual({ type: 'bar', x: MID - 13, y: MID - 2.5, w: 26, h: 5 });
        expect(markSpec('circle', 'lineCol')).toEqual({ type: 'bar', x: MID - 2.5, y: MID - 13, w: 5, h: 26 });
        expect(markSpec('circle', 'bomb')).toEqual({ type: 'ring', x: MID, y: MID, r: 9 });
    });

    it('lays a row bar flat and a column bar upright on every shape, thickness unchanged', () => {
        for (const shape of SHAPES) {
            const row = markSpec(shape, 'lineRow');
            const col = markSpec(shape, 'lineCol');
            if (row?.type !== 'bar' || col?.type !== 'bar') expect.fail(`${shape}: expected bars`);
            expect(row.h).toBe(MARK_THICKNESS);
            expect(col.w).toBe(MARK_THICKNESS);
            expect(row.w).toBeGreaterThan(row.h);
            expect(col.h).toBeGreaterThan(col.w);
        }
    });

    it('fits every mark of every shape inside its outline, with the bar at least 16 long and the ring radius at least 5', () => {
        let checked = 0;
        for (const shape of SHAPES) {
            const outline = shapeOutline(shape);
            for (const kind of MARKED) {
                const mark = markSpec(shape, kind);
                if (mark === null) expect.fail(`${shape}/${kind}: no mark`);
                if (!markFits(mark, outline)) expect.fail(`${shape}/${kind}: mark leaves the outline`);
                if (mark.type === 'bar') {
                    expect(Math.max(mark.w, mark.h)).toBeGreaterThanOrEqual(MARK_BAR_MIN);
                    expect(Math.max(mark.w, mark.h)).toBeLessThanOrEqual(26);
                } else {
                    expect(mark.r).toBeGreaterThanOrEqual(MARK_RING_MIN);
                    expect(mark.r).toBeLessThanOrEqual(9);
                }
                checked++;
            }
        }
        expect(checked).toBe(18);
    });

    it('shrinks the row bar on the triangle to 17 (the width there is 21.5 and the outline takes 2 px on each end)', () => {
        const mark = markSpec('triangle', 'lineRow');
        expect(mark?.type === 'bar' && mark.w).toBe(17);
    });

    it('centres the triangle marks on the centroid and shrinks its ring to 7 (inradius 11.55 - 4.5 of stroke and outline)', () => {
        const row = markSpec('triangle', 'lineRow');
        const ring = markSpec('triangle', 'bomb');
        const cy = MID + 5.7735;
        expect(row?.type === 'bar' && row.y + row.h / 2).toBeCloseTo(cy, 3);
        expect(ring?.type === 'ring' && ring.y).toBeCloseTo(cy, 3);
        expect(ring?.type === 'ring' && ring.r).toBe(7);
    });

    it('shrinks the star ring to 7 (its nearest outline points are the 12 px inner vertices; 12 - 4.5 = 7.5)', () => {
        const ring = markSpec('star', 'bomb');
        expect(ring?.type === 'ring' && ring.r).toBe(7);
    });

    it('keeps the base size on the diamond, the hexagon and the rounded square', () => {
        for (const shape of ['diamond', 'hexagon', 'square'] as const) {
            expect(markSpec(shape, 'lineRow')).toMatchObject({ w: 26, h: 5 });
            expect(markSpec(shape, 'bomb')).toMatchObject({ r: 9 });
        }
    });
});

describe('shinePlacement', () => {
    it('keeps the round stone highlight where it always was: radius 6, up and to the left by 6', () => {
        expect(shinePlacement('circle')).toEqual({ x: MID - 6, y: MID - 6, r: 6 });
    });

    it('keeps the whole highlight inside every outline, never right of or below the anchor', () => {
        for (const shape of SHAPES) {
            const s = shinePlacement(shape);
            const anchor = shapeAnchor(shape);
            expect(s.x).toBeLessThanOrEqual(anchor.x + 1e-9);
            expect(s.y).toBeLessThanOrEqual(anchor.y + 1e-9);
            const outline = shapeOutline(shape);
            for (let i = 0; i < 64; i++) {
                const a = (i / 64) * Math.PI * 2;
                const p = { x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) };
                if (!insidePolygon(p, outline)) expect.fail(`${shape}: highlight leaves the outline at ${p.x}, ${p.y}`);
            }
            expect(s.r).toBeGreaterThanOrEqual(2);
            expect(s.r).toBeLessThanOrEqual(6);
        }
    });

    it('moves the highlight on the diamond (its corner region is outside) towards the centre', () => {
        const s = shinePlacement('diamond');
        // Base (16, 16) r 6 reaches |dx| + |dy| = 12 + 8.49 = 20.49 > 20, so it cannot stay.
        expect(s).not.toEqual({ x: 16, y: 16, r: 6 });
        expect(s.x).toBeGreaterThan(16);
    });

    it('moves the triangle highlight inside the narrow top and still places it up and to the left of the centroid', () => {
        const s = shinePlacement('triangle');
        expect(s.x).toBeLessThanOrEqual(MID + 1e-9);
        expect(s.y).toBeLessThanOrEqual(MID + 5.7735 + 1e-9);
    });
});
