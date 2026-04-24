import { describe, expect, it } from 'vitest';
import { judgeGuess } from './judge';

describe('judgeGuess', () => {
    it('重複数字を Wordle 互換で判定する', () => {
        expect(judgeGuess('1013', '1111')).toEqual(['green', 'gray', 'green', 'gray']);
    });

    it('位置違いの同数字を黄色にする', () => {
        expect(judgeGuess('1234', '4321')).toEqual(['yellow', 'yellow', 'yellow', 'yellow']);
    });

    it('一致しない数字を灰色にする', () => {
        expect(judgeGuess('2357', '1111')).toEqual(['gray', 'gray', 'gray', 'gray']);
    });
});
