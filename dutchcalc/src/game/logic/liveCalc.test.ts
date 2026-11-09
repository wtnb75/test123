import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';
import { decideCalc, type CalcInput } from './liveCalc';

// A valid input in every respect; each test changes only the field it is about.
const base: CalcInput = { oddsTexts: ['2', '2'], totalUnitsText: '10', unitPriceText: '100', budgetText: '' };
const with_ = (patch: Partial<CalcInput>): CalcInput => ({ ...base, ...patch });

describe('decideCalc: auto mode, unfinished input（途中）', () => {
    it('is incomplete when one odds field is empty', () => {
        expect(decideCalc(with_({ oddsTexts: ['2', ''] }), 'auto')).toEqual({ kind: 'incomplete' });
    });

    it('is incomplete when the first odds field is empty too', () => {
        expect(decideCalc(with_({ oddsTexts: ['', '2'] }), 'auto')).toEqual({ kind: 'incomplete' });
    });

    it('is incomplete when the total units field is empty', () => {
        expect(decideCalc(with_({ totalUnitsText: '' }), 'auto')).toEqual({ kind: 'incomplete' });
    });

    it('is incomplete when the unit price field is empty', () => {
        expect(decideCalc(with_({ unitPriceText: '' }), 'auto')).toEqual({ kind: 'incomplete' });
    });

    it('treats a whitespace-only field as empty', () => {
        expect(decideCalc(with_({ oddsTexts: ['2', ' '] }), 'auto')).toEqual({ kind: 'incomplete' });
    });

    it('stays incomplete even when the other fields would be invalid', () => {
        expect(decideCalc(with_({ oddsTexts: ['1', ''], unitPriceText: '150' }), 'auto')).toEqual({ kind: 'incomplete' });
    });

    it('does not wait for the budget: an empty budget is fine', () => {
        expect(decideCalc(with_({ budgetText: '' }), 'auto').kind).toBe('ok');
    });
});

describe('decideCalc: valid input（有効）', () => {
    it('odds [2, 2], 10 units, 100 yen → 5 / 5 units and no remainder', () => {
        const outcome = decideCalc(base, 'auto');
        if (outcome.kind !== 'ok') {
            expect.fail(`expected ok, got ${outcome.kind}`);
        }
        expect(outcome.result.candidates.map((c) => c.units)).toEqual([5, 5]);
        expect(outcome.unitPrice).toBe(100);
        expect(outcome.remainder).toBeUndefined();
    });

    it('the result is the one allocate() gives for the same numbers', () => {
        const outcome = decideCalc(with_({ oddsTexts: ['1.5', '3.2', '2.1'], totalUnitsText: '37', unitPriceText: '200' }), 'auto');
        if (outcome.kind !== 'ok') {
            expect.fail(`expected ok, got ${outcome.kind}`);
        }
        expect(outcome.result).toEqual(allocate({ odds: [1.5, 3.2, 2.1], totalUnits: 37, unitPrice: 200 }));
        expect(outcome.unitPrice).toBe(200);
    });

    it('budget 1050 with 10 units at 100 yen → remainder 50', () => {
        const outcome = decideCalc(with_({ budgetText: '1050' }), 'auto');
        expect(outcome).toMatchObject({ kind: 'ok', remainder: 50 });
    });

    it('budget 1000 with 10 units at 100 yen → remainder 0 (still reported)', () => {
        const outcome = decideCalc(with_({ budgetText: '1000' }), 'auto');
        expect(outcome).toMatchObject({ kind: 'ok', remainder: 0 });
    });

    it.each(['abc', '1050.5'])('a budget that is not an integer (%s) gives no remainder', (budgetText) => {
        const outcome = decideCalc(with_({ budgetText }), 'auto');
        if (outcome.kind !== 'ok') {
            expect.fail(`expected ok, got ${outcome.kind}`);
        }
        expect(outcome.remainder).toBeUndefined();
    });
});

describe('decideCalc: invalid input（無効）keeps the existing messages', () => {
    it('odds 1 → the odds message', () => {
        expect(decideCalc(with_({ oddsTexts: ['1', '2'] }), 'auto')).toEqual({
            kind: 'invalid',
            message: '倍率はすべて1.0より大きい有限の数値にしてください'
        });
    });

    it('1 unit for 2 candidates → the units-versus-candidates message', () => {
        expect(decideCalc(with_({ totalUnitsText: '1' }), 'auto')).toEqual({
            kind: 'invalid',
            message: '合計口数は候補数以上にしてください'
        });
    });

    it('unit price 150 → the unit price message', () => {
        expect(decideCalc(with_({ unitPriceText: '150' }), 'auto')).toEqual({
            kind: 'invalid',
            message: '1口あたり金額は100以上かつ100の倍数にしてください'
        });
    });

    it('a single candidate → the candidate count message', () => {
        expect(decideCalc(with_({ oddsTexts: ['2'] }), 'auto')).toEqual({
            kind: 'invalid',
            message: '候補は2件以上指定してください'
        });
    });

    it('units over the limit → the upper limit message', () => {
        expect(decideCalc(with_({ totalUnitsText: '100001' }), 'auto')).toEqual({
            kind: 'invalid',
            message: '合計口数は100000以下にしてください'
        });
    });
});

describe('decideCalc: button mode counts blank fields as 0 and reports them', () => {
    it('an empty odds field → the odds message', () => {
        expect(decideCalc(with_({ oddsTexts: ['2', ''] }), 'button')).toEqual({
            kind: 'invalid',
            message: '倍率はすべて1.0より大きい有限の数値にしてください'
        });
    });

    it('an empty total units field → the positive integer message', () => {
        expect(decideCalc(with_({ totalUnitsText: '' }), 'button')).toEqual({
            kind: 'invalid',
            message: '合計口数は正の整数にしてください'
        });
    });

    it('an empty unit price field → the unit price message', () => {
        expect(decideCalc(with_({ unitPriceText: '' }), 'button')).toEqual({
            kind: 'invalid',
            message: '1口あたり金額は100以上かつ100の倍数にしてください'
        });
    });

    it('a valid input gives the same outcome as auto mode', () => {
        const input = with_({ budgetText: '1050' });
        expect(decideCalc(input, 'button')).toEqual(decideCalc(input, 'auto'));
    });
});
