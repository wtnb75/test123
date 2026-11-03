import { describe, expect, it } from 'vitest';
import { bonusFor, fallSpeed, multiBonus, scoreFor } from './scoring';

describe('scoreFor / bonusFor (docs/spec.md "完成")', () => {
    it('scores 30, 50, 80, 120, 170, 230 for 3 to 8 letters', () => {
        expect([3, 4, 5, 6, 7, 8].map(scoreFor)).toEqual([30, 50, 80, 120, 170, 230]);
    });

    it('adds one second per letter', () => {
        expect([3, 4, 5, 6, 7, 8].map(bonusFor)).toEqual([3, 4, 5, 6, 7, 8]);
    });

    it('scores 0 for a length no word has', () => {
        expect(scoreFor(2)).toBe(0);
        expect(scoreFor(9)).toBe(0);
    });
});

describe('multiBonus (docs/spec/multi-complete.md "同時完成ボーナス")', () => {
    it('adds nothing for zero or one word', () => {
        expect(multiBonus(0)).toEqual({ score: 0, sec: 0 });
        expect(multiBonus(1)).toEqual({ score: 0, sec: 0 });
    });

    it('adds 100 points and 5 seconds per word beyond the first: 2 -> 100/5, 3 -> 200/10, 4 -> 300/15', () => {
        expect(multiBonus(2)).toEqual({ score: 100, sec: 5 });
        expect(multiBonus(3)).toEqual({ score: 200, sec: 10 });
        expect(multiBonus(4)).toEqual({ score: 300, sec: 15 });
    });
});

describe('fallSpeed', () => {
    it('starts at 0.25 field heights per second', () => {
        expect(fallSpeed(0)).toBeCloseTo(0.25, 10);
    });

    it('grows 0.0025 per second: 0.4 at 60 s, 0.625 at 150 s', () => {
        expect(fallSpeed(60)).toBeCloseTo(0.4, 10);
        expect(fallSpeed(150)).toBeCloseTo(0.625, 10);
    });

    it('stops at 0.63 from about 152 s on', () => {
        expect(fallSpeed(151)).toBeCloseTo(0.6275, 10);
        expect(fallSpeed(152)).toBeCloseTo(0.63, 10);
        expect(fallSpeed(200)).toBe(0.63);
        expect(fallSpeed(10000)).toBe(0.63);
    });
});
