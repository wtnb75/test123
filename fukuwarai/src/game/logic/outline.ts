import { RESULT_OVERLAY_DASH_PX, RESULT_OVERLAY_GAP_PX } from './constants';
import { FACE_IDS, PART_SHAPES, type PartShape } from './parts';
import type { PartId, PartTransform, Point } from './types';

// Outline of a face drawn as a dashed line, for the Result overlay
// (docs/spec.md「Result の重ね表示」). Pure: no Phaser, so it can be unit-tested.
// Phaser's Graphics has no dashed stroke, so the outline is sampled into
// points and cut into dashes here.

const CURVE_SAMPLES = 48;

/** Closed outline of a part shape centered on (0, 0), as polylines (the first point is repeated at the end). */
export function shapeOutlines(shape: PartShape): Point[][] {
    const { w, h } = shape.size;
    if (shape.kind === 'triangle') {
        const vertices = [
            { x: 0, y: -h / 2 },
            { x: -w / 2, y: h / 2 },
            { x: w / 2, y: h / 2 },
        ];
        return [[...vertices, vertices[0]]];
    }
    const points: Point[] = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
        const angle = (Math.PI * 2 * i) / CURVE_SAMPLES;
        points.push({ x: (w / 2) * Math.cos(angle), y: (h / 2) * Math.sin(angle) });
    }
    return [points];
}

/** Moves a polyline by a part transform: rotate around the origin, then translate (the same order as drawing.ts). */
export function placePoints(points: Point[], t: PartTransform): Point[] {
    const cos = Math.cos(t.rotation);
    const sin = Math.sin(t.rotation);
    return points.map((p) => ({
        x: t.x + p.x * cos - p.y * sin,
        y: t.y + p.x * sin + p.y * cos,
    }));
}

function lerpPoint(a: Point, b: Point, t: number): Point {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Cuts a polyline into dash segments: draw `dash` px, skip `gap` px, repeat.
 * The dash phase carries over corners. A dash still open at the end of the
 * line is dropped, so a closed outline may leave one gap at its seam.
 */
export function dashSegments(
    points: Point[],
    dash = RESULT_OVERLAY_DASH_PX,
    gap = RESULT_OVERLAY_GAP_PX,
): [Point, Point][] {
    const segments: [Point, Point][] = [];
    if (points.length < 2) {
        return segments;
    }
    let drawing = true;
    let phaseLeft = dash;
    let start = points[0];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        // A repeated point adds no length. The loop below cannot run for it
        // anyway (phaseLeft stays above 0 for dash > 0), so this only avoids a NaN.
        if (length === 0) {
            continue;
        }
        let travelled = 0;
        while (length - travelled >= phaseLeft) {
            travelled += phaseLeft;
            const at = lerpPoint(a, b, travelled / length);
            if (drawing) {
                segments.push([start, at]);
            } else {
                start = at;
            }
            drawing = !drawing;
            phaseLeft = drawing ? dash : gap;
        }
        phaseLeft -= length - travelled;
    }
    return segments;
}

/**
 * The whole face overlay: the outline circle and the 6 parts, each placed by
 * its transform (relative to the face center, the origin here) and cut into
 * dashes. The caller only draws the returned segments.
 */
export function faceOverlaySegments(
    transforms: Record<PartId, PartTransform>,
    dash = RESULT_OVERLAY_DASH_PX,
    gap = RESULT_OVERLAY_GAP_PX,
): [Point, Point][] {
    const segments: [Point, Point][] = [];
    for (const id of FACE_IDS) {
        for (const line of shapeOutlines(PART_SHAPES[id])) {
            segments.push(...dashSegments(placePoints(line, transforms[id]), dash, gap));
        }
    }
    return segments;
}
