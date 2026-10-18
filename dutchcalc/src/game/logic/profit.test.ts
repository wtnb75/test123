import { describe, expect, it } from 'vitest';
import {
    VERDICT_AT_OR_ABOVE,
    VERDICT_BELOW,
    formatPercent,
    formatProfit,
    isLoss,
    profitOf,
    theoreticalReturnRate,
    verdictOf
} from './profit';

describe('profitOf', () => {
    it('returns payout minus investment for whole-yen values', () => {
        expect(profitOf(1300, 1000)).toBe(300);
        expect(profitOf(200, 1000)).toBe(-800);
    });

    it('rounds the payout before subtracting (999.6 against 1000 is break-even)', () => {
        expect(profitOf(999.6, 1000)).toBe(0);
    });

    it('rounds a payout just below half a yen down (999.4 against 1000 is -1)', () => {
        expect(profitOf(999.4, 1000)).toBe(-1);
    });
});

describe('isLoss', () => {
    it('treats -1 as a loss', () => {
        expect(isLoss(-1)).toBe(true);
    });

    it('does not treat exactly 0 as a loss', () => {
        expect(isLoss(0)).toBe(false);
    });

    it('does not treat +1 as a loss', () => {
        expect(isLoss(1)).toBe(false);
    });
});

describe('formatProfit', () => {
    it('prefixes positive values with +', () => {
        expect(formatProfit(300)).toBe('+300');
    });

    it('shows zero as +0', () => {
        expect(formatProfit(0)).toBe('+0');
    });

    it('keeps the minus sign of negative values and adds no thousands separator', () => {
        expect(formatProfit(-800)).toBe('-800');
        expect(formatProfit(-12000)).toBe('-12000');
    });
});

describe('theoreticalReturnRate', () => {
    it('is 1.0 for odds [2, 2] (1 / (0.5 + 0.5))', () => {
        expect(theoreticalReturnRate([2, 2])).toBeCloseTo(1.0, 12);
    });

    it('is 0.75 for odds [1.5, 1.5] (1 / (2/3 + 2/3) = 3/4)', () => {
        expect(theoreticalReturnRate([1.5, 1.5])).toBeCloseTo(0.75, 12);
    });

    it('is 4/3 for odds [2, 4] (1 / (0.5 + 0.25))', () => {
        expect(theoreticalReturnRate([2, 4])).toBeCloseTo(4 / 3, 12);
    });
});

describe('formatPercent', () => {
    it('shows one decimal place of the percentage', () => {
        expect(formatPercent(0.75)).toBe('75.0');
        expect(formatPercent(1.3333333)).toBe('133.3');
    });

    it('shows 99.96% as 100.0', () => {
        expect(formatPercent(0.9996)).toBe('100.0');
    });
});

describe('verdictOf', () => {
    it('gives the below-100% sentence for 0.75', () => {
        expect(verdictOf(0.75)).toBe(VERDICT_BELOW);
    });

    it('gives the at-or-above sentence for exactly 1.0', () => {
        expect(verdictOf(1.0)).toBe(VERDICT_AT_OR_ABOVE);
    });

    it('judges on the displayed value: 0.9996 shows 100.0 and gets the at-or-above sentence', () => {
        expect(verdictOf(0.9996)).toBe(VERDICT_AT_OR_ABOVE);
    });

    it('judges on the displayed value: 0.9994 shows 99.9 and gets the below sentence', () => {
        expect(verdictOf(0.9994)).toBe(VERDICT_BELOW);
    });

    it('uses two different sentences', () => {
        expect(VERDICT_BELOW).not.toBe(VERDICT_AT_OR_ABOVE);
    });
});
