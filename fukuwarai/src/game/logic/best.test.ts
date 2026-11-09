import { describe, it, expect } from 'vitest';
import { BestStore, bestKey, type KeyValueStorage } from 'best-store';
import { GAME_ID, resultBestText, scoreLabel, titleBestText } from './best';
import {
    BEST_TEXT_COLOR,
    GAME_WIDTH,
    GAME_HEIGHT,
    RESULT_BEST_FONT_PX,
    RESULT_BEST_Y,
    RESULT_NEW_RECORD_COLOR,
    RESULT_NEW_RECORD_FONT_PX,
    TITLE_BEST_FONT_PX,
    TITLE_BEST_Y,
} from './constants';

const memoryStorage = (): KeyValueStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
    };
};

const throwingStorage: KeyValueStorage = {
    getItem: () => {
        throw new Error('blocked');
    },
    setItem: () => {
        throw new Error('quota');
    },
};

const newStore = (storage: KeyValueStorage = memoryStorage()) => new BestStore(GAME_ID, () => storage, () => '2026-01-01');

// The text of one play, as the Result scene builds it: record, then format.
const play = (store: BestStore, score: number): string => {
    const result = store.record(score, scoreLabel(score));
    if (result === null) {
        throw new Error('score was not recorded');
    }
    return resultBestText(result);
};

describe('best text', () => {
    it('saves under the key fukuwarai.best', () => {
        expect(GAME_ID).toBe('fukuwarai');
        expect(bestKey(GAME_ID)).toBe('fukuwarai.best');
    });

    it('labels a score with its unit', () => {
        expect(scoreLabel(87)).toBe('87点');
        expect(scoreLabel(0)).toBe('0点');
    });

    it('shows the new record text when the play set the best', () => {
        expect(resultBestText({ best: { score: 87, label: '87点' }, isNew: true })).toBe('新記録！');
    });

    it('shows the standing best with a half-width space when the play did not set it', () => {
        expect(resultBestText({ best: { score: 87, label: '87点' }, isNew: false })).toBe('ベスト 87点');
    });

    it('shows no title line without a record', () => {
        expect(titleBestText(null)).toBeNull();
    });

    it.each([
        [0, 'ベスト 0点'],
        [87, 'ベスト 87点'],
        [100, 'ベスト 100点'],
    ])('shows the title line for a best of %i', (score, expected) => {
        expect(titleBestText({ score, label: scoreLabel(score) })).toBe(expected);
    });
});

describe('best record flow (hand-worked)', () => {
    it('calls the first play a new record and keeps a tie or a lower score from replacing it', () => {
        const store = newStore();
        expect(play(store, 87)).toBe('新記録！');
        expect(play(store, 87)).toBe('ベスト 87点');
        expect(play(store, 86)).toBe('ベスト 87点');
        expect(play(store, 88)).toBe('新記録！');
        expect(play(store, 50)).toBe('ベスト 88点');
    });

    it('calls a first play of 0 points a new record', () => {
        const store = newStore();
        expect(play(store, 0)).toBe('新記録！');
        expect(titleBestText(store.load())).toBe('ベスト 0点');
    });

    it('shows no title line before the first record and the best after it', () => {
        const store = newStore();
        expect(titleBestText(store.load())).toBeNull();
        play(store, 87);
        expect(titleBestText(store.load())).toBe('ベスト 87点');
    });

    it('keeps one best across topics: only the score is compared', () => {
        const store = newStore();
        play(store, 70);
        expect(play(store, 69)).toBe('ベスト 70点');
        expect(store.load()?.score).toBe(70);
    });

    it('persists the best in the storage so a new store (a page reload) reads it', () => {
        const storage = memoryStorage();
        play(newStore(storage), 91);
        expect(titleBestText(newStore(storage).load())).toBe('ベスト 91点');
        expect(storage.data.size).toBe(1);
        expect(storage.data.has('fukuwarai.best')).toBe(true);
    });

    it('does not record a score that is not a finite number', () => {
        const store = newStore();
        expect(store.record(Number.NaN, 'NaN点')).toBeNull();
        expect(store.load()).toBeNull();
    });

    it('does not throw and keeps the best in this page when the storage is blocked', () => {
        const store = newStore(throwingStorage);
        expect(play(store, 87)).toBe('新記録！');
        expect(store.load()?.score).toBe(87);
        expect(play(store, 60)).toBe('ベスト 87点');
    });

    it('loses the best in a second store when the storage is blocked (why Title and Result share one store)', () => {
        play(newStore(throwingStorage), 87);
        expect(newStore(throwingStorage).load()).toBeNull();
    });
});

describe('best line layout (hand-worked, docs/spec.md「ベスト点の表示」)', () => {
    // The 64px score (center 355, line height about 74) ends near y 392; the 14px
    // "正解" label (center 440) starts near y 432.
    const SCORE_BOTTOM = 392;
    const ANSWER_LABEL_TOP = 432;

    it.each([
        ['new record', RESULT_NEW_RECORD_FONT_PX],
        ['best', RESULT_BEST_FONT_PX],
    ])('fits the %s line between the score and the answer label', (_name, fontPx) => {
        const lineHeight = fontPx * 1.15;
        expect(RESULT_BEST_Y - lineHeight / 2).toBeGreaterThan(SCORE_BOTTOM);
        expect(RESULT_BEST_Y + lineHeight / 2).toBeLessThan(ANSWER_LABEL_TOP);
    });

    it('fits the Title line between the subtitle (bottom about 441) and the start button (top 544)', () => {
        const lineHeight = TITLE_BEST_FONT_PX * 1.15;
        const startTop = GAME_HEIGHT * 0.6 - 32;
        expect(startTop).toBe(544);
        expect(TITLE_BEST_Y - lineHeight / 2).toBeGreaterThan(441);
        expect(TITLE_BEST_Y + lineHeight / 2).toBeLessThan(startTop);
    });

    it('keeps the longest line (ベスト 100点, 8 characters) inside the screen width', () => {
        expect('ベスト 100点'.length * RESULT_BEST_FONT_PX).toBeLessThanOrEqual(GAME_WIDTH);
    });

    it('keeps the text at least 14 real px at 375 x 550', () => {
        const scale = Math.min(375 / GAME_WIDTH, 550 / GAME_HEIGHT);
        expect(RESULT_BEST_FONT_PX * scale).toBeGreaterThanOrEqual(14);
        expect(RESULT_NEW_RECORD_FONT_PX * scale).toBeGreaterThanOrEqual(14);
        expect(TITLE_BEST_FONT_PX * scale).toBeGreaterThanOrEqual(14);
    });

    it('uses the colors from the parameter table', () => {
        expect(RESULT_NEW_RECORD_COLOR).toBe('#2a9d8f');
        expect(BEST_TEXT_COLOR).toBe('#8a6d3b');
    });
});
