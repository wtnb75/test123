import { describe, expect, it } from 'vitest';
import { BestStore, type KeyValueStorage } from 'best-store';
import { bestRowText, NEW_BEST_TEXT, recordRun, runRecord, titleBestText } from './best';

class MapStorage implements KeyValueStorage {
    map = new Map<string, string>();
    sets = 0;
    gets = 0;
    getItem(key: string) {
        this.gets++;
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.sets++;
        this.map.set(key, value);
    }
}

const KEY = 'stepup.best';
const newStore = (s: KeyValueStorage | null = new MapStorage()) => new BestStore('stepup', () => s, () => '2026-01-02');

describe('runRecord (what a run saves; docs/spec.md "自己ベスト（記録）")', () => {
    it('saves a failed run as its height, labelled "<h> m"', () => {
        expect(runRecord('hit', 137)).toEqual({ score: 137, label: '137 m' });
        expect(runRecord('left-behind', 12)).toEqual({ score: 12, label: '12 m' });
    });

    it('does not record 0 m but records 1 m (boundary)', () => {
        expect(runRecord('hit', 0)).toBeNull();
        expect(runRecord('left-behind', 0)).toBeNull();
        expect(runRecord('hit', 1)).toEqual({ score: 1, label: '1 m' });
    });

    it('saves a clear as 201 labelled "200 m クリア"', () => {
        expect(runRecord('clear', 200)).toEqual({ score: 201, label: '200 m クリア' });
    });

    it('saves a failure that reached the goal height as 200 labelled "200 m" (below a clear)', () => {
        const failed = runRecord('hit', 200)!;
        const cleared = runRecord('clear', 200)!;
        expect(failed).toEqual({ score: 200, label: '200 m' });
        expect(cleared.score).toBeGreaterThan(failed.score);
    });

    it('does not record a non-finite height', () => {
        expect(runRecord('hit', Number.NaN)).toBeNull();
    });
});

describe('bestRowText', () => {
    it('builds the row from the saved label', () => {
        expect(bestRowText('137 m')).toBe('自己ベスト 137 m');
        expect(bestRowText('200 m クリア')).toBe('自己ベスト 200 m クリア');
    });
});

describe('recordRun (the row Result shows)', () => {
    it('shows NEW BEST! and saves { score, label } under stepup.best on the first record', () => {
        const s = new MapStorage();
        const row = recordRun(newStore(s), 'hit', 137);
        expect(row).toEqual({ text: NEW_BEST_TEXT, isNew: true });
        expect(JSON.parse(s.map.get(KEY)!)).toEqual({ score: 137, label: '137 m', date: '2026-01-02' });
    });

    it('shows the saved best, not NEW BEST!, on a tie or a lower height', () => {
        const store = newStore();
        recordRun(store, 'hit', 137);
        expect(recordRun(store, 'hit', 137)).toEqual({ text: '自己ベスト 137 m', isNew: false });
        expect(recordRun(store, 'left-behind', 136)).toEqual({ text: '自己ベスト 137 m', isNew: false });
    });

    it('shows NEW BEST! again when the height is exceeded by one', () => {
        const store = newStore();
        recordRun(store, 'hit', 137);
        expect(recordRun(store, 'hit', 138)).toEqual({ text: NEW_BEST_TEXT, isNew: true });
        expect(titleBestText(store)).toBe('自己ベスト 138 m');
    });

    it('treats a clear after a 200 m failure as a new best, and never lets a later failure replace a clear', () => {
        const store = newStore();
        expect(recordRun(store, 'hit', 200)?.isNew).toBe(true);
        expect(recordRun(store, 'clear', 200)).toEqual({ text: NEW_BEST_TEXT, isNew: true });
        expect(titleBestText(store)).toBe('自己ベスト 200 m クリア');
        expect(recordRun(store, 'hit', 200)).toEqual({ text: '自己ベスト 200 m クリア', isNew: false });
        expect(recordRun(store, 'left-behind', 199)).toEqual({ text: '自己ベスト 200 m クリア', isNew: false });
        expect(recordRun(store, 'clear', 200)).toEqual({ text: '自己ベスト 200 m クリア', isNew: false });
    });

    it('with 0 m and no record: saves nothing and shows no row', () => {
        const s = new MapStorage();
        expect(recordRun(newStore(s), 'hit', 0)).toBeNull();
        expect(s.sets).toBe(0);
    });

    it('with 0 m and an existing record: saves nothing and shows the saved best', () => {
        const store = newStore();
        recordRun(store, 'hit', 50);
        expect(recordRun(store, 'left-behind', 0)).toEqual({ text: '自己ベスト 50 m', isNew: false });
    });

    it('writes at most once per call (once per Result)', () => {
        const s = new MapStorage();
        const store = newStore(s);
        recordRun(store, 'hit', 10);
        expect(s.sets).toBe(1);
        recordRun(store, 'hit', 5);
        expect(s.sets).toBe(1);
    });

    it('keeps working when the storage is unavailable (memory only)', () => {
        const store = newStore(null);
        expect(recordRun(store, 'hit', 30)).toEqual({ text: NEW_BEST_TEXT, isNew: true });
        expect(recordRun(store, 'hit', 20)).toEqual({ text: '自己ベスト 30 m', isNew: false });
    });

    it('keeps working when reading and writing the storage throw (memory only)', () => {
        const throwing: KeyValueStorage = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('full');
            },
        };
        const store = newStore(throwing);
        expect(recordRun(store, 'hit', 30)).toEqual({ text: NEW_BEST_TEXT, isNew: true });
        expect(titleBestText(store)).toBe('自己ベスト 30 m');
    });

    it('treats a broken stored value as no record', () => {
        const s = new MapStorage();
        s.map.set(KEY, '{broken');
        expect(titleBestText(newStore(s))).toBeNull();
        expect(recordRun(newStore(s), 'hit', 5)).toEqual({ text: NEW_BEST_TEXT, isNew: true });
    });
});

describe('titleBestText (the row Title shows)', () => {
    it('is null without a record', () => {
        expect(titleBestText(newStore())).toBeNull();
    });

    it('reads the store on every call, so Title shows the latest record after coming back from Result', () => {
        const s = new MapStorage();
        const store = newStore(s);
        expect(titleBestText(store)).toBeNull();
        recordRun(store, 'hit', 88);
        expect(titleBestText(store)).toBe('自己ベスト 88 m');
        expect(titleBestText(newStore(s))).toBe('自己ベスト 88 m');
        const reads = s.gets;
        titleBestText(store);
        expect(s.gets).toBeGreaterThan(reads);
    });
});
