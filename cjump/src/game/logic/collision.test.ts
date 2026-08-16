import { describe, it, expect } from 'vitest';
import { isTouchingEdge } from './collision';

describe('isTouchingEdge', () => {
    it('is false well inside the circle', () => {
        expect(isTouchingEdge(0, 0, 0, 0, 100, 3)).toBe(false);
    });

    it('is false well outside the circle', () => {
        expect(isTouchingEdge(200, 0, 0, 0, 50, 3)).toBe(false);
    });

    it('is true exactly on the edge', () => {
        expect(isTouchingEdge(100, 0, 0, 0, 100, 3)).toBe(true);
    });

    it('is true just inside the tolerance band', () => {
        expect(isTouchingEdge(97.5, 0, 0, 0, 100, 3)).toBe(true);
    });

    it('is false just outside the tolerance band', () => {
        expect(isTouchingEdge(96, 0, 0, 0, 100, 3)).toBe(false);
    });
});
