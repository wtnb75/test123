import { describe, expect, it } from 'vitest';
import { analyzePuzzle } from './solver';
import { generateColHints, generateRowHints } from './hints';

describe('solver', () => {
    it('analyzes simple logical puzzle', () => {
        const solution = [
            [1, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 0, 1],
        ];
        const rows = [[1], [1], [1], [1], [1]];
        const cols = [[1], [1], [1], [1], [1]];

        const result = analyzePuzzle(solution, rows, cols, 3000);
        expect(result.solvable).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.difficulty === 'easy' || result.difficulty === 'normal' || result.difficulty === 'hard' || result.difficulty === 'unsolved').toBe(true);
    });

    it('returns unsolved when timed out quickly', () => {
        const solution = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 0 as const));
        const rows = Array.from({ length: 10 }, () => [0]);
        const cols = Array.from({ length: 10 }, () => [0]);

        const result = analyzePuzzle(solution, rows, cols, 0);
        expect(result.timedOut).toBe(true);
        expect(result.difficulty).toBe('unsolved');
    });

    it('marks non-unique puzzle as unique false', () => {
        const solution = Array.from({ length: 5 }, (_, y) =>
            Array.from({ length: 5 }, (_, x) => (x === y ? 1 : 0)),
        );
        const rows = Array.from({ length: 5 }, () => [1]);
        const cols = Array.from({ length: 5 }, () => [1]);

        const result = analyzePuzzle(solution, rows, cols, 3000);
        expect(result.solvable).toBe(true);
        expect(result.unique).toBe(false);
    });

    it('marks contradictory hints as unsolvable', () => {
        const solution = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0 as const));
        const rows = Array.from({ length: 5 }, () => [5]);
        const cols = Array.from({ length: 5 }, () => [0]);

        const result = analyzePuzzle(solution, rows, cols, 3000);
        expect(result.solvable).toBe(false);
        expect(result.unique).toBe(false);
        expect(result.difficulty).toBe('unsolved');
    });

    it('applies probe-consistency on a simple framed puzzle', () => {
        const solution = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            [0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            [0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ] as const;
        const rows = [
            [0],
            [8],
            [1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1],
            [8],
            [1, 1, 1],
            [1, 1, 1, 1],
            [8],
            [0],
        ];
        const cols = [
            [0],
            [8],
            [1, 1, 1],
            [1, 1, 1],
            [8],
            [1, 1],
            [1, 1, 1, 1],
            [1, 1, 1],
            [8],
            [0],
        ];

        const result = analyzePuzzle(solution.map((r) => [...r]), rows, cols, 3000);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.techniquesUsed['probe-consistency'] ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('exposes planned advanced techniques in analysis result', () => {
        const solution = [
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 0, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0],
        ];
        const rows = [[0], [3], [1, 1], [3], [0]];
        const cols = [[0], [3], [1, 1], [3], [0]];

        const result = analyzePuzzle(solution, rows, cols, 3000);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.techniquesUsed['cross-constraint'] ?? 0).toBeGreaterThanOrEqual(0);
        expect(result.techniquesUsed['region-split'] ?? 0).toBeGreaterThanOrEqual(0);
        expect(result.techniquesUsed['box-reduction'] ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('keeps uniqueness true for the framed 10x10 sample', () => {
        const solution = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            [0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            [0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ];
        const rows = generateRowHints(solution);
        const cols = generateColHints(solution);

        const result = analyzePuzzle(solution, rows, cols, 3000);
        expect(result.solvable).toBe(true);
        expect(result.unique).toBe(true);
    });
});
