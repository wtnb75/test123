import { browserBackend, type DailyBackend } from './daily';
import type { Locale } from './locale';
import { DIGIT_OPTIONS } from './selectLayout';
import type { DigitOption, RoundStatus, TitleMode } from '../types';

/** The localStorage key of the stats save. */
export const STATS_STORAGE_KEY = 'digdle.stats';
/** How long after the first press of "clear stats" the second press still erases. */
export const STATS_CLEAR_CONFIRM_MS = 3000;
/** Counts above this are shown as `999+`. */
export const STATS_COUNT_CAP = 999;

const STATS_VERSION = 1;
const STATS_MODES: readonly TitleMode[] = ['normal', 'hard', 'daily'];

export interface StatsEntry {
    played: number;
    won: number;
    streak: number;
    /** The sum of the attempts used by the won rounds. */
    attemptsWon: number;
}

/** The entries by `<mode>:<digits>`. */
export type Stats = Readonly<Record<string, StatsEntry>>;

export const EMPTY_ENTRY: StatsEntry = { played: 0, won: 0, streak: 0, attemptsWon: 0 };

export const statsKey = (mode: TitleMode, digits: DigitOption): string => `${mode}:${digits}`;

export const getEntry = (stats: Stats, mode: TitleMode, digits: DigitOption): StatsEntry =>
    stats[statsKey(mode, digits)] ?? EMPTY_ENTRY;

/** `stats` with one finished round added to its mode and digit count; `stats` itself is not changed. */
export const recordRound = (
    stats: Stats,
    mode: TitleMode,
    digits: DigitOption,
    won: boolean,
    attemptsUsed: number
): Stats => {
    const entry = getEntry(stats, mode, digits);
    const next: StatsEntry = won
        ? {
            played: entry.played + 1,
            won: entry.won + 1,
            streak: entry.streak + 1,
            attemptsWon: entry.attemptsWon + attemptsUsed
        }
        : { ...entry, played: entry.played + 1, streak: 0 };

    return { ...stats, [statsKey(mode, digits)]: next };
};

/** Whether a round that went from `before` to `after` has just ended, so it is counted (a result only reopened is not). */
export const shouldRecordRound = (before: RoundStatus, after: RoundStatus): boolean =>
    before === 'playing' && after !== 'playing';

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseEntry = (value: unknown): StatsEntry | null => {
    if (!isRecord(value)) {
        return null;
    }

    const { played, won, streak, attemptsWon } = value;

    if (!isCount(played) || !isCount(won) || !isCount(streak) || !isCount(attemptsWon)) {
        return null;
    }

    if (won > played || streak > won || attemptsWon < won) {
        return null;
    }

    return { played, won, streak, attemptsWon };
};

/** The stats in `raw`: empty for a missing, broken or old save; a broken entry or an unknown key is dropped. */
export const parseStats = (raw: string | null): Stats => {
    if (raw === null) {
        return {};
    }

    let value: unknown;

    try {
        value = JSON.parse(raw);
    } catch {
        return {};
    }

    if (!isRecord(value) || value.version !== STATS_VERSION || !isRecord(value.entries)) {
        return {};
    }

    const stats: Record<string, StatsEntry> = {};

    for (const mode of STATS_MODES) {
        for (const digits of DIGIT_OPTIONS) {
            const key = statsKey(mode, digits);
            const entry = parseEntry(value.entries[key]);

            if (entry !== null) {
                stats[key] = entry;
            }
        }
    }

    return stats;
};

export interface StatsStorage {
    load: () => Stats;
    /** Adds one finished round and stores everything; returns the new stats. */
    record: (mode: TitleMode, digits: DigitOption, won: boolean, attemptsUsed: number) => Stats;
    /** Erases the stats of every mode and digit count. */
    clear: () => void;
}

/**
 * The stats on top of `backend`. Like the daily save: the backend is read each time (so another tab's
 * writes are seen); once it fails, or when there is none, the copy of what was written is used instead.
 */
export const createStatsStorage = (backend: DailyBackend | null): StatsStorage => {
    let memory: string | null = null;
    let backendWorks = backend !== null;

    const readRaw = (): string | null => {
        if (backendWorks) {
            try {
                return backend?.getItem(STATS_STORAGE_KEY) ?? null;
            } catch {
                backendWorks = false;
            }
        }

        return memory;
    };

    const load = (): Stats => parseStats(readRaw());

    const write = (stats: Stats): void => {
        const raw = JSON.stringify({ version: STATS_VERSION, entries: stats });

        memory = raw;

        try {
            backend?.setItem(STATS_STORAGE_KEY, raw);
        } catch {
            // Storage is blocked or full: the memory copy keeps this page session working.
            backendWorks = false;
        }
    };

    return {
        load,
        record: (mode, digits, won, attemptsUsed) => {
            const next = recordRound(load(), mode, digits, won, attemptsUsed);

            write(next);
            return next;
        },
        clear: () => write({})
    };
};

let sharedStorage: StatsStorage | null = null;

/** The one stats save of the page. */
export const getStatsStorage = (): StatsStorage => {
    sharedStorage ??= createStatsStorage(browserBackend());
    return sharedStorage;
};

/** The result of pressing "clear stats": the first press arms it, a second one within the time erases. */
export interface ClearPress {
    action: 'arm' | 'erase';
    /** The time of the first press that is still waiting for its second one; `null` after an erase. */
    armedAt: number | null;
}

export const pressClear = (armedAt: number | null, now: number): ClearPress =>
    armedAt !== null && now - armedAt <= STATS_CLEAR_CONFIRM_MS
        ? { action: 'erase', armedAt: null }
        : { action: 'arm', armedAt: now };

const capped = (count: number): string => (count > STATS_COUNT_CAP ? `${STATS_COUNT_CAP}+` : String(count));

export const winRatePercent = (entry: StatsEntry): number => Math.round((100 * entry.won) / entry.played);

/** The average attempts of the won rounds with one decimal; `-` with no win. */
export const averageTries = (entry: StatsEntry): string =>
    entry.won === 0 ? '-' : (entry.attemptsWon / entry.won).toFixed(1);

export interface StatsParts {
    rate: string;
    record: string;
    streak: string;
    average: string;
}

export const statsParts = (locale: Locale, entry: StatsEntry): StatsParts => {
    const ja = locale === 'ja';
    const average = averageTries(entry);

    return {
        rate: `${ja ? '勝率' : 'Win'} ${winRatePercent(entry)}%`,
        record: `${capped(entry.won)} / ${capped(entry.played)}`,
        streak: `${ja ? '連勝' : 'Streak'} ${capped(entry.streak)}`,
        average: ja ? `平均 ${average}${average === '-' ? '' : ' 回'}` : `Avg ${average}${average === '-' ? '' : ' tries'}`
    };
};

/** The one-line form, and the two lines it breaks into after the closing parenthesis. */
export const statsLines = (locale: Locale, entry: StatsEntry): { one: string; first: string; second: string } => {
    const { rate, record, streak, average } = statsParts(locale, entry);
    const ja = locale === 'ja';
    const first = ja ? `${rate}（${record}）` : `${rate} (${record})`;
    const second = ja ? `${streak}・${average}` : `${streak} · ${average}`;

    return { one: ja ? `${first}・${second}` : `${first} · ${second}`, first, second };
};
