import { describe, it, expect } from 'vitest';
import {
    buildRetryPool,
    createRetrySequence,
    isReviewCompact,
    recordAnswer,
    resultLayout,
    resultTexts,
    reviewRetryLabel,
    uniqueEntries,
} from './retry';
import { generateSlots, getLangValue, isCorrect } from './kogodrop';
import type { KogoEntry } from './types';

const makeEntry = (id: string, level: KogoEntry['level'] = 'basic'): KogoEntry => ({
    id,
    word: `word${id}`,
    meaning: `meaning for ${id}`,
    shortMeaning: [`short${id}`],
    level,
    pos: '形容詞・シク活用',
    englishMeaning: `english meaning for ${id}`,
    shortEnglishMeaning: [`en${id}`],
    verified: true,
    rank: 1,
});

const a = makeEntry('a');
const b = makeEntry('b');
const c = makeEntry('c');
const hardWord = makeEntry('hard', 'advanced');

const ids = (entries: KogoEntry[]) => entries.map((e) => e.id);

describe('uniqueEntries', () => {
    it('keeps only the first entry of each id in order of first appearance', () => {
        expect(ids(uniqueEntries([a, b, a, c, b]))).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty list for an empty input', () => {
        expect(uniqueEntries([])).toEqual([]);
    });
});

describe('createRetrySequence', () => {
    it('lists a word missed twice only once', () => {
        const seq = createRetrySequence([a, b, a]);
        expect(ids(seq).sort()).toEqual(['a', 'b']);
    });

    it('contains exactly the distinct missed words', () => {
        const seq = createRetrySequence([c, a, b, c]);
        expect(ids(seq).sort()).toEqual(['a', 'b', 'c']);
    });

    it('reorders with the injected rng (rng=0 turns [a,b,c] into [b,c,a])', () => {
        expect(ids(createRetrySequence([a, b, c], () => 0))).toEqual(['b', 'c', 'a']);
    });

    it('keeps the order when the rng never swaps (rng close to 1)', () => {
        expect(ids(createRetrySequence([a, b, c], () => 0.999))).toEqual(['a', 'b', 'c']);
    });

    it('gives the same order for the same rng and a different one for another rng', () => {
        const first = ids(createRetrySequence([a, b, c], () => 0));
        const again = ids(createRetrySequence([a, b, c], () => 0));
        const other = ids(createRetrySequence([a, b, c], () => 0.999));
        expect(first).toEqual(again);
        expect(first).not.toEqual(other);
    });

    it('returns an empty list for no missed words', () => {
        expect(createRetrySequence([])).toEqual([]);
    });

    it('returns the single word for one missed word', () => {
        expect(ids(createRetrySequence([a]))).toEqual(['a']);
    });

    it('does not modify the input list', () => {
        const input = [a, b, c, a];
        createRetrySequence(input, () => 0);
        expect(ids(input)).toEqual(['a', 'b', 'c', 'a']);
    });
});

describe('buildRetryPool', () => {
    it('merges the base pool and the retry words without duplicate ids', () => {
        const pool = buildRetryPool([a, b, c], [b, hardWord]);
        expect(ids(pool)).toEqual(['a', 'b', 'c', 'hard']);
    });

    it('includes a retry word that is outside the difficulty pool', () => {
        const pool = buildRetryPool([a, b], [hardWord]);
        expect(ids(pool)).toContain('hard');
    });

    it('lets generateSlots build 4 slots with exactly one correct slot from the retry pool', () => {
        const base = [a, b, c, makeEntry('d'), makeEntry('e')];
        const pool = buildRetryPool(base, [hardWord]);
        const slots = generateSlots(hardWord, pool, 'jp', () => 0.3, 4, 'kogo');
        expect(slots).toHaveLength(4);
        const correctSlots = slots.filter((s) => isCorrect(hardWord, s, 'jp'));
        expect(correctSlots).toHaveLength(1);
        expect(getLangValue(correctSlots[0], 'jp')).toBe('shorthard');
    });
});

