import { describe, expect, it, vi } from 'vitest';
import type { DailyBackend } from './daily';
import {
    averageTries, createStatsStorage, getEntry, getStatsStorage, parseStats, pressClear, recordRound, shouldRecordRound,
    STATS_CLEAR_CONFIRM_MS, STATS_STORAGE_KEY, statsKey, statsLines, statsParts, winRatePercent, type Stats,
    type StatsEntry
} from './stats';

const entry = (played: number, won: number, streak: number, attemptsWon: number): StatsEntry =>
    ({ played, won, streak, attemptsWon });

const memoryBackend = (initial: string | null = null): DailyBackend & { value: string | null } => {
    const backend = {
        value: initial,
        getItem: () => backend.value,
        setItem: (_key: string, value: string) => {
            backend.value = value;
        }
    };
    return backend;
};

const throwingBackend: DailyBackend = {
    getItem: () => {
        throw new Error('blocked');
    },
    setItem: () => {
        throw new Error('blocked');
    }
};

const save = (entries: Record<string, unknown>, version: unknown = 1): string => JSON.stringify({ version, entries });

describe('recordRound', () => {
    it('adds 3-win, 5-win, loss and 2-win rounds of normal 4 digits as played / won / streak / attemptsWon', () => {
        let stats: Stats = {};
        stats = recordRound(stats, 'normal', 4, true, 3);
        expect(getEntry(stats, 'normal', 4)).toEqual(entry(1, 1, 1, 3));
        stats = recordRound(stats, 'normal', 4, true, 5);
        expect(getEntry(stats, 'normal', 4)).toEqual(entry(2, 2, 2, 8));
        stats = recordRound(stats, 'normal', 4, false, 5);
        expect(getEntry(stats, 'normal', 4)).toEqual(entry(3, 2, 0, 8));
        stats = recordRound(stats, 'normal', 4, true, 2);
        expect(getEntry(stats, 'normal', 4)).toEqual(entry(4, 3, 1, 10));
    });

    it('keeps modes and digit counts apart', () => {
        let stats: Stats = {};
        stats = recordRound(stats, 'normal', 3, true, 2);
        stats = recordRound(stats, 'hard', 3, false, 4);
        stats = recordRound(stats, 'daily', 3, true, 1);
        stats = recordRound(stats, 'normal', 4, false, 5);
        expect(getEntry(stats, 'normal', 3)).toEqual(entry(1, 1, 1, 2));
        expect(getEntry(stats, 'hard', 3)).toEqual(entry(1, 0, 0, 0));
        expect(getEntry(stats, 'daily', 3)).toEqual(entry(1, 1, 1, 1));
        expect(getEntry(stats, 'normal', 4)).toEqual(entry(1, 0, 0, 0));
        expect(getEntry(stats, 'normal', 5)).toEqual(entry(0, 0, 0, 0));
    });

    it('does not change the stats it is given', () => {
        const before: Stats = { 'normal:3': entry(1, 1, 1, 2) };
        const snapshot = JSON.stringify(before);
        recordRound(before, 'normal', 3, true, 3);
        expect(JSON.stringify(before)).toBe(snapshot);
    });
});

describe('shouldRecordRound', () => {
    it.each([
        ['playing', 'won', true],
        ['playing', 'lost', true],
        ['playing', 'playing', false],
        ['won', 'won', false],
        ['lost', 'lost', false]
    ] as const)('%s -> %s is %s (a result that is only reopened is not counted)', (before, after, expected) => {
        expect(shouldRecordRound(before, after)).toBe(expected);
    });
});

