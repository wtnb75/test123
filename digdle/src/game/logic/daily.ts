import { applyGuess, ATTEMPT_LIMITS } from './game';
import { createRng, type PrimeMap } from './primes';
import { DIGIT_OPTIONS } from './selectLayout';
import type { DigitOption, RoundState } from '../types';

/** The localStorage key of the daily save. */
export const DAILY_STORAGE_KEY = 'digdle.daily';
/** The prefix of the string that is hashed into a day's seed. */
export const DAILY_SEED_PREFIX = 'digdle-daily:';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** The local calendar date as `YYYY-MM-DD`. */
export const dailyDateKey = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** 32-bit FNV-1a over the ASCII bytes of `text`. */
export const fnv1a32 = (text: string): number => {
    let hash = FNV_OFFSET;

    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i) & 0xff;
        hash = Math.imul(hash, FNV_PRIME);
    }

    return hash >>> 0;
};

export const dailySeed = (dateKey: string, digits: number): number =>
    fnv1a32(`${DAILY_SEED_PREFIX}${dateKey}:${digits}`);

/** The prime everyone gets for `dateKey` and `digits`: the first value of the seeded generator picks from the ascending list. */
export const dailyAnswer = (primeMap: PrimeMap, dateKey: string, digits: number): string => {
    const candidates = primeMap[digits];

    if (candidates === undefined || candidates.length === 0) {
        throw new Error(`missing prime candidates for digits: ${digits}`);
    }

    return candidates[Math.floor(createRng(dailySeed(dateKey, digits))() * candidates.length)];
};

export const createDailyRound = (primeMap: PrimeMap, dateKey: string, digits: DigitOption): RoundState => ({
    n: digits,
    mode: 'normal',
    attemptLimit: ATTEMPT_LIMITS[digits],
    answer: dailyAnswer(primeMap, dateKey, digits),
    attemptsUsed: 0,
    status: 'playing',
    history: []
});

/** Plays `guesses` into `round` in order; `null` when any of them is rejected or comes after the round has ended. */
export const replayGuesses = (round: RoundState, guesses: readonly string[]): RoundState | null => {
    let current = round;

    for (const guess of guesses) {
        if (current.status !== 'playing') {
            return null;
        }

        const result = applyGuess(current, guess);

        if (!result.accepted) {
            return null;
        }

        current = result.round;
    }

    return current;
};

export interface DailySave {
    date: string;
    rounds: Partial<Record<DigitOption, string[]>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

/** The save for `dateKey`: empty when the stored day differs or the stored shape is wrong; keys outside 2-6 are dropped. */
export const parseDailySave = (raw: string | null, dateKey: string): DailySave => {
    const empty: DailySave = { date: dateKey, rounds: {} };

    if (raw === null) {
        return empty;
    }

    let value: unknown;

    try {
        value = JSON.parse(raw);
    } catch {
        return empty;
    }

    if (!isRecord(value) || value.date !== dateKey || !isRecord(value.rounds)) {
        return empty;
    }

    const stored = value.rounds;

    if (!Object.values(stored).every(isStringArray)) {
        return empty;
    }

    const rounds: DailySave['rounds'] = {};

    for (const digits of DIGIT_OPTIONS) {
        const guesses = stored[String(digits)];

        if (isStringArray(guesses)) {
            rounds[digits] = guesses;
        }
    }

    return { date: dateKey, rounds };
};

/** The part of `Storage` the daily save needs. */
export interface DailyBackend {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}

export interface DailyStorage {
    load: (dateKey: string) => DailySave;
    /** Stores the guesses of one digit count and keeps the other counts of the same day. */
    saveGuesses: (dateKey: string, digits: DigitOption, guesses: readonly string[]) => void;
}

/**
 * The daily save on top of `backend`. The backend is read while it works (so a save written by another
 * tab is seen); once a read or a write of it fails, or when there is none, the copy of what was written
 * is read instead, so resume and marks still work within the page's lifetime.
 */
export const createDailyStorage = (backend: DailyBackend | null): DailyStorage => {
    let memory: string | null = null;
    let backendWorks = backend !== null;

    const readRaw = (): string | null => {
        if (backendWorks) {
            try {
                return backend?.getItem(DAILY_STORAGE_KEY) ?? null;
            } catch {
                backendWorks = false;
            }
        }

        return memory;
    };

    const load = (dateKey: string): DailySave => parseDailySave(readRaw(), dateKey);

    return {
        load,
        saveGuesses: (dateKey, digits, guesses) => {
            const save = load(dateKey);
            const raw = JSON.stringify({ date: dateKey, rounds: { ...save.rounds, [digits]: [...guesses] } });

            memory = raw;

            try {
                backend?.setItem(DAILY_STORAGE_KEY, raw);
            } catch {
                // Storage is blocked or full: the memory copy keeps this page session working.
                backendWorks = false;
            }
        }
    };
};

/** `window.localStorage`, or `null` when there is no window or reaching it throws (blocked storage). */
export const browserBackend = (): DailyBackend | null => {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
};

let sharedStorage: DailyStorage | null = null;

/** The one daily save shared by the Title and the Game. */
export const getDailyStorage = (): DailyStorage => {
    sharedStorage ??= createDailyStorage(browserBackend());
    return sharedStorage;
};

/** The day's round for `digits` with the saved guesses played in; a fresh round when nothing valid is saved. */
export const loadDailyRound = (
    storage: DailyStorage,
    primeMap: PrimeMap,
    dateKey: string,
    digits: DigitOption
): RoundState => {
    const fresh = createDailyRound(primeMap, dateKey, digits);
    const saved = storage.load(dateKey).rounds[digits];

    return (saved === undefined ? null : replayGuesses(fresh, saved)) ?? fresh;
};

export type DailyResult = 'won' | 'lost';

/** The digit counts already finished on `dateKey` and how they ended (in-progress counts are left out). */
export const loadDailyResults = (
    storage: DailyStorage,
    primeMap: PrimeMap,
    dateKey: string
): Partial<Record<DigitOption, DailyResult>> => {
    const results: Partial<Record<DigitOption, DailyResult>> = {};

    for (const digits of DIGIT_OPTIONS) {
        const { status } = loadDailyRound(storage, primeMap, dateKey, digits);

        if (status !== 'playing') {
            results[digits] = status;
        }
    }

    return results;
};

/** Whether a key-down is dropped: an auto-repeat while a daily result is on screen (that screen is the last one). */
export const dropsDailyResultRepeat = (repeat: boolean, daily: boolean, phase: RoundState['status']): boolean =>
    repeat && daily && phase !== 'playing';

/** The Title label of a digit button: the digit, plus `✓` / `✗` once that day's round is finished. */
export const digitLabel = (digits: DigitOption, result: DailyResult | undefined): string => {
    if (result === undefined) {
        return String(digits);
    }

    return `${digits}${result === 'won' ? '✓' : '✗'}`;
};
