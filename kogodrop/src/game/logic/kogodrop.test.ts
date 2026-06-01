import { describe, it, expect } from 'vitest';
import {
    DIFFICULTY_LEVELS,
    findExampleSentence,
    generateSlots,
    getFullMeaning,
    getPool,
    getSlotValue,
    getTileValue,
    isCorrect,
    createQuestionSequence,
    shuffleArray,
} from './kogodrop';
import type { ExampleSentence, KogoEntry } from './types';
import { POS_VALUES } from './types';
import { kogoList } from '../data/kogoList';
import { exampleSentences } from '../data/exampleSentences';

const makeEntry = (
    id: string,
    level: KogoEntry['level'],
    overrides: Partial<KogoEntry> = {}
): KogoEntry => ({
    id,
    word: `word${id}`,
    meaning: `meaning for ${id}`,
    shortMeaning: `short${id}`,
    level,
    pos: '形容詞・シク活用',
    englishMeaning: `english meaning for ${id}`,
    shortEnglishMeaning: `en${id}`,
    verified: true,
    ...overrides,
});

const e1 = makeEntry('1', 'basic');
const e2 = makeEntry('2', 'basic');
const e3 = makeEntry('3', 'standard');
const e4 = makeEntry('4', 'standard');
const e5 = makeEntry('5', 'advanced');
const eUnverified = makeEntry('unv', 'basic', { verified: false });
const eDupShort = makeEntry('dup', 'basic', { shortMeaning: 'short1' });

