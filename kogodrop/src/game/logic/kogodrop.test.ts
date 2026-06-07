import { describe, it, expect } from 'vitest';
import {
    DIFFICULTY_LEVELS,
    findExampleSentence,
    findExampleSentences,
    generateSlots,
    getFullMeaning,
    getPool,
    getLangValue,
    isCorrect,
    createQuestionSequence,
    sharesConfusingPrefix,
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
    rank: 1,
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

    it('excludeIds removes specified entries from sequence', () => {
        const pool = [e1, e2, e3, e4, e5];
        const exclude = new Set([e1.id, e3.id]);
        const seq = createQuestionSequence(pool, 20, Math.random, exclude);
        expect(seq.every((e) => !exclude.has(e.id))).toBe(true);
    });

    it('excludeIds falls back to full pool when all entries are excluded', () => {
        const pool = [e1, e2];
        const exclude = new Set([e1.id, e2.id]);
        const seq = createQuestionSequence(pool, 5, Math.random, exclude);
        expect(seq).toHaveLength(5);
    });

    it('empty excludeIds has no effect', () => {
        const pool = [e1, e2, e3];
        const seq = createQuestionSequence(pool, 9, seqRng, new Set());
        expect(seq).toHaveLength(9);
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

describe('getLangValue', () => {
    it("'kogo' returns word", () => {
        expect(getLangValue(e1, 'kogo')).toBe(e1.word);
    });
    it("'jp' returns first shortMeaning", () => {
        expect(getLangValue(e1, 'jp')).toBe(e1.shortMeaning[0]);
    });
    it("'en' returns first shortEnglishMeaning", () => {
        expect(getLangValue(e1, 'en')).toBe(e1.shortEnglishMeaning[0]);
    });
});

describe('getFullMeaning', () => {
    it("'jp' returns meaning", () => {
        expect(getFullMeaning(e1, 'jp')).toBe(e1.meaning);
    });
    it("'en' returns englishMeaning", () => {
        expect(getFullMeaning(e1, 'en')).toBe(e1.englishMeaning);
    });
    it("'kogo' returns word", () => {
        expect(getFullMeaning(e1, 'kogo')).toBe(e1.word);
    });
});

describe('isCorrect', () => {
    it('same entry is correct', () => {
        expect(isCorrect(e1, e1, 'jp')).toBe(true);
    });
    it('different entry is incorrect', () => {
        expect(isCorrect(e1, e2, 'jp')).toBe(false);
    });
    it('different entries with same shortMeaning[0] are correct', () => {
        expect(isCorrect(e1, eDupShort, 'jp')).toBe(true);
    });
    it('slot showing an alt meaning (non-[0]) of correct entry is accepted', () => {
        const altSlot = makeEntry('x', 'basic', { shortMeaning: ['alt1'] });
        expect(isCorrect(eAlt, altSlot, 'jp')).toBe(true);
    });
    it('slot showing unrelated meaning is rejected', () => {
        expect(isCorrect(eAlt, e2, 'jp')).toBe(false);
    });
    it("'en' slot accepts alt shortEnglishMeaning", () => {
        const altSlot = makeEntry('x', 'basic', { shortEnglishMeaning: ['altEn1'] });
        expect(isCorrect(eEnAlt, altSlot, 'en')).toBe(true);
        expect(isCorrect(eEnAlt, e2, 'en')).toBe(false);
    });
    it("'kogo' slot checks word field", () => {
        expect(isCorrect(e1, e1, 'kogo')).toBe(true);
        expect(isCorrect(e1, e2, 'kogo')).toBe(false);
    });
});

describe('generateSlots', () => {
    const pool = [e1, e2, e3, e4, e5];

    it('returns exactly 4 slots', () => {
        const slots = generateSlots(e1, pool, 'jp');
        expect(slots).toHaveLength(4);
    });

    it('correct entry slot value is always present', () => {
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, pool, 'jp');
            expect(slots.some((s) => isCorrect(e1, s, 'jp'))).toBe(true);
        }
    });

    it('slot values have no duplicates with sufficient pool', () => {
        const slots = generateSlots(e1, pool, 'jp');
        const values = slots.map((s) => getLangValue(s, 'jp'));
        expect(new Set(values).size).toBe(4);
    });

    it('correct position is randomized across multiple calls', () => {
        const positions = new Set<number>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(e1, pool, 'jp');
            const pos = slots.findIndex((s) => isCorrect(e1, s, 'jp'));
            positions.add(pos);
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it('correct slot sometimes shows an alt meaning when shortMeaning has multiple values', () => {
        const poolWithAlt = [eAlt, e2, e3, e4, e5];
        const displayed = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(eAlt, poolWithAlt, 'jp');
            const correctSlot = slots.find((s) => isCorrect(eAlt, s, 'jp'));
            if (correctSlot) displayed.add(getLangValue(correctSlot, 'jp'));
        }
        expect(displayed.has(eAlt.shortMeaning[0])).toBe(true);
        expect(displayed.has('alt1')).toBe(true);
    });

    it('dummies never show any meaning from shortMeaning of the correct entry', () => {
        const poolWithAlt = [eAlt, e2, e3, e4, e5];
        for (let i = 0; i < 30; i++) {
            const slots = generateSlots(eAlt, poolWithAlt, 'jp');
            const dummies = slots.filter((s) => !isCorrect(eAlt, s, 'jp'));
            for (const d of dummies) {
                expect(eAlt.shortMeaning).not.toContain(getLangValue(d, 'jp'));
            }
        }
    });

    it('no dummy has same slot value as correct (prevents multiple correct slots)', () => {
        const poolWithDup = [e1, e2, e3, e4, e5, eDupShort];
        for (let i = 0; i < 30; i++) {
            const slots = generateSlots(e1, poolWithDup, 'jp');
            const correctCount = slots.filter((s) => isCorrect(e1, s, 'jp')).length;
            expect(correctCount).toBe(1);
        }
    });

    it('slot values are all distinct when pool has enough unique entries', () => {
        const poolWithDup = [e1, e2, e3, e4, e5, eDupShort];
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e2, poolWithDup, 'jp');
            const values = slots.map((s) => getLangValue(s, 'jp'));
            expect(new Set(values).size).toBe(4);
        }
    });

    it('second pass allows duplicate display values when first pass yields fewer than 3', () => {
        const dupPool = [e1, eDupVal1, eDupVal2, eDupVal3];
        const slots = generateSlots(e1, dupPool, 'jp');
        expect(slots).toHaveLength(4);
        const correctCount = slots.filter((s) => isCorrect(e1, s, 'jp')).length;
        expect(correctCount).toBe(1);
    });

    it('fallback works with small pool (3 entries)', () => {
        const smallPool = [e1, e2, e3];
        const slots = generateSlots(e1, smallPool, 'jp');
        expect(slots).toHaveLength(4);
        expect(slots.some((s) => isCorrect(e1, s, 'jp'))).toBe(true);
    });

    it('fallback never uses correct slot value even in tiny pool', () => {
        const smallPool = [e1, e2, e3];
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, smallPool, 'jp');
            const correctCount = slots.filter((s) => isCorrect(e1, s, 'jp')).length;
            expect(correctCount).toBe(1);
        }
    });

    it('fallback works with single-entry pool', () => {
        const slots = generateSlots(e1, [e1], 'jp');
        expect(slots).toHaveLength(4);
    });

    it('kogo-to-en alt: correct slot shows alt shortEnglishMeaning', () => {
        const poolEn = [eEnAlt, e2, e3, e4, e5];
        const displayed = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const slots = generateSlots(eEnAlt, poolEn, 'en');
            const correctSlot = slots.find((s) => isCorrect(eEnAlt, s, 'en'));
            if (correctSlot) displayed.add(getLangValue(correctSlot, 'en'));
        }
        expect(displayed.has(eEnAlt.shortEnglishMeaning[0])).toBe(true);
        expect(displayed.has('altEn1')).toBe(true);
    });

    it('en-to-kogo mode uses correct fields', () => {
        const slots = generateSlots(e1, pool, 'kogo');
        expect(slots.some((s) => isCorrect(e1, s, 'kogo'))).toBe(true);
    });

    it('slotCount=5 returns 5 slots with exactly 1 correct', () => {
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, pool, 'jp', Math.random, 5);
            expect(slots).toHaveLength(5);
            expect(slots.filter((s) => isCorrect(e1, s, 'jp'))).toHaveLength(1);
        }
    });

    it('slotCount=6 returns 6 slots with exactly 1 correct', () => {
        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(e1, pool, 'jp', Math.random, 6);
            expect(slots).toHaveLength(6);
            expect(slots.filter((s) => isCorrect(e1, s, 'jp'))).toHaveLength(1);
        }
    });

    it('slotCount=5 with tiny pool falls back gracefully', () => {
        const slots = generateSlots(e1, [e1, e2], 'jp', Math.random, 5);
        expect(slots).toHaveLength(5);
        expect(slots.some((s) => isCorrect(e1, s, 'jp'))).toBe(true);
    });

    it('first pass avoids confusing distractors when alternatives exist', () => {
        const correct = makeEntry('c', 'basic', { shortMeaning: ['あいさつ'] });
        const confusing = makeEntry('cf', 'basic', { shortMeaning: ['あいして'] }); // same あい prefix
        const clean1 = makeEntry('cl1', 'basic', { shortMeaning: ['かわいい'] });
        const clean2 = makeEntry('cl2', 'basic', { shortMeaning: ['きれいだ'] });
        const clean3 = makeEntry('cl3', 'basic', { shortMeaning: ['さびしい'] });

        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(correct, [correct, confusing, clean1, clean2, clean3], 'jp');
            const dummies = slots.filter((s) => !isCorrect(correct, s, 'jp'));
            expect(dummies.every((d) => getLangValue(d, 'jp') !== 'あいして')).toBe(true);
        }
    });

    it('falls back to confusing distractor when no clean alternative exists', () => {
        const correct = makeEntry('c', 'basic', { shortMeaning: ['あいさつ'] });
        const confusing = makeEntry('cf', 'basic', { shortMeaning: ['あいして'] });
        // Only one non-confusing entry — not enough to fill 3 dummy slots
        const clean1 = makeEntry('cl1', 'basic', { shortMeaning: ['かわいい'] });

        const slots = generateSlots(correct, [correct, confusing, clean1], 'jp');
        expect(slots).toHaveLength(4);
        expect(slots.some((s) => isCorrect(correct, s, 'jp'))).toBe(true);
    });

    it('tileLang: excludes dummies whose tile-side meaning overlaps with correct entry', () => {
        // Regression: jp→kogo mode — tile shows "言う", both "いふ" and "まうす" have "言う"
        // in shortMeaning, so "まうす" must not appear as a dummy slot
        const ifu = makeEntry('ifu', 'basic', { word: 'いふ', shortMeaning: ['言う'] });
        const mousu = makeEntry('mousu', 'basic', { word: 'まうす', shortMeaning: ['言う', '申す'] });
        const afu = makeEntry('afu', 'basic', { word: 'あふ', shortMeaning: ['会う'] });
        const miru = makeEntry('miru', 'basic', { word: 'みる', shortMeaning: ['見る'] });
        const kuru = makeEntry('kuru', 'basic', { word: 'く', shortMeaning: ['来る'] });

        for (let i = 0; i < 20; i++) {
            const slots = generateSlots(ifu, [ifu, mousu, afu, miru, kuru], 'kogo', Math.random, 4, 'jp');
            // "まうす" shares tile-side meaning "言う" with correct → must not appear
            expect(slots.every((s) => s.id !== mousu.id)).toBe(true);
            // correct slot is always present
            expect(slots.some((s) => s.id === ifu.id)).toBe(true);
        }
    });

    it('tileLang: undefined falls back to old behavior (no tile-side filtering)', () => {
        const ifu = makeEntry('ifu', 'basic', { word: 'いふ', shortMeaning: ['言う'] });
        const mousu = makeEntry('mousu', 'basic', { word: 'まうす', shortMeaning: ['言う'] });
        const afu = makeEntry('afu', 'basic', { word: 'あふ', shortMeaning: ['会う'] });
        const miru = makeEntry('miru', 'basic', { word: 'みる', shortMeaning: ['見る'] });

        // Without tileLang, mousu may appear (old behavior preserved for backwards compat)
        const allSlotIds = new Set<string>();
        for (let i = 0; i < 50; i++) {
            const slots = generateSlots(ifu, [ifu, mousu, afu, miru], 'kogo', Math.random, 4);
            slots.forEach((s) => allSlotIds.add(s.id));
        }
        // mousu can appear as a dummy when tileLang is not provided
        expect(allSlotIds.has(mousu.id)).toBe(true);
    });
});

