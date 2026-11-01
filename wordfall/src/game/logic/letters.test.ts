import { describe, expect, it } from 'vitest';
import { freeColumns, neededLetters, pickColumn, pickLetter } from './letters';
import { seeded, seq } from './testing';
import type { Word } from './words';

const w = (en: string): Word => ({ en, ja: '' });
const L = (s: string): string[] => [...s];

describe('neededLetters', () => {
    it('lists the letters each target still lacks, target by target', () => {
        // tray C covers C of CAT; DOG is untouched
        expect(neededLetters(['C'], [w('CAT'), w('DOG')])).toEqual(['A', 'T', 'D', 'O', 'G']);
    });

    it('counts a letter wanted by two targets twice', () => {
        expect(neededLetters([], [w('CAT'), w('TAC')]).sort()).toEqual(['A', 'A', 'C', 'C', 'T', 'T']);
    });

    it('is empty when the tray covers every target', () => {
        expect(neededLetters(L('CATDOG'), [w('CAT'), w('DOG')])).toEqual([]);
    });
});

describe('pickLetter', () => {
    const targets = [w('CAT'), w('DOG')];

    it('picks a needed letter when the first random value is below 0.55', () => {
        // needed = A T D O G (tray holds C); second value 0.5 -> index floor(0.5 * 5) = 2 -> D
        expect(pickLetter(seq(0.54, 0.5), L('C'), targets)).toBe('D');
    });

    it('picks a decoy from A-Z at exactly 0.55', () => {
        expect(pickLetter(seq(0.55, 0), L('C'), targets)).toBe('A');
        expect(pickLetter(seq(0.55, 0.5), L('C'), targets)).toBe('N'); // index 13
        expect(pickLetter(seq(0.55, 0.999999), L('C'), targets)).toBe('Z');
    });

    it('always picks a decoy when nothing is needed', () => {
        // a constant 0.5 would pick a needed letter (0.5 < 0.55) if any were needed; here it must give the decoy N
        expect(pickLetter(seq(0.5), L('CATDOG'), targets)).toBe('N');
        expect(pickLetter(seq(0), L('CATDOG'), targets)).toBe('A');
    });

    it('picks needed letters about 55% of the time (the other 45% may also land on needed ones by chance)', () => {
        const rng = seeded(11);
        let needed = 0;
        const n = 20000;
        for (let i = 0; i < n; i++) {
            if ('ATDOG'.includes(pickLetter(rng, L('C'), targets))) needed++;
        }
        // 0.55 + 0.45 * 5/26 = 0.6365
        expect(needed / n).toBeGreaterThan(0.61);
        expect(needed / n).toBeLessThan(0.66);
    });
});

describe('freeColumns / pickColumn', () => {
    const spawnY = 200;

    it('offers all 7 columns when nothing is falling', () => {
        expect(freeColumns([], spawnY)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('blocks a column whose newest letter has fallen less than 40 from the spawn line', () => {
        expect(freeColumns([{ col: 2, y: spawnY + 39 }], spawnY)).toEqual([0, 1, 3, 4, 5, 6]);
    });

    it('frees the column once the letter has fallen exactly 40', () => {
        expect(freeColumns([{ col: 2, y: spawnY + 40 }], spawnY)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('stays blocked while any letter in the column is still close to the line', () => {
        const letters = [
            { col: 1, y: spawnY + 100 },
            { col: 1, y: spawnY + 10 },
        ];
        expect(freeColumns(letters, spawnY)).not.toContain(1);
    });

    it('picks uniformly from the free columns and returns -1 when none is free', () => {
        expect(pickColumn(seq(0), [1, 3, 5])).toBe(1);
        expect(pickColumn(seq(0.34), [1, 3, 5])).toBe(3);
        expect(pickColumn(seq(0.99), [1, 3, 5])).toBe(5);
        expect(pickColumn(seq(1), [1, 3, 5])).toBe(5); // clamped for a value outside [0, 1)
        expect(pickColumn(seq(0.5), [])).toBe(-1);
    });
});
