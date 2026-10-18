import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CLEAR_CONFIRM_MS,
    RECORDS_KEY,
    TOGGLE_KEY,
    WEAK_BOOST,
    clearPhaseAt,
    clearRecords,
    getStorage,
    hasRecords,
    loadRecords,
    loadToggle,
    parseRecords,
    recordWordAnswer,
    saveRecords,
    saveToggle,
    tapClear,
    weightFromRecords,
    weightedShuffle,
    wordWeight,
    type ClearState,
    type StorageLike,
    type WordRecords,
} from './weakWords';
import type { KogoEntry } from './types';

/** A Storage stand-in backed by a Map */
const fakeStorage = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));
    const storage: NonNullable<StorageLike> = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key),
    };
    return { storage, data };
};

const throwingStorage: NonNullable<StorageLike> = {
    getItem: () => {
        throw new Error('blocked');
    },
    setItem: () => {
        throw new Error('quota');
    },
    removeItem: () => {
        throw new Error('blocked');
    },
};

/** Deterministic rng (mulberry32) for the frequency test */
const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const fixed = (values: number[]) => {
    let i = 0;
    return () => values[i++];
};

describe('parameters', () => {
    it('weakBoost 4 and a 3000 ms confirm time, with the spec keys', () => {
        expect(WEAK_BOOST).toBe(4);
        expect(CLEAR_CONFIRM_MS).toBe(3000);
        expect(RECORDS_KEY).toBe('kogodrop.records');
        expect(TOGGLE_KEY).toBe('kogodrop.weakWords');
    });
});

describe('wordWeight', () => {
    it.each([
        [undefined, 1],
        [{ c: 0, w: 0 }, 1],
        [{ c: 3, w: 0 }, 1],
        [{ c: 1, w: 1 }, 3],
        [{ c: 3, w: 1 }, 2],
        [{ c: 0, w: 3 }, 5],
        [{ c: 9, w: 1 }, 1.4],
    ])('record %j weighs %f', (record, expected) => {
        expect(wordWeight(record)).toBeCloseTo(expected, 10);
    });

    it('uses the boost it is given (boost 2, one right one wrong -> 2)', () => {
        expect(wordWeight({ c: 1, w: 1 }, 2)).toBeCloseTo(2, 10);
    });

    it.each([
        { c: -1, w: 2 },
        { c: 1.5, w: 2 },
        { c: 1 },
        { w: 2 },
        null,
        'x',
    ])('invalid record %j weighs 1', (record) => {
        expect(wordWeight(record as never)).toBe(1);
    });
});

describe('recordWordAnswer', () => {
    it('a correct answer adds to c, a wrong one adds to w, starting from 0', () => {
        expect(recordWordAnswer({}, 'a', true)).toEqual({ a: { c: 1, w: 0 } });
        expect(recordWordAnswer({}, 'a', false)).toEqual({ a: { c: 0, w: 1 } });
    });

    it('accumulates on an existing record and leaves other words alone', () => {
        const before: WordRecords = { a: { c: 2, w: 1 }, b: { c: 5, w: 5 } };
        const after = recordWordAnswer(before, 'a', false);
        expect(after).toEqual({ a: { c: 2, w: 2 }, b: { c: 5, w: 5 } });
    });

    it('does not change its input', () => {
        const before: WordRecords = { a: { c: 2, w: 1 } };
        recordWordAnswer(before, 'a', true);
        expect(before).toEqual({ a: { c: 2, w: 1 } });
    });

    it('an invalid stored record starts again from 0', () => {
        const broken = { a: { c: -3, w: 1 } } as WordRecords;
        expect(recordWordAnswer(broken, 'a', true)).toEqual({ a: { c: 1, w: 0 } });
    });
});

describe('hasRecords', () => {
    it('true with one valid record, false when empty or only invalid', () => {
        expect(hasRecords({ a: { c: 0, w: 0 } })).toBe(true);
        expect(hasRecords({})).toBe(false);
        expect(hasRecords({ a: { c: -1, w: 0 } } as WordRecords)).toBe(false);
    });
});