describe('sharesConfusingPrefix', () => {
    it('returns false for identical strings', () => {
        expect(sharesConfusingPrefix('あいさつ', 'あいさつ')).toBe(false);
    });
    it('returns true when first 2 chars match and strings differ', () => {
        expect(sharesConfusingPrefix('あいさつ', 'あいして')).toBe(true);
    });
    it('returns false when first 2 chars differ', () => {
        expect(sharesConfusingPrefix('あいさつ', 'かわいい')).toBe(false);
    });
    it('returns false when either string is shorter than 2 chars', () => {
        expect(sharesConfusingPrefix('あ', 'あい')).toBe(false);
        expect(sharesConfusingPrefix('あい', 'あ')).toBe(false);
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

describe('findExampleSentences', () => {
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
    const ex4: ExampleSentence = {
        sentence: 'wordA third.',
        translation: 'third',
        highlights: [{ word: 'wordA', form: 'wordA' }],
        verified: true,
    };

    it('returns empty array when no match', () => {
        expect(findExampleSentences('wordX', [ex1, ex2])).toEqual([]);
    });

    it('excludes unverified examples', () => {
        expect(findExampleSentences('wordB', [ex2])).toEqual([]);
    });

    it('returns up to max=2 by default', () => {
        expect(findExampleSentences('wordA', [ex1, ex3, ex4])).toEqual([ex1, ex3]);
    });

    it('returns fewer than max when not enough matches', () => {
        expect(findExampleSentences('wordA', [ex1])).toEqual([ex1]);
    });

    it('respects custom max', () => {
        expect(findExampleSentences('wordA', [ex1, ex3, ex4], 3)).toEqual([ex1, ex3, ex4]);
        expect(findExampleSentences('wordA', [ex1, ex3, ex4], 1)).toEqual([ex1]);
    });
});

describe('data integrity: kogoList', () => {
    it('all pos values are valid', () => {
        for (const entry of kogoList) {
            expect(POS_VALUES as readonly string[]).toContain(entry.pos);
        }
    });

    it('meaning is at most 100 characters', () => {
        for (const entry of kogoList) {
            expect(entry.meaning.length).toBeLessThanOrEqual(100);
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
        expect(counts[1]).toBe(45);
        expect(counts[2]).toBe(72);
        expect(counts[3]).toBe(17);
    });

    it('reports entries sharing a 2-char prefix in shortMeaning (filtered at runtime by generateSlots)', () => {
        // 完全一致は出題時に除去されるため問題なし。
        // 先頭2文字が共通な別表現は generateSlots の第1パスで選択を避ける。
        // このテストはデータの現状を記録するためのもので、失敗しない。
        const allValues: Array<{ id: string; value: string }> = [];
        for (const entry of kogoList)
            for (const m of entry.shortMeaning)
                allValues.push({ id: entry.id, value: m });

        const nearDuplicates: string[] = [];
        for (let i = 0; i < allValues.length; i++) {
            for (let j = i + 1; j < allValues.length; j++) {
                const a = allValues[i], b = allValues[j];
                if (a.id === b.id) continue;
                if (a.value === b.value) continue;
                if (a.value.length < 2 || b.value.length < 2) continue;
                if (a.value.slice(0, 2) === b.value.slice(0, 2)) {
                    nearDuplicates.push(`'${a.value}'(${a.id}) ≈ '${b.value}'(${b.id})`);
                }
            }
        }
        if (nearDuplicates.length > 0) {
            // eslint-disable-next-line no-console
            console.info('[kogoList] near-duplicate shortMeaning pairs filtered at runtime:\n' + nearDuplicates.join('\n'));
        }
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

    it('no duplicate sentences', () => {
        const seen = new Map<string, number>();
        const duplicates: string[] = [];
        for (const ex of exampleSentences) {
            const prev = seen.get(ex.sentence);
            if (prev !== undefined) {
                duplicates.push(`「${ex.sentence}」 (first seen at index ${prev})`);
            } else {
                seen.set(ex.sentence, exampleSentences.indexOf(ex));
            }
        }
        expect(duplicates, `duplicate sentences:\n${duplicates.join('\n')}`).toEqual([]);
    });

    it('verified entries must have a non-empty translation', () => {
        const offenders: string[] = [];
        for (const ex of exampleSentences) {
            if (ex.verified && ex.translation.trim() === '') {
                offenders.push(`「${ex.sentence}」`);
            }
        }
        expect(offenders, `verified but missing translation:\n${offenders.join('\n')}`).toEqual([]);
    });
});
