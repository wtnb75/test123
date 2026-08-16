import { createPrng } from './prng';

export interface Point {
    x: number;
    y: number;
}

export interface RouteBounds {
    width: number;
    height: number;
    margin: number;
}

const ANGLE_LIMIT_DEG = 80;
const SEGMENT_JITTER_MIN = 0.8;
const SEGMENT_JITTER_MAX = 1.2;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function generateWaypoints(
    seed: number,
    waypointCount: number,
    thetaMaxDeg: number,
    bounds: RouteBounds
): Point[] {
    const rng = createPrng(seed);
    const targetSpan = bounds.width - 2 * bounds.margin;
    const segmentCount = waypointCount - 1;
    const targetSegmentX = segmentCount > 0 ? targetSpan / segmentCount : 0;

    const points: Point[] = [{ x: bounds.margin, y: bounds.height / 2 }];
    let angleDeg = 0;

    for (let i = 1; i < waypointCount; i++) {
        const delta = (rng() * 2 - 1) * thetaMaxDeg;
        angleDeg = clamp(angleDeg + delta, -ANGLE_LIMIT_DEG, ANGLE_LIMIT_DEG);
        const rad = (angleDeg * Math.PI) / 180;
        const jitter = SEGMENT_JITTER_MIN + rng() * (SEGMENT_JITTER_MAX - SEGMENT_JITTER_MIN);
        const dist = (targetSegmentX * jitter) / Math.cos(rad);
        const prev = points[i - 1];
        points.push({
            x: prev.x + Math.cos(rad) * dist,
            y: clamp(prev.y + Math.sin(rad) * dist, bounds.margin, bounds.height - bounds.margin)
        });
    }

    return points;
}
