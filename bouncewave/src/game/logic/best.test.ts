import { describe, expect, it } from 'vitest';
import { BEST_KEY, BestStore, formatBest, type KeyValueStorage } from './best';

class MapStorage implements KeyValueStorage {
    map = new Map<string, string>();
    getItem(key: string) {
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.map.set(key, value);
    }
}

const storeWith = (raw?: string) => {
    const s = new MapStorage();
    if (raw !== undefined) s.map.set(BEST_KEY, raw);
    return { s, store: new BestStore(() => s) };
};

describe('BestStore.record', () => {
    it('with no record, saves 120 and reports a new best', () => {
        const { s, store } = storeWith();
        expect(store.record(120, 3)).toEqual({ best: { score: 120, wave: 3 }, isNew: true });
        expect(JSON.parse(s.map.get(BEST_KEY)!)).toEqual({ score: 120, wave: 3 });
    });

    it('with no record, saves even a score of 0 as a new best', () => {
        const { s, store } = storeWith();
        expect(store.record(0, 1)).toEqual({ best: { score: 0, wave: 1 }, isNew: true });
        expect(s.map.has(BEST_KEY)).toBe(true);
    });

    it('a tie with the saved best does not update it', () => {
        const { s, store } = storeWith(JSON.stringify({ score: 120, wave: 3 }));
        expect(store.record(120, 5)).toEqual({ best: { score: 120, wave: 3 }, isNew: false });
        expect(JSON.parse(s.map.get(BEST_KEY)!)).toEqual({ score: 120, wave: 3 });
    });

    it('one point more than the saved best updates it', () => {
        const { s, store } = storeWith(JSON.stringify({ score: 120, wave: 3 }));
        expect(store.record(121, 4)).toEqual({ best: { score: 121, wave: 4 }, isNew: true });
        expect(JSON.parse(s.map.get(BEST_KEY)!)).toEqual({ score: 121, wave: 4 });
    });

    it('when writing throws, keeps the best in memory and does not throw', () => {
        const s: KeyValueStorage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
        };
        const store = new BestStore(() => s);
        expect(store.record(50, 2)).toEqual({ best: { score: 50, wave: 2 }, isNew: true });
        expect(store.load()).toEqual({ score: 50, wave: 2 });
        expect(store.record(40, 2)).toEqual({ best: { score: 50, wave: 2 }, isNew: false });
    });

    it('with no storage at all, works from memory', () => {
        const store = new BestStore(() => null);
        expect(store.load()).toBeNull();
        expect(store.record(30, 1).isNew).toBe(true);
        expect(store.load()).toEqual({ score: 30, wave: 1 });
    });

    it('when even getting the storage throws, works from memory', () => {
        const store = new BestStore(() => {
            throw new Error('SecurityError');
        });
        expect(store.load()).toBeNull();
        expect(store.record(30, 1).isNew).toBe(true);
        expect(store.load()).toEqual({ score: 30, wave: 1 });
    });
});

describe('BestStore.load', () => {
    it('reads a saved best', () => {
        expect(storeWith(JSON.stringify({ score: 70, wave: 2 })).store.load()).toEqual({ score: 70, wave: 2 });
    });

    it('treats broken JSON as no record', () => {
        expect(storeWith('{').store.load()).toBeNull();
    });

    it('treats non-number fields as no record', () => {
        expect(storeWith(JSON.stringify({ score: 'a', wave: 1 })).store.load()).toBeNull();
        expect(storeWith(JSON.stringify({ score: 10, wave: '2' })).store.load()).toBeNull();
        expect(storeWith(JSON.stringify({ score: 10 })).store.load()).toBeNull();
    });

    it('treats JSON null or a plain number as no record', () => {
        expect(storeWith('null').store.load()).toBeNull();
        expect(storeWith('42').store.load()).toBeNull();
    });

    it('treats a throwing read as no record', () => {
        const store = new BestStore(() => ({
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {},
        }));
        expect(store.load()).toBeNull();
    });

    it('prefers a higher saved best over a lower one kept in memory', () => {
        const s = new MapStorage();
        let failWrites = true;
        const store = new BestStore(() => ({
            getItem: (k) => s.getItem(k),
            setItem: (k, v) => {
                if (failWrites) throw new Error('full');
                s.setItem(k, v);
            },
        }));
        store.record(50, 2); // memory only
        failWrites = false;
        s.map.set(BEST_KEY, JSON.stringify({ score: 80, wave: 3 })); // e.g. written by another tab
        expect(store.load()).toEqual({ score: 80, wave: 3 });
    });
});

describe('formatBest', () => {
    it('shows score and wave, or dashes with no record', () => {
        expect(formatBest({ score: 1230, wave: 5 })).toBe('BEST 1230（WAVE 5）');
        expect(formatBest(null)).toBe('BEST ---');
    });
});
