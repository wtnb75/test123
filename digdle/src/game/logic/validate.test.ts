import { describe, expect, it } from 'vitest';
import { validateGuess, validateHardMode } from './validate';
import type { DigitStatus } from '../types';

describe('validateGuess', () => {
    it('Enter 検証順序は桁数が先', () => {
        const result = validateGuess('12', 4);
        expect(result).toEqual({ ok: false, reason: { code: 'length' } });
    });

    it('桁数が一致しても素数でなければ拒否', () => {
        const result = validateGuess('1000', 4);
        expect(result.ok).toBe(false);
        expect(result.reason).toEqual({ code: 'not-prime', factorization: '1000 = 2 x 2 x 2 x 5 x 5 x 5' });
    });

    it('非素数は素因数分解を表示する', () => {
        const result = validateGuess('15', 2);
        expect(result.ok).toBe(false);
        expect(result.reason).toEqual({ code: 'not-prime', factorization: '15 = 3 x 5' });
    });

    it('非数字はヒントなしで拒否される', () => {
        const result = validateGuess('1a', 2);
        expect(result.ok).toBe(false);
        expect(result.reason).toEqual({ code: 'not-prime' });
    });

    it('1 以下相当の値はヒントなしで拒否される', () => {
        const result = validateGuess('01', 2);
        expect(result.ok).toBe(false);
        expect(result.reason).toEqual({ code: 'not-prime' });
    });

    it('桁数が違い、かつ素数でもない入力は桁数の理由になる', () => {
        expect(validateGuess('1000', 3)).toEqual({ ok: false, reason: { code: 'length' } });
    });

    it('同じ素因数が重なる合成数は小さい順に x でつないだ分解になる', () => {
        expect(validateGuess('12', 2).reason).toEqual({ code: 'not-prime', factorization: '12 = 2 x 2 x 3' });
    });

    it('先頭 0 の合成数は入力の文字列のまま分解を付ける', () => {
        expect(validateGuess('0015', 4).reason).toEqual({ code: 'not-prime', factorization: '0015 = 3 x 5' });
    });

    it('桁数 1 の 1 は素数でなく、分解は付かない', () => {
        expect(validateGuess('1', 1)).toEqual({ ok: false, reason: { code: 'not-prime' } });
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
        // guess='1039', answer='1013' -> positions 0='1'(green),1='0'(green),2='3'(yellow)
        const history = makeHistory('1039', ['green', 'green', 'yellow', 'gray']);
        // '1031': 位置0='1',位置1='0' を維持し、yellow の '3' も含む
        expect(validateHardMode('1031', history)).toEqual({ ok: true });
    });

    it('green 位置の数字を変えると拒否される', () => {
        const history = makeHistory('1009', ['green', 'green', 'yellow', 'gray']);
        // 位置0を '2' に変える
        const result = validateHardMode('2019', history);
        expect(result.ok).toBe(false);
        expect(result.reason).toEqual({ code: 'hard-green' });
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
        expect(result.reason).toEqual({ code: 'hard-yellow' });
    });

    it('複数の yellow が必要な場合も正しくチェックする', () => {
        // guess='2311', colors=['yellow','yellow','gray','gray'] -> '2','3' が yellow
        const history = makeHistory('2311', ['yellow', 'yellow', 'gray', 'gray']);
        // '2' と '3' 両方含む
        expect(validateHardMode('1237', history)).toEqual({ ok: true });
        // '3' だけ含んで '2' なし
        const result = validateHardMode('1373', history);
        expect(result.ok).toBe(false);
        expect(result.reason).toEqual({ code: 'hard-yellow' });
    });

    it('履歴を古い順に 1 件ずつ見て、各件で green 違反 → yellow 不足の順に調べる', () => {
        // 色は手書き。1 件目 '3111': 3 と最後の 1 が yellow。2 件目 '1009': 位置 0,1 が green。
        const history = [
            { guess: '3111', colors: ['yellow', 'gray', 'gray', 'yellow'] as DigitStatus[] },
            { guess: '1009', colors: ['green', 'green', 'gray', 'gray'] as DigitStatus[] }
        ];
        // '2019': 1 件目の yellow(3)に違反し、2 件目の green(位置 0)にも違反する → 先に見る 1 件目の yellow
        expect(validateHardMode('2019', history).reason).toEqual({ code: 'hard-yellow' });
        // '2013': 3 と 1 を含み 1 件目は満たすが、2 件目の green(位置 0)に違反する
        expect(validateHardMode('2013', history).reason).toEqual({ code: 'hard-green' });
    });

    it('同じ件では green 違反が yellow 不足より先に返る', () => {
        const history = makeHistory('1039', ['green', 'green', 'yellow', 'gray']);
        // '2019': 位置 0 が green 違反、3 も欠けている
        expect(validateHardMode('2019', history).reason).toEqual({ code: 'hard-green' });
    });
});