describe('formatting', () => {
    it('shows 12 / 15 as 勝率 80%（12 / 15）・連勝 3・平均 3.4 回 (41 / 12 tries)', () => {
        expect(statsLines('ja', entry(15, 12, 3, 41)).one).toBe('勝率 80%（12 / 15）・連勝 3・平均 3.4 回');
        expect(statsLines('ja', entry(15, 12, 3, 41)).first).toBe('勝率 80%（12 / 15）');
        expect(statsLines('ja', entry(15, 12, 3, 41)).second).toBe('連勝 3・平均 3.4 回');
    });

    it('shows the English one-line and two-line forms', () => {
        const lines = statsLines('en', entry(15, 12, 3, 41));
        expect(lines.one).toBe('Win 80% (12 / 15) · Streak 3 · Avg 3.4 tries');
        expect(lines.first).toBe('Win 80% (12 / 15)');
        expect(lines.second).toBe('Streak 3 · Avg 3.4 tries');
    });

    it('splits the landscape rows in both languages', () => {
        expect(statsParts('ja', entry(15, 12, 3, 41))).toEqual({
            rate: '勝率 80%', record: '12 / 15', streak: '連勝 3', average: '平均 3.4 回'
        });
        expect(statsParts('en', entry(15, 12, 3, 41))).toEqual({
            rate: 'Win 80%', record: '12 / 15', streak: 'Streak 3', average: 'Avg 3.4 tries'
        });
    });

    it('shows - without 回 / tries when there is no win', () => {
        expect(averageTries(entry(2, 0, 0, 0))).toBe('-');
        expect(statsParts('ja', entry(2, 0, 0, 0)).average).toBe('平均 -');
        expect(statsParts('en', entry(2, 0, 0, 0)).average).toBe('Avg -');
    });

    it('rounds the win rate: 1/3 -> 33, 2/3 -> 67, 1/8 -> 13 (12.5 up), 3/4 -> 75', () => {
        expect(winRatePercent(entry(3, 1, 1, 1))).toBe(33);
        expect(winRatePercent(entry(3, 2, 1, 2))).toBe(67);
        expect(winRatePercent(entry(8, 1, 1, 1))).toBe(13);
        expect(winRatePercent(entry(4, 3, 1, 10))).toBe(75);
    });

    it('rounds the average to one decimal: 10 / 3 -> 3.3, 41 / 12 -> 3.4', () => {
        expect(averageTries(entry(4, 3, 1, 10))).toBe('3.3');
        expect(averageTries(entry(15, 12, 3, 41))).toBe('3.4');
    });

    it('caps counts above 999 as 999+ and computes the rate from the real counts', () => {
        const parts = statsParts('ja', entry(1500, 1200, 1000, 4200));
        expect(parts.record).toBe('999+ / 999+');
        expect(parts.streak).toBe('連勝 999+');
        expect(parts.rate).toBe('勝率 80%');
        expect(parts.average).toBe('平均 3.5 回');
        expect(statsParts('ja', entry(999, 999, 999, 999)).record).toBe('999 / 999');
    });
});

describe('parseStats', () => {
    it.each([
        ['null', null],
        ['broken JSON', '{'],
        ['another version', save({ 'normal:3': entry(1, 1, 1, 1) }, 2)],
        ['entries as an array', save([] as unknown as Record<string, unknown>)],
        ['a non-object', '5'],
        ['an array', '[]']
    ])('treats %s as empty', (_name, raw) => {
        expect(parseStats(raw)).toEqual({});
    });

    it('reads a valid save', () => {
        expect(parseStats(save({ 'normal:3': entry(4, 3, 1, 10), 'daily:6': entry(1, 0, 0, 0) }))).toEqual({
            'normal:3': entry(4, 3, 1, 10), 'daily:6': entry(1, 0, 0, 0)
        });
    });

    it.each([
        ['a negative count', { played: -1, won: 0, streak: 0, attemptsWon: 0 }],
        ['a fractional count', { played: 1.5, won: 0, streak: 0, attemptsWon: 0 }],
        ['a string count', { played: '1', won: 0, streak: 0, attemptsWon: 0 }],
        ['a missing field', { played: 1, won: 0, streak: 0 }],
        ['won above played', { played: 1, won: 2, streak: 0, attemptsWon: 2 }],
        ['streak above won', { played: 3, won: 1, streak: 2, attemptsWon: 2 }],
        ['attemptsWon below won', { played: 2, won: 2, streak: 1, attemptsWon: 1 }],
        ['a non-object entry', 5]
    ])('drops only the entry with %s and keeps the others', (_name, bad) => {
        const parsed = parseStats(save({ 'normal:3': bad, 'hard:3': entry(1, 1, 1, 2) }));
        expect(parsed).toEqual({ 'hard:3': entry(1, 1, 1, 2) });
    });

    it('drops keys that are not a known mode and a digit count of 2 to 6', () => {
        const good = entry(1, 1, 1, 1);
        const parsed = parseStats(save({
            'normal:1': good, 'normal:7': good, 'easy:3': good, 'normal': good, 'normal:3': good
        }));
        expect(Object.keys(parsed)).toEqual(['normal:3']);
    });
});

