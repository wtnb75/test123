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
    shortMeaning: [`short${id}`],
    level,
    pos: '形容詞・シク活用',
    englishMeaning: `english meaning for ${id}`,
    shortEnglishMeaning: [`en${id}`],
    verified: true,
    ...overrides,
});

const e1 = makeEntry('1', 'basic');
const e2 = makeEntry('2', 'basic');
const e3 = makeEntry('3', 'standard');
const e4 = makeEntry('4', 'standard');
const e5 = makeEntry('5', 'advanced');
const eUnverified = makeEntry('unv', 'basic', { verified: false });
// same shortMeaning[0] as e1
const eDupShort = makeEntry('dup', 'basic', { shortMeaning: ['short1'] });
// multiple meanings (primary + alts)
const eAlt = makeEntry('alt', 'basic', { shortMeaning: ['shortalt', 'alt1', 'alt2'] });
const eEnAlt = makeEntry('enalt', 'basic', { shortEnglishMeaning: ['enenalt', 'altEn1'] });
// three entries sharing the same shortMeaning (for second-pass fallback test)
const eDupVal1 = makeEntry('dv1', 'basic', { shortMeaning: ['dupval'] });
const eDupVal2 = makeEntry('dv2', 'basic', { shortMeaning: ['dupval'] });
const eDupVal3 = makeEntry('dv3', 'basic', { shortMeaning: ['dupval'] });

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
        for (let i = 1; i < seq.length; i++) {
            expect(seq[i].word).not.toBe(seq[i - 1].word);
        }
    });

    it('single entry pool returns all same entry', () => {
        const seq = createQuestionSequence([e1], 5);
        expect(seq).toHaveLength(5);
        expect(seq.every((e) => e.id === e1.id)).toBe(true);
    });

    it('swaps deck[0] when reshuffle would repeat the last word', () => {
        // Controlled RNG:
        //   1st shuffleArray (initial deck [e1,e2]): rng()=0.9 → j=floor(1.8)=1 → [e1,e2]
        //   2nd shuffleArray (reshuffle): rng()=0.1 → j=floor(0.2)=0 → [e2,e1]
        //     → deck[0].word === lastWord ('word2') → triggers swap
        //     swapIdx = 1 + floor(rng()*1) = 1 + floor(0.1) = 1 → deck=[e1,e2]
        const vals = [0.9, 0.1, 0.1];
        let vi = 0;
        const rng = () => vals[vi++ % vals.length];
        const seq = createQuestionSequence([e1, e2], 4, rng);
        expect(seq).toHaveLength(4);
        for (let i = 1; i < seq.length; i++) {
            expect(seq[i].word).not.toBe(seq[i - 1].word);
        }
    });
});

describe('getTileValue', () => {
    it('kogo-to-jp returns word', () => {
        expect(getTileValue(e1, 'kogo-to-jp')).toBe(e1.word);
    });
    it('kogo-to-en returns word', () => {
        expect(getTileValue(e1, 'kogo-to-en')).toBe(e1.word);
    });
    it('en-to-kogo returns first shortEnglishMeaning', () => {
        expect(getTileValue(e1, 'en-to-kogo')).toBe(e1.shortEnglishMeaning[0]);
    });
});

