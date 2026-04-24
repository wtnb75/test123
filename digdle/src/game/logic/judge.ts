import type { DigitStatus } from '../types';

export const judgeGuess = (answer: string, guess: string): DigitStatus[] => {
    const length = answer.length;
    const result: DigitStatus[] = Array.from({ length }, () => 'gray');
    const remainCount = new Map<string, number>();

    for (let i = 0; i < length; i += 1) {
        const answerDigit = answer[i];
        const guessDigit = guess[i];

        if (guessDigit === answerDigit) {
            result[i] = 'green';
        } else {
            const current = remainCount.get(answerDigit) ?? 0;
            remainCount.set(answerDigit, current + 1);
        }
    }

    for (let i = 0; i < length; i += 1) {
        if (result[i] === 'green') {
            continue;
        }

        const digit = guess[i];
        const current = remainCount.get(digit) ?? 0;
        if (current > 0) {
            result[i] = 'yellow';
            remainCount.set(digit, current - 1);
        }
    }

    return result;
};
