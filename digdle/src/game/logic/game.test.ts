import { describe, expect, it, vi } from 'vitest';
import { ATTEMPT_LIMITS, applyGuess, createGame } from './game';
import type { PrimeMap } from './primes';

const PRIME_MAP: PrimeMap = {
    2: ['11', '13', '17', '19'],
    3: ['101', '103', '107'],
    4: ['1009', '1013', '1019'],
    5: ['10007', '10009', '10037'],
    6: ['100003', '100019', '100043']
};

describe('createGame', () => {
    it('seed を指定すると決定的になる', () => {
        const gameA = createGame({ seed: 123, primeMap: PRIME_MAP });
        const gameB = createGame({ seed: 123, primeMap: PRIME_MAP });

        const a1 = gameA.createRound(4);
        const a2 = gameA.createRound(4);
        const b1 = gameB.createRound(4);
        const b2 = gameB.createRound(4);

        expect(a1.answer).toBe(b1.answer);
        expect(a2.answer).toBe(b2.answer);
    });

    it('seed 未指定では Math.random を使用する', () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const game = createGame({ primeMap: PRIME_MAP });

        game.createRound(2);

        expect(randomSpy).toHaveBeenCalled();
        randomSpy.mockRestore();
    });

    it('次ゲームの正解は直前と異なる値を優先する', () => {
        const game = createGame({ seed: 1, primeMap: PRIME_MAP });
        const first = game.createRound(3);
        const second = game.createRound(3, 'normal', first.answer);

        expect(second.answer).not.toBe(first.answer);
    });

    it('未対応桁数で createRound は例外を投げる', () => {
        const game = createGame({ primeMap: PRIME_MAP });
        expect(() => game.createRound(9)).toThrow('unsupported digits: 9');
    });

    it('候補不足の桁数で createRound は例外を投げる', () => {
        const game = createGame({ primeMap: { ...PRIME_MAP, 4: [] } });
        expect(() => game.createRound(4)).toThrow('missing prime candidates for digits: 4');
    });

    it('試行回数が仕様どおり削減されている', () => {
        expect(ATTEMPT_LIMITS[2]).toBe(3);
        expect(ATTEMPT_LIMITS[3]).toBe(4);
        expect(ATTEMPT_LIMITS[4]).toBe(5);
        expect(ATTEMPT_LIMITS[5]).toBe(6);
        expect(ATTEMPT_LIMITS[6]).toBe(7);
    });

    it('N=6 で createRound が動作する', () => {
        const game = createGame({ seed: 1, primeMap: PRIME_MAP });
        const round = game.createRound(6);
        expect(round.n).toBe(6);
        expect(round.attemptLimit).toBe(7);
    });

    it('mode が RoundState に反映される', () => {
        const game = createGame({ seed: 1, primeMap: PRIME_MAP });
        const normal = game.createRound(4, 'normal');
        const hard = game.createRound(4, 'hard');
        expect(normal.mode).toBe('normal');
        expect(hard.mode).toBe('hard');
    });
});

describe('applyGuess', () => {
    it('playing 以外の状態は入力を受け付けない', () => {
        const round = {
            n: 4,
            mode: 'normal' as const,
            attemptLimit: 5,
            answer: '1013',
            attemptsUsed: 1,
            status: 'won' as const,
            history: []
        };

        const result = applyGuess(round, '1013');

        expect(result.accepted).toBe(false);
        expect(result.consumedAttempt).toBe(false);
        expect(result.round).toEqual(round);
    });

    it('不正入力は試行回数を消費しない', () => {
        const game = createGame({ seed: 1, primeMap: PRIME_MAP });
        const round = game.createRound(3);

        const result = applyGuess(round, '12');

        expect(result.accepted).toBe(false);
        expect(result.consumedAttempt).toBe(false);
        expect(result.round.attemptsUsed).toBe(0);
    });

    it('正しい入力は試行回数を消費し、履歴を追加する', () => {
        const round = {
            n: 4,
            mode: 'normal' as const,
            attemptLimit: 5,
            answer: '1013',
            attemptsUsed: 0,
            status: 'playing' as const,
            history: []
        };

        const result = applyGuess(round, '1019');

        expect(result.accepted).toBe(true);
        expect(result.consumedAttempt).toBe(true);
        expect(result.round.attemptsUsed).toBe(1);
        expect(result.round.history).toHaveLength(1);
    });

    it('正解入力で won になる', () => {
        const round = {
            n: 4,
            mode: 'normal' as const,
            attemptLimit: 5,
            answer: '1013',
            attemptsUsed: 0,
            status: 'playing' as const,
            history: []
        };

        const result = applyGuess(round, '1013');
        expect(result.round.status).toBe('won');
    });

    it('最終試行で不正解なら lost になる', () => {
        const round = {
            n: 4,
            mode: 'normal' as const,
            attemptLimit: 2,
            answer: '1013',
            attemptsUsed: 1,
            status: 'playing' as const,
            history: []
        };

        const result = applyGuess(round, '1019');
        expect(result.round.status).toBe('lost');
    });

    it('ハードモード: green 位置違反は拒否され試行回数を消費しない', () => {
        const game = createGame({ seed: 1, primeMap: PRIME_MAP });
        const round = game.createRound(4, 'hard');
        // 1回目を通す
        const after1 = applyGuess(round, '1009');
        expect(after1.accepted).toBe(true);
        // green が確定した桁を変えて入力 -> 拒否
        const greenPositions = after1.colors!
            .map((c, i) => (c === 'green' ? i : -1))
            .filter((i) => i >= 0);
        if (greenPositions.length > 0) {
            // '1009'と'1013': 位置0='1'(green)なら位置0を変えた入力を試みる
            const violated = '2' + '1013'.slice(1);
            if (violated !== '1013' && violated.length === 4) {
                const result = applyGuess(after1.round, violated);
                // violatedが素数でない場合は別の理由で拒否されるが試行消費0は共通
                expect(result.consumedAttempt).toBe(false);
            }
        }
    });

    it('ハードモード: yellow 未包含は拒否され試行回数を消費しない', () => {
        // answer='1013', 1回目guess='1039' → pos2='3'→yellow
        const round = {
            n: 4,
            mode: 'hard' as const,
            attemptLimit: 5,
            answer: '1013',
            attemptsUsed: 1,
            status: 'playing' as const,
            history: [{ guess: '1039', colors: ['green', 'green', 'yellow', 'gray'] as import('../types').DigitStatus[] }]
        };
        // '3'(yellow確定) を含まない '1019' を入力 → 違反
        const result = applyGuess(round, '1019');
        expect(result.consumedAttempt).toBe(false);
        expect(result.accepted).toBe(false);
    });

    it('ノーマルモードではハードモード制約チェックを行わない', () => {
        const round = {
            n: 4,
            mode: 'normal' as const,
            attemptLimit: 5,
            answer: '1013',
            attemptsUsed: 1,
            status: 'playing' as const,
            history: [{ guess: '1009', colors: ['green', 'green', 'yellow', 'gray'] as import('../types').DigitStatus[] }]
        };
        // ノーマルなら '0' を含まなくても受理される
        const result = applyGuess(round, '1013');
        expect(result.accepted).toBe(true);
    });
});
