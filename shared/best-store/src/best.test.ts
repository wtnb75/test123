import { describe, expect, it } from 'vitest';
import { BestStore, bestKey, browserStorage, parseBest, type KeyValueStorage } from './best';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
    const data = { ...initial };
    return {
        data,
        getItem: (k) => data[k] ?? null,
        setItem: (k, v) => {
            data[k] = v;
        }
    };
}

const throwing: KeyValueStorage = {
    getItem: () => {
        throw new Error('denied');
    },
    setItem: () => {
        throw new Error('quota');
    }
};

describe('bestKey', () => {
    it('is "<game-dir>.best"', () => {
        expect(bestKey('bouncewave')).toBe('bouncewave.best');
    });
});

describe('parseBest', () => {
    it('reads a valid value', () => {
        expect(parseBest('{"score":8,"label":"WAVE 8"}')).toEqual({ score: 8, label: 'WAVE 8' });
    });

    it('accepts zero and negative scores and an empty label', () => {
        expect(parseBest('{"score":0,"label":""}')).toEqual({ score: 0, label: '' });
        expect(parseBest('{"score":-3,"label":"x"}')).toEqual({ score: -3, label: 'x' });
    });

    it.each([
        ['null input', null],
        ['broken JSON', '{score'],
        ['a bare number', '12'],
        ['JSON null', 'null'],
        ['missing label', '{"score":1}'],
        ['missing score', '{"label":"x"}'],
        ['string score', '{"score":"1","label":"x"}'],
        ['non-string label', '{"score":1,"label":2}'],
        ['non-finite score', '{"score":1e999,"label":"x"}']
    ])('returns null for %s', (_name, raw) => {
        expect(parseBest(raw)).toBeNull();
    });
});

describe('browserStorage', () => {
    it('is null when there is no localStorage', () => {
        expect(browserStorage()).toBeNull();
    });

    it('returns the global localStorage when present', () => {
        const fake = memoryStorage();
        Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
        try {
            expect(browserStorage()).toBe(fake);
        } finally {
            Reflect.deleteProperty(globalThis, 'localStorage');
        }
    });

    it('is null when reading localStorage throws', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            get: () => {
                throw new Error('SecurityError');
            },
            configurable: true
        });
        try {
            expect(browserStorage()).toBeNull();
        } finally {
            Reflect.deleteProperty(globalThis, 'localStorage');
        }
    });
});

describe('BestStore', () => {
    it('has no best before anything is recorded', () => {
        expect(new BestStore('g', () => memoryStorage()).load()).toBeNull();
    });

    it('saves the first play as a new best under <game>.best', () => {
        const storage = memoryStorage();
        const store = new BestStore('g', () => storage);
        expect(store.record(5, 'WAVE 5')).toEqual({ best: { score: 5, label: 'WAVE 5' }, isNew: true });
        expect(JSON.parse(storage.data['g.best'])).toEqual({ score: 5, label: 'WAVE 5' });
        expect(store.key).toBe('g.best');
    });

    it('replaces the best only with a strictly higher score', () => {
        const storage = memoryStorage();
        const store = new BestStore('g', () => storage);
        store.record(5, 'a');
        expect(store.record(5, 'b')).toEqual({ best: { score: 5, label: 'a' }, isNew: false });
        expect(store.record(3, 'c')).toEqual({ best: { score: 5, label: 'a' }, isNew: false });
        expect(store.record(9, 'd')).toEqual({ best: { score: 9, label: 'd' }, isNew: true });
        expect(store.load()).toEqual({ score: 9, label: 'd' });
    });

    it('beats a record saved by an earlier page', () => {
        const storage = memoryStorage({ 'g.best': '{"score":7,"label":"old"}' });
        const store = new BestStore('g', () => storage);
        expect(store.load()).toEqual({ score: 7, label: 'old' });
        expect(store.record(6, 'x')?.isNew).toBe(false);
        expect(store.record(8, 'new')?.isNew).toBe(true);
    });

    it('treats a corrupted saved value as no record and overwrites it', () => {
        const storage = memoryStorage({ 'g.best': 'garbage' });
        const store = new BestStore('g', () => storage);
        expect(store.load()).toBeNull();
        expect(store.record(1, 'x')?.isNew).toBe(true);
        expect(parseBest(storage.data['g.best'])).toEqual({ score: 1, label: 'x' });
    });

    it('ignores a score that is not a finite number', () => {
        const storage = memoryStorage();
        const store = new BestStore('g', () => storage);
        expect(store.record(Number.NaN, 'x')).toBeNull();
        expect(store.record(Infinity, 'x')).toBeNull();
        expect(storage.data).toEqual({});
    });

    it('keeps the best in memory when the storage cannot be written', () => {
        const store = new BestStore('g', () => throwing);
        expect(store.load()).toBeNull();
        expect(store.record(4, 'a')).toEqual({ best: { score: 4, label: 'a' }, isNew: true });
        expect(store.load()).toEqual({ score: 4, label: 'a' });
        expect(store.record(2, 'b')?.isNew).toBe(false);
        expect(store.record(6, 'c')?.isNew).toBe(true);
    });

    it('works without any storage (in memory only)', () => {
        const store = new BestStore('g', () => null);
        expect(store.record(3, 'a')?.isNew).toBe(true);
        expect(store.load()).toEqual({ score: 3, label: 'a' });
    });

    it('prefers the saved best over a lower in-memory one', () => {
        let storage: KeyValueStorage | null = throwing;
        const store = new BestStore('g', () => storage);
        store.record(4, 'mem');
        storage = memoryStorage({ 'g.best': '{"score":10,"label":"saved"}' });
        expect(store.load()).toEqual({ score: 10, label: 'saved' });
    });

    it('defaults to the browser storage', () => {
        const fake = memoryStorage();
        Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
        try {
            new BestStore('g').record(2, 'two');
            expect(fake.data['g.best']).toBe('{"score":2,"label":"two"}');
        } finally {
            Reflect.deleteProperty(globalThis, 'localStorage');
        }
    });
});
