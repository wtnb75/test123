import { describe, expect, it, vi } from 'vitest';
import { applyGuess, createGame } from './game';
import type { PrimeMap } from './primes';

const PRIME_MAP: PrimeMap = {
    2: ['11', '13', '17', '19'],
    3: ['101', '103', '107'],
    4: ['1009', '1013', '1019'],
    5: ['10007', '10009', '10037']
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
        const second = game.createRound(3, first.answer);

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
});

describe('applyGuess', () => {
    it('playing 以外の状態は入力を受け付けない', () => {
        const round = {
            n: 4,
            attemptLimit: 7,
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
            attemptLimit: 7,
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
            attemptLimit: 7,
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
            attemptLimit: 2,
            answer: '1013',
            attemptsUsed: 1,
            status: 'playing' as const,
            history: []
        };

        const result = applyGuess(round, '1019');
        expect(result.round.status).toBe('lost');
    });
});
