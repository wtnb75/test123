import { describe, expect, it } from 'vitest';
import { WORDS } from './words';

describe('word list (docs/spec.md "単語リスト")', () => {
    it('has 37 distinct words', () => {
        expect(WORDS).toHaveLength(37);
        expect(new Set(WORDS.map((w) => w.en)).size).toBe(37);
    });

    it('writes every English word in uppercase A-Z, 3 to 8 letters, with a meaning', () => {
        for (const w of WORDS) {
            if (!/^[A-Z]{3,8}$/.test(w.en)) expect.fail(`bad word ${w.en}`);
            if (w.ja.length === 0) expect.fail(`no meaning for ${w.en}`);
        }
    });

    it('has 6, 7, 6, 6, 6, 6 words of 3, 4, 5, 6, 7, 8 letters (so the weights sum to 87)', () => {
        const byLength = [3, 4, 5, 6, 7, 8].map((n) => WORDS.filter((w) => w.en.length === n).length);
        expect(byLength).toEqual([6, 7, 6, 6, 6, 6]);
    });
});
