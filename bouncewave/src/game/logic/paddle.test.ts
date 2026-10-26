import { describe, expect, it } from 'vitest';
import { clampPaddle, nextPaddleX } from './paddle';

describe('clampPaddle', () => {
    it('keeps the paddle center between the walls: [8 + 55, 532 - 55] = [63, 477]', () => {
        expect(clampPaddle(0)).toBe(63);
        expect(clampPaddle(63)).toBe(63);
        expect(clampPaddle(300)).toBe(300);
        expect(clampPaddle(477)).toBe(477);
        expect(clampPaddle(600)).toBe(477);
    });
});

describe('nextPaddleX', () => {
    it('jumps to a pointer that touched or moved this frame, even with a key held', () => {
        expect(nextPaddleX(270, 400, true, false, 0.1)).toBe(400);
    });

    it('clamps the pointer position', () => {
        expect(nextPaddleX(270, 0, false, false, 0.1)).toBe(63);
        expect(nextPaddleX(270, 540, false, false, 0.1)).toBe(477);
    });

    it('moves left at 720 px/s while only left is held', () => {
        expect(nextPaddleX(270, null, true, false, 0.1)).toBeCloseTo(198, 10);
    });

    it('moves right at 720 px/s while only right is held', () => {
        expect(nextPaddleX(270, null, false, true, 0.1)).toBeCloseTo(342, 10);
    });

    it('stays put with both arrows held, or with none', () => {
        expect(nextPaddleX(270, null, true, true, 0.1)).toBe(270);
        expect(nextPaddleX(270, null, false, false, 0.1)).toBe(270);
    });

    it('stops at the left wall under a key', () => {
        expect(nextPaddleX(70, null, true, false, 0.1)).toBe(63);
    });

    it('stops at the right wall under a key', () => {
        expect(nextPaddleX(470, null, false, true, 0.1)).toBe(477);
    });
});
