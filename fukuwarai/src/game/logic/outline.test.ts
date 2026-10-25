import { describe, it, expect } from 'vitest';
import { PART_ANSWERS, PART_SHAPES } from './parts';
import { dashSegments, faceOverlaySegments, placePoints, shapeOutlines } from './outline';
import type { PartId, PartTransform } from './types';

// The overlay face is drawn at the Result face center (docs/spec.md「Result の重ね表示」).
const FACE_CENTER_Y = 210;
const FAR = 100000;

// The correct face (PART_ANSWERS) moved to the Result face center.
function correctFaceAtResult(): Record<PartId, PartTransform> {
    const transforms = {} as Record<PartId, PartTransform>;
    for (const id of Object.keys(PART_ANSWERS) as PartId[]) {
        const t = PART_ANSWERS[id];
        transforms[id] = { x: t.x, y: t.y + FACE_CENTER_Y, rotation: t.rotation };
    }
    return transforms;
}

describe('shapeOutlines', () => {
    it('closes the triangle outline on its first vertex', () => {
        const [triangle] = shapeOutlines(PART_SHAPES.nose);
        expect(triangle).toEqual([
            { x: 0, y: -13 },
            { x: -11, y: 13 },
            { x: 11, y: 13 },
            { x: 0, y: -13 },
        ]);
    });

    it('samples a circle on its radius and closes the loop', () => {
        const [circle] = shapeOutlines(PART_SHAPES.outline);
        const first = circle[0];
        const last = circle[circle.length - 1];
        expect(first.x).toBeCloseTo(70);
        expect(first.y).toBeCloseTo(0);
        expect(last.x).toBeCloseTo(first.x);
        expect(last.y).toBeCloseTo(first.y);
        for (const p of circle) {
            expect(Math.hypot(p.x, p.y)).toBeCloseTo(70);
        }
    });

    it('samples an ellipse with its half-width and half-height', () => {
        const [mouth] = shapeOutlines(PART_SHAPES.mouth);
        const maxX = Math.max(...mouth.map((p) => p.x));
        const maxY = Math.max(...mouth.map((p) => p.y));
        expect(maxX).toBeCloseTo(23);
        expect(maxY).toBeCloseTo(9);
    });
});

describe('placePoints', () => {
    it('rotates by the part angle, then translates to the part position', () => {
        const [p] = placePoints([{ x: 1, y: 0 }], { x: 10, y: 5, rotation: Math.PI / 2 });
        expect(p.x).toBeCloseTo(10);
        expect(p.y).toBeCloseTo(6);
    });

    it('keeps points unchanged for a zero transform', () => {
        expect(placePoints([{ x: 3, y: -4 }], { x: 0, y: 0, rotation: 0 })).toEqual([{ x: 3, y: -4 }]);
    });
});

