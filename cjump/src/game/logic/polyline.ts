import type { Point } from './waypoints';

export function polylineLength(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
}

// Position at a ratio (0-1, clamped) of the arc length from the first point.
export function polylinePointAt(points: Point[], ratio: number): Point {
    const total = polylineLength(points);
    if (points.length === 1 || total === 0) {
        return { ...points[0] };
    }
    const target = Math.min(Math.max(ratio, 0), 1) * total;
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const segment = Math.hypot(b.x - a.x, b.y - a.y);
        if (walked + segment >= target) {
            const f = segment === 0 ? 0 : (target - walked) / segment;
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
        walked += segment;
    }
    return { ...points[points.length - 1] };
}
