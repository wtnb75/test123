import { describe, expect, it } from 'vitest';
import { BestStore, bestKey, browserStorage, localDateString, parseBest, type KeyValueStorage } from './best';

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

const TODAY = '2026-11-03';

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

    it('reads the date when it is a YYYY-MM-DD string', () => {
        expect(parseBest('{"score":8,"label":"WAVE 8","date":"2026-11-03"}')).toEqual({
            score: 8,
            label: 'WAVE 8',
            date: '2026-11-03'
        });
    });

    it.each([
        ['a number', '20261103'],
        ['a non-date string', '"yesterday"'],
        ['a time stamp', '"2026-11-03T10:00:00"'],
        ['null', 'null']
    ])('drops a date that is %s but keeps the record', (_name, date) => {
        expect(parseBest(`{"score":8,"label":"WAVE 8","date":${date}}`)).toEqual({ score: 8, label: 'WAVE 8' });
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
        expect(new BestStore('g', () => memoryStorage(), () => TODAY).load()).toBeNull();
    });

    it('saves the first play as a new best under <game>.best', () => {
        const storage = memoryStorage();
        const store = new BestStore('g', () => storage, () => TODAY);
        expect(store.record(5, 'WAVE 5')).toEqual({ best: { score: 5, label: 'WAVE 5', date: TODAY }, isNew: true });
        expect(JSON.parse(storage.data['g.best'])).toEqual({ score: 5, label: 'WAVE 5', date: TODAY });
        expect(store.key).toBe('g.best');
    });

    it('replaces the best only with a strictly higher score', () => {
        const storage = memoryStorage();
        const store = new BestStore('g', () => storage, () => TODAY);
        store.record(5, 'a');
        expect(store.record(5, 'b')).toEqual({ best: { score: 5, label: 'a', date: TODAY }, isNew: false });
        expect(store.record(3, 'c')).toEqual({ best: { score: 5, label: 'a', date: TODAY }, isNew: false });
        expect(store.record(9, 'd')).toEqual({ best: { score: 9, label: 'd', date: TODAY }, isNew: true });
        expect(store.load()).toEqual({ score: 9, label: 'd', date: TODAY });
    });

    it('beats a record saved by an earlier page', () => {
        const storage = memoryStorage({ 'g.best': '{"score":7,"label":"old"}' });
        const store = new BestStore('g', () => storage, () => TODAY);
        expect(store.load()).toEqual({ score: 7, label: 'old' });
        expect(store.record(6, 'x')?.isNew).toBe(false);
        expect(store.record(8, 'new')?.isNew).toBe(true);
    });

    it('treats a corrupted saved value as no record and overwrites it', () => {
        const storage = memoryStorage({ 'g.best': 'garbage' });
        const store = new BestStore('g', () => storage, () => TODAY);
        expect(store.load()).toBeNull();
        expect(store.record(1, 'x')?.isNew).toBe(true);
        expect(parseBest(storage.data['g.best'])).toEqual({ score: 1, label: 'x', date: TODAY });
    });

    it('ignores a score that is not a finite number', () => {
        const storage = memoryStorage();
        const store = new BestStore('g', () => storage, () => TODAY);
        expect(store.record(Number.NaN, 'x')).toBeNull();
        expect(store.record(Infinity, 'x')).toBeNull();
        expect(storage.data).toEqual({});
    });

    it('keeps the best in memory when the storage cannot be written', () => {
        const store = new BestStore('g', () => throwing, () => TODAY);
        expect(store.load()).toBeNull();
        expect(store.record(4, 'a')).toEqual({ best: { score: 4, label: 'a', date: TODAY }, isNew: true });
        expect(store.load()).toEqual({ score: 4, label: 'a', date: TODAY });
        expect(store.record(2, 'b')?.isNew).toBe(false);
        expect(store.record(6, 'c')?.isNew).toBe(true);
    });

    it('works without any storage (in memory only)', () => {
        const store = new BestStore('g', () => null, () => TODAY);
        expect(store.record(3, 'a')?.isNew).toBe(true);
        expect(store.load()).toEqual({ score: 3, label: 'a', date: TODAY });
    });

    it('prefers the saved best over a lower in-memory one', () => {
        let storage: KeyValueStorage | null = throwing;
        const store = new BestStore('g', () => storage, () => TODAY);
        store.record(4, 'mem');
        storage = memoryStorage({ 'g.best': '{"score":10,"label":"saved"}' });
        expect(store.load()).toEqual({ score: 10, label: 'saved' });
    });

    it('keeps the date of the first play that set the record when a later play ties or falls short', () => {
        const storage = memoryStorage();
        let day = '2026-11-01';
        const store = new BestStore('g', () => storage, () => day);
        store.record(5, 'a');
        day = '2026-11-02';
        expect(store.record(5, 'b')?.best.date).toBe('2026-11-01');
        expect(store.record(3, 'c')?.best.date).toBe('2026-11-01');
        day = '2026-11-03';
        expect(store.record(6, 'd')?.best.date).toBe('2026-11-03');
    });

    it('reads a record saved before the date existed and replaces it with a dated one', () => {
        const storage = memoryStorage({ 'g.best': '{"score":7,"label":"old"}' });
        const store = new BestStore('g', () => storage, () => TODAY);
        expect(store.load()).toEqual({ score: 7, label: 'old' });
        expect(store.record(8, 'new')?.best).toEqual({ score: 8, label: 'new', date: TODAY });
    });

    it('defaults to the browser storage', () => {
        const fake = memoryStorage();
        Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
        try {
            new BestStore('g').record(2, 'two');
            expect(JSON.parse(fake.data['g.best'])).toEqual({ score: 2, label: 'two', date: localDateString() });
        } finally {
            Reflect.deleteProperty(globalThis, 'localStorage');
        }
    });
});

describe('localDateString', () => {
    it('formats the local date as YYYY-MM-DD with zero padding', () => {
        expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
        expect(localDateString(new Date(2026, 10, 30, 0, 0))).toBe('2026-11-30');
    });

    it('uses the current date when no date is given', () => {
        expect(localDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
