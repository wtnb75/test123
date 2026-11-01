/** A target word: uppercase English and its Japanese meaning. */
export interface Word {
    en: string;
    ja: string;
}

/** Random source in [0, 1), injected so the rules stay reproducible. */
export type Rng = () => number;

/** The fixed word list (docs/spec.md "単語リスト"): 37 words, 3 to 8 letters. */
export const WORDS: readonly Word[] = [
    { en: 'CAT', ja: 'ねこ' },
    { en: 'DOG', ja: 'いぬ' },
    { en: 'SUN', ja: '太陽' },
    { en: 'SKY', ja: '空' },
    { en: 'KEY', ja: 'かぎ' },
    { en: 'CUP', ja: 'カップ' },
    { en: 'BIRD', ja: '鳥' },
    { en: 'MOON', ja: '月' },
    { en: 'TREE', ja: '木' },
    { en: 'FISH', ja: '魚' },
    { en: 'BOOK', ja: '本' },
    { en: 'RAIN', ja: '雨' },
    { en: 'STAR', ja: '星' },
    { en: 'APPLE', ja: 'りんご' },
    { en: 'WATER', ja: '水' },
    { en: 'GREEN', ja: '緑' },
    { en: 'LIGHT', ja: '光' },
    { en: 'MUSIC', ja: '音楽' },
    { en: 'RIVER', ja: '川' },
    { en: 'ORANGE', ja: 'オレンジ' },
    { en: 'FLOWER', ja: '花' },
    { en: 'SCHOOL', ja: '学校' },
    { en: 'WINDOW', ja: '窓' },
    { en: 'FRIEND', ja: '友だち' },
    { en: 'GARDEN', ja: '庭' },
    { en: 'WEATHER', ja: '天気' },
    { en: 'MORNING', ja: '朝' },
    { en: 'KITCHEN', ja: '台所' },
    { en: 'LIBRARY', ja: '図書館' },
    { en: 'JOURNEY', ja: '旅' },
    { en: 'PICTURE', ja: '絵' },
    { en: 'ELEPHANT', ja: '象' },
    { en: 'MOUNTAIN', ja: '山' },
    { en: 'BIRTHDAY', ja: '誕生日' },
    { en: 'UMBRELLA', ja: '傘' },
    { en: 'HOSPITAL', ja: '病院' },
    { en: 'TREASURE', ja: '宝物' },
];
