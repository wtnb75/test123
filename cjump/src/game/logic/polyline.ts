import type { Point } from './waypoints';

// Length of the straight lines through the control points. The route seed table was chosen by this length,
// and the seed tests verify it with it; the measured travel time uses the spline length instead.
export function polylineLength(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
}
