import { describe, expect, it } from 'vitest';
import { createEmptyBoxes, resolvePlacement, resolveTimeout } from './primtris';

describe('resolveTimeout (a number the timer drops is a miss wherever it lands)', () => {
    it('a correct box does not clear digits on a time-out: the digits stay as a miss', () => {
        // 14 is correct for x2; dropped by the timer it stays as 1 and 4 in x2
        const result = resolveTimeout(14, 'x2', createEmptyBoxes(), 12);
        expect(result.isCorrect).toBe(false);
        expect(result.clearedDigits).toEqual([]);
        expect(result.boxes.x2).toEqual([1, 4]);
        expect(result.scoreDelta).toBe(1);
    });

    it('the same number placed by hand into the correct box clears instead (the rule is unchanged)', () => {
        const result = resolvePlacement(14, 'x2', createEmptyBoxes(), 12);
        expect(result.isCorrect).toBe(true);
        expect(result.boxes.x2).toEqual([]);
    });

    it('a time-out drop that overflows the box is game over, as a manual miss is', () => {
        const boxes = createEmptyBoxes();
        boxes.x2 = [9, 9];
        const result = resolveTimeout(14, 'x2', boxes, 3);
        expect(result.boxes.x2).toEqual([9, 9, 1, 4]);
        expect(result.gameOver).toBe(true);
    });

    it('does not change the boxes it was given', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 4];
        const before = JSON.stringify(boxes);
        resolveTimeout(12, 'x3', boxes, 12);
        expect(JSON.stringify(boxes)).toBe(before);
    });
});
