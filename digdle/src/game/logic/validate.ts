import { isPrimeString } from './primes';
import type { GuessHistory, ValidationResult } from '../types';

export const INVALID_LENGTH_MESSAGE = 'N桁の数字を入力してください';
export const INVALID_PRIME_MESSAGE = '素数を入力してください';
export const HARD_MODE_GREEN_MESSAGE = 'ハードモード: 確定した位置の数字を変えられません';
export const HARD_MODE_YELLOW_MESSAGE = 'ハードモード: 判明した数字を必ず含めてください';

const factorize = (value: number): number[] => {
    const factors: number[] = [];
    let current = value;

    while (current % 2 === 0) {
        factors.push(2);
        current /= 2;
    }

    let divisor = 3;
    while (divisor * divisor <= current) {
        while (current % divisor === 0) {
            factors.push(divisor);
            current /= divisor;
        }
        divisor += 2;
    }

    if (current > 1) {
        factors.push(current);
    }

    return factors;
};

const buildCompositeHint = (guess: string): string | undefined => {
    if (!/^\d+$/.test(guess)) {
        return undefined;
    }

    const value = Number(guess);
    if (!Number.isInteger(value) || value <= 1) {
        return undefined;
    }

    const factors = factorize(value);
    if (factors.length <= 1) {
        return undefined;
    }

    return `${guess} = ${factors.join(' x ')}`;
};

export const validateGuess = (guess: string, digits: number): ValidationResult => {
    if (guess.length !== digits) {
        return {
            ok: false,
            message: INVALID_LENGTH_MESSAGE
        };
    }

    if (!isPrimeString(guess)) {
        const hint = buildCompositeHint(guess);
        return {
            ok: false,
            message: hint ? `${INVALID_PRIME_MESSAGE} (${hint})` : INVALID_PRIME_MESSAGE
        };
    }

    return {
        ok: true
    };
};

export const validateHardMode = (guess: string, history: GuessHistory[]): ValidationResult => {
    for (const entry of history) {
        // green: same position must have same digit
        for (let i = 0; i < entry.colors.length; i += 1) {
            if (entry.colors[i] === 'green' && guess[i] !== entry.guess[i]) {
                return { ok: false, message: HARD_MODE_GREEN_MESSAGE };
            }
        }

        // yellow: guess must contain each yellow digit somewhere
        const yellowRequired = new Map<string, number>();
        for (let i = 0; i < entry.colors.length; i += 1) {
            if (entry.colors[i] === 'yellow') {
                yellowRequired.set(entry.guess[i], (yellowRequired.get(entry.guess[i]) ?? 0) + 1);
            }
        }

        const guessCounts = new Map<string, number>();
        for (const ch of guess) {
            guessCounts.set(ch, (guessCounts.get(ch) ?? 0) + 1);
        }

        for (const [digit, required] of yellowRequired.entries()) {
            if ((guessCounts.get(digit) ?? 0) < required) {
                return { ok: false, message: HARD_MODE_YELLOW_MESSAGE };
            }
        }
    }

    return { ok: true };
};
