import { describe, expect, it } from 'vitest';
import { pickWord, pickWordX, WORDS } from './words';
import { seededRng, seqRng } from './testing';

// The 120 words the game shipped with (docs/spec.md "単語リスト"); the extended list must keep all of them.
const ORIGINAL_WORDS: readonly string[] = [
    ...['cat', 'dog', 'sun', 'sky', 'red', 'box', 'cup', 'map', 'key', 'bus', 'egg', 'fox', 'hat', 'ice', 'jam'],
    ...['leg', 'owl', 'pen', 'zoo', 'bee'],
    ...['tree', 'bird', 'fish', 'moon', 'star', 'wind', 'snow', 'book', 'door', 'cake', 'milk', 'ship', 'road'],
    ...['lamp', 'song', 'farm', 'hill', 'jump', 'kite', 'nest'],
    ...['apple', 'bread', 'chair', 'cloud', 'dance', 'earth', 'flame', 'grape', 'house', 'juice', 'lemon'],
    ...['mouse', 'night', 'ocean', 'piano', 'queen', 'river', 'storm', 'tiger', 'water'],
    ...['animal', 'basket', 'camera', 'dinner', 'engine', 'forest', 'garden', 'hammer', 'island', 'jungle'],
    ...['kitten', 'ladder', 'magnet', 'orange', 'pencil', 'rabbit', 'silver', 'turtle', 'window', 'yellow'],
    ...['balloon', 'chicken', 'diamond', 'factory', 'giraffe', 'holiday', 'kitchen', 'monster', 'penguin'],
    ...['rainbow', 'station', 'teacher', 'village', 'weather', 'musical', 'journey', 'library', 'mystery'],
    ...['pumpkin', 'whistle'],
    ...['airplane', 'birthday', 'computer', 'elephant', 'football', 'hospital', 'mountain', 'notebook'],
    ...['painting', 'question', 'sandwich', 'treasure', 'umbrella', 'vacation', 'wardrobe', 'bathroom'],
    ...['building', 'children', 'daughter', 'envelope'],
];

const firstLetterCounts = (words: readonly string[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w[0], (counts.get(w[0]) ?? 0) + 1);
    return counts;
};

describe('WORDS', () => {
    it('has 240 distinct lower-case words, 40 for each length from 3 to 8', () => {
        expect(WORDS).toHaveLength(240);
        expect(new Set(WORDS).size).toBe(240);
        for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,8}$/);
        for (let len = 3; len <= 8; len++) expect(WORDS.filter((w) => w.length === len)).toHaveLength(40);
    });

    it('keeps all 120 words of the original list (the fixture itself is 120 distinct words)', () => {
        expect(ORIGINAL_WORDS).toHaveLength(120);
        expect(new Set(ORIGINAL_WORDS).size).toBe(120);
        const now = new Set(WORDS);
        expect(ORIGINAL_WORDS.filter((w) => !now.has(w))).toEqual([]);
    });

    it('has at least 20 different first letters in every length (measured minimum: 22, 4 letters)', () => {
        for (let len = 3; len <= 8; len++) {
            const firsts = firstLetterCounts(WORDS.filter((w) => w.length === len));
            expect(firsts.size, `length ${len}`).toBeGreaterThanOrEqual(20);
        }
    });

    it('evens out the first letters: u, y and z have 5 or more words, b and s have not grown (11 and 10)', () => {
        const counts = firstLetterCounts(WORDS);
        for (const letter of ['u', 'y', 'z']) expect(counts.get(letter), letter).toBeGreaterThanOrEqual(5);
        expect(counts.get('b')).toBeLessThanOrEqual(11);
        expect(counts.get('s')).toBeLessThanOrEqual(10);
    });
});

