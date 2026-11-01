import { describe, expect, it } from 'vitest';
import { letterAtPoint, lowestLetterWithChar } from './targeting';

describe('letterAtPoint', () => {
    it('picks the letter whose centre is nearest when two tap areas overlap', () => {
        const left = { ch: 'A', x: 100, y: 100 };
        const right = { ch: 'B', x: 130, y: 100 };
        // 18 px from A, 12 px from B; both within the 25 px half-size
        expect(letterAtPoint([left, right], 118, 100)).toBe(right);
        expect(letterAtPoint([left, right], 112, 100)).toBe(left);
    });

    it('prefers the lower letter at an equal distance', () => {
        const upper = { ch: 'A', x: 100, y: 90 };
        const lower = { ch: 'B', x: 100, y: 110 };
        expect(letterAtPoint([upper, lower], 100, 100)).toBe(lower);
        expect(letterAtPoint([lower, upper], 100, 100)).toBe(lower);
    });

    it('hits exactly 25 px away (the edge of the 50 px tap area) but not 26', () => {
        const a = { ch: 'A', x: 100, y: 100 };
        expect(letterAtPoint([a], 125, 100)).toBe(a);
        expect(letterAtPoint([a], 100, 75)).toBe(a);
        expect(letterAtPoint([a], 125.1, 100)).toBeUndefined();
        expect(letterAtPoint([a], 100, 74.9)).toBeUndefined();
    });

    it('has a square tap area: its corners hit (24, 24 away) and just beyond them do not (26, 26 away)', () => {
        const a = { ch: 'A', x: 100, y: 100 };
        expect(letterAtPoint([a], 124, 124)).toBe(a);
        expect(letterAtPoint([a], 76, 76)).toBe(a);
        expect(letterAtPoint([a], 126, 126)).toBeUndefined();
        expect(letterAtPoint([a], 74, 74)).toBeUndefined();
    });

    it('returns undefined when nothing is falling', () => {
        expect(letterAtPoint([], 10, 10)).toBeUndefined();
    });
});

describe('lowestLetterWithChar', () => {
    it('picks the lowest (largest y) letter showing the key', () => {
        const high = { ch: 'A', x: 10, y: 50 };
        const low = { ch: 'A', x: 90, y: 200 };
        const other = { ch: 'B', x: 50, y: 300 };
        expect(lowestLetterWithChar([high, low, other], 'A')).toBe(low);
        expect(lowestLetterWithChar([low, high, other], 'A')).toBe(low);
    });

    it('returns undefined when the letter is not falling', () => {
        expect(lowestLetterWithChar([{ ch: 'B', x: 0, y: 0 }], 'A')).toBeUndefined();
        expect(lowestLetterWithChar([], 'A')).toBeUndefined();
    });
});
