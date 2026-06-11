import type { KogoEntry, ExampleSentence, Lang, Difficulty, Level } from './types';

export const DIFFICULTY_LEVELS: Record<Difficulty, Level[]> = {
    easy: ['basic'],
    normal: ['basic', 'standard'],
    hard: ['basic', 'standard', 'advanced'],
};

export const getPool = (
    entries: KogoEntry[],
    difficulty: Difficulty,
    ignoreVerified = false
): KogoEntry[] => {
    const levels = DIFFICULTY_LEVELS[difficulty];
    return entries.filter((e) => levels.includes(e.level) && (ignoreVerified || e.verified));
};

export const shuffleArray = <T>(arr: T[], rng: () => number = Math.random): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export const createQuestionSequence = (
    pool: KogoEntry[],
    count: number,
    rng: () => number = Math.random,
    excludeIds: Set<string> = new Set()
): KogoEntry[] => {
    if (pool.length === 0) {
        return [];
    }

    const filtered = excludeIds.size > 0 ? pool.filter((e) => !excludeIds.has(e.id)) : pool;
    const activePool = filtered.length > 0 ? filtered : pool;

    const result: KogoEntry[] = [];
    let deck = shuffleArray(activePool, rng);
    let deckIndex = 0;

    for (let i = 0; i < count; i++) {
        if (deckIndex >= deck.length) {
            const lastWord = result.length > 0 ? result[result.length - 1].word : null;
            deck = shuffleArray(activePool, rng);

            if (activePool.length > 1 && lastWord !== null && deck[0].word === lastWord) {
                const swapIdx = 1 + Math.floor(rng() * (deck.length - 1));
                [deck[0], deck[swapIdx]] = [deck[swapIdx], deck[0]];
            }
            deckIndex = 0;
        }

        result.push(deck[deckIndex++]);
    }

    return result;
};

export const getLangValue = (entry: KogoEntry, lang: Lang): string => {
    if (lang === 'kogo') return entry.word;
    if (lang === 'jp') return entry.shortMeaning[0];
    return entry.shortEnglishMeaning[0];
};

export const getFullMeaning = (entry: KogoEntry, slotLang: Lang): string => {
    if (slotLang === 'kogo') return entry.word;
    if (slotLang === 'jp') return entry.meaning;
    return entry.englishMeaning;
};

const getAllLangValues = (entry: KogoEntry, lang: Lang): string[] => {
    if (lang === 'kogo') return [entry.word];
    if (lang === 'jp') return entry.shortMeaning;
    return entry.shortEnglishMeaning;
};

export const sharesConfusingPrefix = (a: string, b: string): boolean => {
    if (a === b || a.length < 2 || b.length < 2) return false;
    return a.slice(0, 2) === b.slice(0, 2);
};

export const isCorrect = (correct: KogoEntry, selected: KogoEntry, slotLang: Lang): boolean => {
    return getAllLangValues(correct, slotLang).includes(getLangValue(selected, slotLang));
};

export const generateSlots = (
    correct: KogoEntry,
    pool: KogoEntry[],
    slotLang: Lang,
    rng: () => number = Math.random,
    slotCount = 4,
    tileLang?: Lang
): KogoEntry[] => {
    const dummyTarget = slotCount - 1;
    const allCorrectValues = new Set(getAllLangValues(correct, slotLang));
    // When tileLang is provided, exclude entries that share any tile-side meaning with correct
    // (they would look like valid answers to the player, causing ambiguity)
    const correctTileValues = tileLang ? new Set(getAllLangValues(correct, tileLang)) : null;

    const candidates = shuffleArray(
        pool.filter((e) => {
            if (e.id === correct.id) return false;
            if (allCorrectValues.has(getLangValue(e, slotLang))) return false;
            if (correctTileValues && tileLang && getAllLangValues(e, tileLang).some((v) => correctTileValues.has(v))) return false;
            // Exclude entries that are manually flagged as semantically confusable
            // with the correct answer, in either direction.
            if (correct.confusableWith?.includes(e.id)) return false;
            if (e.confusableWith?.includes(correct.id)) return false;
            return true;
        }),
        rng
    );

    const dummies: KogoEntry[] = [];
    const usedValues = new Set<string>(allCorrectValues);

    // First pass: distinct values AND no confusing 2-char prefix with any correct value
    for (const e of candidates) {
        if (dummies.length >= dummyTarget) break;
        const val = getLangValue(e, slotLang);
        const confusing = [...allCorrectValues].some((cv) => sharesConfusingPrefix(val, cv));
        if (!usedValues.has(val) && !confusing) {
            dummies.push(e);
            usedValues.add(val);
        }
    }

    // Second pass: allow confusing prefix when first pass couldn't fill all slots
    for (const e of candidates) {
        if (dummies.length >= dummyTarget) break;
        const val = getLangValue(e, slotLang);
        if (!usedValues.has(val)) {
            dummies.push(e);
            usedValues.add(val);
        }
    }

    // Third pass: allow repeated display values when pool is too small
    for (const e of candidates) {
        if (dummies.length >= dummyTarget) break;
        if (!dummies.includes(e)) dummies.push(e);
    }

    // Last resort: pad when pool is tiny
    const padSource = candidates.length > 0 ? candidates : [correct];
    while (dummies.length < dummyTarget) {
        dummies.push(padSource[dummies.length % padSource.length]);
    }

    // Randomly pick which valid meaning to display in the correct slot
    const correctValues = [...allCorrectValues];
    const displayValue = correctValues[Math.floor(rng() * correctValues.length)];
    const correctSlotEntry: KogoEntry =
        displayValue === getLangValue(correct, slotLang)
            ? correct
            : slotLang === 'jp'
              ? { ...correct, shortMeaning: [displayValue] }
              : slotLang === 'en'
                ? { ...correct, shortEnglishMeaning: [displayValue] }
                : correct;

    const correctPosition = Math.floor(rng() * slotCount);
    const slots: KogoEntry[] = [];
    let dummyIndex = 0;
    for (let i = 0; i < slotCount; i++) {
        slots.push(i === correctPosition ? correctSlotEntry : dummies[dummyIndex++]);
    }
    return slots;
};

export const findExampleSentences = (
    word: string,
    examples: ExampleSentence[],
    max = 2
): ExampleSentence[] => {
    const result: ExampleSentence[] = [];
    for (const ex of examples) {
        if (result.length >= max) break;
        if (ex.verified && ex.highlights.some((h) => h.word === word)) result.push(ex);
    }
    return result;
};

export const findExampleSentence = (
    word: string,
    examples: ExampleSentence[]
): ExampleSentence | undefined => findExampleSentences(word, examples, 1)[0];