describe('parseRecords', () => {
    it('no stored value gives no records', () => {
        expect(parseRecords(null)).toEqual({});
    });

    it.each(['{broken', '[]', '5', 'null', '"text"'])('%s gives no records', (raw) => {
        expect(parseRecords(raw)).toEqual({});
    });

    it('an entry named __proto__ is skipped, not turned into a prototype', () => {
        const parsed = parseRecords('{"__proto__":{"c":1,"w":1},"ok":{"c":1,"w":0}}');
        expect(Object.keys(parsed)).toEqual(['ok']);
        expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
        expect(hasRecords(parsed)).toBe(true);
    });

    it('drops invalid entries and keeps valid ones', () => {
        const raw = JSON.stringify({
            ok: { c: 1, w: 2 },
            negative: { c: -1, w: 0 },
            fraction: { c: 1.5, w: 0 },
            missing: { c: 1 },
            notObject: 5,
        });
        expect(parseRecords(raw)).toEqual({ ok: { c: 1, w: 2 } });
    });
});

describe('storage: records', () => {
    it('a saved record set reads back the same', () => {
        const { storage } = fakeStorage();
        const records: WordRecords = { a: { c: 1, w: 2 }, b: { c: 0, w: 4 } };
        saveRecords(storage, records);
        expect(loadRecords(storage)).toEqual(records);
    });

    it('nothing stored reads as no records', () => {
        expect(loadRecords(fakeStorage().storage)).toEqual({});
    });

    it('a storage that throws reads as no records and saves without throwing', () => {
        expect(loadRecords(throwingStorage)).toEqual({});
        expect(() => saveRecords(throwingStorage, { a: { c: 1, w: 0 } })).not.toThrow();
        expect(() => clearRecords(throwingStorage)).not.toThrow();
    });

    it('no storage at all is fine too', () => {
        expect(loadRecords(undefined)).toEqual({});
        expect(() => saveRecords(undefined, { a: { c: 1, w: 0 } })).not.toThrow();
        expect(() => clearRecords(undefined)).not.toThrow();
    });

    it('clearing removes the records but keeps the toggle', () => {
        const { storage, data } = fakeStorage({ [TOGGLE_KEY]: 'false' });
        saveRecords(storage, { a: { c: 1, w: 1 } });
        clearRecords(storage);
        expect(loadRecords(storage)).toEqual({});
        expect(data.has(RECORDS_KEY)).toBe(false);
        expect(loadToggle(storage)).toBe(false);
    });

    it('records of words the data no longer has are kept as they are', () => {
        const { storage } = fakeStorage();
        saveRecords(storage, { gone: { c: 1, w: 1 } });
        expect(loadRecords(storage)).toEqual({ gone: { c: 1, w: 1 } });
    });
});

describe('storage: toggle', () => {
    it('on when nothing is stored, and for any value other than "false"', () => {
        expect(loadToggle(fakeStorage().storage)).toBe(true);
        expect(loadToggle(fakeStorage({ [TOGGLE_KEY]: 'true' }).storage)).toBe(true);
        expect(loadToggle(fakeStorage({ [TOGGLE_KEY]: 'garbage' }).storage)).toBe(true);
        expect(loadToggle(fakeStorage({ [TOGGLE_KEY]: '' }).storage)).toBe(true);
    });

    it('"false" is off', () => {
        expect(loadToggle(fakeStorage({ [TOGGLE_KEY]: 'false' }).storage)).toBe(false);
    });

    it('a saved choice reads back, as "true" / "false"', () => {
        const { storage, data } = fakeStorage();
        saveToggle(storage, false);
        expect(data.get(TOGGLE_KEY)).toBe('false');
        expect(loadToggle(storage)).toBe(false);
        saveToggle(storage, true);
        expect(data.get(TOGGLE_KEY)).toBe('true');
        expect(loadToggle(storage)).toBe(true);
    });

    it('a storage that throws, or none, reads as on and saves without throwing', () => {
        expect(loadToggle(throwingStorage)).toBe(true);
        expect(loadToggle(undefined)).toBe(true);
        expect(() => saveToggle(throwingStorage, false)).not.toThrow();
        expect(() => saveToggle(undefined, false)).not.toThrow();
    });
});

describe('getStorage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('is undefined without a window', () => {
        vi.stubGlobal('window', undefined);
        expect(getStorage()).toBeUndefined();
    });

    it('returns window.localStorage when it can be reached', () => {
        const { storage } = fakeStorage();
        vi.stubGlobal('window', { localStorage: storage });
        expect(getStorage()).toBe(storage);
    });

    it('is undefined when reading localStorage throws (blocked)', () => {
        vi.stubGlobal('window', {
            get localStorage(): never {
                throw new Error('SecurityError');
            },
        });
        expect(getStorage()).toBeUndefined();
    });
});

