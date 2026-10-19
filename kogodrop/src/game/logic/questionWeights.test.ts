import { describe, expect, it, vi } from 'vitest';
import { createQuestionSequence, shuffleArray } from './kogodrop';
import type { KogoEntry } from './types';

const makeEntry = (id: string): KogoEntry => ({
    id,
    word: `word${id}`,
    meaning: `meaning ${id}`,
    shortMeaning: [`short${id}`],
    level: 'basic',
    pos: '形容詞・シク活用',
    englishMeaning: `english ${id}`,
    shortEnglishMeaning: [`en${id}`],
    verified: true,
    rank: 1,
});

const pool = ['1', '2', '3', '4'].map(makeEntry);

const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const fixed = (values: number[]) => {
    let i = 0;
    return () => values[i++];
};

const ids = (list: KogoEntry[]) => list.map((e) => e.id);

describe('createQuestionSequence with weights', () => {
    it('a heavy word is drawn first when its key is largest (u all 0.5: weight 5 gives 0.871 against 0.5)', () => {
        const weightOf = (e: KogoEntry) => (e.id === '3' ? 5 : 1);
        const seq = createQuestionSequence(pool, 1, fixed([0.5, 0.5, 0.5, 0.5]), new Set(), weightOf);
        expect(ids(seq)).toEqual(['3']);
    });

    it('with every weight 1 the sequence and the rng use are the same as without weights', () => {
        const plainRng = vi.fn(seeded(99));
        const weightedRng = vi.fn(seeded(99));
        const plain = createQuestionSequence(pool, 9, plainRng);
        const weighted = createQuestionSequence(pool, 9, weightedRng, new Set(), () => 1);
        expect(ids(weighted)).toEqual(ids(plain));
        expect(weightedRng).toHaveBeenCalledTimes(plainRng.mock.calls.length);
    });

    it('with no weights given the sequence is the plain shuffle (regression)', () => {
        const seq = createQuestionSequence(pool, 4, seeded(5));
        expect(ids(seq)).toEqual(ids(shuffleArray(pool, seeded(5))));
    });

    it('the check for "any weight other than 1" looks only at the pool left after excludeIds', () => {
        // word 1 is heavy but excluded: the rest weigh 1, so the plain shuffle (and its rng use) stays
        const weightOf = (e: KogoEntry) => (e.id === '1' ? 5 : 1);
        const plainRng = vi.fn(seeded(3));
        const weightedRng = vi.fn(seeded(3));
        const plain = createQuestionSequence(pool, 3, plainRng, new Set(['1']));
        const weighted = createQuestionSequence(pool, 3, weightedRng, new Set(['1']), weightOf);
        expect(ids(weighted)).toEqual(ids(plain));
        expect(weightedRng).toHaveBeenCalledTimes(plainRng.mock.calls.length);
    });

    it('past one lap the pool is shuffled again with weights, every lap is a full permutation, and no word repeats back to back', () => {
        const weightOf = (e: KogoEntry) => (e.id === '2' ? 5 : 1);
        const seq = createQuestionSequence(pool, 12, seeded(21), new Set(), weightOf);
        expect(seq).toHaveLength(12);
        for (let lap = 0; lap < 3; lap++) {
            expect(ids(seq.slice(lap * 4, lap * 4 + 4)).sort()).toEqual(['1', '2', '3', '4']);
        }
        for (let i = 1; i < seq.length; i++) {
            expect(seq[i].id).not.toBe(seq[i - 1].id);
        }
    });

    it('excluded words never appear even while weighting is active; the heavy word that remains leads (u all 0.5)', () => {
        const weightOf = (e: KogoEntry) => (e.id === '2' ? 5 : 1);
        const first = createQuestionSequence(pool, 1, fixed([0.5, 0.5, 0.5]), new Set(['1']), weightOf);
        expect(ids(first)).toEqual(['2']);
        const seq = createQuestionSequence(pool, 12, seeded(8), new Set(['1']), weightOf);
        expect(seq).toHaveLength(12);
        expect(ids(seq)).not.toContain('1');
    });

    it('the question count is kept and an empty pool gives an empty sequence', () => {
        expect(createQuestionSequence(pool, 7, seeded(1), new Set(), (e) => (e.id === '4' ? 3 : 1))).toHaveLength(7);
        expect(createQuestionSequence([], 5, seeded(1), new Set(), () => 5)).toEqual([]);
    });

    it('a heavy word leads the first question more often than a light one', () => {
        const weightOf = (e: KogoEntry) => (e.id === '1' ? 5 : 1);
        const rng = seeded(2024);
        let heavyFirst = 0;
        let others = 0;
        for (let i = 0; i < 1200; i++) {
            const first = createQuestionSequence(pool, 1, rng, new Set(), weightOf)[0];
            if (first.id === '1') heavyFirst++;
            else others++;
        }
        // expected share of word 1: 5 / (5 + 1 + 1 + 1) = 62.5%
        expect(others).toBeGreaterThan(0);
        expect(heavyFirst).toBeGreaterThan(others);
    });
});