describe('getSlotValue', () => {
    it('kogo-to-jp returns first shortMeaning', () => {
        expect(getSlotValue(e1, 'kogo-to-jp')).toBe(e1.shortMeaning[0]);
    });
    it('kogo-to-en returns first shortEnglishMeaning', () => {
        expect(getSlotValue(e1, 'kogo-to-en')).toBe(e1.shortEnglishMeaning[0]);
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
    it('different entries with same shortMeaning[0] are correct', () => {
        expect(isCorrect(e1, eDupShort, 'kogo-to-jp')).toBe(true);
    });
    it('slot showing an alt meaning (non-[0]) of correct entry is accepted', () => {
        const altSlot = makeEntry('x', 'basic', { shortMeaning: ['alt1'] });
        expect(isCorrect(eAlt, altSlot, 'kogo-to-jp')).toBe(true);
    });
    it('slot showing unrelated meaning is rejected', () => {
        expect(isCorrect(eAlt, e2, 'kogo-to-jp')).toBe(false);
    });
    it('kogo-to-en accepts alt shortEnglishMeaning', () => {
        const altSlot = makeEntry('x', 'basic', { shortEnglishMeaning: ['altEn1'] });
        expect(isCorrect(eEnAlt, altSlot, 'kogo-to-en')).toBe(true);
        expect(isCorrect(eEnAlt, e2, 'kogo-to-en')).toBe(false);
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
            expect(slots.some((s) => isCorrect(e1, s, 'kogo-to-jp'))).toBe(true);
        }
    });

    it('slot values have no duplicates with sufficient pool', () => {
        const slots = generateSlots(e1, pool, 'kogo-to-jp');
        const values = slots.map((s) => getSlotValue(s, 'kogo-to-jp'));
        expect(new Set(values).size).toBe(4);
    });

    it('correct position is randomized across multiple calls', () => {
        const positions = new Set<number>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(e1, pool, 'kogo-to-jp');
            const pos = slots.findIndex((s) => isCorrect(e1, s, 'kogo-to-jp'));
            positions.add(pos);
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it('correct slot sometimes shows an alt meaning when shortMeaning has multiple values', () => {
        const poolWithAlt = [eAlt, e2, e3, e4, e5];
        const displayed = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(eAlt, poolWithAlt, 'kogo-to-jp');
            const correctSlot = slots.find((s) => isCorrect(eAlt, s, 'kogo-to-jp'));
            if (correctSlot) displayed.add(getSlotValue(correctSlot, 'kogo-to-jp'));
        }
        expect(displayed.has(eAlt.shortMeaning[0])).toBe(true);
        expect(displayed.has('alt1')).toBe(true);
    });

    it('dummies never show any meaning from shortMeaning of the correct entry', () => {
        const poolWithAlt = [eAlt, e2, e3, e4, e5];
        for (let i = 0; i < 30; i++) {
            const slots = generateSlots(eAlt, poolWithAlt, 'kogo-to-jp');
            const dummies = slots.filter((s) => !isCorrect(eAlt, s, 'kogo-to-jp'));
            for (const d of dummies) {
                expect(eAlt.shortMeaning).not.toContain(getSlotValue(d, 'kogo-to-jp'));
            }
        }
    });

    it('no dummy has same slot value as correct (prevents multiple correct slots)', () => {
        const poolWithDup = [e1, e2, e3, e4, e5, eDupShort];
        for (let i = 0; i < 30; i++) {
            const slots = generateSlots(e1, poolWithDup, 'kogo-to-jp');
            const correctCount = slots.filter((s) => isCorrect(e1, s, 'kogo-to-jp')).length;
            expect(correctCount).toBe(1);
        }
    });

    it('slot values are all distinct when pool has enough unique entries', () => {
        const poolWithDup = [e1, e2, e3, e4, e5, eDupShort];
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e2, poolWithDup, 'kogo-to-jp');
            const values = slots.map((s) => getSlotValue(s, 'kogo-to-jp'));
            expect(new Set(values).size).toBe(4);
        }
    });

    it('second pass allows duplicate display values when first pass yields fewer than 3', () => {
        const dupPool = [e1, eDupVal1, eDupVal2, eDupVal3];
        const slots = generateSlots(e1, dupPool, 'kogo-to-jp');
        expect(slots).toHaveLength(4);
        const correctCount = slots.filter((s) => isCorrect(e1, s, 'kogo-to-jp')).length;
        expect(correctCount).toBe(1);
    });

    it('fallback works with small pool (3 entries)', () => {
        const smallPool = [e1, e2, e3];
        const slots = generateSlots(e1, smallPool, 'kogo-to-jp');
        expect(slots).toHaveLength(4);
        expect(slots.some((s) => isCorrect(e1, s, 'kogo-to-jp'))).toBe(true);
    });

    it('fallback never uses correct slot value even in tiny pool', () => {
        const smallPool = [e1, e2, e3];
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, smallPool, 'kogo-to-jp');
            const correctCount = slots.filter((s) => isCorrect(e1, s, 'kogo-to-jp')).length;
            expect(correctCount).toBe(1);
        }
    });

    it('fallback works with single-entry pool', () => {
        const slots = generateSlots(e1, [e1], 'kogo-to-jp');
        expect(slots).toHaveLength(4);
    });

    it('kogo-to-en alt: correct slot shows alt shortEnglishMeaning', () => {
        const poolEn = [eEnAlt, e2, e3, e4, e5];
        const displayed = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(eEnAlt, poolEn, 'kogo-to-en');
            const correctSlot = slots.find((s) => isCorrect(eEnAlt, s, 'kogo-to-en'));
            if (correctSlot) displayed.add(getSlotValue(correctSlot, 'kogo-to-en'));
        }
        expect(displayed.has(eEnAlt.shortEnglishMeaning[0])).toBe(true);
        expect(displayed.has('altEn1')).toBe(true);
    });

    it('en-to-kogo mode uses correct fields', () => {
        const slots = generateSlots(e1, pool, 'en-to-kogo');
        expect(slots.some((s) => isCorrect(e1, s, 'en-to-kogo'))).toBe(true);
    });

    it('slotCount=5 returns 5 slots with exactly 1 correct', () => {
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, pool, 'kogo-to-jp', Math.random, 5);
            expect(slots).toHaveLength(5);
            expect(slots.filter((s) => isCorrect(e1, s, 'kogo-to-jp'))).toHaveLength(1);
        }
    });

    it('slotCount=6 returns 6 slots with exactly 1 correct', () => {
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, pool, 'kogo-to-jp', Math.random, 6);
            expect(slots).toHaveLength(6);
            expect(slots.filter((s) => isCorrect(e1, s, 'kogo-to-jp'))).toHaveLength(1);
        }
    });

    it('slotCount=5 with tiny pool falls back gracefully', () => {
        const slots = generateSlots(e1, [e1, e2], 'kogo-to-jp', Math.random, 5);
        expect(slots).toHaveLength(5);
        expect(slots.some((s) => isCorrect(e1, s, 'kogo-to-jp'))).toBe(true);
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

    it('each shortMeaning value is at most 10 characters', () => {
        for (const entry of kogoList) {
            expect(entry.shortMeaning.length).toBeGreaterThan(0);
            for (const m of entry.shortMeaning) {
                expect(m.length).toBeLessThanOrEqual(10);
            }
        }
    });

    it('englishMeaning is at most 50 characters', () => {
        for (const entry of kogoList) {
            expect(entry.englishMeaning.length).toBeLessThanOrEqual(50);
        }
    });

    it('each shortEnglishMeaning value is at most 15 characters', () => {
        for (const entry of kogoList) {
            expect(entry.shortEnglishMeaning.length).toBeGreaterThan(0);
            for (const m of entry.shortEnglishMeaning) {
                expect(m.length).toBeLessThanOrEqual(15);
            }
        }
    });

    it('all ids are unique', () => {
        const ids = kogoList.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('all entries have rank 1, 2, or 3', () => {
        for (const e of kogoList) {
            expect([1, 2, 3]).toContain(e.rank);
        }
    });

    it('rank counts match expected distribution', () => {
        const counts = { 1: 0, 2: 0, 3: 0 };
        for (const e of kogoList) counts[e.rank]++;
        expect(counts[1]).toBe(20);
        expect(counts[2]).toBe(34);
        expect(counts[3]).toBe(7);
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