describe('createStatsStorage', () => {
    it('stores under digdle.stats with version 1 and reads it back', () => {
        const backend = memoryBackend();
        const storage = createStatsStorage(backend);
        storage.record('normal', 3, true, 2);
        expect(JSON.parse(backend.value as string)).toEqual({ version: 1, entries: { 'normal:3': entry(1, 1, 1, 2) } });
        expect(STATS_STORAGE_KEY).toBe('digdle.stats');
        expect(storage.load()).toEqual({ 'normal:3': entry(1, 1, 1, 2) });
    });

    it('uses the key digdle.stats of the backend', () => {
        const getItem = vi.fn(() => null);
        createStatsStorage({ getItem, setItem: () => undefined }).load();
        expect(getItem).toHaveBeenCalledWith('digdle.stats');
    });

    it('sees what another tab wrote, because it reads the backend on every call', () => {
        const backend = memoryBackend();
        const storage = createStatsStorage(backend);
        storage.record('normal', 3, true, 2);
        backend.value = save({ 'normal:3': entry(5, 5, 5, 10) });
        expect(storage.record('normal', 3, false, 4)['normal:3']).toEqual(entry(6, 5, 0, 10));
    });

    it('keeps working from the page copy when every read and write throws', () => {
        const storage = createStatsStorage(throwingBackend);
        expect(storage.load()).toEqual({});
        storage.record('hard', 4, true, 3);
        storage.record('hard', 4, true, 4);
        expect(getEntry(storage.load(), 'hard', 4)).toEqual(entry(2, 2, 2, 7));
    });

    it('keeps working without any backend', () => {
        const storage = createStatsStorage(null);
        storage.record('daily', 2, false, 3);
        expect(getEntry(storage.load(), 'daily', 2)).toEqual(entry(1, 0, 0, 0));
    });

    it('keeps the page copy when only the write fails', () => {
        const storage = createStatsStorage({ getItem: () => null, setItem: () => { throw new Error('full'); } });
        storage.record('normal', 2, true, 1);
        storage.record('normal', 2, true, 2);
        expect(getEntry(storage.load(), 'normal', 2)).toEqual(entry(2, 2, 2, 3));
    });

    it('erases every mode and digit count, and counting starts again from the first round', () => {
        const backend = memoryBackend();
        const storage = createStatsStorage(backend);
        storage.record('normal', 3, true, 2);
        storage.record('daily', 6, false, 7);
        storage.clear();
        expect(storage.load()).toEqual({});
        expect(JSON.parse(backend.value as string)).toEqual({ version: 1, entries: {} });
        expect(storage.record('normal', 3, true, 2)['normal:3']).toEqual(entry(1, 1, 1, 2));
    });

    it('hands out one shared storage', () => {
        expect(getStatsStorage()).toBe(getStatsStorage());
    });

    it('statsKey joins the mode and the digit count', () => {
        expect(statsKey('daily', 5)).toBe('daily:5');
    });
});

describe('pressClear', () => {
    it('arms on the first press', () => {
        expect(pressClear(null, 1000)).toEqual({ action: 'arm', armedAt: 1000 });
    });

    it('erases on a second press within 3000 ms, and exactly at 3000 ms', () => {
        expect(pressClear(1000, 1001)).toEqual({ action: 'erase', armedAt: null });
        expect(pressClear(1000, 1000 + STATS_CLEAR_CONFIRM_MS)).toEqual({ action: 'erase', armedAt: null });
    });

    it('treats a second press 3001 ms later as a new first press', () => {
        expect(pressClear(1000, 1000 + STATS_CLEAR_CONFIRM_MS + 1)).toEqual({ action: 'arm', armedAt: 4001 });
    });
});