describe('dashSegments', () => {
    it('cuts a 40px line into dashes of 8px with 6px gaps, dropping the open tail', () => {
        const segments = dashSegments([
            { x: 0, y: 0 },
            { x: 40, y: 0 },
        ]);
        expect(segments).toEqual([
            [{ x: 0, y: 0 }, { x: 8, y: 0 }],
            [{ x: 14, y: 0 }, { x: 22, y: 0 }],
            [{ x: 28, y: 0 }, { x: 36, y: 0 }],
        ]);
    });

    it('keeps a dash that ends exactly at the end of the line (8px fits 8px)', () => {
        expect(
            dashSegments([
                { x: 0, y: 0 },
                { x: 8, y: 0 },
            ]),
        ).toEqual([[{ x: 0, y: 0 }, { x: 8, y: 0 }]]);
    });

    it('keeps a second dash that ends exactly at 22px (8 + 6 gap + 8)', () => {
        expect(
            dashSegments([
                { x: 0, y: 0 },
                { x: 22, y: 0 },
            ]),
        ).toEqual([
            [{ x: 0, y: 0 }, { x: 8, y: 0 }],
            [{ x: 14, y: 0 }, { x: 22, y: 0 }],
        ]);
    });

    it('gives the same dashes whether a straight line is split at a corner or not', () => {
        const straight = dashSegments([
            { x: 0, y: 0 },
            { x: 30, y: 0 },
        ]);
        const split = dashSegments([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 30, y: 0 },
        ]);
        expect(straight).toEqual([
            [{ x: 0, y: 0 }, { x: 8, y: 0 }],
            [{ x: 14, y: 0 }, { x: 22, y: 0 }],
        ]);
        expect(split).toEqual(straight);
    });

    it('carries the dash phase across a corner', () => {
        const segments = dashSegments([
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
        ]);
        expect(segments).toEqual([[{ x: 0, y: 0 }, { x: 8, y: 0 }]]);
    });

    it('gives the same dashes with or without a repeated point (zero-length step)', () => {
        const plain = dashSegments([
            { x: 0, y: 0 },
            { x: 40, y: 0 },
        ]);
        const repeated = dashSegments([
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 40, y: 0 },
        ]);
        expect(repeated).toEqual(plain);
    });

    it('uses the given dash and gap lengths (4 and 4)', () => {
        expect(
            dashSegments(
                [
                    { x: 0, y: 0 },
                    { x: 12, y: 0 },
                ],
                4,
                4,
            ),
        ).toEqual([
            [{ x: 0, y: 0 }, { x: 4, y: 0 }],
            [{ x: 8, y: 0 }, { x: 12, y: 0 }],
        ]);
    });

    it('keeps a gap that ends exactly at the line end (8 dash + 6 gap = 14)', () => {
        expect(
            dashSegments([
                { x: 0, y: 0 },
                { x: 14, y: 0 },
            ]),
        ).toEqual([[{ x: 0, y: 0 }, { x: 8, y: 0 }]]);
    });

    it('returns no segments for fewer than two points', () => {
        expect(dashSegments([])).toEqual([]);
        expect(dashSegments([{ x: 1, y: 1 }])).toEqual([]);
    });

    it('keeps every dash end on the ellipse of an eye (independent of the sampling code)', () => {
        // eyeL is an ellipse 30 x 22, so its outline is x^2/15^2 + y^2/11^2 = 1.
        // Chords between samples lie just inside it: 0.99 <= norm <= 1 for 48 samples.
        const [eye] = shapeOutlines(PART_SHAPES.eyeL);
        const segments = dashSegments(eye);
        expect(segments.length).toBeGreaterThan(0);
        for (const [from, to] of segments) {
            for (const p of [from, to]) {
                const norm = (p.x / 15) ** 2 + (p.y / 11) ** 2;
                if (norm < 0.99 || norm > 1 + 1e-9) {
                    expect.fail(`dash end (${p.x}, ${p.y}) has norm ${norm}, expected 0.99..1`);
                }
            }
        }
    });
});

describe('faceOverlaySegments', () => {
    it('keeps every dash end inside the face band y 138 to 282 at the Result face center', () => {
        // The outline circle has radius 70 around y 210, so its dashes sit at y 140 to 280;
        // the 3px stroke adds 1.5px on each side, giving 138.5 to 281.5 (docs/spec.md).
        const segments = faceOverlaySegments(correctFaceAtResult());
        expect(segments.length).toBeGreaterThan(0);
        for (const [from, to] of segments) {
            for (const p of [from, to]) {
                if (p.y < 138 || p.y > 282) {
                    expect.fail(`dash end y ${p.y} is outside 138..282`);
                }
            }
        }
    });

    it('draws the outline circle at the face center (every end about 70px from it)', () => {
        // Parts moved far away, so only the outline circle lands near the center.
        const transforms = correctFaceAtResult();
        for (const id of Object.keys(transforms) as PartId[]) {
            if (id !== 'outline') {
                transforms[id] = { x: FAR, y: 0, rotation: 0 };
            }
        }
        const nearCenter = faceOverlaySegments(transforms).filter(([from]) => Math.hypot(from.x, from.y - FACE_CENTER_Y) < 1000);
        expect(nearCenter.length).toBeGreaterThan(0);
        for (const [from, to] of nearCenter) {
            for (const p of [from, to]) {
                const distance = Math.hypot(p.x, p.y - FACE_CENTER_Y);
                if (distance < 69.8 || distance > 70.0001) {
                    expect.fail(`dash end ${distance} px from the center, expected 69.8..70`);
                }
            }
        }
    });

    it.each(['eyebrowL', 'eyebrowR', 'eyeL', 'eyeR', 'nose', 'mouth'] as const)(
        'draws %s near the face center when the other parts are moved away',
        (only) => {
            const transforms = correctFaceAtResult();
            for (const id of Object.keys(transforms) as PartId[]) {
                if (id !== only) {
                    transforms[id] = { x: FAR, y: 0, rotation: 0 };
                }
            }
            const segments = faceOverlaySegments(transforms);
            const nearPart = segments.filter(([from]) => Math.hypot(from.x, from.y - FACE_CENTER_Y) < 100);
            expect(nearPart.length).toBeGreaterThan(0);
        },
    );
});
