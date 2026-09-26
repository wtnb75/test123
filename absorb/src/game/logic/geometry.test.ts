import { describe, expect, it } from 'vitest';
import {
    angleTo, circlesOverlap, distanceSq, isFullyOffScreen, isOnScreen, normalizeAngle, randomRange, removeWhere,
    turnToward
} from './geometry';

const S = { width: 1024, height: 768 };

describe('distanceSq / circlesOverlap', () => {
    it('returns the squared distance between two points', () => {
        expect(distanceSq(0, 0, 3, 4)).toBe(25);
    });

    it('treats circles that exactly touch as overlapping', () => {
        expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 25, y: 0 }, 15)).toBe(true);
    });

    it('does not overlap once the gap is any wider than the radii', () => {
        expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 25.01, y: 0 }, 15)).toBe(false);
    });
});

describe('angleTo', () => {
    it('points straight down (+PI/2) toward a target below', () => {
        expect(angleTo({ x: 5, y: 5 }, { x: 5, y: 50 })).toBeCloseTo(Math.PI / 2);
    });
});

describe('normalizeAngle', () => {
    it('wraps angles above PI into (-PI, PI]', () => {
        expect(normalizeAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    });

    it('wraps angles at or below -PI into (-PI, PI]', () => {
        expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
        expect(normalizeAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    });

    it('keeps angles already in range', () => {
        expect(normalizeAngle(1)).toBe(1);
    });
});

describe('turnToward', () => {
    it('snaps to the target when it is within one step', () => {
        expect(turnToward(0, 0.1, 0.2)).toBe(0.1);
    });

    it('turns by exactly one step toward a farther target', () => {
        expect(turnToward(0, 1, 0.2)).toBeCloseTo(0.2);
        expect(turnToward(0, -1, 0.2)).toBeCloseTo(-0.2);
    });

    it('turns the short way around across the ±PI seam', () => {
        // From just below +PI to just above -PI the short way is to keep increasing.
        expect(turnToward(Math.PI - 0.1, -Math.PI + 0.1, 0.05)).toBeCloseTo(Math.PI - 0.05);
    });
});

describe('isOnScreen / isFullyOffScreen', () => {
    it('counts points on the screen edges as on screen', () => {
        expect(isOnScreen({ x: 0, y: 0 }, S)).toBe(true);
        expect(isOnScreen({ x: 1024, y: 768 }, S)).toBe(true);
    });

    it('counts points just past any edge as off screen', () => {
        expect(isOnScreen({ x: -0.1, y: 10 }, S)).toBe(false);
        expect(isOnScreen({ x: 1024.1, y: 10 }, S)).toBe(false);
        expect(isOnScreen({ x: 10, y: -0.1 }, S)).toBe(false);
        expect(isOnScreen({ x: 10, y: 768.1 }, S)).toBe(false);
    });

    it('reports a circle as fully off screen only once it has cleared the edge by its radius', () => {
        expect(isFullyOffScreen({ x: -10, y: 100 }, 10, S)).toBe(false);
        expect(isFullyOffScreen({ x: -10.1, y: 100 }, 10, S)).toBe(true);
        expect(isFullyOffScreen({ x: 1034.1, y: 100 }, 10, S)).toBe(true);
        expect(isFullyOffScreen({ x: 100, y: -10.1 }, 10, S)).toBe(true);
        expect(isFullyOffScreen({ x: 100, y: 778.1 }, 10, S)).toBe(true);
    });
});

describe('randomRange', () => {
    it('maps the rng range [0, 1) onto [min, max)', () => {
        expect(randomRange(() => 0, 5, 7)).toBe(5);
        expect(randomRange(() => 0.5, 5, 7)).toBe(6);
    });
});

describe('removeWhere', () => {
    it('removes matching items in place and keeps the order of the rest', () => {
        const items = [1, 2, 3, 4, 5];
        const same = items;
        removeWhere(items, (n) => n % 2 === 0);
        expect(items).toBe(same);
        expect(items).toEqual([1, 3, 5]);
    });
});
