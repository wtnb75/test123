import type { Point } from './waypoints';

export interface CircleObstacle {
    id: number;
    x: number;
    y: number;
    spawnedAtMs: number;
}

export interface ScreenBounds {
    width: number;
    height: number;
}

export function createCircle(id: number, center: Point, nowMs: number): CircleObstacle {
    return { id, x: center.x, y: center.y, spawnedAtMs: nowMs };
}

export function getRadius(
    circle: CircleObstacle,
    nowMs: number,
    growthSpeedPxPerSec: number,
    warningMs: number
): number {
    const elapsedSec = Math.max(nowMs - circle.spawnedAtMs - warningMs, 0) / 1000;
    return elapsedSec * growthSpeedPxPerSec;
}

export function isWarning(circle: CircleObstacle, nowMs: number, warningMs: number): boolean {
    return nowMs - circle.spawnedAtMs < warningMs;
}

export function isOffScreen(circle: CircleObstacle, radius: number, bounds: ScreenBounds): boolean {
    const corners: Array<[number, number]> = [
        [0, 0],
        [bounds.width, 0],
        [0, bounds.height],
        [bounds.width, bounds.height]
    ];
    const maxCornerDist = Math.max(...corners.map(([cx, cy]) => Math.hypot(circle.x - cx, circle.y - cy)));
    return radius > maxCornerDist;
}
