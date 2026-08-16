import { describe, it, expect } from 'vitest';
import { createCircle, getRadius, isOffScreen, isWarning } from './circle';

const bounds = { width: 960, height: 600 };

describe('createCircle', () => {
    it('places the circle using the given rng, scaled to the screen bounds', () => {
        const values = [0.25, 0.75];
        let i = 0;
        const rng = () => values[i++];
        expect(createCircle(1, rng, bounds, 1000)).toEqual({ id: 1, x: 240, y: 450, spawnedAtMs: 1000 });
    });
});

describe('getRadius', () => {
    const circle = { id: 1, x: 0, y: 0, spawnedAtMs: 1000 };

    it('stays at 0 during the warning phase', () => {
        expect(getRadius(circle, 1000, 50, 500)).toBe(0);
        expect(getRadius(circle, 1300, 50, 500)).toBe(0);
        expect(getRadius(circle, 1499, 50, 500)).toBe(0);
    });

    it('grows linearly with elapsed time after the warning phase ends', () => {
        expect(getRadius(circle, 1500, 50, 500)).toBe(0);
        expect(getRadius(circle, 2500, 50, 500)).toBe(50);
        expect(getRadius(circle, 3500, 50, 500)).toBe(100);
    });

    it('never returns a negative radius when called before the spawn time', () => {
        expect(getRadius(circle, 500, 50, 500)).toBe(0);
    });
});

describe('isWarning', () => {
    const circle = { id: 1, x: 0, y: 0, spawnedAtMs: 1000 };

    it('is true immediately after spawn', () => {
        expect(isWarning(circle, 1000, 500)).toBe(true);
    });

    it('is true just before the warning duration elapses', () => {
        expect(isWarning(circle, 1499, 500)).toBe(true);
    });

    it('is false once the warning duration has elapsed', () => {
        expect(isWarning(circle, 1500, 500)).toBe(false);
    });
});

describe('isOffScreen', () => {
    const circle = { id: 1, x: 480, y: 300, spawnedAtMs: 0 };
    const maxCornerDist = Math.hypot(480, 300);

    it('is false while the ring still overlaps the screen', () => {
        expect(isOffScreen(circle, 10, bounds)).toBe(false);
    });

    it('is false exactly at the farthest corner distance', () => {
        expect(isOffScreen(circle, maxCornerDist, bounds)).toBe(false);
    });

    it('is true once the ring has grown past every corner', () => {
        expect(isOffScreen(circle, maxCornerDist + 1, bounds)).toBe(true);
    });
});
