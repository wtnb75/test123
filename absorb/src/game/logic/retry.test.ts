import { describe, expect, it } from 'vitest';
import { lineAlpha } from './breakdown';
import { GAMEOVER_INPUT_LOCK, RETRY_KEY_CODES, RetryInput, hintAlpha, retryEnabled } from './retry';

// Expected values are worked out by hand from the spec: 9 staggered lines (7 kinds, bonus, total), the
// total starts at 8 × 0.12 = 0.96 s and is fully shown at 0.96 + 0.2 = 1.16 s, which is when retry opens;
// the hint then fades in linearly over 0.2 s (0.5 at 1.26 s, 1 from 1.36 s).
// DOM key codes: Space 32, X 88, Enter 13, R 82.
const SPACE = 32;
const X = 88;
const ENTER = 13;
const R = 82;
const LOCK = 1.16;
const TOTAL_LINE = 8;

describe('retry lock on the game-over screen', () => {
    it('lasts 1.16 s', () => {
        expect(GAMEOVER_INPUT_LOCK).toBeCloseTo(LOCK, 9);
    });

    it('ends exactly when the total line becomes fully opaque', () => {
        expect(lineAlpha(GAMEOVER_INPUT_LOCK, TOTAL_LINE)).toBe(1);
        expect(lineAlpha(1.15, TOTAL_LINE)).toBeLessThan(1);
    });

    it('ignores retry at 0 s and at 1.15 s', () => {
        expect(retryEnabled(0)).toBe(false);
        expect(retryEnabled(1.15)).toBe(false);
    });

    it('accepts retry from exactly 1.16 s, tolerating float drift from summed frame deltas', () => {
        expect(retryEnabled(1.16)).toBe(true);
        expect(retryEnabled(1.16 - 1e-12)).toBe(true);
        expect(retryEnabled(1.16 - 1e-4)).toBe(false);
        expect(retryEnabled(5)).toBe(true);
    });
});

describe('retry hint opacity', () => {
    it('is hidden before the lock ends and at the moment it ends', () => {
        expect(hintAlpha(0)).toBe(0);
        expect(hintAlpha(1.15)).toBe(0);
        expect(hintAlpha(LOCK)).toBeCloseTo(0, 9);
    });

    it('fades in linearly over 0.2 s after the lock ends', () => {
        expect(hintAlpha(1.21)).toBeCloseTo(0.25, 9);
        expect(hintAlpha(1.26)).toBeCloseTo(0.5, 9);
    });

    it('stays fully shown from 1.36 s on', () => {
        expect(hintAlpha(1.36)).toBe(1);
        expect(hintAlpha(1.36 - 1e-12)).toBe(1);
        expect(hintAlpha(1.36 - 1e-4)).toBeLessThan(1);
        expect(hintAlpha(10)).toBe(1);
    });
});

describe('retry input', () => {
    it('uses the release keys Space, X and Enter and not R', () => {
        expect([...RETRY_KEY_CODES].sort((a, b) => a - b)).toEqual([ENTER, SPACE, X]);
    });

    // One frame: record a keydown, then judge it at the frame's elapsed time `t`.
    const keyFrame = (input: RetryInput, code: number, repeat: boolean, t: number) => {
        input.keyDown(code, repeat);
        return input.resolve(t);
    };
    const tapFrame = (input: RetryInput, t: number) => {
        input.pointerDown();
        return input.resolve(t);
    };

    it.each([['Space', SPACE], ['X', X], ['Enter', ENTER]])('retries on a fresh %s press after the lock', (_name, code) => {
        expect(keyFrame(new RetryInput(), code, false, LOCK)).toBe(true);
    });

    it('does not retry on R even after the lock', () => {
        expect(keyFrame(new RetryInput(), R, false, 2)).toBe(false);
    });

    it('ignores a fresh key press during the lock', () => {
        expect(keyFrame(new RetryInput(), SPACE, false, 1.15)).toBe(false);
    });

    it('judges input at the elapsed time of the frame it arrives in, so the frame reaching the lock accepts it', () => {
        // Input arrives before update; that frame's update moves elapsed from 1.15 s to 1.166 s.
        const input = new RetryInput();
        expect(input.resolve(1.15)).toBe(false);
        input.keyDown(SPACE, false);
        expect(input.resolve(1.166)).toBe(true);
    });

    it('does not carry a press made during the lock over to a later frame', () => {
        const input = new RetryInput();
        expect(keyFrame(input, SPACE, false, 1.0)).toBe(false);
        expect(input.resolve(2)).toBe(false);
    });

    it('does nothing in a frame without input', () => {
        expect(new RetryInput().resolve(2)).toBe(false);
    });

    it('ignores a key pressed during the lock and still held after it, until it is pressed again', () => {
        const input = new RetryInput();
        expect(keyFrame(input, SPACE, false, 0.5)).toBe(false);
        expect(keyFrame(input, SPACE, true, 1.2)).toBe(false); // auto-repeat while held
        expect(keyFrame(input, SPACE, true, 3)).toBe(false);
        expect(keyFrame(input, SPACE, false, 3.1)).toBe(true); // released and pressed again
    });

    it('ignores a key held since the game, which only sends auto-repeat', () => {
        const input = new RetryInput();
        expect(keyFrame(input, X, true, 0.1)).toBe(false);
        expect(keyFrame(input, X, true, 2)).toBe(false);
    });

    it('ignores a click or tap during the lock and accepts one after it', () => {
        const input = new RetryInput();
        expect(tapFrame(input, 1.15)).toBe(false);
        expect(tapFrame(input, LOCK)).toBe(true);
    });

    it('retries only once when several inputs arrive in the same frame', () => {
        const input = new RetryInput();
        input.keyDown(SPACE, false);
        input.keyDown(ENTER, false);
        input.pointerDown();
        expect(input.resolve(2)).toBe(true);
        input.pointerDown();
        expect(input.resolve(2.02)).toBe(false);
    });

    it('retries only once when more input follows in later frames', () => {
        const input = new RetryInput();
        expect(tapFrame(input, 2)).toBe(true);
        expect(keyFrame(input, SPACE, false, 2.02)).toBe(false);
    });
});
