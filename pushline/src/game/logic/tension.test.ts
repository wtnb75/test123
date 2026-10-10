import { describe, expect, it } from 'vitest';
import { tensionOf } from './tension';

describe('tensionOf', () => {
    it.each([
        [40, 'none'], [30, 'none'], [11, 'none'],
        [10, 'warn'], [9, 'warn'], [6, 'warn'],
        [5, 'critical'], [4, 'critical'], [1, 'critical'], [0, 'critical'],
    ])('with %i moves left it is %s', (moves, expected) => {
        expect(tensionOf(moves)).toBe(expected);
    });
});