const seqRng = (() => {
    let n = 0;
    return () => ((n++ * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
})();

describe('DIFFICULTY_LEVELS', () => {
    it('easy includes only basic', () => {
        expect(DIFFICULTY_LEVELS.easy).toEqual(['basic']);
    });
    it('normal includes basic and standard', () => {
        expect(DIFFICULTY_LEVELS.normal).toContain('basic');
        expect(DIFFICULTY_LEVELS.normal).toContain('standard');
        expect(DIFFICULTY_LEVELS.normal).not.toContain('advanced');
    });
    it('hard includes all levels', () => {
        expect(DIFFICULTY_LEVELS.hard).toContain('basic');
        expect(DIFFICULTY_LEVELS.hard).toContain('standard');
        expect(DIFFICULTY_LEVELS.hard).toContain('advanced');
    });
});

describe('getPool', () => {
    const all = [e1, e2, e3, e4, e5, eUnverified];

    it('easy returns only basic verified', () => {
        const pool = getPool(all, 'easy');
        expect(pool.every((e) => e.level === 'basic')).toBe(true);
        expect(pool.every((e) => e.verified)).toBe(true);
    });

    it('normal returns basic and standard', () => {
        const pool = getPool(all, 'normal');
        expect(pool.some((e) => e.level === 'basic')).toBe(true);
        expect(pool.some((e) => e.level === 'standard')).toBe(true);
        expect(pool.every((e) => e.level !== 'advanced')).toBe(true);
    });

    it('hard returns all levels', () => {
        const pool = getPool(all, 'hard');
        expect(pool.some((e) => e.level === 'advanced')).toBe(true);
    });

    it('excludes unverified entries by default', () => {
        const pool = getPool(all, 'easy');
        expect(pool.every((e) => e.verified)).toBe(true);
        expect(pool.find((e) => e.id === 'unv')).toBeUndefined();
    });

    it('includes unverified when ignoreVerified is true', () => {
        const pool = getPool(all, 'easy', true);
        expect(pool.find((e) => e.id === 'unv')).toBeDefined();
    });
});

describe('shuffleArray', () => {
    it('returns same elements', () => {
        const arr = [1, 2, 3, 4, 5];
        const result = shuffleArray(arr);
        expect(result.sort()).toEqual(arr.sort());
    });

    it('does not mutate original array', () => {
        const arr = [1, 2, 3];
        const copy = [...arr];
        shuffleArray(arr);
        expect(arr).toEqual(copy);
    });

    it('uses provided rng', () => {
        const mockRng = (() => {
            const vals = [0.9, 0.5, 0.1];
            let i = 0;
            return () => vals[i++ % vals.length];
        })();
        const arr = [1, 2, 3];
        const r1 = shuffleArray(arr, mockRng);
        expect(r1).toHaveLength(3);
    });
});

describe('createQuestionSequence', () => {
    it('returns empty array for empty pool', () => {
        expect(createQuestionSequence([], 10)).toEqual([]);
    });

    it('returns correct count', () => {
        const pool = [e1, e2, e3, e4, e5];
        expect(createQuestionSequence(pool, 10, seqRng)).toHaveLength(10);
    });

    it('no consecutive same word', () => {
        const pool = [e1, e2, e3, e4, e5];
        const seq = createQuestionSequence(pool, 30, Math.random);
        for (let i = 1; i < seq.length; i++) {
            expect(seq[i].word).not.toBe(seq[i - 1].word);
        }
    });

    it('handles count larger than pool size (reshuffle)', () => {
        const pool = [e1, e2, e3];
        const seq = createQuestionSequence(pool, 12, seqRng);
        expect(seq).toHaveLength(12);
        // No consecutive
        for (let i = 1; i < seq.length; i++) {
            expect(seq[i].word).not.toBe(seq[i - 1].word);
        }
    });

    it('single entry pool returns all same entry', () => {
        const seq = createQuestionSequence([e1], 5);
        expect(seq).toHaveLength(5);
        expect(seq.every((e) => e.id === e1.id)).toBe(true);
    });
});

describe('getTileValue', () => {
    it('kogo-to-jp returns word', () => {
        expect(getTileValue(e1, 'kogo-to-jp')).toBe(e1.word);
    });
    it('kogo-to-en returns word', () => {
        expect(getTileValue(e1, 'kogo-to-en')).toBe(e1.word);
    });
    it('en-to-kogo returns shortEnglishMeaning', () => {
        expect(getTileValue(e1, 'en-to-kogo')).toBe(e1.shortEnglishMeaning);
    });
});

describe('getSlotValue', () => {
    it('kogo-to-jp returns shortMeaning', () => {
        expect(getSlotValue(e1, 'kogo-to-jp')).toBe(e1.shortMeaning);
    });
    it('kogo-to-en returns shortEnglishMeaning', () => {
        expect(getSlotValue(e1, 'kogo-to-en')).toBe(e1.shortEnglishMeaning);
    });
    it('en-to-kogo returns word', () => {
        expect(getSlotValue(e1, 'en-to-kogo')).toBe(e1.word);
    });
});

describe('getFullMeaning', () => {
    it('kogo-to-jp returns meaning', () => {
        expect(getFullMeaning(e1, 'kogo-to-jp')).toBe(e1.meaning);
    });
    it('kogo-to-en returns englishMeaning', () => {
        expect(getFullMeaning(e1, 'kogo-to-en')).toBe(e1.englishMeaning);
    });
    it('en-to-kogo returns word', () => {
        expect(getFullMeaning(e1, 'en-to-kogo')).toBe(e1.word);
    });
});

describe('isCorrect', () => {
    it('same entry is correct', () => {
        expect(isCorrect(e1, e1, 'kogo-to-jp')).toBe(true);
    });
    it('different entry is incorrect', () => {
        expect(isCorrect(e1, e2, 'kogo-to-jp')).toBe(false);
    });
    it('different entries with same shortMeaning are correct', () => {
        expect(isCorrect(e1, eDupShort, 'kogo-to-jp')).toBe(true);
    });
    it('en-to-kogo mode checks word field', () => {
        expect(isCorrect(e1, e1, 'en-to-kogo')).toBe(true);
        expect(isCorrect(e1, e2, 'en-to-kogo')).toBe(false);
    });
});

describe('generateSlots', () => {
    const pool = [e1, e2, e3, e4, e5];

    it('returns exactly 4 slots', () => {
        const slots = generateSlots(e1, pool, 'kogo-to-jp');
        expect(slots).toHaveLength(4);
    });

    it('correct entry slot value is always present', () => {
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, pool, 'kogo-to-jp');
            const correctVal = getSlotValue(e1, 'kogo-to-jp');
            expect(slots.some((s) => getSlotValue(s, 'kogo-to-jp') === correctVal)).toBe(true);
        }
    });

    it('slot values have no duplicates with sufficient pool', () => {
        const slots = generateSlots(e1, pool, 'kogo-to-jp');
        const values = slots.map((s) => getSlotValue(s, 'kogo-to-jp'));
        const unique = new Set(values);
        expect(unique.size).toBe(4);
    });

    it('correct position is randomized across multiple calls', () => {
        const positions = new Set<number>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(e1, pool, 'kogo-to-jp');
            const pos = slots.findIndex((s) => s.id === e1.id);
            positions.add(pos);
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it('fallback works with small pool (3 entries)', () => {
        const smallPool = [e1, e2, e3];
        const slots = generateSlots(e1, smallPool, 'kogo-to-jp');
        expect(slots).toHaveLength(4);
        const correctVal = getSlotValue(e1, 'kogo-to-jp');
        expect(slots.some((s) => getSlotValue(s, 'kogo-to-jp') === correctVal)).toBe(true);
    });

    it('fallback works with single-entry pool', () => {
        const slots = generateSlots(e1, [e1], 'kogo-to-jp');
        expect(slots).toHaveLength(4);
    });

    it('en-to-kogo mode uses correct fields', () => {
        const slots = generateSlots(e1, pool, 'en-to-kogo');
        const correctVal = getSlotValue(e1, 'en-to-kogo');
        expect(slots.some((s) => getSlotValue(s, 'en-to-kogo') === correctVal)).toBe(true);
    });
});

describe('findExampleSentence', () => {
    const ex1: ExampleSentence = {
        sentence: 'wordA is here.',
        translation: 'translation',
        highlights: [{ word: 'wordA', form: 'wordA' }],
        verified: true,
    };
    const ex2: ExampleSentence = {
        sentence: 'wordB is here.',
        translation: 'translation',
        highlights: [{ word: 'wordB', form: 'wordB' }],
        verified: false,
    };
    const ex3: ExampleSentence = {
        sentence: 'wordA again.',
        translation: 'second',
        highlights: [{ word: 'wordA', form: 'wordA' }],
        verified: true,
    };

    it('returns matching verified example', () => {
        expect(findExampleSentence('wordA', [ex1, ex2, ex3])).toBe(ex1);
    });

    it('returns undefined when no match', () => {
        expect(findExampleSentence('wordX', [ex1, ex2])).toBeUndefined();
    });

    it('excludes unverified examples', () => {
        expect(findExampleSentence('wordB', [ex2])).toBeUndefined();
    });

    it('returns first match when multiple exist', () => {
        expect(findExampleSentence('wordA', [ex1, ex3])).toBe(ex1);
    });
});

describe('data integrity: kogoList', () => {
    it('all pos values are valid', () => {
        for (const entry of kogoList) {
            expect(POS_VALUES as readonly string[]).toContain(entry.pos);
        }
    });

    it('meaning is at most 30 characters', () => {
        for (const entry of kogoList) {
            expect(entry.meaning.length).toBeLessThanOrEqual(30);
        }
    });

    it('shortMeaning is at most 10 characters', () => {
        for (const entry of kogoList) {
            expect(entry.shortMeaning.length).toBeLessThanOrEqual(10);
        }
    });

    it('englishMeaning is at most 50 characters', () => {
        for (const entry of kogoList) {
            expect(entry.englishMeaning.length).toBeLessThanOrEqual(50);
        }
    });

    it('shortEnglishMeaning is at most 15 characters', () => {
        for (const entry of kogoList) {
            expect(entry.shortEnglishMeaning.length).toBeLessThanOrEqual(15);
        }
    });

    it('all ids are unique', () => {
        const ids = kogoList.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('data integrity: exampleSentences', () => {
    it('all highlights[].form is included in sentence', () => {
        for (const ex of exampleSentences) {
            for (const h of ex.highlights) {
                expect(ex.sentence.includes(h.form)).toBe(true);
            }
        }
    });

    it('all highlights[].word matches a kogoList entry word', () => {
        const words = new Set(kogoList.map((e) => e.word));
        for (const ex of exampleSentences) {
            for (const h of ex.highlights) {
                expect(words.has(h.word)).toBe(true);
            }
        }
    });
});
