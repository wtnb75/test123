import { describe, expect, it } from 'vitest';
import { scoreFor } from './scoring';

describe('scoreFor', () => {
    it('is length x 10 with no combo (3 letters 30, 8 letters 80)', () => {
        expect(scoreFor(3, 0)).toBe(30);
        expect(scoreFor(8, 0)).toBe(80);
    });

    it('multiplies by 1 + combo x 0.1 (5 letters at combo 5 -> 75)', () => {
        expect(scoreFor(5, 5)).toBe(75);
    });

    it('rounds to a whole number (3 letters at combo 3 -> 39)', () => {
        expect(scoreFor(3, 3)).toBe(39);
    });

    it('reaches the x3 cap at combo 20 and stays there (4 letters -> 120)', () => {
        expect(scoreFor(4, 19)).toBe(116);
        expect(scoreFor(4, 20)).toBe(120);
        expect(scoreFor(4, 25)).toBe(120);
    });
});
