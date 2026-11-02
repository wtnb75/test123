import { BestStore, type KeyValueStorage } from 'best-store';
import { describe, expect, it, vi } from 'vitest';
import { GAME_ID, getBestStreakStore, recordBestStreak, recordFinishedRound, streakLabel } from './bestStreak';
import { createDailyStorage, DAILY_STORAGE_KEY, type DailyBackend } from './daily';
import { createStatsStorage } from './stats';

/** A Map-backed fake of `localStorage` (both `KeyValueStorage` and `DailyBackend` fit it). */
const memoryStorage = (): KeyValueStorage & DailyBackend & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        }
    };
};

/** Stats, daily save and best on the one shared storage, like the page's `localStorage`. */
const setup = () => {
    const storage = memoryStorage();
    return {
        storage,
        best: new BestStore(GAME_ID, () => storage),
        stats: createStatsStorage(storage),
        daily: createDailyStorage(storage)
    };
};

describe('streakLabel', () => {
    it('writes 連勝 N in ja and Streak N in en, with N unrounded', () => {
        expect(streakLabel('ja', 1)).toBe('連勝 1');
        expect(streakLabel('en', 1)).toBe('Streak 1');
        expect(streakLabel('ja', 1000)).toBe('連勝 1000');
        expect(streakLabel('en', 1000)).toBe('Streak 1000');
    });
});

describe('recordBestStreak', () => {
    it('passes the streak and its label to the recorder', () => {
        const record = vi.fn();

        recordBestStreak({ record }, 'en', 4);
        expect(record).toHaveBeenCalledExactlyOnceWith(4, 'Streak 4');
    });
});

describe('recordFinishedRound', () => {
    it('stores {1, 連勝 1} under digdle.best on a first win with no earlier best', () => {
        const { storage, best, stats } = setup();

        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        expect(JSON.parse(storage.data.get('digdle.best') ?? 'null')).toEqual({ score: 1, label: '連勝 1', date: expect.any(String) });
    });

    it('uses the English label when the win happens in en', () => {
        const { best, stats } = setup();

        recordFinishedRound(stats, best, 'en', 'normal', 4, true, 3);
        expect(best.load()).toEqual({ score: 1, label: 'Streak 1', date: expect.any(String) });
    });

    it('raises the best as the streak grows, and keeps it on a loss without touching the recorder', () => {
        const { best, stats } = setup();
        const record = vi.spyOn(best, 'record');

        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 2);
        expect(best.load()).toEqual({ score: 2, label: '連勝 2', date: expect.any(String) });

        record.mockClear();
        recordFinishedRound(stats, best, 'ja', 'normal', 4, false, 5);
        expect(record).not.toHaveBeenCalled();
        expect(best.load()).toEqual({ score: 2, label: '連勝 2', date: expect.any(String) });
    });

    it('does not replace the best on a tie, and replaces it only when the streak passes it', () => {
        const { best, stats } = setup();

        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3); // 1
        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3); // 2
        recordFinishedRound(stats, best, 'ja', 'normal', 4, false, 5); // streak 0
        recordFinishedRound(stats, best, 'en', 'normal', 4, true, 3); // 1: below
        recordFinishedRound(stats, best, 'en', 'normal', 4, true, 3); // 2: tie, label stays ja
        expect(best.load()).toEqual({ score: 2, label: '連勝 2', date: expect.any(String) });

        recordFinishedRound(stats, best, 'en', 'normal', 4, true, 3); // 3: new best
        expect(best.load()).toEqual({ score: 3, label: 'Streak 3', date: expect.any(String) });
    });

    it('does not let a streak in another mode or digit count below the best change it', () => {
        const { best, stats } = setup();

        for (let i = 0; i < 3; i++) {
            recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        }
        recordFinishedRound(stats, best, 'ja', 'hard', 3, true, 3); // 1
        recordFinishedRound(stats, best, 'ja', 'daily', 2, true, 3); // 1
        expect(best.load()).toEqual({ score: 3, label: '連勝 3', date: expect.any(String) });
    });

    it('lets any mode and digit count set the best (hard 5 digits reaching 4 beats 3)', () => {
        const { best, stats } = setup();

        for (let i = 0; i < 3; i++) {
            recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        }
        for (let i = 0; i < 4; i++) {
            recordFinishedRound(stats, best, 'ja', 'hard', 5, true, 4);
        }
        expect(best.load()).toEqual({ score: 4, label: '連勝 4', date: expect.any(String) });
    });

    it('keeps the best after the stats are cleared, until a new streak passes it', () => {
        const { best, stats } = setup();

        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        stats.clear();
        expect(stats.load()).toEqual({});
        expect(best.load()).toEqual({ score: 2, label: '連勝 2', date: expect.any(String) });

        recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3); // streak 1 again
        expect(best.load()).toEqual({ score: 2, label: '連勝 2', date: expect.any(String) });
    });

    it('leaves a real daily save byte for byte unchanged while a daily win is recorded', () => {
        const { storage, best, stats, daily } = setup();

        daily.saveGuesses('2026-11-02', 4, ['1013', '1117']);
        const before = storage.data.get(DAILY_STORAGE_KEY);

        recordFinishedRound(stats, best, 'ja', 'daily', 4, true, 2);
        expect(before).toBeDefined();
        expect(storage.data.get(DAILY_STORAGE_KEY)).toBe(before);
        expect(daily.load('2026-11-02').rounds[4]).toEqual(['1013', '1117']);
        expect(best.load()).toEqual({ score: 1, label: '連勝 1', date: expect.any(String) });
        expect([...storage.data.keys()].sort()).toEqual(['digdle.best', 'digdle.daily', 'digdle.stats']);
    });

    it('keeps score and label as plain integers for a streak of 1000', () => {
        const { best, stats } = setup();

        for (let i = 0; i < 1000; i++) {
            recordFinishedRound(stats, best, 'ja', 'normal', 2, true, 1);
        }
        expect(best.load()).toEqual({ score: 1000, label: '連勝 1000', date: expect.any(String) });
    });

    it('does not throw and keeps the best for this page when setItem fails', () => {
        const blocked: KeyValueStorage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('blocked');
            }
        };
        const best = new BestStore(GAME_ID, () => blocked);
        const stats = createStatsStorage(memoryStorage());

        expect(() => recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3)).not.toThrow();
        expect(best.load()).toEqual({ score: 1, label: '連勝 1', date: expect.any(String) });
    });

    it('keeps the higher best in memory when storage is blocked and a lower streak is recorded later', () => {
        const blocked: KeyValueStorage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('blocked');
            }
        };
        const best = new BestStore(GAME_ID, () => blocked);
        const stats = createStatsStorage(memoryStorage());

        for (let i = 0; i < 3; i++) {
            recordFinishedRound(stats, best, 'ja', 'normal', 4, true, 3);
        }
        recordFinishedRound(stats, best, 'ja', 'normal', 4, false, 5);
        recordFinishedRound(stats, best, 'en', 'normal', 4, true, 3); // streak 1 after the loss
        expect(best.load()).toEqual({ score: 3, label: '連勝 3', date: expect.any(String) });
    });
});

describe('getBestStreakStore', () => {
    it('returns one store of the key digdle.best every time', () => {
        expect(getBestStreakStore()).toBe(getBestStreakStore());
        expect(getBestStreakStore().key).toBe('digdle.best');
    });
});
