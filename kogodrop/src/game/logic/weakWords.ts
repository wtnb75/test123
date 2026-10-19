import type { KogoEntry } from './types';

// Per-word answer records and the "weak words" weighting (docs/spec/weak-words.md).

/**
 * weight = 1 + WEAK_BOOST x wrong rate: an always-missed word gets weight 5, a never-missed word 1.
 * The weight only orders the shuffled deck (a word still comes up at most once per lap), so it is a
 * relative chance of being picked or picked early, not a frequency.
 */
export const WEAK_BOOST = 4;
/** After the first tap of "clear records", the second tap must come before this many ms have passed */
export const CLEAR_CONFIRM_MS = 3000;
export const RECORDS_KEY = 'kogodrop.records';
export const TOGGLE_KEY = 'kogodrop.weakWords';

export interface WordRecord {
    /** correct answers */
    c: number;
    /** wrong answers */
    w: number;
}
export type WordRecords = Record<string, WordRecord>;

/** The part of `Storage` this module uses; undefined means no storage is available */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;

/** `localStorage`, or undefined when it cannot be reached (blocked, private mode, no window) */
export const getStorage = (): StorageLike => {
    try {
        return typeof window === 'undefined' ? undefined : window.localStorage;
    } catch {
        return undefined;
    }
};

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

const isRecord = (value: unknown): value is WordRecord =>
    typeof value === 'object' && value !== null && isCount((value as WordRecord).c) && isCount((value as WordRecord).w);

/** The weight of a word from its record; a missing or invalid record, or no answers yet, weighs 1 */
export const wordWeight = (record: WordRecord | undefined, boost: number = WEAK_BOOST): number => {
    if (!isRecord(record)) return 1;
    const total = record.c + record.w;
    return total === 0 ? 1 : 1 + (boost * record.w) / total;
};

/** A new set of records with one more answer for `id` (the input is not changed) */
export const recordWordAnswer = (records: WordRecords, id: string, correct: boolean): WordRecords => {
    const current = isRecord(records[id]) ? records[id] : { c: 0, w: 0 };
    return { ...records, [id]: correct ? { c: current.c + 1, w: current.w } : { c: current.c, w: current.w + 1 } };
};

/** True when at least one valid record exists */
export const hasRecords = (records: WordRecords): boolean => Object.values(records).some(isRecord);

/** Parse stored records; broken JSON, a non-object, or invalid entries give no records (invalid entries are dropped) */
export const parseRecords = (raw: string | null): WordRecords => {
    if (raw === null) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        const result: WordRecords = {};
        for (const [id, value] of Object.entries(parsed)) {
            // '__proto__' would set the prototype of `result` instead of adding a key
            if (id !== '__proto__' && isRecord(value)) result[id] = { c: value.c, w: value.w };
        }
        return result;
    } catch {
        return {};
    }
};

export const loadRecords = (storage: StorageLike): WordRecords => {
    try {
        return parseRecords(storage?.getItem(RECORDS_KEY) ?? null);
    } catch {
        return {};
    }
};

/** Best effort: a failing write (blocked, quota) is ignored */
export const saveRecords = (storage: StorageLike, records: WordRecords): void => {
    try {
        storage?.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch {
        // the game goes on with the records it holds in memory
    }
};

/** Removes the records only; the toggle stays */
export const clearRecords = (storage: StorageLike): void => {
    try {
        storage?.removeItem(RECORDS_KEY);
    } catch {
        // nothing to do: the records stay where they are
    }
};

/** The toggle: on unless the stored value is exactly "false" */
export const loadToggle = (storage: StorageLike): boolean => {
    try {
        return storage?.getItem(TOGGLE_KEY) !== 'false';
    } catch {
        return true;
    }
};

export const saveToggle = (storage: StorageLike, on: boolean): void => {
    try {
        storage?.setItem(TOGGLE_KEY, on ? 'true' : 'false');
    } catch {
        // ignored, as with the records
    }
};

/** The weight function a round uses, reading the records as they are when it is called */
export const weightFromRecords = (getRecords: () => WordRecords) => (entry: KogoEntry): number =>
    wordWeight(getRecords()[entry.id]);

/**
 * Shuffle where heavier items tend to come first: each item draws u = rng() once (in order) and gets the
 * key u^(1/weight); items are sorted by key, largest first, ties in the original order.
 */
export const weightedShuffle = <T>(
    items: readonly T[],
    weightOf: (item: T) => number,
    rng: () => number = Math.random,
): T[] => {
    const keyed = items.map((item, index) => {
        const u = rng();
        return { item, index, key: u <= 0 ? 0 : Math.pow(u, 1 / weightOf(item)) };
    });
    keyed.sort((a, b) => b.key - a.key || a.index - b.index);
    return keyed.map((k) => k.item);
};

/** The "clear records" control: idle, or armed after one tap at time `since` (ms) */
export type ClearState = { phase: 'idle' } | { phase: 'armed'; since: number };

/** idle when the confirm time has passed (3000 ms or more after the first tap), otherwise as it is */
export const clearPhaseAt = (state: ClearState, now: number): ClearState =>
    state.phase === 'armed' && now - state.since >= CLEAR_CONFIRM_MS ? { phase: 'idle' } : state;

/** A tap: the first tap arms (nothing is cleared); a second tap within the time clears and goes back to idle */
export const tapClear = (state: ClearState, now: number): { state: ClearState; clear: boolean } => {
    const current = clearPhaseAt(state, now);
    if (current.phase === 'armed') return { state: { phase: 'idle' }, clear: true };
    return { state: { phase: 'armed', since: now }, clear: false };
};
