import { describe, expect, it } from 'vitest';
import { focusIndexAfterRemove } from './rows';

describe('focusIndexAfterRemove', () => {
    it('focuses the row that moved into the removed position (first row of 2 → index 0)', () => {
        expect(focusIndexAfterRemove(0, 2)).toBe(0);
    });

    it('focuses the row that moved into the removed position (middle row of 3 → index 1)', () => {
        expect(focusIndexAfterRemove(1, 3)).toBe(1);
    });

    it('focuses the new last row when the last row was removed (2 rows left → index 1)', () => {
        expect(focusIndexAfterRemove(2, 2)).toBe(1);
    });

    it('focuses the next row after removing a row near the end (index 4 of 5 left)', () => {
        expect(focusIndexAfterRemove(4, 5)).toBe(4);
    });

    it('focuses the new last row when the removed index equals the new count (5 → index 4)', () => {
        expect(focusIndexAfterRemove(5, 5)).toBe(4);
    });

    it('returns 0 when only one row is left', () => {
        expect(focusIndexAfterRemove(0, 1)).toBe(0);
    });

    it('returns 0 without throwing when no row is left', () => {
        expect(focusIndexAfterRemove(0, 0)).toBe(0);
        expect(focusIndexAfterRemove(3, 0)).toBe(0);
    });
});
