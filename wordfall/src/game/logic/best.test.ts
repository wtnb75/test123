import { describe, expect, it } from 'vitest';
import { BestStore, formatBest, type KeyValueStorage } from './best';

/** An in-memory Storage that can be told to fail. */
function fakeStorage(initial?: string, opts: { failRead?: boolean; failWrite?: boolean } = {}) {
    const data = new Map<string, string>();
    if (initial !== undefined) data.set('wordfall:best', initial);
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

describe('BestStore.record (docs/spec.md "自己ベスト")', () => {
    it('starts with no record, and a score of 0 does not create one', () => {
        const { storage, data } = fakeStorage();
        const store = new BestStore(() => storage);
        expect(store.load()).toBeNull();
        expect(store.record(0)).toEqual({ best: null, isNew: false });
        expect(data.size).toBe(0);
    });

    it('records any score of 1 or more when there is no record', () => {
        const { storage, data } = fakeStorage();
        const store = new BestStore(() => storage);
        expect(store.record(1)).toEqual({ best: 1, isNew: true });
        expect(data.get('wordfall:best')).toBe('1');
    });

    it('updates only when the score beats the best: a tie does not, one more does', () => {
        const { storage, data } = fakeStorage('100');
        const store = new BestStore(() => storage);
        expect(store.record(99)).toEqual({ best: 100, isNew: false });
        expect(store.record(100)).toEqual({ best: 100, isNew: false });
        expect(store.record(101)).toEqual({ best: 101, isNew: true });
        expect(data.get('wordfall:best')).toBe('101');
        expect(store.load()).toBe(101);
    });

    it('treats a stored best of 0 as a record that a score of 1 beats', () => {
        const { storage } = fakeStorage('0');
        const store = new BestStore(() => storage);
        expect(store.load()).toBe(0);
        expect(store.record(0).isNew).toBe(false);
        expect(store.record(1)).toEqual({ best: 1, isNew: true });
    });
});

describe('BestStore with bad or unavailable storage', () => {
    it.each(['abc', '-3', '1.5', '', ' 7', '1e3', '99999999999999999999'])('treats the stored value %j as no record', (raw) => {
        const { storage } = fakeStorage(raw);
        expect(new BestStore(() => storage).load()).toBeNull();
    });

    it('keeps the best in memory when reading throws', () => {
        const { storage } = fakeStorage('50', { failRead: true });
        const store = new BestStore(() => storage);
        expect(store.load()).toBeNull();
        expect(store.record(10)).toEqual({ best: 10, isNew: true });
        expect(store.load()).toBe(10);
        expect(store.record(10).isNew).toBe(false);
        expect(store.record(11).isNew).toBe(true);
    });

    it('keeps the best in memory when writing throws, and prefers it over an older stored value', () => {
        const { storage } = fakeStorage('10', { failWrite: true });
        const store = new BestStore(() => storage);
        expect(store.record(20)).toEqual({ best: 20, isNew: true });
        expect(store.load()).toBe(20);
        expect(store.record(15)).toEqual({ best: 20, isNew: false });
    });

    it('prefers a newer stored value over the in-memory one', () => {
        const { storage, data } = fakeStorage('10', { failWrite: true });
        const store = new BestStore(() => storage);
        store.record(20);
        data.set('wordfall:best', '30');
        expect(store.load()).toBe(30);
    });

    it('works with no storage at all (the lookup returns null)', () => {
        const store = new BestStore(() => null);
        expect(store.load()).toBeNull();
        expect(store.record(5)).toEqual({ best: 5, isNew: true });
        expect(store.load()).toBe(5);
    });
});

describe('formatBest', () => {
    it('shows the number, or --- when there is no record', () => {
        expect(formatBest(1230)).toBe('BEST 1230');
        expect(formatBest(0)).toBe('BEST 0');
        expect(formatBest(null)).toBe('BEST ---');
    });
});
