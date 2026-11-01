import { describe, expect, it } from 'vitest';
import { clampPopX, heartsLost, lockBandRect, popText } from './effects';
import { scoreFor } from './scoring';

describe('popText', () => {
    it('is + and the whole points: 3 letters at combo 0 -> +30, 4 letters at combo 20 -> +120', () => {
        expect(popText(scoreFor(3, 0))).toBe('+30');
        expect(popText(scoreFor(4, 20))).toBe('+120');
    });
});

describe('clampPopX', () => {
    // A text 40 wide keeps 8 from each edge: its centre stays within [28, 332] of the 360 width.
    it('keeps a pop-up at the left edge 8 px inside (centre 10 -> 28)', () => {
        expect(clampPopX(10, 40)).toBe(28);
    });

    it('keeps a pop-up at the right edge 8 px inside (centre 350 -> 332)', () => {
        expect(clampPopX(350, 40)).toBe(332);
    });

    it('leaves a centre that already fits alone, including the exact limits', () => {
        expect(clampPopX(180, 40)).toBe(180);
        expect(clampPopX(28, 40)).toBe(28);
        expect(clampPopX(332, 40)).toBe(332);
    });
});

describe('lockBandRect', () => {
    it('starts 4 left of the word and is 8 wider than its letters (cat at x 10 -> left 6, width 47)', () => {
        expect(lockBandRect(10, 3)).toEqual({ x: 6, width: 47 });
    });

    it('grows 13 per letter (8 letters at x 8 -> left 4, width 112)', () => {
        expect(lockBandRect(8, 8)).toEqual({ x: 4, width: 112 });
    });
});

describe('heartsLost', () => {
    it('is the drop in lives: 3 -> 2 is 1, 3 -> 1 (two words at once) is 2, 1 -> 0 is 1', () => {
        expect(heartsLost(3, 2)).toBe(1);
        expect(heartsLost(3, 1)).toBe(2);
        expect(heartsLost(1, 0)).toBe(1);
    });

    it('is 0 when the lives did not drop and never negative', () => {
        expect(heartsLost(2, 2)).toBe(0);
        expect(heartsLost(2, 3)).toBe(0);
    });
});
