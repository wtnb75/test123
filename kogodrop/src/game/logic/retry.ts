import type { GameConfig, KogoEntry } from './types';
import { shuffleArray } from './kogodrop';

export const RESULT_REVIEW_BUTTON_Y = 538;
export const RESULT_RETRY_BUTTON_Y = 636;
export const RESULT_RETRY_BUTTON_HEIGHT = 80;
export const RESULT_WIDE_BUTTON_WIDTH_RATIO = 0.82;
export const RESULT_BOTTOM_ROW_Y = 691;
export const RESULT_BOTTOM_ROW_Y_WITH_RETRY = 760;

export const REVIEW_COMPACT_HEIGHT_PX = 400;

export interface RetryGameData extends GameConfig {
    retryEntries?: KogoEntry[];
}

export interface ResultLayout {
    showRetry: boolean;
    retryY: number;
    retryHeight: number;
    bottomRowY: number;
}

export interface ResultTexts {
    heading: string;
    retryLabel: string;
    restartLabel: string;
}

export const uniqueEntries = (entries: KogoEntry[]): KogoEntry[] => {
    const seen = new Set<string>();
    const result: KogoEntry[] = [];
    for (const e of entries) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        result.push(e);
    }
    return result;
};

export interface AnswerRecord {
    wrongEntries: KogoEntry[];
    correctEntries: KogoEntry[];
}

// A word counts as missed while it has not been answered correctly: answering
// it correctly later removes it from the missed list, and a wrong answer after
// a correct one is not added back.
export const recordAnswer = (
    record: AnswerRecord,
    entry: KogoEntry,
    correct: boolean
): AnswerRecord => {
    if (correct) {
        return {
            correctEntries: [...record.correctEntries, entry],
            wrongEntries: record.wrongEntries.filter((e) => e.id !== entry.id),
        };
    }
    if (record.correctEntries.some((e) => e.id === entry.id)) return record;
    return { ...record, wrongEntries: [...record.wrongEntries, entry] };
};

export const createRetrySequence = (
    missed: KogoEntry[],
    rng: () => number = Math.random
): KogoEntry[] => shuffleArray(uniqueEntries(missed), rng);

export const buildRetryPool = (basePool: KogoEntry[], retryEntries: KogoEntry[]): KogoEntry[] =>
    uniqueEntries([...basePool, ...retryEntries]);

export const resultLayout = (missedCount: number): ResultLayout => {
    const showRetry = missedCount > 0;
    return {
        showRetry,
        retryY: RESULT_RETRY_BUTTON_Y,
        retryHeight: RESULT_RETRY_BUTTON_HEIGHT,
        bottomRowY: showRetry ? RESULT_BOTTOM_ROW_Y_WITH_RETRY : RESULT_BOTTOM_ROW_Y,
    };
};

export const resultTexts = (isRetry: boolean, missedCount: number): ResultTexts => ({
    heading: isRetry ? '復習ラウンド' : 'リザルト',
    retryLabel: `${isRetry ? 'まだ' : ''}間違えた語を再挑戦 (${missedCount}語)`,
    restartLabel: isRetry ? '最初から' : 'もう一度',
});

export const reviewRetryLabel = (missedCount: number): string => `間違えた語を再挑戦 (${missedCount}語)`;

export const isReviewCompact = (overlayHeightPx: number): boolean =>
    overlayHeightPx < REVIEW_COMPACT_HEIGHT_PX;
