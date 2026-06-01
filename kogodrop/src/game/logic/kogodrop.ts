import type { KogoEntry, ExampleSentence, LangMode, Difficulty, Level } from './types';

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
    rng: () => number = Math.random
): KogoEntry[] => {
    if (pool.length === 0) {
        return [];
    }

    const result: KogoEntry[] = [];
    let deck = shuffleArray(pool, rng);
    let deckIndex = 0;

    for (let i = 0; i < count; i++) {
        if (deckIndex >= deck.length) {
            const lastWord = result.length > 0 ? result[result.length - 1].word : null;
            deck = shuffleArray(pool, rng);

            if (pool.length > 1 && lastWord !== null && deck[0].word === lastWord) {
                const swapIdx = 1 + Math.floor(rng() * (deck.length - 1));
                [deck[0], deck[swapIdx]] = [deck[swapIdx], deck[0]];
            }
            deckIndex = 0;
        }

        result.push(deck[deckIndex++]);
    }

    return result;
};

export const getTileValue = (entry: KogoEntry, mode: LangMode): string => {
    return mode === 'en-to-kogo' ? entry.shortEnglishMeaning : entry.word;
};

export const getSlotValue = (entry: KogoEntry, mode: LangMode): string => {
    if (mode === 'kogo-to-jp') return entry.shortMeaning;
    if (mode === 'kogo-to-en') return entry.shortEnglishMeaning;
    return entry.word;
};

export const getFullMeaning = (entry: KogoEntry, mode: LangMode): string => {
    if (mode === 'kogo-to-jp') return entry.meaning;
    if (mode === 'kogo-to-en') return entry.englishMeaning;
    return entry.word;
};

export const isCorrect = (correct: KogoEntry, selected: KogoEntry, mode: LangMode): boolean => {
    return getSlotValue(correct, mode) === getSlotValue(selected, mode);
};

export const generateSlots = (
    correct: KogoEntry,
    pool: KogoEntry[],
    mode: LangMode,
    rng: () => number = Math.random
): KogoEntry[] => {
    const correctValue = getSlotValue(correct, mode);
    const preferred = pool.filter(
        (e) => e.id !== correct.id && getSlotValue(e, mode) !== correctValue
    );

    let dummies: KogoEntry[];
    if (preferred.length >= 3) {
        dummies = shuffleArray(preferred, rng).slice(0, 3);
    } else {
        const others = shuffleArray(pool.filter((e) => e.id !== correct.id), rng);
        dummies = [...others];
        const base = others.length > 0 ? others : [correct];
        while (dummies.length < 3) {
            dummies.push(base[dummies.length % base.length]);
        }
        dummies = dummies.slice(0, 3);
    }

    const correctPosition = Math.floor(rng() * 4);
    const slots: KogoEntry[] = [];
    let dummyIndex = 0;

    for (let i = 0; i < 4; i++) {
        slots.push(i === correctPosition ? correct : dummies[dummyIndex++]);
    }

    return slots;
};

export const findExampleSentence = (
    word: string,
    examples: ExampleSentence[]
): ExampleSentence | undefined => {
    return examples.find((ex) => ex.verified && ex.highlights.some((h) => h.word === word));
};