describe('pickWord', () => {
    it('draws the length from 3 up to the longest allowed at that time (4 at the start)', () => {
        // First number: the length (0 -> 3, 0.999 -> 4). Second: the index among the candidates.
        expect(pickWord(seqRng([0, 0]), 0, [])).toBe('cat');
        expect(pickWord(seqRng([0.999, 0]), 0, [])).toBe('tree');
    });

    it('can draw up to 8 letters once 80 s have passed', () => {
        expect(pickWord(seqRng([0.999, 0]), 80, [])).toBe('airplane');
        expect(pickWord(seqRng([0, 0]), 80, [])).toBe('cat');
    });

    it('picks the first or the last candidate at the ends of the random range', () => {
        expect(pickWord(seqRng([0, 0]), 0, [])).toBe('cat');
        // The last 3-letter word of the extended list is "fan" (it was "bee" in the 120-word list).
        expect(pickWord(seqRng([0, 0.999]), 0, [])).toBe('fan');
    });

    it('never picks a word already on screen, nor one that starts with the same letter as a word on screen', () => {
        // "cat" is shown: "cat" and "cup" (also c) are skipped, so the first candidate is "dog".
        expect(pickWord(seqRng([0, 0]), 0, ['cat'])).toBe('dog');
    });

    it('takes the last of the candidates whose first letters are free at the high end of the range', () => {
        // "bus" is shown: "bus", "box" and "bee" (all b) are out. The last 3-letter candidate is "fan" (not b).
        expect(pickWord(seqRng([0, 0.999]), 0, ['bus'])).toBe('fan');
    });

    it('draws middle lengths too (at 80 s a draw of 0.5 gives 6 letters)', () => {
        expect(pickWord(seqRng([0.5, 0]), 80, [])).toBe('animal');
    });

    it('allows a shared first letter when every first letter of that length is already used', () => {
        // One 3-letter word for each of the 23 first letters used by 3-letter words (a, b, c, d, e, f, g, h, i, j,
        // k, l, m, n, o, p, r, s, t, v, w, y, z), so no 3-letter candidate has a free first letter.
        const shown = ['cat', 'dog', 'sun', 'red', 'box', 'map', 'key', 'egg', 'fox', 'hat', 'ice', 'jam'];
        shown.push('leg', 'owl', 'pen', 'zoo', 'ant', 'gum', 'net', 'tea', 'van', 'yak', 'wet');
        // The 3-letter words not on screen, in list order, are sky, cup, bus, bee, arm, eye, end, ink, nut, oil,
        // oak, toy, vet, yes, zip, run, fan: the first is "sky" and the last "fan".
        expect(pickWord(seqRng([0, 0]), 0, shown)).toBe('sky');
        expect(pickWord(seqRng([0, 0.999]), 0, shown)).toBe('fan');
    });

    it.each([3, 4, 5, 6, 7, 8])(
        'still finds a free first letter at length %i when 6 words with different first letters are on screen',
        (len) => {
            const rng = seededRng(len);
            const lengthDraw = (len - 3) / 6 + 0.01; // lands on `len` once 80 s have passed (3..8 equally likely)
            const same = WORDS.filter((w) => w.length === len);
            for (let trial = 0; trial < 200; trial++) {
                // Six words of this length with six different first letters, chosen at random.
                const shown: string[] = [];
                while (shown.length < 6) {
                    const w = same[Math.floor(rng() * same.length)];
                    if (!shown.some((s) => s[0] === w[0])) shown.push(w);
                }
                const picked = pickWord(seqRng([lengthDraw, rng()]), 80, shown);
                if (picked.length !== len || shown.some((s) => s[0] === picked[0])) {
                    expect.fail(`length ${len}: picked ${picked} with ${shown.join(',')} on screen`);
                }
            }
        },
    );

    it('draws every length from 3 to 8 about equally often at 80 s (the length draw is uniform)', () => {
        const rng = seededRng(11);
        const counts = new Map<number, number>();
        for (let i = 0; i < 6000; i++) {
            const len = pickWord(rng, 80, []).length;
            counts.set(len, (counts.get(len) ?? 0) + 1);
        }
        for (let len = 3; len <= 8; len++) {
            expect(counts.get(len) ?? 0, `length ${len}`).toBeGreaterThan(850);
            expect(counts.get(len) ?? 0, `length ${len}`).toBeLessThan(1150);
        }
    });

    it('falls back to any word not on screen when every word of the length is on screen', () => {
        const allThree = WORDS.filter((w) => w.length === 3);
        expect(pickWord(seqRng([0, 0]), 0, allThree)).toBe('tree');
    });

    it('can pick every word in the list over many seeded draws', () => {
        const rng = seededRng(7);
        const seen = new Set<string>();
        for (let i = 0; i < 20000; i++) seen.add(pickWord(rng, 100, []));
        expect(seen.size).toBe(WORDS.length);
    });
});

describe('pickWordX', () => {
    it('starts at the margin (8) at the low end of the random range', () => {
        expect(pickWordX(() => 0, 3)).toBe(8);
    });

    it('spreads over the room left by the word: 3 letters at 0.5 -> 8 + 152.5', () => {
        expect(pickWordX(() => 0.5, 3)).toBeCloseTo(160.5, 10);
    });

    it('keeps the longest word inside the right margin (8 letters: x < 248)', () => {
        const x = pickWordX(() => 0.999999, 8);
        expect(x).toBeLessThanOrEqual(248);
        expect(x).toBeGreaterThan(247);
    });

    it('uses the margin when a word is too wide to have any room', () => {
        expect(pickWordX(() => 0.7, 40)).toBe(8);
    });
});
