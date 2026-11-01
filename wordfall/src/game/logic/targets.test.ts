import { describe, expect, it } from 'vitest';
import { seeded, seq } from './testing';
import { initialTargets, pickWord } from './targets';
import { WORDS } from './words';

describe('pickWord', () => {
    it('picks the first word when the random value is 0 and the last when it is just below 1', () => {
        expect(pickWord(seq(0), []).en).toBe('CAT');
        expect(pickWord(seq(0.999999), []).en).toBe('TREASURE');
    });

    it('moves from the first word (weight 3) to the second at 3/87 of the way', () => {
        expect(pickWord(seq(2.99 / 87), []).en).toBe('CAT');
        expect(pickWord(seq(3.01 / 87), []).en).toBe('DOG');
    });

    it('skips excluded words', () => {
        expect(pickWord(seq(0), ['CAT']).en).toBe('DOG');
        expect(pickWord(seq(0), ['CAT', 'DOG', 'SUN']).en).toBe('SKY');
    });

    it('weights a 3-letter word 3 and an 8-letter word 1: the split between them is at 3/4', () => {
        const pair = [
            { en: 'AAA', ja: 'x' },
            { en: 'BBBBBBBB', ja: 'y' },
        ];
        expect(pickWord(seq(0.74), [], pair).en).toBe('AAA');
        expect(pickWord(seq(0.76), [], pair).en).toBe('BBBBBBBB');
    });

    it.each([
        // [shorter length, longer length, weight ratio shorter : longer from the spec table 3,3,3,2,2,1]
        [3, 4, 0.5], // 3 : 3
        [4, 5, 0.5], // 3 : 3
        [5, 6, 0.6], // 3 : 2
        [6, 7, 0.5], // 2 : 2
        [7, 8, 2 / 3], // 2 : 1
    ])('splits a %i-letter and a %i-letter word at %d of the way (the weights from the spec table)', (a, b, split) => {
        const pair = [
            { en: 'A'.repeat(a), ja: 'x' },
            { en: 'B'.repeat(b), ja: 'y' },
        ];
        expect(pickWord(seq(split - 0.01), [], pair).en).toBe('A'.repeat(a));
        expect(pickWord(seq(split + 0.01), [], pair).en).toBe('B'.repeat(b));
    });

    it('falls back to the last candidate for a random value outside [0, 1)', () => {
        expect(pickWord(seq(1), []).en).toBe('TREASURE');
    });

    it('can pick every word in the list and draws long words about 6.9% of the time', () => {
        const rng = seeded(7);
        const seen = new Set<string>();
        let long = 0;
        const n = 20000;
        for (let i = 0; i < n; i++) {
            const w = pickWord(rng, []);
            seen.add(w.en);
            if (w.en.length === 8) long++;
        }
        expect(seen.size).toBe(WORDS.length);
        // expected 6/87 = 6.9%; allow generous sampling noise
        expect(long / n).toBeGreaterThan(0.055);
        expect(long / n).toBeLessThan(0.085);
    });
});

describe('initialTargets', () => {
    it('draws 3 words without repeats, in list order for a constant 0', () => {
        expect(initialTargets(seq(0)).map((w) => w.en)).toEqual(['CAT', 'DOG', 'SUN']);
    });

    it('never repeats a word within the 3, whatever the random values', () => {
        const rng = seeded(3);
        for (let i = 0; i < 500; i++) {
            const names = initialTargets(rng).map((w) => w.en);
            if (new Set(names).size !== 3) expect.fail(`repeat in ${names.join(',')}`);
        }
    });
});