describe('weightFromRecords', () => {
    const entry = { id: 'a' } as KogoEntry;

    it('reads the records as they are when asked, so later answers count', () => {
        let records: WordRecords = {};
        const weightOf = weightFromRecords(() => records);
        expect(weightOf(entry)).toBe(1);
        records = { a: { c: 0, w: 3 } };
        expect(weightOf(entry)).toBe(5);
    });
});

describe('weightedShuffle', () => {
    it('puts the heavier word first when its key is larger (u 0.5 / 0.5: A=0.5, B=0.5^0.2=0.871)', () => {
        const weightOf = (s: string) => (s === 'B' ? 5 : 1);
        expect(weightedShuffle(['A', 'B'], weightOf, fixed([0.5, 0.5]))).toEqual(['B', 'A']);
    });

    it('and the lighter one first when it draws a much larger u (0.9 / 0.1: A=0.9, B=0.1^0.2=0.631)', () => {
        const weightOf = (s: string) => (s === 'B' ? 5 : 1);
        expect(weightedShuffle(['A', 'B'], weightOf, fixed([0.9, 0.1]))).toEqual(['A', 'B']);
    });

    it('with equal weights the order is by u, largest first', () => {
        expect(weightedShuffle(['x', 'y', 'z'], () => 1, fixed([0.2, 0.8, 0.5]))).toEqual(['y', 'z', 'x']);
    });

    it('equal keys keep the original order', () => {
        expect(weightedShuffle(['x', 'y', 'z'], () => 1, fixed([0.5, 0.5, 0.5]))).toEqual(['x', 'y', 'z']);
    });

    it('a draw of exactly 0 goes last', () => {
        expect(weightedShuffle(['x', 'y'], () => 1, fixed([0, 0.1]))).toEqual(['y', 'x']);
    });

    it('draws once per item, in order', () => {
        const draws = vi.fn(() => 0.5);
        weightedShuffle(['a', 'b', 'c'], () => 1, draws);
        expect(draws).toHaveBeenCalledTimes(3);
    });

    it('keeps every item once and does not change its input', () => {
        const items = ['a', 'b', 'c', 'd'];
        const out = weightedShuffle(items, (s) => (s === 'c' ? 4 : 1), seeded(7));
        expect(out.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
        expect(items).toEqual(['a', 'b', 'c', 'd']);
    });

    it('a 5x word comes first more often than a 1x word (expected 5/6 of the time)', () => {
        const rng = seeded(12345);
        let heavyFirst = 0;
        let lightFirst = 0;
        for (let i = 0; i < 2000; i++) {
            const first = weightedShuffle(['light', 'heavy'], (s) => (s === 'heavy' ? 5 : 1), rng)[0];
            if (first === 'heavy') heavyFirst++;
            else lightFirst++;
        }
        expect(lightFirst).toBeGreaterThan(0);
        expect(heavyFirst).toBeGreaterThan(lightFirst * 3);
    });
});

describe('the clear-records control', () => {
    const idle: ClearState = { phase: 'idle' };

    it('the first tap arms it and clears nothing', () => {
        expect(tapClear(idle, 1000)).toEqual({ state: { phase: 'armed', since: 1000 }, clear: false });
    });

    it('a second tap 2999 ms later clears and goes back to idle', () => {
        const armed = tapClear(idle, 1000).state;
        expect(tapClear(armed, 3999)).toEqual({ state: { phase: 'idle' }, clear: true });
    });

    it('a tap exactly 3000 ms later is a first tap again (armed anew, nothing cleared)', () => {
        const armed = tapClear(idle, 1000).state;
        expect(tapClear(armed, 4000)).toEqual({ state: { phase: 'armed', since: 4000 }, clear: false });
    });

    it('clearPhaseAt: armed until 2999 ms, idle from 3000 ms; idle stays idle', () => {
        const armed: ClearState = { phase: 'armed', since: 1000 };
        expect(clearPhaseAt(armed, 3999)).toEqual(armed);
        expect(clearPhaseAt(armed, 4000)).toEqual({ phase: 'idle' });
        expect(clearPhaseAt(idle, 99999)).toEqual(idle);
    });
});
