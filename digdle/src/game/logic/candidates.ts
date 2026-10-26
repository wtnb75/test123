import type { DigitStatus, GuessHistory } from '../types';

/** Digit counts for the yellow pass, reused between calls (the digits are '0'..'9'). */
const remain = new Int32Array(10);
const ZERO_CODE = '0'.charCodeAt(0);

/**
 * Whether judging `guess` against `answer` gives exactly `colors`: the same rule as `judgeGuess` (greens first, then
 * yellow while the answer still has that digit unmatched, otherwise gray), without allocating. Used in the hot loop.
 */
const judgesTo = (answer: string, guess: string, colors: readonly DigitStatus[]): boolean => {
    remain.fill(0);

    for (let i = 0; i < answer.length; i += 1) {
        if (answer[i] === guess[i]) {
            if (colors[i] !== 'green') {
                return false;
            }
        } else {
            remain[answer.charCodeAt(i) - ZERO_CODE] += 1;
        }
    }

    for (let i = 0; i < answer.length; i += 1) {
        if (answer[i] === guess[i]) {
            continue;
        }

        const slot = guess.charCodeAt(i) - ZERO_CODE;
        const expected: DigitStatus = remain[slot] > 0 ? 'yellow' : 'gray';

        if (colors[i] !== expected) {
            return false;
        }
        if (expected === 'yellow') {
            remain[slot] -= 1;
        }
    }

    return true;
};

/**
 * How many of the N-digit primes `primes` could still be the answer: a prime counts when, for every judged
 * guess, judging that guess against it gives the colours the player actually saw. Pure colour matching only.
 */
export const countCandidates = (
    primes: readonly string[],
    history: readonly GuessHistory[],
    previousAnswer?: string
): number => {
    let count = 0;

    for (const prime of primes) {
        // The answer is never the previous round's answer (docs/spec.md: 直前と異なる正解).
        if (prime === previousAnswer) {
            continue;
        }

        let consistent = true;

        for (const row of history) {
            if (!judgesTo(prime, row.guess, row.colors)) {
                consistent = false;
                break;
            }
        }

        if (consistent) {
            count += 1;
        }
    }

    return count;
};

/**
 * Whether the "あと n 個" line is on screen: only with the 💡 on, in normal or hard (not the daily challenge), for a
 * round in progress with a judgement, and never over a notice.
 */
export const candidateLineShown = (input: {
    candidates: boolean;
    daily: boolean;
    phase: 'playing' | 'won' | 'lost';
    historyLength: number;
    noticeShown: boolean;
}): boolean =>
    input.candidates
    && !input.daily
    && input.phase === 'playing'
    && input.historyLength > 0
    && !input.noticeShown;

/** The line's text: 「あと 1 個」 / 「あと 12 個」 in Japanese, "1 left" / "12 left" in English. */
export const candidateLineText = (count: number, locale: 'ja' | 'en'): string =>
    locale === 'ja' ? `あと ${count} 個` : `${count} left`;
