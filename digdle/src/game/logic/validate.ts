import { isPrimeString } from './primes';
import type { ValidationResult } from '../types';

export const INVALID_LENGTH_MESSAGE = 'N桁の数字を入力してください';
export const INVALID_PRIME_MESSAGE = '素数を入力してください';

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
