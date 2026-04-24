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
});

describe('applyGuess', () => {
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
});
