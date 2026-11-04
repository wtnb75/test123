import { describe, it, expect } from 'vitest';
import { createSplineRoute, splinePointAtParam } from './spline';
import { measureStage, stageRoute } from './measure';
import { polylineLength } from './polyline';
import { CHARACTER_PIXEL_SPEED_PER_SEC, STAGE_COUNT } from './constants';
import type { Point } from './waypoints';

// Reference values come from Phaser 4.2.1 itself: a throwaway Node script (not committed) required
// node_modules/phaser/src/curves/path/Path.js and src/math/Vector2.js by absolute path, built
// `new Path(p0.x, p0.y)` + `splineTo(rest)` the way the Game scene does, and recorded `Path.getLength()` and
// `Path.getPoint(u)` for u = 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1. Positions and lengths are in px.
const TOLERANCE_PX = 0.5;
const RATIOS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

interface Reference {
    name: string;
    points: Point[];
    length: number;
    // [x, y] at each of RATIOS.
    positions: [number, number][];
}

const REFERENCES: Reference[] = [
    {
        name: 'zigzag',
        points: [
            { x: 0, y: 0 },
            { x: 100, y: 80 },
            { x: 200, y: 0 },
            { x: 300, y: 80 }
        ],
        length: 392.2787,
        positions: [
            [0, 0],
            [27.297, 28.126],
            [70.544, 67.926],
            [150, 40],
            [229.456, 12.074],
            [272.703, 51.874],
            [300, 80]
        ]
    },
    {
        name: 'right-angle corner',
        points: [
            { x: 0, y: 0 },
            { x: 120, y: 0 },
            { x: 120, y: 150 }
        ],
        length: 275.729,
        positions: [
            [0, 0],
            [27.241, -4.043],
            [68.125, -10.27],
            [125.791, 12.784],
            [126.952, 81.436],
            [122.457, 122.56],
            [120, 150]
        ]
    },
    {
        name: 'uneven spacing',
        points: [
            { x: 10, y: 20 },
            { x: 40, y: 25 },
            { x: 300, y: 200 },
            { x: 320, y: 40 },
            { x: 600, y: 90 }
        ],
        length: 823.0145,
        positions: [
            [10, 20],
            [70.758, 46.677],
            [168.947, 121.558],
            [313.961, 157.355],
            [399.941, 42.175],
            [520.232, 69.905],
            [600, 90]
        ]
    },
    {
        name: 'stage 3 route',
        points: stageRoute(3),
        length: 973.5186,
        positions: [
            [60, 300],
            [154.951, 321.376],
            [294.669, 357.518],
            [432.467, 551.252],
            [674.557, 540],
            [820.526, 540],
            [917.903, 540]
        ]
    },
    {
        name: 'stage 8 route',
        points: stageRoute(8),
        length: 1160.1906,
        positions: [
            [60, 300],
            [139.664, 219.705],
            [221.112, 350.775],
            [349.611, 540],
            [639.421, 544.083],
            [776.287, 490.815],
            [880.503, 460.117]
        ]
    }
];

// Phaser Path.getLength() of stageRoute(1..10), px.
const STAGE_SPLINE_LENGTHS = [
    924.7873, 950.3771, 973.5186, 1007.3776, 1040.5239, 1055.8132, 1085.214, 1160.1906, 1147.6036, 1214.2447
];

describe('createSplineRoute matches Phaser Curves.Path with splineTo', () => {
    for (const ref of REFERENCES) {
        it(`${ref.name}: length is within ${TOLERANCE_PX} px of the Phaser length`, () => {
            expect(Math.abs(createSplineRoute(ref.points).length - ref.length)).toBeLessThanOrEqual(TOLERANCE_PX);
        });

        it(`${ref.name}: positions at arc ratios ${RATIOS.join('/')} are within ${TOLERANCE_PX} px of Phaser`, () => {
            const route = createSplineRoute(ref.points);
            RATIOS.forEach((ratio, i) => {
                const p = route.pointAt(ratio);
                const [x, y] = ref.positions[i];
                if (Math.hypot(p.x - x, p.y - y) > TOLERANCE_PX) {
                    expect.fail(`${ref.name} ratio ${ratio}: got (${p.x}, ${p.y}), Phaser (${x}, ${y})`);
                }
            });
        });
    }
});

