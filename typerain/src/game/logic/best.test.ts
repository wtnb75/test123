import { describe, expect, it } from 'vitest';
import { BestStore, formatBest, type KeyValueStorage } from './best';

class FakeStorage implements KeyValueStorage {
    data = new Map<string, string>();
    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }
}

const KEY = 'typerain:best';

describe('BestStore with a working storage', () => {
    it('has no record at first', () => {
        expect(new BestStore(() => new FakeStorage()).load()).toBeNull();
    });

    it('reads a stored best', () => {
        const s = new FakeStorage();
        s.data.set(KEY, '120');
        expect(new BestStore(() => s).load()).toBe(120);
    });

    it.each(['abc', '-3', '1.5', '', ' 7', '1e3', '99999999999999999999'])('ignores the stored value %j', (raw) => {
        const s = new FakeStorage();
        s.data.set(KEY, raw);
        expect(new BestStore(() => s).load()).toBeNull();
    });

    it('records a first score of 1 or more as a new best and saves it', () => {
        const s = new FakeStorage();
        const store = new BestStore(() => s);
        expect(store.record(1)).toEqual({ best: 1, isNew: true });
        expect(s.data.get(KEY)).toBe('1');
    });

    it('does not record a score of 0, even with no record', () => {
        const s = new FakeStorage();
        const store = new BestStore(() => s);
        expect(store.record(0)).toEqual({ best: null, isNew: false });
        expect(s.data.has(KEY)).toBe(false);
    });

    it('updates only when the score beats the best (a tie does not)', () => {
        const s = new FakeStorage();
        s.data.set(KEY, '100');
        const store = new BestStore(() => s);
        expect(store.record(100)).toEqual({ best: 100, isNew: false });
        expect(store.record(99)).toEqual({ best: 100, isNew: false });
        expect(store.record(101)).toEqual({ best: 101, isNew: true });
        expect(s.data.get(KEY)).toBe('101');
    });
});

describe('BestStore when the storage is unusable', () => {
    const throwing: KeyValueStorage = {
        getItem() {
            throw new Error('blocked');
        },
        setItem() {
            throw new Error('blocked');
        },
    };

    it('keeps the best in memory for this page when reading and writing both throw', () => {
        const store = new BestStore(() => throwing);
        expect(store.load()).toBeNull();
        expect(store.record(50)).toEqual({ best: 50, isNew: true });
        expect(store.load()).toBe(50);
        expect(store.record(40)).toEqual({ best: 50, isNew: false });
    });

    it('works when there is no storage at all', () => {
        const store = new BestStore(() => null);
        expect(store.record(5)).toEqual({ best: 5, isNew: true });
        expect(store.load()).toBe(5);
    });

    it('works when asking for the storage itself throws', () => {
        const store = new BestStore(() => {
            throw new Error('denied');
        });
        expect(store.record(9)).toEqual({ best: 9, isNew: true });
        expect(store.load()).toBe(9);
    });

    it('prefers the in-memory best when it is higher than a stored one that could not be updated', () => {
        const s = new FakeStorage();
        s.data.set(KEY, '10');
        let writable = true;
        const flaky: KeyValueStorage = {
            getItem: (k) => s.getItem(k),
            setItem: (k, v) => {
                if (!writable) throw new Error('full');
                s.setItem(k, v);
            },
        };
        const store = new BestStore(() => flaky);
        writable = false;
        expect(store.record(30)).toEqual({ best: 30, isNew: true });
        expect(store.load()).toBe(30);
        expect(s.data.get(KEY)).toBe('10');
    });
});

describe('formatBest', () => {
    it('shows --- without a record and the number with one', () => {
        expect(formatBest(null)).toBe('BEST ---');
        expect(formatBest(1230)).toBe('BEST 1230');
        expect(formatBest(0)).toBe('BEST 0');
    });
});
