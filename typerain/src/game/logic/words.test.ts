import { describe, expect, it } from 'vitest';
import { pickWord, pickWordX, WORDS } from './words';
import { seededRng, seqRng } from './testing';

describe('WORDS', () => {
    it('has 120 distinct lower-case words, 20 for each length from 3 to 8', () => {
        expect(WORDS).toHaveLength(120);
        expect(new Set(WORDS).size).toBe(120);
        for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,8}$/);
        for (let len = 3; len <= 8; len++) expect(WORDS.filter((w) => w.length === len)).toHaveLength(20);
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
        expect(pickWord(seqRng([0, 0.999]), 0, [])).toBe('bee');
    });

    it('never picks a word already on screen, nor one that starts with the same letter as a word on screen', () => {
        // "cat" is shown: "cat" and "cup" (also c) are skipped, so the first candidate is "dog".
        expect(pickWord(seqRng([0, 0]), 0, ['cat'])).toBe('dog');
    });

    it('takes the last of the candidates whose first letters are free at the high end of the range', () => {
        // "bus" is shown: "bus", "box" and "bee" (all b) are out, so the last 3-letter candidate is "zoo".
        expect(pickWord(seqRng([0, 0.999]), 0, ['bus'])).toBe('zoo');
    });

    it('draws middle lengths too (at 80 s a draw of 0.5 gives 6 letters)', () => {
        expect(pickWord(seqRng([0.5, 0]), 80, [])).toBe('animal');
    });

    it('allows a shared first letter when every first letter of that length is already used', () => {
        const shown = ['door', 'cake', 'star', 'road', 'book', 'milk', 'kite', 'earth', 'farm', 'hill'];
        shown.push('island', 'jump', 'lamp', 'ocean', 'piano', 'zoo');
        // All 16 first letters of the 3-letter words are taken; "zoo" itself is on screen so it is out,
        // and the first remaining 3-letter word is "cat".
        expect(pickWord(seqRng([0, 0]), 0, shown)).toBe('cat');
        expect(pickWord(seqRng([0, 0.999]), 0, shown)).toBe('bee');
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
