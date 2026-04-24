export type PrimeMap = Record<number, string[]>;

export const SUPPORTED_DIGITS = [2, 3, 4, 5] as const;

export const isPrimeNumber = (value: number): boolean => {
    if (!Number.isInteger(value) || value < 2) {
        return false;
    }
    if (value === 2) {
        return true;
    }
    if (value % 2 === 0) {
        return false;
    }

    const limit = Math.floor(Math.sqrt(value));
    for (let i = 3; i <= limit; i += 2) {
        if (value % i === 0) {
            return false;
        }
    }
    return true;
};

export const isPrimeString = (value: string): boolean => {
    if (!/^\d+$/.test(value) || value.startsWith('0')) {
        return false;
    }
    return isPrimeNumber(Number(value));
};

export const generateNDigitPrimes = (digits: number): string[] => {
    if (digits < 1) {
        return [];
    }

    const start = Math.pow(10, digits - 1);
    const end = Math.pow(10, digits) - 1;
    const result: string[] = [];

    for (let value = start; value <= end; value += 1) {
        if (isPrimeNumber(value)) {
            result.push(String(value));
        }
    }

    return result;
};

export const buildPrimeMap = (): PrimeMap => {
    const map: PrimeMap = {};

    for (const digits of SUPPORTED_DIGITS) {
        map[digits] = generateNDigitPrimes(digits);
    }

    return map;
};

const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;

    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const createRng = (seed?: number): (() => number) => {
    if (seed === undefined) {
        return () => Math.random();
    }
    return mulberry32(seed);
};

export const choosePrime = (candidates: string[], rng: () => number, exclude?: string): string => {
    if (candidates.length === 0) {
        throw new Error('prime candidates are empty');
    }

    if (exclude === undefined || candidates.length === 1) {
        return candidates[Math.floor(rng() * candidates.length)];
    }

    const firstIndex = Math.floor(rng() * candidates.length);
    const firstPick = candidates[firstIndex];
    if (firstPick !== exclude) {
        return firstPick;
    }

    for (let offset = 1; offset < candidates.length; offset += 1) {
        const nextPick = candidates[(firstIndex + offset) % candidates.length];
        if (nextPick !== exclude) {
            return nextPick;
        }
    }

    return firstPick;
};
