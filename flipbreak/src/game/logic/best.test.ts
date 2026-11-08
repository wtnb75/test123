import { BestStore, type KeyValueStorage } from 'best-store';
import { describe, expect, it } from 'vitest';
import { GAME_ID, formatBest, recordPlay, stageLabel } from './best';

class MapStorage implements KeyValueStorage {
    map = new Map<string, string>();
    getItem(key: string) {
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.map.set(key, value);
    }
}

const KEY = 'flipbreak.best';
const TODAY = () => '2026-01-01';
const newStore = (s: MapStorage) => new BestStore(GAME_ID, () => s, TODAY);

describe('stageLabel / formatBest', () => {
    it('writes the reached stage as "STAGE n"', () => {
        expect(stageLabel(3)).toBe('STAGE 3');
        expect(stageLabel(5)).toBe('STAGE 5');
    });

    it('shows the score and the saved label in the Title / Result format', () => {
        expect(formatBest({ score: 1200, label: 'STAGE 3' })).toBe('BEST 1200（STAGE 3）');
    });

    it('shows BEST --- when there is no record', () => {
        expect(formatBest(null)).toBe('BEST ---');
    });
});

describe('recordPlay (through best-store)', () => {
    it('saves under flipbreak.best as { score, label, date } and reports a new best', () => {
        const s = new MapStorage();
        const r = recordPlay(newStore(s), { score: 1200, stage: 3 });
        expect(r).toEqual({ best: { score: 1200, label: 'STAGE 3', date: '2026-01-01' }, isNew: true });
        expect(JSON.parse(s.map.get(KEY)!)).toEqual({ score: 1200, label: 'STAGE 3', date: '2026-01-01' });
    });

    it('saves a score of 0 as a new best when there is no record', () => {
        const s = new MapStorage();
        expect(recordPlay(newStore(s), { score: 0, stage: 1 }).isNew).toBe(true);
        expect(s.map.has(KEY)).toBe(true);
    });

    it('does not update on a tie, and updates when the score is strictly higher', () => {
        const s = new MapStorage();
        const store = newStore(s);
        recordPlay(store, { score: 500, stage: 2 });
        expect(recordPlay(store, { score: 500, stage: 4 })).toEqual({
            best: { score: 500, label: 'STAGE 2', date: '2026-01-01' },
            isNew: false,
        });
        expect(recordPlay(store, { score: 501, stage: 4 }).best).toMatchObject({ score: 501, label: 'STAGE 4' });
    });

    it('records the all-clear as STAGE 5', () => {
        const s = new MapStorage();
        expect(recordPlay(newStore(s), { score: 13000, stage: 5 }).best?.label).toBe('STAGE 5');
    });

    it('falls back to the saved best when record() has nothing to record (a non-finite score)', () => {
        const s = new MapStorage();
        const store = newStore(s);
        recordPlay(store, { score: 300, stage: 2 });
        const r = recordPlay(store, { score: Number.NaN, stage: 3 });
        expect(r).toEqual({ best: { score: 300, label: 'STAGE 2', date: '2026-01-01' }, isNew: false });
    });

    it('treats a broken saved value as no record and overwrites it', () => {
        const s = new MapStorage();
        s.map.set(KEY, 'not json');
        const store = newStore(s);
        expect(store.load()).toBeNull();
        expect(recordPlay(store, { score: 10, stage: 1 }).isNew).toBe(true);
    });
});
