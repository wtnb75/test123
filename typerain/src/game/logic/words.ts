// The word list and how words are chosen and placed (docs/spec.md "単語リスト", "ルール > 単語").
import { CHAR_W, MARGIN, SCREEN_WIDTH, WORD_MIN_LEN } from '../params';
import { maxLenAt } from './difficulty';

/** Random numbers in [0, 1); injected so choices are reproducible. */
export type Rng = () => number;

export const WORDS: readonly string[] = [
    // 3 letters
    ...['cat', 'dog', 'sun', 'sky', 'red', 'box', 'cup', 'map', 'key', 'bus', 'egg', 'fox', 'hat', 'ice', 'jam'],
    ...['leg', 'owl', 'pen', 'zoo', 'bee'],
    // 4 letters
    ...['tree', 'bird', 'fish', 'moon', 'star', 'wind', 'snow', 'book', 'door', 'cake', 'milk', 'ship', 'road'],
    ...['lamp', 'song', 'farm', 'hill', 'jump', 'kite', 'nest'],
    // 5 letters
    ...['apple', 'bread', 'chair', 'cloud', 'dance', 'earth', 'flame', 'grape', 'house', 'juice', 'lemon'],
    ...['mouse', 'night', 'ocean', 'piano', 'queen', 'river', 'storm', 'tiger', 'water'],
    // 6 letters
    ...['animal', 'basket', 'camera', 'dinner', 'engine', 'forest', 'garden', 'hammer', 'island', 'jungle'],
    ...['kitten', 'ladder', 'magnet', 'orange', 'pencil', 'rabbit', 'silver', 'turtle', 'window', 'yellow'],
    // 7 letters
    ...['balloon', 'chicken', 'diamond', 'factory', 'giraffe', 'holiday', 'kitchen', 'monster', 'penguin'],
    ...['rainbow', 'station', 'teacher', 'village', 'weather', 'musical', 'journey', 'library', 'mystery'],
    ...['pumpkin', 'whistle'],
    // 8 letters
    ...['airplane', 'birthday', 'computer', 'elephant', 'football', 'hospital', 'mountain', 'notebook'],
    ...['painting', 'question', 'sandwich', 'treasure', 'umbrella', 'vacation', 'wardrobe', 'bathroom'],
    ...['building', 'children', 'daughter', 'envelope'],
];

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/**
 * Chooses the next word. The length is uniform in [WORD_MIN_LEN, maxLen(t)]; the word is one that is not on
 * screen, preferably with a first letter no other word on screen starts with (so the first key press picks one
 * word). Falls back to any word of that length, then to any word not on screen.
 */
export function pickWord(rng: Rng, elapsedSec: number, onScreen: readonly string[]): string {
    const maxLen = maxLenAt(elapsedSec);
    const len = WORD_MIN_LEN + Math.min(maxLen - WORD_MIN_LEN, Math.floor(rng() * (maxLen - WORD_MIN_LEN + 1)));
    const shown = new Set(onScreen);
    const firsts = new Set(onScreen.map((w) => w[0]));
    const sameLen = WORDS.filter((w) => w.length === len && !shown.has(w));
    const distinctFirst = sameLen.filter((w) => !firsts.has(w[0]));
    if (distinctFirst.length > 0) return pick(distinctFirst, rng);
    if (sameLen.length > 0) return pick(sameLen, rng);
    return pick(
        WORDS.filter((w) => !shown.has(w)),
        rng,
    );
}

/** Left edge of a new word: uniform over the room that keeps it inside the margins (MARGIN when there is none). */
export function pickWordX(rng: Rng, length: number): number {
    const room = SCREEN_WIDTH - MARGIN * 2 - length * CHAR_W;
    return MARGIN + rng() * Math.max(0, room);
}
