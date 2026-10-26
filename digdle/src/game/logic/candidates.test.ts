import { describe, expect, it } from 'vitest';
import { candidateLineShown, candidateLineText, countCandidates } from './candidates';
import { createGame } from './game';
import { judgeGuess } from './judge';
import { generateNDigitPrimes, getSharedPrimeMap } from './primes';
import { candidatesFromData, gameStartData, titleDataFromGame } from './selectLayout';
import type { GuessHistory } from '../types';

/** A small seeded generator, so the oracle loops below are the same on every run. */
const seeded = (seed: number): (() => number) => {
    let state = seed >>> 0;

    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

/** Brute force, written apart from the implementation: judge every prime and keep those that reproduce the rows. */
const bruteCount = (primes: readonly string[], history: readonly GuessHistory[]): string[] =>
    primes.filter((prime) => history.every((row) => {
        const colors = judgeGuess(prime, row.guess);
        return colors.every((color, index) => color === row.colors[index]);
    }));

describe('countCandidates: primes still consistent with every judged colour row', () => {
    it.each([
        [2, 21],
        [3, 143],
        [4, 1061],
        [5, 8363],
        [6, 68906]
    ])('with no judgement yet, %i-digit primes are all candidates (%i)', (digits, expected) => {
        expect(countCandidates(getSharedPrimeMap()[digits], [])).toBe(expected);
    });

    it('after 11 → green, gray (2 digits), exactly 13, 17 and 19 remain', () => {
        // The answer starts with 1 and its second digit is not 1: 11 itself is out, as is every prime without a 1 first.
        const primes = generateNDigitPrimes(2);
        const history: GuessHistory[] = [{ guess: '11', colors: ['green', 'gray'] }];

        expect(bruteCount(primes, history)).toEqual(['13', '17', '19']);
        expect(countCandidates(primes, history)).toBe(3);
    });

    it('after a full green row only the answer itself is left', () => {
        const primes = generateNDigitPrimes(2);
        expect(countCandidates(primes, [{ guess: '13', colors: ['green', 'green'] }])).toBe(1);
    });

    it('agrees with brute force for single rows: every 3-digit prime as the answer, several guesses', () => {
        const primes = generateNDigitPrimes(3);

        for (const guess of ['113', '373', '997', '222']) {
            for (const answer of primes.slice(0, 40)) {
                const history: GuessHistory[] = [{ guess, colors: judgeGuess(answer, guess) }];

                expect(countCandidates(primes, history)).toBe(bruteCount(primes, history).length);
            }
        }
    });

    it('agrees with brute force after several judgements, and keeps the answer among the candidates', () => {
        // The hidden answer is drawn from a fixed seed; 2–3 guesses are judged against it, then the count is checked.
        const primes = generateNDigitPrimes(3);
        const rng = seeded(20260501);
        let checkedRounds = 0;

        for (let round = 0; round < 60; round += 1) {
            const answer = primes[Math.floor(rng() * primes.length)];
            const guesses = [primes[Math.floor(rng() * primes.length)], primes[Math.floor(rng() * primes.length)]];
            const history: GuessHistory[] = guesses.map((guess) => ({ guess, colors: judgeGuess(answer, guess) }));
            const count = countCandidates(primes, history);

            expect(count).toBe(bruteCount(primes, history).length);
            expect(bruteCount(primes, history)).toContain(answer);
            checkedRounds += 1;
        }

        expect(checkedRounds).toBe(60);
    });

    it('leaves out the previous round\'s answer: 20 for 2 digits after a round, and 17 and 19 left after 11 → green, gray', () => {
        // The previous answer 13 fits the judged row, but it is not the next answer, so only 17 and 19 remain.
        const primes = getSharedPrimeMap()[2];

        expect(countCandidates(primes, [], '11')).toBe(20);
        expect(countCandidates(primes, [{ guess: '11', colors: ['green', 'gray'] }], '13')).toBe(2);
    });

    it('starts a new round with no history, so the count is the full list again', () => {
        const game = createGame({ primeMap: getSharedPrimeMap(), seed: 7 });
        const first = game.createRound(2);

        expect(first.history).toEqual([]);
        expect(countCandidates(getSharedPrimeMap()[2], first.history)).toBe(21);
    });

    it('counts a 6-digit list after one judgement within 100 ms', () => {
        const primes = getSharedPrimeMap()[6];
        const started = performance.now();
        const count = countCandidates(primes, [{ guess: '100003', colors: ['gray', 'gray', 'gray', 'gray', 'gray', 'gray'] }]);
        const elapsed = performance.now() - started;

        expect(count).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(100);
    });
});

describe('candidateLineShown: when the "あと n 個" line is on screen', () => {
    const shown = {
        candidates: true,
        daily: false,
        phase: 'playing' as const,
        historyLength: 1,
        noticeShown: false
    };

    it('is shown once a judgement is made, with the toggle on (normal and hard share the same rule)', () => {
        expect(candidateLineShown(shown)).toBe(true);
    });

    it('is hidden with the toggle off', () => {
        expect(candidateLineShown({ ...shown, candidates: false })).toBe(false);
    });

    it('is hidden in the daily challenge', () => {
        expect(candidateLineShown({ ...shown, daily: true })).toBe(false);
    });

    it('is hidden before the first judgement, on the result screens, and while a notice is up', () => {
        expect(candidateLineShown({ ...shown, historyLength: 0 })).toBe(false);
        expect(candidateLineShown({ ...shown, phase: 'won' })).toBe(false);
        expect(candidateLineShown({ ...shown, phase: 'lost' })).toBe(false);
        expect(candidateLineShown({ ...shown, noticeShown: true })).toBe(false);
    });
});

describe('the 💡 handoff between the Title and the Game', () => {
    it('reads the toggle only as an explicit true (absent, false or other values are off)', () => {
        expect(candidatesFromData(undefined)).toBe(false);
        expect(candidatesFromData({})).toBe(false);
        expect(candidatesFromData({ candidates: false })).toBe(false);
        expect(candidatesFromData({ candidates: 'true' })).toBe(false);
        expect(candidatesFromData({ candidates: true })).toBe(true);
    });

    it('starts the Game with the digits, the mode and the toggle, and reopens the Title with the mode and the toggle', () => {
        expect(gameStartData(4, 'hard', true)).toEqual({ digits: 4, mode: 'hard', candidates: true });
        expect(titleDataFromGame('daily', false)).toEqual({ mode: 'daily', candidates: false });
    });
});

describe('candidateLineText', () => {
    it('reads あと n 個 in Japanese and n left in English, including 1', () => {
        expect(candidateLineText(1, 'ja')).toBe('あと 1 個');
        expect(candidateLineText(68906, 'ja')).toBe('あと 68906 個');
        expect(candidateLineText(3, 'en')).toBe('3 left');
    });
});
