import { describe, expect, it } from 'vitest';
import { firstTimeOnly, isImeCommitKey, keyName } from './keys';

describe('firstTimeOnly (Phaser re-delivers earlier key events when several arrive in one frame)', () => {
    it('lets an event through once and refuses it every time after', () => {
        const isNew = firstTimeOnly<object>();
        const e1 = {};
        expect(isNew(e1)).toBe(true);
        expect(isNew(e1)).toBe(false);
        expect(isNew(e1)).toBe(false);
    });

    it('treats different events as different, even with equal contents', () => {
        const isNew = firstTimeOnly<{ key: string }>();
        const a = { key: 'a' };
        const b = { key: 'a' };
        expect(isNew(a)).toBe(true);
        expect(isNew(b)).toBe(true);
        expect(isNew(a)).toBe(false);
    });

    it('keeps separate memories for separate filters', () => {
        const one = firstTimeOnly<object>();
        const two = firstTimeOnly<object>();
        const e = {};
        expect(one(e)).toBe(true);
        expect(two(e)).toBe(true);
    });

    it('delivers a queue of 3 events, replayed the way Phaser does, exactly 3 times in total', () => {
        const isNew = firstTimeOnly<object>();
        const queue: object[] = [];
        let delivered = 0;
        for (let n = 0; n < 3; n++) {
            queue.push({}); // an event arrives...
            for (const e of queue) if (isNew(e)) delivered++; // ...and Phaser replays the whole queue
        }
        expect(delivered).toBe(3);
    });
});

describe('isImeCommitKey (Enter / Space that confirm or convert IME text must not act as game keys)', () => {
    it('is true for Enter and Space while composing', () => {
        expect(isImeCommitKey('Enter', true)).toBe(true);
        expect(isImeCommitKey(' ', true)).toBe(true);
    });

    it('is false for Enter and Space when not composing', () => {
        expect(isImeCommitKey('Enter', false)).toBe(false);
        expect(isImeCommitKey(' ', false)).toBe(false);
    });

    it('is false for letters even while composing (the first letter of a word starts composition)', () => {
        expect(isImeCommitKey('A', true)).toBe(false);
        expect(isImeCommitKey('Backspace', true)).toBe(false);
    });
});

describe('keyName', () => {
    it('returns the key as the browser reports it', () => {
        expect(keyName({ key: 'a', code: 'KeyA' })).toBe('a');
        expect(keyName({ key: 'A', code: 'KeyA' })).toBe('A');
        expect(keyName({ key: 'Enter', code: 'Enter' })).toBe('Enter');
        expect(keyName({ key: ' ', code: 'Space' })).toBe(' ');
        expect(keyName({ key: 'Backspace', code: 'Backspace' })).toBe('Backspace');
        expect(keyName({ key: 'ArrowUp', code: 'ArrowUp' })).toBe('ArrowUp');
    });

    it('keeps the typed letter on a non-QWERTY layout (AZERTY: the physical KeyQ types "a")', () => {
        expect(keyName({ key: 'a', code: 'KeyQ' })).toBe('a');
    });

    it('recovers the letter from the physical key while a Japanese IME is on ("Process")', () => {
        expect(keyName({ key: 'Process', code: 'KeyA' })).toBe('A');
        expect(keyName({ key: 'Process', code: 'KeyZ' })).toBe('Z');
        expect(keyName({ key: 'Unidentified', code: 'KeyM' })).toBe('M');
    });

    it('recovers Enter, Space, Backspace and the arrows under an IME', () => {
        expect(keyName({ key: 'Process', code: 'Enter' })).toBe('Enter');
        expect(keyName({ key: 'Process', code: 'NumpadEnter' })).toBe('Enter');
        expect(keyName({ key: 'Process', code: 'Space' })).toBe(' ');
        expect(keyName({ key: 'Process', code: 'Backspace' })).toBe('Backspace');
        expect(keyName({ key: 'Process', code: 'ArrowDown' })).toBe('ArrowDown');
    });

    it('returns the key unchanged when an IME key has no code we use', () => {
        expect(keyName({ key: 'Process', code: 'Digit1' })).toBe('Process');
        expect(keyName({ key: 'Process', code: '' })).toBe('Process');
    });
});
