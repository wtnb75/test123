import { describe, expect, it } from 'vitest';
import { GAMEOVER_TITLE_H, GAMEOVER_TITLE_OFFSET, GAMEOVER_TITLE_W } from './constants';
import { GAMEOVER_INPUT_LOCK, RetryInput, TITLE_KEY_CODE, inRect } from './retry';

// The TITLE button and key T on the game-over screen (docs/spec.md, GameOver 画面 / 入力).
const T = TITLE_KEY_CODE;
const SPACE = 32;
const AFTER_LOCK = GAMEOVER_INPUT_LOCK + 0.01;

describe('TITLE button geometry (spec: 200 × 48 px, 60 px below the hint)', () => {
    it('uses the spec numbers', () => {
        expect(GAMEOVER_TITLE_W).toBe(200);
        expect(GAMEOVER_TITLE_H).toBe(48);
        expect(GAMEOVER_TITLE_OFFSET).toBe(60);
        expect(T).toBe(84);
    });
});

describe('inRect（矩形の内側は左上の角を含み、右下の辺を含まない）', () => {
    const left = 100;
    const top = 500;
    const w = 200;
    const h = 48;

    it('the top-left corner is inside', () => {
        expect(inRect(left, top, left, top, w, h)).toBe(true);
    });

    it('a point just inside the bottom-right is inside', () => {
        expect(inRect(left + w - 0.5, top + h - 0.5, left, top, w, h)).toBe(true);
    });

    it('the right edge (x = left + width) is outside', () => {
        expect(inRect(left + w, top + 10, left, top, w, h)).toBe(false);
    });

    it('the bottom edge (y = top + height) is outside', () => {
        expect(inRect(left + 10, top + h, left, top, w, h)).toBe(false);
    });

    it('a point just left of or above the rectangle is outside', () => {
        expect(inRect(left - 0.01, top + 10, left, top, w, h)).toBe(false);
        expect(inRect(left + 10, top - 0.01, left, top, w, h)).toBe(false);
    });
});

describe('RetryInput.resolveExit: where a game-over press leads', () => {
    it('a fresh T press after the lock goes to Title', () => {
        const input = new RetryInput();
        input.keyDown(T, false);
        expect(input.resolveExit(AFTER_LOCK)).toBe('title');
    });

    it('a tap on the TITLE button goes to Title', () => {
        const input = new RetryInput();
        input.pointerDown(true);
        expect(input.resolveExit(AFTER_LOCK)).toBe('title');
    });

    it('a tap elsewhere retries (goes to Game)', () => {
        const input = new RetryInput();
        input.pointerDown(false);
        expect(input.resolveExit(AFTER_LOCK)).toBe('game');
    });

    it('a retry key still goes to Game', () => {
        const input = new RetryInput();
        input.keyDown(SPACE, false);
        expect(input.resolveExit(AFTER_LOCK)).toBe('game');
    });

    it('when a TITLE press and a retry press arrive in the same frame, Title wins', () => {
        const input = new RetryInput();
        input.keyDown(SPACE, false);
        input.pointerDown(true);
        expect(input.resolveExit(AFTER_LOCK)).toBe('title');
    });

    it('nothing pressed gives null', () => {
        expect(new RetryInput().resolveExit(AFTER_LOCK)).toBeNull();
    });
});

describe('TITLE input follows the same rules as retry', () => {
    it('T pressed during the lock (1.15 s) is ignored, and the press is forgotten', () => {
        const input = new RetryInput();
        input.keyDown(T, false);
        expect(input.resolveExit(GAMEOVER_INPUT_LOCK - 0.01)).toBeNull();
        expect(input.resolveExit(AFTER_LOCK)).toBeNull();
    });

    it('a TITLE tap during the lock is ignored, and the tap is forgotten', () => {
        const input = new RetryInput();
        input.pointerDown(true);
        expect(input.resolveExit(1)).toBeNull();
        expect(input.resolveExit(AFTER_LOCK)).toBeNull();
    });

    it('a T key that is only auto-repeating (held down) does nothing', () => {
        const input = new RetryInput();
        input.keyDown(T, false); // the first press, judged during the lock
        input.resolveExit(1);
        input.keyDown(T, true); // auto-repeat after the lock
        expect(input.resolveExit(AFTER_LOCK)).toBeNull();
    });

    it('fires at most once: a second TITLE press after leaving does nothing', () => {
        const input = new RetryInput();
        input.keyDown(T, false);
        expect(input.resolveExit(AFTER_LOCK)).toBe('title');
        input.keyDown(T, false);
        expect(input.resolveExit(AFTER_LOCK + 1)).toBeNull();
    });

    it('resolve() reports true only for a retry (Game), not for a TITLE press', () => {
        const input = new RetryInput();
        input.keyDown(T, false);
        expect(input.resolve(AFTER_LOCK)).toBe(false);
    });
});