describe('recordAnswer', () => {
    const empty = { wrongEntries: [], correctEntries: [] };

    it('adds a wrongly answered word to the missed list', () => {
        const r = recordAnswer(empty, a, false);
        expect(ids(r.wrongEntries)).toEqual(['a']);
        expect(r.correctEntries).toEqual([]);
    });

    it('removes a missed word from the missed list when it is answered correctly later', () => {
        const missed = recordAnswer(empty, a, false);
        const r = recordAnswer(missed, a, true);
        expect(r.wrongEntries).toEqual([]);
        expect(ids(r.correctEntries)).toEqual(['a']);
    });

    it('does not add a word back to the missed list when it is answered wrongly after a correct answer', () => {
        const solved = recordAnswer(empty, a, true);
        const r = recordAnswer(solved, a, false);
        expect(r.wrongEntries).toEqual([]);
        expect(ids(r.correctEntries)).toEqual(['a']);
    });

    it('keeps a word missed twice in a row in the list, and counts it once after uniqueEntries', () => {
        const twice = recordAnswer(recordAnswer(empty, a, false), a, false);
        expect(ids(twice.wrongEntries)).toEqual(['a', 'a']);
        expect(ids(uniqueEntries(twice.wrongEntries))).toEqual(['a']);
    });

    it('keeps the other missed words when one of them is answered correctly', () => {
        const missed = recordAnswer(recordAnswer(empty, a, false), b, false);
        const r = recordAnswer(missed, a, true);
        expect(ids(r.wrongEntries)).toEqual(['b']);
    });

    it('does not modify the record it receives', () => {
        const missed = recordAnswer(empty, a, false);
        recordAnswer(missed, a, true);
        expect(ids(missed.wrongEntries)).toEqual(['a']);
        expect(missed.correctEntries).toEqual([]);
    });
});

describe('resultLayout', () => {
    it('places the retry button at y=636 with height 80 and the bottom row at y=760 when words were missed', () => {
        const layout = resultLayout(3);
        expect(layout).toEqual({ showRetry: true, retryY: 636, retryHeight: 80, bottomRowY: 760 });
    });

    it('hides the retry button and keeps the bottom row at y=691 when nothing was missed', () => {
        const layout = resultLayout(0);
        expect(layout.showRetry).toBe(false);
        expect(layout.bottomRowY).toBe(691);
    });

    it('treats a single missed word as a retry case (boundary)', () => {
        expect(resultLayout(1).showRetry).toBe(true);
    });

    it('does not overlap the retry button with the review button (506-570) or the bottom row (730-790)', () => {
        const { retryY, retryHeight, bottomRowY } = resultLayout(2);
        const top = retryY - retryHeight / 2;
        const bottom = retryY + retryHeight / 2;
        expect(top).toBe(596);
        expect(bottom).toBe(676);
        expect(top).toBeGreaterThan(538 + 32);
        expect(bottom).toBeLessThan(bottomRowY - 30);
    });
});

describe('resultTexts', () => {
    it('uses the normal heading, labels and "もう一度" in a normal round', () => {
        expect(resultTexts(false, 5)).toEqual({
            heading: 'リザルト',
            retryLabel: '間違えた語を再挑戦 (5語)',
            restartLabel: 'もう一度',
        });
    });

    it('uses the retry-round heading, "まだ" label and "最初から" in a retry round', () => {
        expect(resultTexts(true, 2)).toEqual({
            heading: '復習ラウンド',
            retryLabel: 'まだ間違えた語を再挑戦 (2語)',
            restartLabel: '最初から',
        });
    });
});

describe('review button helpers', () => {
    it('labels the Review retry button with the missed word count', () => {
        expect(reviewRetryLabel(4)).toBe('間違えた語を再挑戦 (4語)');
    });

    it('switches to the compact one-row layout below 400 px and not at 400 px', () => {
        expect(isReviewCompact(399)).toBe(true);
        expect(isReviewCompact(400)).toBe(false);
        expect(isReviewCompact(310)).toBe(true);
    });
});
