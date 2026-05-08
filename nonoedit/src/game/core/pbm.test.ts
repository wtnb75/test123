import { describe, expect, it } from 'vitest';
import { exportPBM, importPBM } from './pbm';
import type { AnalysisResult } from './types';

const sampleAnalysis: AnalysisResult = {
    solvable: true,
    unique: true,
    logical: true,
    remainingCells: 0,
    techniquesUsed: {
        'full-line-fill': 2,
    },
    score: 12,
    difficulty: 'easy',
    timedOut: false,
};

describe('pbm', () => {
    it('exports PBM with required metadata comments', () => {
        const board = [
            [1, 0, 0, 1, 0],
            [0, 1, 1, 0, 0],
            [0, 0, 1, 0, 1],
            [1, 0, 0, 1, 0],
            [0, 1, 0, 0, 1],
        ] as const;
        const text = exportPBM(board.map((r) => [...r]), sampleAnalysis);

        expect(text).toContain('P1');
        expect(text).toContain('# difficulty: easy');
        expect(text).toContain('# score: 12');
        expect(text).toContain('# unique: true');
    });

    it('imports PBM while ignoring comments', () => {
        const pbm = `P1\n# NonoEdit export\n# difficulty: hard\n# score: 99\n# unique: false\n5 5\n0 0 1 0 0\n0 1 1 1 0\n1 1 1 1 1\n0 1 1 1 0\n0 0 1 0 0\n`;
        const loaded = importPBM(pbm);

        expect(loaded.puzzle.width).toBe(5);
        expect(loaded.puzzle.height).toBe(5);
        expect(loaded.puzzle.rows).toEqual([[1], [3], [5], [3], [1]]);
        expect(loaded.meta.difficulty).toBe('hard');
        expect(loaded.meta.score).toBe('99');
    });

    it('throws on invalid token', () => {
        const bad = `P1\n5 5\n0 0 1 2 0\n0 1 1 1 0\n1 1 1 1 1\n0 1 1 1 0\n0 0 1 0 0\n`;
        expect(() => importPBM(bad)).toThrowError(/invalid binary token/);
    });

    it('throws on invalid header', () => {
        const bad = `P2\n5 5\n0 0 1 0 0\n0 1 1 1 0\n1 1 1 1 1\n0 1 1 1 0\n0 0 1 0 0\n`;
        expect(() => importPBM(bad)).toThrowError(/expected P1/);
    });

    it('throws on invalid size and count', () => {
        const badSize = `P1\n4 4\n0 0 0 0\n0 0 0 0\n0 0 0 0\n0 0 0 0\n`;
        expect(() => importPBM(badSize)).toThrowError(/out of range/);

        const badCount = `P1\n5 5\n0 0 1\n`;
        expect(() => importPBM(badCount)).toThrowError(/cell count/);
    });

    it('throws on non-integer size and too-short payload', () => {
        const nonInteger = `P1\n5.5 5\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n`;
        expect(() => importPBM(nonInteger)).toThrowError(/invalid PBM size/);

        const tooShort = `P1\n5\n`;
        expect(() => importPBM(tooShort)).toThrowError(/too short/);
    });

    it('ignores unknown metadata keys', () => {
        const pbm = `P1\n# foo: bar\n# difficulty: normal\n# unique: true\n5 5\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n`;
        const loaded = importPBM(pbm);
        expect(loaded.meta.difficulty).toBe('normal');
        expect(loaded.meta.unique).toBe('true');
        expect((loaded.meta as Record<string, string>).foo).toBeUndefined();
    });
});
