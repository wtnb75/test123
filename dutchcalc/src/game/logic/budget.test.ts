import { describe, expect, it } from 'vitest';
import { budgetFromUnits, formatRemainder, parseBudget, remainderOf, unitsFromBudget } from './budget';

describe('parseBudget', () => {
    it('reads a whole yen amount', () => {
        expect(parseBudget('1050')).toBe(1050);
    });

    it('is null for an empty or blank field (the other field is then left alone)', () => {
        expect(parseBudget('')).toBeNull();
        expect(parseBudget('   ')).toBeNull();
    });

    it('is null for a value that is not an integer', () => {
        expect(parseBudget('12.5')).toBeNull();
        expect(parseBudget('abc')).toBeNull();
    });
});

describe('unitsFromBudget（予算 → 口数、切り捨て）', () => {
    it('予算 1,050 円・単価 100 円 → 10 口', () => {
        expect(unitsFromBudget(1050, 100)).toBe(10);
    });

    it('予算 99 円・単価 100 円 → 0 口（口数の検証で弾かれる値）', () => {
        expect(unitsFromBudget(99, 100)).toBe(0);
    });

    it('予算 1,000,000 円・単価 100 円 → 10,000 口、予算 1,000,050 円でも 10,000 口', () => {
        expect(unitsFromBudget(1000000, 100)).toBe(10000);
        expect(unitsFromBudget(1000050, 100)).toBe(10000);
    });

    it('予算 10,000,000 円・単価 100 円 → 100,000 口（上限ちょうど）、10,000,100 円 → 100,001 口（上限超え）', () => {
        expect(unitsFromBudget(10000000, 100)).toBe(100000);
        expect(unitsFromBudget(10000100, 100)).toBe(100001);
    });

    it('予算 0 円 → 0 口', () => {
        expect(unitsFromBudget(0, 100)).toBe(0);
    });

    it('換算できないとき（単価が 0 以下、または有限でない値）は null', () => {
        expect(unitsFromBudget(1050, 0)).toBeNull();
        expect(unitsFromBudget(1050, -100)).toBeNull();
        expect(unitsFromBudget(1050, Number.NaN)).toBeNull();
        expect(unitsFromBudget(Number.NaN, 100)).toBeNull();
    });
});

describe('budgetFromUnits（口数 → 予算）', () => {
    it('口数 10・単価 100 円 → 予算 1,000 円', () => {
        expect(budgetFromUnits(10, 100)).toBe(1000);
    });
});

describe('remainderOf（余り = 予算 − 合計投資額）', () => {
    it('予算 1,050 円・合計投資額 1,000 円 → 余り 50 円', () => {
        expect(remainderOf(1050, 1000)).toBe(50);
    });

    it('予算と合計投資額が同じなら余りは 0', () => {
        expect(remainderOf(1000, 1000)).toBe(0);
    });
});

describe('formatRemainder', () => {
    it('余りは「余り xx 円」の形で、桁区切りなし', () => {
        expect(formatRemainder(50)).toBe('余り 50 円');
        expect(formatRemainder(0)).toBe('余り 0 円');
        expect(formatRemainder(1000000)).toBe('余り 1000000 円');
    });
});