describe('createSplineRoute hand-worked cases', () => {
    it('is a straight line of length 10 for two points, with the middle at (5, 0)', () => {
        const route = createSplineRoute([
            { x: 0, y: 0 },
            { x: 10, y: 0 }
        ]);
        expect(route.length).toBeCloseTo(10, 9);
        const mid = route.pointAt(0.5);
        expect(mid.x).toBeCloseTo(5, 1);
        expect(mid.y).toBeCloseTo(0, 9);
    });

    it('walks three evenly spaced collinear points at an even arc-length pace (length 20)', () => {
        const route = createSplineRoute([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 0 }
        ]);
        expect(route.length).toBeCloseTo(20, 9);
        for (const [ratio, x] of [
            [0.25, 5],
            [0.5, 10],
            [0.75, 15]
        ]) {
            const p = route.pointAt(ratio);
            expect(Math.abs(p.x - x)).toBeLessThanOrEqual(0.05);
            expect(p.y).toBeCloseTo(0, 9);
        }
    });

    it('returns the first and last control points at ratios 0 and 1', () => {
        const points = REFERENCES[0].points;
        const route = createSplineRoute(points);
        expect(route.pointAt(0).x).toBeCloseTo(0, 6);
        expect(route.pointAt(0).y).toBeCloseTo(0, 6);
        expect(route.pointAt(1).x).toBeCloseTo(300, 6);
        expect(route.pointAt(1).y).toBeCloseTo(80, 6);
    });

    it('clamps ratios below 0 and above 1 to the end points', () => {
        const route = createSplineRoute(REFERENCES[1].points);
        expect(route.pointAt(-3)).toEqual(route.pointAt(0));
        expect(route.pointAt(5)).toEqual(route.pointAt(1));
    });

    it('has length 0 and returns the point itself for a single control point', () => {
        const route = createSplineRoute([{ x: 7, y: 9 }]);
        expect(route.length).toBe(0);
        expect(route.pointAt(0.5)).toEqual({ x: 7, y: 9 });
    });

    it('does not return NaN when consecutive control points coincide', () => {
        const route = createSplineRoute([
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 0 }
        ]);
        expect(route.length).toBeGreaterThan(0);
        for (const ratio of RATIOS) {
            const p = route.pointAt(ratio);
            expect(Number.isNaN(p.x) || Number.isNaN(p.y)).toBe(false);
        }
        expect(route.pointAt(0)).toEqual({ x: 0, y: 0 });
    });

    it('returns the control point when every control point is the same', () => {
        const route = createSplineRoute([
            { x: 3, y: 4 },
            { x: 3, y: 4 }
        ]);
        expect(route.length).toBe(0);
        expect(route.pointAt(0.7)).toEqual({ x: 3, y: 4 });
    });
});

describe('splinePointAtParam', () => {
    it('passes through every control point at w = i / n', () => {
        const points = REFERENCES[2].points;
        const n = points.length - 1;
        points.forEach((point, i) => {
            const p = splinePointAtParam(points, i / n);
            expect(p.x).toBeCloseTo(point.x, 6);
            expect(p.y).toBeCloseTo(point.y, 6);
        });
    });

    it('clamps w outside 0-1 to the end points', () => {
        const points = REFERENCES[0].points;
        expect(splinePointAtParam(points, -1)).toEqual(splinePointAtParam(points, 0));
        expect(splinePointAtParam(points, 2)).toEqual(splinePointAtParam(points, 1));
    });

    it('evaluates the Catmull-Rom formula by hand for the midpoint of the first span', () => {
        // Points x = 0, 10, 20: first span, f = 0.5. p0 = p1 = 0, p2 = 10, p3 = 20, so v0 = 5, v1 = 10.
        // (0 - 20 + 5 + 10) * 0.125 + (0 + 30 - 10 - 10) * 0.25 + 5 * 0.5 + 0 = -0.625 + 2.5 + 2.5 = 4.375
        const p = splinePointAtParam(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 20, y: 0 }
            ],
            0.25
        );
        expect(p.x).toBeCloseTo(4.375, 9);
    });
});

describe('real stage routes', () => {
    it('are a little longer as splines than as polylines (under 5%) for stages 1-10', () => {
        for (let stage = 1; stage <= STAGE_COUNT; stage++) {
            const route = stageRoute(stage);
            const spline = createSplineRoute(route).length;
            const polyline = polylineLength(route);
            if (spline < polyline || spline >= polyline * 1.05) {
                expect.fail(`stage ${stage}: spline ${spline}, polyline ${polyline}`);
            }
        }
    });

    it('match the Phaser lengths of stages 1-10 within 0.5 px', () => {
        STAGE_SPLINE_LENGTHS.forEach((length, i) => {
            expect(Math.abs(createSplineRoute(stageRoute(i + 1)).length - length)).toBeLessThanOrEqual(TOLERANCE_PX);
        });
    });

    it('are measured with the Phaser travel time (length / 130 px/s) for stages 1-10', () => {
        const toleranceMs = (TOLERANCE_PX / CHARACTER_PIXEL_SPEED_PER_SEC) * 1000;
        STAGE_SPLINE_LENGTHS.forEach((length, i) => {
            const expectedMs = (length / CHARACTER_PIXEL_SPEED_PER_SEC) * 1000;
            expect(Math.abs(measureStage(i + 1, 1).travelTimeMs - expectedMs)).toBeLessThanOrEqual(toleranceMs);
        });
    });
});
