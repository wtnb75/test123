// The best win streak shown on the top page. Storage itself (key, value shape, fallbacks) is the shared `best-store` package.
import { BestStore } from 'best-store';
import type { Locale } from './locale';
import { getEntry, type StatsStorage } from './stats';
import type { DigitOption, TitleMode } from '../types';

/** The game directory name: the best is saved under the key `digdle.best`. */
export const GAME_ID = 'digdle';

/** The label saved with a best streak, in the language of the win that set it. */
export const streakLabel = (locale: Locale, streak: number): string =>
    locale === 'ja' ? `連勝 ${streak}` : `Streak ${streak}`;

/** The minimal part of `BestStore` used here (so a test can pass a fake). */
export interface StreakRecorder {
    record: (score: number, label: string) => unknown;
}

/**
 * Offers the streak of a just-won round to the best. Only a streak strictly above the saved best
 * replaces it (the `BestStore` rule), whichever mode and digit count it came from.
 */
export const recordBestStreak = (recorder: StreakRecorder, locale: Locale, streak: number): void => {
    recorder.record(streak, streakLabel(locale, streak));
};

/**
 * Counts one finished round in the stats, and when it was a win offers the streak that results (of its
 * own mode and digit count) to the best. A loss only reaches the stats.
 */
export const recordFinishedRound = (
    stats: StatsStorage,
    recorder: StreakRecorder,
    locale: Locale,
    mode: TitleMode,
    digits: DigitOption,
    won: boolean,
    attemptsUsed: number
): void => {
    const next = stats.record(mode, digits, won, attemptsUsed);

    if (won) {
        recordBestStreak(recorder, locale, getEntry(next, mode, digits).streak);
    }
};

let sharedStore: BestStore | null = null;

/** The one best-streak store of the page. */
export const getBestStreakStore = (): BestStore => {
    sharedStore ??= new BestStore(GAME_ID);
    return sharedStore;
};
