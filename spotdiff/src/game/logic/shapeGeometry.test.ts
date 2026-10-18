import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { SHAPE_KIND_ORDER, kindsAt } from './generate';
import type { Point } from './layout';
import { polygonPoints } from './shapeGeometry';
import type { PolygonKind } from './shapeGeometry';

const KINDS: PolygonKind[] = ['star', 'cross', 'hexagon'];

/** Independent oracle: the shoelace area of a polygon. */
const area = (pts: Point[]): number => {
    let sum = 0;
    pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        sum += p.x * q.y - q.x * p.y;
    });
    return Math.abs(sum) / 2;
};

describe('polygonPoints: star (size 40, inner ratio 0.4)', () => {
    const pts = polygonPoints('star', 40);

    it('has 10 vertices, starting at the top and alternating outer and inner radius', () => {
        expect(pts).toHaveLength(10);
        pts.forEach((p, k) => {
            expect(Math.hypot(p.x, p.y), `vertex ${k}`).toBeCloseTo(k % 2 === 0 ? 40 : 16, 9);
        });
        expect(pts[0].x).toBeCloseTo(0, 9);
        expect(pts[0].y).toBeCloseTo(-40, 9);
    });

    it('puts the first vertices where the spec says: (0,-40), (9.40,-12.94), (38.04,-12.36)', () => {
        expect(pts[1].x).toBeCloseTo(9.4, 2);
        expect(pts[1].y).toBeCloseTo(-12.94, 2);
        expect(pts[2].x).toBeCloseTo(38.04, 2);
        expect(pts[2].y).toBeCloseTo(-12.36, 2);
    });

    it('has the area n * R * r * sin(pi / n) of a regular star (5 * 40 * 16 * sin 36 deg)', () => {
        expect(area(pts)).toBeCloseTo(5 * 40 * 16 * Math.sin(Math.PI / 5), 6);
    });
});

describe('polygonPoints: cross (size 40, arm half-width ratio 0.35)', () => {
    const pts = polygonPoints('cross', 40);

    it('has the 12 corners of the union of a horizontal and a vertical bar (arms +-14, reach +-40)', () => {
        expect(pts).toEqual([
            { x: -14, y: -40 }, { x: 14, y: -40 }, { x: 14, y: -14 }, { x: 40, y: -14 }, { x: 40, y: 14 }, { x: 14, y: 14 },
            { x: 14, y: 40 }, { x: -14, y: 40 }, { x: -14, y: 14 }, { x: -40, y: 14 }, { x: -40, y: -14 }, { x: -14, y: -14 },
        ].map((p) => ({ x: expect.closeTo(p.x, 9), y: expect.closeTo(p.y, 9) })));
    });

    it('covers two bars minus their overlap: 2 * (80 * 28) - 28 * 28 = 3696', () => {
        expect(area(pts)).toBeCloseTo(3696, 6);
    });
});

describe('polygonPoints: hexagon (size 40)', () => {
    const pts = polygonPoints('hexagon', 40);

    it('has vertices left and right and flat horizontal top and bottom edges', () => {
        expect(pts).toHaveLength(6);
        expect(pts[0].x).toBeCloseTo(40, 9);
        expect(pts[0].y).toBeCloseTo(0, 9);
        expect(pts[3].x).toBeCloseTo(-40, 9);
        expect(pts[1].x).toBeCloseTo(20, 9);
        expect(pts[2].x).toBeCloseTo(-20, 9);
        expect(pts[1].y).toBeCloseTo(34.64, 2);
        expect(pts[2].y).toBeCloseTo(34.64, 2);
        expect(pts[4].y).toBeCloseTo(-34.64, 2);
        expect(pts[5].y).toBeCloseTo(-34.64, 2);
    });

    it('has the area of a regular hexagon, 3 * sqrt(3) / 2 * r^2', () => {
        expect(area(pts)).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * 40 * 40, 6);
    });
});

describe('polygonPoints: bounding square', () => {
    it('keeps every vertex of every polygon kind inside the square of side 2 * size, for the sizes of every stage', () => {
        const sizes = [PARAMS.shapeSizeMin, 25, 32, 36, 40, 44, 48];
        for (const kind of KINDS) {
            for (const size of sizes) {
                for (const p of polygonPoints(kind, size)) {
                    if (Math.abs(p.x) > size + 1e-9 || Math.abs(p.y) > size + 1e-9) expect.fail(`${kind} size ${size} (${p.x}, ${p.y})`);
                }
            }
        }
    });

    it('scales every polygon in proportion to size', () => {
        for (const kind of KINDS) {
            const a = polygonPoints(kind, 20);
            const b = polygonPoints(kind, 40);
            b.forEach((p, i) => {
                expect(p.x).toBeCloseTo(a[i].x * 2, 9);
                expect(p.y).toBeCloseTo(a[i].y * 2, 9);
            });
        }
    });
});

describe('kindsAt', () => {
    it('lists the order of kinds as the spec gives it', () => {
        expect([...SHAPE_KIND_ORDER]).toEqual(['circle', 'rect', 'triangle', 'star', 'cross', 'hexagon']);
    });

    it('gives the first 3 / 4 / 5 / 6 / 6 kinds of the order at stages 1-5', () => {
        expect(kindsAt(0)).toEqual(['circle', 'rect', 'triangle']);
        expect(kindsAt(1)).toEqual(['circle', 'rect', 'triangle', 'star']);
        expect(kindsAt(2)).toEqual(['circle', 'rect', 'triangle', 'star', 'cross']);
        expect(kindsAt(3)).toEqual(['circle', 'rect', 'triangle', 'star', 'cross', 'hexagon']);
        expect(kindsAt(4)).toEqual(['circle', 'rect', 'triangle', 'star', 'cross', 'hexagon']);
    });
});
