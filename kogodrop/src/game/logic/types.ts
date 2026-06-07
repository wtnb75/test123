export const POS_VALUES = [
    '形容詞・ク活用',
    '形容詞・シク活用',
    '形容動詞・ナリ活用',
    '形容動詞・タリ活用',
    '動詞・四段活用',
    '動詞・上一段活用',
    '動詞・上二段活用',
    '動詞・下一段活用',
    '動詞・下二段活用',
    '動詞・カ行変格活用',
    '動詞・サ行変格活用',
    '動詞・ナ行変格活用',
    '動詞・ラ行変格活用',
    '名詞',
    '副詞',
    '助動詞',
    '接続詞',
    '感動詞',
] as const;

export type PosValue = (typeof POS_VALUES)[number];
export type Level = 'basic' | 'standard' | 'advanced';
export type Lang = 'kogo' | 'jp' | 'en';
export type LangMode = { tile: Lang; slot: Lang };
export type Difficulty = 'easy' | 'normal' | 'hard';
export type QuestionCount = 10 | 20 | 30;

export interface KogoEntry {
    id: string;
    word: string;
    reading?: string;
    meaning: string;
    shortMeaning: string[];
    level: Level;
    pos: PosValue;
    englishMeaning: string;
    shortEnglishMeaning: string[];
    verified: boolean;
    rank: 1 | 2 | 3;
}

export interface Highlight {
    word: string;
    form: string;
    note?: string;
}

export interface ExampleSentence {
    sentence: string;
    translation: string;
    translationEn?: string;
    highlights: Highlight[];
    source?: string;
    verified: boolean;
}

export interface GameConfig {
    langMode: LangMode;
    difficulty: Difficulty;
    questionCount: QuestionCount;
}
