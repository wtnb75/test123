import { SPLINE_ARC_DIVISIONS } from './constants';
import type { Point } from './waypoints';

// Phaser-free copy of the curve the Game scene walks: Phaser.Curves.Path#splineTo (one Curves.Spline),
// with its arc-length lookup (Curve#getLengths / getUtoTmapping / getPointAt, arcLengthDivisions = 100).

function catmullRom(f: number, p0: number, p1: number, p2: number, p3: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const f2 = f * f;
    const f3 = f * f2;
    return (2 * p1 - 2 * p2 + v0 + v1) * f3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * f2 + v0 * f + p1;
}

// Point at the curve parameter w (0-1, clamped). The curve passes through every control point.
export function splinePointAtParam(points: Point[], w: number): Point {
    const last = points.length - 1;
    const x = last * Math.min(Math.max(w, 0), 1);
    const i = Math.floor(x);
    const f = x - i;
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i > last - 1 ? last : i + 1];
    const p3 = points[i > last - 2 ? last : i + 2];
    return { x: catmullRom(f, p0.x, p1.x, p2.x, p3.x), y: catmullRom(f, p0.y, p1.y, p2.y, p3.y) };
}

export interface SplineRoute {
    length: number;
    // Position at a ratio (0-1, clamped) of the arc length from the first control point.
    pointAt: (ratio: number) => Point;
}

export function createSplineRoute(points: Point[]): SplineRoute {
    // Cumulative chord lengths at w = k / SPLINE_ARC_DIVISIONS.
    const table: number[] = [0];
    let previous = splinePointAtParam(points, 0);
    for (let k = 1; k <= SPLINE_ARC_DIVISIONS; k++) {
        const current = splinePointAtParam(points, k / SPLINE_ARC_DIVISIONS);
        table.push(table[k - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
        previous = current;
    }
    const length = table[SPLINE_ARC_DIVISIONS];

    const parameterAt = (ratio: number): number => {
        const target = Math.min(Math.max(ratio, 0), 1) * length;
        // Largest index whose cumulative length is below the target (the exact match wins).
        let low = 0;
        let high = SPLINE_ARC_DIVISIONS;
        while (low <= high) {
            const mid = Math.floor(low + (high - low) / 2);
            const diff = table[mid] - target;
            if (diff < 0) {
                low = mid + 1;
            } else if (diff > 0) {
                high = mid - 1;
            } else {
                high = mid;
                break;
            }
        }
        const k = Math.max(high, 0);
        if (table[k] === target) {
            return k / SPLINE_ARC_DIVISIONS;
        }
        const span = table[k + 1] - table[k];
        return (k + (target - table[k]) / span) / SPLINE_ARC_DIVISIONS;
    };

    return {
        length,
        pointAt: (ratio) => (length === 0 ? { ...points[0] } : splinePointAtParam(points, parameterAt(ratio)))
    };
}
