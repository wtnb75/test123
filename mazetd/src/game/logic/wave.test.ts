import { describe, expect, it } from 'vitest';
import { computeScore, enemyCount, enemyHp } from './wave';

describe('wave values', () => {
    it('starts wave 1 with 8 enemies of 3 HP', () => {
        expect(enemyCount(1)).toBe(8);
        expect(enemyHp(1)).toBe(3);
    });

    it('adds 2 enemies and 2 HP per wave, reaching 26 enemies of 21 HP at wave 10', () => {
        expect(enemyCount(2)).toBe(10);
        expect(enemyHp(2)).toBe(5);
        expect(enemyCount(10)).toBe(26);
        expect(enemyHp(10)).toBe(21);
    });
});

describe('computeScore', () => {
    it('adds 50 per remaining life on a clear', () => {
        expect(computeScore(5, 3, true)).toBe(5 * 10 + 3 * 50);
    });

    it('counts only kills on a game over', () => {
        expect(computeScore(5, 3, false)).toBe(50);
        expect(computeScore(12, 0, false)).toBe(120);
    });

    it('is zero with no kills and no clear', () => {
        expect(computeScore(0, 0, false)).toBe(0);
    });
});
