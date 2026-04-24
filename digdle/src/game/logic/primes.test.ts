import { describe, expect, it, vi } from 'vitest';
import {
    buildPrimeMap,
    choosePrime,
    createRng,
    generateNDigitPrimes,
    isPrimeNumber,
    isPrimeString
} from './primes';

describe('primes', () => {
    it('isPrimeNumber は整数でない値や2未満を拒否する', () => {
        expect(isPrimeNumber(1)).toBe(false);
        expect(isPrimeNumber(-3)).toBe(false);
        expect(isPrimeNumber(2.5)).toBe(false);
    });

    it('isPrimeNumber は偶数と奇数を正しく判定する', () => {
        expect(isPrimeNumber(2)).toBe(true);
        expect(isPrimeNumber(9)).toBe(false);
        expect(isPrimeNumber(17)).toBe(true);
    });

    it('isPrimeString は非数字や先頭0を拒否する', () => {
        expect(isPrimeString('abc')).toBe(false);
        expect(isPrimeString('013')).toBe(false);
        expect(isPrimeString('13')).toBe(true);
    });

    it('generateNDigitPrimes は桁指定に応じた素数列を返す', () => {
        expect(generateNDigitPrimes(0)).toEqual([]);
        const twoDigits = generateNDigitPrimes(2);
        expect(twoDigits).toContain('11');
        expect(twoDigits).not.toContain('10');
    });

    it('buildPrimeMap は 2-5 桁の候補を構築する', () => {
        const map = buildPrimeMap();
        expect(map[2].length).toBeGreaterThan(0);
        expect(map[3].length).toBeGreaterThan(0);
        expect(map[4].length).toBeGreaterThan(0);
        expect(map[5].length).toBeGreaterThan(0);
    });

    it('createRng は seed 指定で決定的になる', () => {
        const a = createRng(42);
        const b = createRng(42);
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    });

    it('createRng は seed 未指定で Math.random を使う', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
        const rng = createRng();
        expect(rng()).toBe(0.25);
        spy.mockRestore();
    });

    it('choosePrime は空候補で例外を投げる', () => {
        expect(() => choosePrime([], () => 0)).toThrow('prime candidates are empty');
    });

    it('choosePrime は exclude を避けて別候補を選ぶ', () => {
        const chosen = choosePrime(['11', '13', '17'], () => 0, '11');
        expect(chosen).toBe('13');
    });

    it('choosePrime は全候補が exclude と同じ場合に先頭選択を返す', () => {
        const chosen = choosePrime(['11', '11'], () => 0, '11');
        expect(chosen).toBe('11');
    });
});
