import { describe, expect, it } from 'vitest';
import { LENGTH_WEIGHT, SCORE_BY_LENGTH, TRAY_CAPACITY, TRAY_COLS, TRAY_ROWS } from '../params';
import { WORDS } from './words';

describe('parameter tables stay consistent', () => {
    it('has a draw weight and a score for every word length in the list, and no others', () => {
        const lengths = [...new Set(WORDS.map((w) => w.en.length))].sort((a, b) => a - b);
        expect(lengths).toEqual([3, 4, 5, 6, 7, 8]);
        expect(Object.keys(LENGTH_WEIGHT).map(Number).sort((a, b) => a - b)).toEqual(lengths);
        expect(Object.keys(SCORE_BY_LENGTH).map(Number).sort((a, b) => a - b)).toEqual(lengths);
    });

    it('scores a longer word more, and gives every length a positive weight', () => {
        const lengths = [3, 4, 5, 6, 7, 8];
        for (let i = 1; i < lengths.length; i++) {
            expect(SCORE_BY_LENGTH[lengths[i]]).toBeGreaterThan(SCORE_BY_LENGTH[lengths[i - 1]]);
        }
        for (const n of lengths) expect(LENGTH_WEIGHT[n]).toBeGreaterThan(0);
    });

    it('fills the tray grid exactly: capacity = columns x rows = 10', () => {
        expect(TRAY_CAPACITY).toBe(TRAY_COLS * TRAY_ROWS);
        expect(TRAY_CAPACITY).toBe(10);
    });

    it('holds the longest word with room to spare', () => {
        const longest = Math.max(...WORDS.map((w) => w.en.length));
        expect(TRAY_CAPACITY).toBeGreaterThanOrEqual(longest + 1);
    });
});
