import { describe, it, expect } from 'vitest';
import { generateWaypoints, type RouteBounds } from './waypoints';

const bounds: RouteBounds = { width: 960, height: 600, margin: 60 };

describe('generateWaypoints', () => {
    it('is deterministic for the same seed and parameters', () => {
        const a = generateWaypoints(3, 8, 45, bounds);
        const b = generateWaypoints(3, 8, 45, bounds);
        expect(a).toEqual(b);
    });

    it('produces a different route for a different seed', () => {
        const a = generateWaypoints(1, 8, 45, bounds);
        const b = generateWaypoints(2, 8, 45, bounds);
        expect(a).not.toEqual(b);
    });

    it('returns exactly waypointCount points', () => {
        expect(generateWaypoints(5, 10, 60, bounds)).toHaveLength(10);
    });

    it('always progresses to the right, so the route cannot self-intersect', () => {
        const points = generateWaypoints(4, 12, 90, bounds);
        for (let i = 1; i < points.length; i++) {
            expect(points[i].x).toBeGreaterThan(points[i - 1].x);
        }
    });

    it('keeps every point within the vertical bounds minus margin', () => {
        const points = generateWaypoints(9, 12, 90, bounds);
        for (const point of points) {
            expect(point.y).toBeGreaterThanOrEqual(bounds.margin);
            expect(point.y).toBeLessThanOrEqual(bounds.height - bounds.margin);
        }
    });

    it('starts at the left margin, vertically centered', () => {
        const [start] = generateWaypoints(1, 4, 30, bounds);
        expect(start).toEqual({ x: bounds.margin, y: bounds.height / 2 });
    });
});
