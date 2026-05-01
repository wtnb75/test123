import { describe, expect, it } from 'vitest';
import {
    HARD_MODE_GREEN_MESSAGE,
    HARD_MODE_YELLOW_MESSAGE,
    INVALID_LENGTH_MESSAGE,
    INVALID_PRIME_MESSAGE,
    validateGuess,
    validateHardMode
} from './validate';
import type { DigitStatus } from '../types';

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

describe('validateHardMode', () => {
    const makeHistory = (guess: string, colors: DigitStatus[]) => [{ guess, colors }];

    it('履歴なしは常に ok', () => {
        expect(validateHardMode('1013', [])).toEqual({ ok: true });
    });

    it('green 位置を維持すれば ok', () => {
        // guess='1009', answer='1013' -> positions 0='1'(green),1='0'(green)
        const history = makeHistory('1009', ['green', 'green', 'yellow', 'gray']);
        // '1019': 位置0='1',位置1='0' を維持
        expect(validateHardMode('1019', history)).toEqual({ ok: true });
    });

    it('green 位置の数字を変えると拒否される', () => {
        const history = makeHistory('1009', ['green', 'green', 'yellow', 'gray']);
        // 位置0を '2' に変える
        const result = validateHardMode('2019', history);
        expect(result.ok).toBe(false);
        expect(result.message).toBe(HARD_MODE_GREEN_MESSAGE);
    });

    it('yellow 数字を含めれば ok', () => {
        // guess='1039', pos2='3'→yellow: '3' を含む guess は ok
        const history = makeHistory('1039', ['green', 'green', 'yellow', 'gray']);
        // '1013' contains '3' → ok
        expect(validateHardMode('1013', history)).toEqual({ ok: true });
    });

    it('yellow 数字を含めないと拒否される', () => {
        // guess='1039', pos2='3'→yellow
        const history = makeHistory('1039', ['green', 'green', 'yellow', 'gray']);
        // '1019' doesn't contain '3' → violated
        const result = validateHardMode('1019', history);
        expect(result.ok).toBe(false);
        expect(result.message).toBe(HARD_MODE_YELLOW_MESSAGE);
    });

    it('複数の yellow が必要な場合も正しくチェックする', () => {
        // guess='2311', colors=['yellow','yellow','gray','gray'] -> '2','3' が yellow
        const history = makeHistory('2311', ['yellow', 'yellow', 'gray', 'gray']);
        // '2' と '3' 両方含む
        expect(validateHardMode('1237', history)).toEqual({ ok: true });
        // '3' だけ含んで '2' なし
        const result = validateHardMode('1373', history);
        expect(result.ok).toBe(false);
    });
});
