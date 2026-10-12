import { describe, expect, it } from 'vitest';
import { DIGIT_OPTIONS, digitFromKey, isDigitOption, modeFromData } from './selectLayout';

describe('digitFromKey', () => {
    it('キー 2〜6 は対応する桁数になる', () => {
        expect(['2', '3', '4', '5', '6'].map(digitFromKey)).toEqual([2, 3, 4, 5, 6]);
    });

    it('キー 0・1・7・8・9 は開始しない', () => {
        expect(['0', '1', '7', '8', '9'].map(digitFromKey)).toEqual([null, null, null, null, null]);
    });

    it('数字以外のキー（Enter・Backspace・文字・複数桁・空文字）は開始しない', () => {
        expect(['Enter', 'Backspace', 'a', '22', ''].map(digitFromKey)).toEqual([null, null, null, null, null]);
    });

    it('数として 2〜6 に読める文字列（"2.0"・"3 "・"4e0"）でも、1 文字の数字キーでなければ開始しない', () => {
        expect(['2.0', '3 ', '4e0'].map(digitFromKey)).toEqual([null, null, null]);
    });
});

describe('isDigitOption', () => {
    it('2〜6 の整数だけを選べる桁数として認める', () => {
        expect(DIGIT_OPTIONS).toEqual([2, 3, 4, 5, 6]);
        expect([1, 2, 3, 4, 5, 6, 7].filter(isDigitOption)).toEqual([2, 3, 4, 5, 6]);
    });

    it('文字列・小数・null・undefined は認めない', () => {
        expect(['3', 2.5, null, undefined, NaN].some(isDigitOption)).toBe(false);
    });
});

describe('modeFromData', () => {
    it('データが無い・mode が無い・hard 以外のときはノーマルになる', () => {
        expect([undefined, {}, { mode: 'x' }, { mode: 'normal' }, { mode: null }].map(modeFromData)).toEqual([
            'normal', 'normal', 'normal', 'normal', 'normal'
        ]);
    });

    it('mode が hard のときだけハードになる', () => {
        expect(modeFromData({ mode: 'hard' })).toBe('hard');
    });
});
