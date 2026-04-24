import { describe, expect, it } from 'vitest';
import { INVALID_LENGTH_MESSAGE, INVALID_PRIME_MESSAGE, validateGuess } from './validate';

describe('validateGuess', () => {
    it('Enter 検証順序は桁数が先', () => {
        const result = validateGuess('12', 4);
        expect(result).toEqual({ ok: false, message: INVALID_LENGTH_MESSAGE });
    });

    it('桁数が一致しても素数でなければ拒否', () => {
        const result = validateGuess('1000', 4);
        expect(result.ok).toBe(false);
        expect(result.message).toContain(INVALID_PRIME_MESSAGE);
        expect(result.message).toContain('1000 = 2 x 2 x 2 x 5 x 5 x 5');
    });

    it('非素数は素因数分解を表示する', () => {
        const result = validateGuess('15', 2);
        expect(result.ok).toBe(false);
        expect(result.message).toContain('15 = 3 x 5');
    });

    it('非数字はヒントなしで拒否される', () => {
        const result = validateGuess('1a', 2);
        expect(result.ok).toBe(false);
        expect(result.message).toBe(INVALID_PRIME_MESSAGE);
    });

    it('1 以下相当の値はヒントなしで拒否される', () => {
        const result = validateGuess('01', 2);
        expect(result.ok).toBe(false);
        expect(result.message).toBe(INVALID_PRIME_MESSAGE);
    });

    it('有効な素数入力を受理', () => {
        const result = validateGuess('1013', 4);
        expect(result).toEqual({ ok: true });
    });
});
