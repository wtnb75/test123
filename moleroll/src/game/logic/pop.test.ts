import { describe, expect, it } from 'vitest';
import { IDENTITY } from './math';
import { isHittable, popHeight, remainingLife } from './pop';
import { popIn } from './testing';

describe('popHeight (life 2.2, pop in/out 0.18, height 0.3)', () => {
    it.each([
        [0, 0],
        [0.09, 0.15],
        [0.18, 0.3],
        [1.0, 0.3],
        [2.02, 0.3],
        [2.11, 0.15],
        [2.2, 0],
    ])('is %f s old → height %f', (age, expected) => {
        expect(popHeight(age)).toBeCloseTo(expected, 9);
    });

    it('never goes negative past the end of its life', () => {
        expect(popHeight(3)).toBe(0);
    });
});

describe('isHittable', () => {
    // On the +Z face (hole 40) seen from the identity pose; hittable needs a height of at least 0.09.
    it.each([
        [0.05, false],
        [0.06, true],
        [1.0, true],
        [2.14, true],
        [2.15, false],
        [2.16, false],
    ])('a Pop %f s old on a seen face: hittable = %s', (age, expected) => {
        expect(isHittable(popIn(40, 'mole', age), IDENTITY)).toBe(expected);
    });

    it('is not hittable on a face the camera does not see', () => {
        expect(isHittable(popIn(4, 'mole', 1), IDENTITY)).toBe(false); // +X face, edge-on
        expect(isHittable(popIn(49, 'cat', 1), IDENTITY)).toBe(false); // -Z face, behind
    });
});

describe('remainingLife', () => {
    it('is the life minus the age', () => {
        expect(remainingLife(popIn(0, 'mole', 0.7))).toBeCloseTo(1.5, 9);
    });
});
