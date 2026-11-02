import { describe, expect, it } from 'vitest';
import { BestStore, type KeyValueStorage } from 'best-store';
import { bestLabel, formatBest, loadBest, recordBest } from './best';

const KEY = 'typerain.best';
const OLD_KEY = 'typerain:best';

/** An in-memory Storage that can be told to fail. */
function fakeStorage(initial: Record<string, string> = {}, opts: { failRead?: boolean; failWrite?: boolean } = {}) {
    const data = new Map<string, string>(Object.entries(initial));
    const storage: KeyValueStorage = {
        getItem(key) {
            if (opts.failRead) throw new Error('read denied');
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            if (opts.failWrite) throw new Error('quota');
            data.set(key, value);
        },
    };
    return { storage, data };
}

const TODAY = '2026-11-03';

/** The stored form written out by hand (spec: {"score": n, "label": "SCORE n", "date": "YYYY-MM-DD"}). */
const stored = (score: number) => `{"score":${score},"label":"SCORE ${score}","date":"${TODAY}"}`;
const storeOf = (storage: KeyValueStorage | null) => new BestStore('typerain', () => storage, () => TODAY);

describe('recordBest (docs/spec.md "自己ベスト")', () => {
    it('starts with no record, and a score of 0 writes nothing', () => {
        const { storage, data } = fakeStorage();
        const store = storeOf(storage);
        expect(loadBest(store)).toBeNull();
        expect(recordBest(store, 0)).toEqual({ best: null, isNew: false });
        expect(data.size).toBe(0);
    });

    it('records any score of 1 or more when there is no record, as {score, label} under typerain.best', () => {
        const { storage, data } = fakeStorage();
        expect(recordBest(storeOf(storage), 1230)).toEqual({ best: 1230, isNew: true });
        expect(data.get(KEY)).toBe(stored(1230));
    });

    it('records a first score of exactly 1', () => {
        const { storage } = fakeStorage();
        expect(recordBest(storeOf(storage), 1)).toEqual({ best: 1, isNew: true });
    });

    it('updates only when the score beats the best: a tie does not, one more does', () => {
        const { storage, data } = fakeStorage({ [KEY]: stored(100) });
        const store = storeOf(storage);
        expect(recordBest(store, 99)).toEqual({ best: 100, isNew: false });
        expect(recordBest(store, 100)).toEqual({ best: 100, isNew: false });
        expect(data.get(KEY)).toBe(stored(100));
        expect(recordBest(store, 101)).toEqual({ best: 101, isNew: true });
        expect(data.get(KEY)).toBe(stored(101));
        expect(loadBest(store)).toBe(101);
    });

    it('does not record a score of 0 even when a best exists', () => {
        const { storage, data } = fakeStorage({ [KEY]: stored(40) });
        expect(recordBest(storeOf(storage), 0)).toEqual({ best: 40, isNew: false });
        expect(data.get(KEY)).toBe(stored(40));
    });

    it('treats a stored best of 0 as a record that a score of 1 beats, while a score of 0 still does not', () => {
        const { storage } = fakeStorage({ [KEY]: stored(0) });
        const store = storeOf(storage);
        expect(loadBest(store)).toBe(0);
        expect(recordBest(store, 0)).toEqual({ best: 0, isNew: false });
        expect(recordBest(store, 1)).toEqual({ best: 1, isNew: true });
    });

    it('ignores a score that is not a finite number', () => {
        const { storage, data } = fakeStorage();
        expect(recordBest(storeOf(storage), Number.NaN)).toEqual({ best: null, isNew: false });
        expect(data.size).toBe(0);
    });

    it('does not read the old typerain:best key', () => {
        const { storage } = fakeStorage({ [OLD_KEY]: '500' });
        const store = storeOf(storage);
        expect(loadBest(store)).toBeNull();
        expect(recordBest(store, 10)).toEqual({ best: 10, isNew: true });
    });
});

describe('best store with bad or unavailable storage', () => {
    it.each(['abc', '500', '-3', '1.5', '{"score":"1","label":"SCORE 1"}', '{"score":1}', 'null', ''])(
        'treats the stored value %j as no record',
        (raw) => {
            const { storage } = fakeStorage({ [KEY]: raw });
            expect(loadBest(storeOf(storage))).toBeNull();
        }
    );

    it('keeps the best in memory when reading throws', () => {
        const { storage } = fakeStorage({ [KEY]: stored(50) }, { failRead: true });
        const store = storeOf(storage);
        expect(loadBest(store)).toBeNull();
        expect(recordBest(store, 10)).toEqual({ best: 10, isNew: true });
        expect(loadBest(store)).toBe(10);
        expect(recordBest(store, 10).isNew).toBe(false);
        expect(recordBest(store, 11).isNew).toBe(true);
    });

    it('keeps the best in memory when writing throws, and prefers it over an older stored value', () => {
        const { storage } = fakeStorage({ [KEY]: stored(10) }, { failWrite: true });
        const store = storeOf(storage);
        expect(recordBest(store, 20)).toEqual({ best: 20, isNew: true });
        expect(loadBest(store)).toBe(20);
        expect(recordBest(store, 15)).toEqual({ best: 20, isNew: false });
    });

    it('works with no storage at all (the lookup returns null)', () => {
        const store = storeOf(null);
        expect(loadBest(store)).toBeNull();
        expect(recordBest(store, 5)).toEqual({ best: 5, isNew: true });
        expect(loadBest(store)).toBe(5);
    });

    it('works when asking for the storage itself throws', () => {
        const store = new BestStore('typerain', () => {
            throw new Error('denied');
        });
        expect(recordBest(store, 9)).toEqual({ best: 9, isNew: true });
        expect(loadBest(store)).toBe(9);
    });
});

describe('bestLabel and formatBest', () => {
    it('labels the record for the index page as SCORE <score>', () => {
        expect(bestLabel(1230)).toBe('SCORE 1230');
    });

    it('shows the number on screen as BEST <score>, or --- when there is no record', () => {
        expect(formatBest(1230)).toBe('BEST 1230');
        expect(formatBest(0)).toBe('BEST 0');
        expect(formatBest(null)).toBe('BEST ---');
    });
});
