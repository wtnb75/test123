import { describe, expect, it } from 'vitest';
import { BestStore, type KeyValueStorage } from 'best-store';
import { GAME_ID, formatBest, waveLabel } from './best';

class MapStorage implements KeyValueStorage {
    map = new Map<string, string>();
    getItem(key: string) {
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.map.set(key, value);
    }
}

const KEY = 'bouncewave.best';

describe('waveLabel', () => {
    it('writes the reached wave as "WAVE n"', () => {
        expect(waveLabel(5)).toBe('WAVE 5');
        expect(waveLabel(1)).toBe('WAVE 1');
    });
});

describe('formatBest', () => {
    it('shows the score and the saved label in the Title / Result format', () => {
        expect(formatBest({ score: 1230, label: 'WAVE 5' })).toBe('BEST 1230（WAVE 5）');
    });

    it('shows BEST --- when there is no record', () => {
        expect(formatBest(null)).toBe('BEST ---');
    });
});

describe('best record saved through best-store', () => {
    it('is saved under the key bouncewave.best as { score, label }', () => {
        const s = new MapStorage();
        const store = new BestStore(GAME_ID, () => s);
        expect(store.record(120, waveLabel(5))).toEqual({ best: { score: 120, label: 'WAVE 5' }, isNew: true });
        expect(JSON.parse(s.map.get(KEY)!)).toEqual({ score: 120, label: 'WAVE 5' });
    });

    it('saves a score of 0 as a new best when there is no record', () => {
        const s = new MapStorage();
        const store = new BestStore(GAME_ID, () => s);
        expect(store.record(0, waveLabel(1))?.isNew).toBe(true);
        expect(s.map.has(KEY)).toBe(true);
    });

    it('treats the old { score, wave } format as no record and overwrites it on the next play', () => {
        const s = new MapStorage();
        s.map.set(KEY, JSON.stringify({ score: 500, wave: 7 }));
        const store = new BestStore(GAME_ID, () => s);
        expect(store.load()).toBeNull();
        expect(formatBest(store.load())).toBe('BEST ---');
        expect(store.record(10, waveLabel(1))).toEqual({ best: { score: 10, label: 'WAVE 1' }, isNew: true });
        expect(JSON.parse(s.map.get(KEY)!)).toEqual({ score: 10, label: 'WAVE 1' });
    });
});
