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
const SEGMENT_LENGTH_RATIO_MIN = 0.08;
const SEGMENT_LENGTH_RATIO_MAX = 0.18;

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
    const shortSide = Math.min(bounds.width, bounds.height);
    const minDist = shortSide * SEGMENT_LENGTH_RATIO_MIN;
    const maxDist = shortSide * SEGMENT_LENGTH_RATIO_MAX;

    const points: Point[] = [{ x: bounds.margin, y: bounds.height / 2 }];
    let angleDeg = 0;

    for (let i = 1; i < waypointCount; i++) {
        const delta = (rng() * 2 - 1) * thetaMaxDeg;
        angleDeg = clamp(angleDeg + delta, -ANGLE_LIMIT_DEG, ANGLE_LIMIT_DEG);
        const dist = minDist + rng() * (maxDist - minDist);
        const rad = (angleDeg * Math.PI) / 180;
        const prev = points[i - 1];
        points.push({
            x: prev.x + Math.cos(rad) * dist,
            y: clamp(prev.y + Math.sin(rad) * dist, bounds.margin, bounds.height - bounds.margin)
        });
    }

    return points;
}
