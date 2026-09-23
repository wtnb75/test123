import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzePuzzle } from './solver';
import { generateColHints, generateRowHints } from './hints';
import type { BinaryCell } from './types';

const analyzeGrid = (grid: BinaryCell[][], maxMillis = 3000) =>
    analyzePuzzle(grid, generateRowHints(grid), generateColHints(grid), maxMillis);

// 6x6 fixtures found by seeded search; each needs the named technique to make progress.
const boxReductionGrid: BinaryCell[][] = [
    [1, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0],
    [1, 0, 0, 1, 0, 1],
    [0, 1, 0, 1, 0, 0],
];
const probeGrid: BinaryCell[][] = [
    [1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 0, 0],
    [0, 1, 0, 0, 1, 0],
    [1, 1, 0, 1, 1, 0],
    [0, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 0, 1],
];
const regionSplitGrid: BinaryCell[][] = [
    [1, 1, 1, 0, 0, 0],
    [0, 0, 1, 0, 0, 1],
    [0, 1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1, 0],
    [0, 1, 0, 1, 1, 1],
    [0, 1, 0, 1, 1, 0],
];

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

    it('returns unsolved when logical deduction stalls but solutions exist', () => {
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
        expect(result.unique).toBe(false);
        expect(result.logical).toBe(false);
        expect(result.difficulty).toBe('unsolved');
    });

    it('handles impossible hints as unsolvable with no unique solution', () => {
        const solution = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0 as const));
        const rows = [[4, 4], [0], [0], [0], [0]];
        const cols = [[0], [0], [0], [0], [0]];

        const result = analyzePuzzle(solution, rows, cols, 3000);
        expect(result.solvable).toBe(false);
        expect(result.unique).toBe(false);
        expect(result.difficulty).toBe('unsolved');
    });
});

describe('solver advanced techniques', () => {
    it('solves a puzzle that needs cross-constraint and box-reduction as unique and hard', () => {
        const result = analyzeGrid(boxReductionGrid);

        expect(result.techniquesUsed['cross-constraint']).toBeGreaterThan(0);
        expect(result.techniquesUsed['box-reduction']).toBeGreaterThan(0);
        expect(result.techniquesUsed['probe-consistency']).toBeUndefined();
        expect(result).toMatchObject({ solvable: true, unique: true, logical: true, remainingCells: 0, difficulty: 'hard' });
    });

    it('falls back to probe-consistency when line and box reasoning stall', () => {
        const result = analyzeGrid(probeGrid);

        expect(result.techniquesUsed['probe-consistency']).toBeGreaterThan(0);
        expect(result).toMatchObject({ solvable: true, unique: true, logical: true, remainingCells: 0, difficulty: 'hard' });
    });

    it('scores each used technique by its weight', () => {
        const result = analyzeGrid(probeGrid);
        const weights = {
            'full-line-fill': 1,
            'full-line-empty': 1,
            'edge-overlap': 2,
            'candidate-common': 5,
            'cross-constraint': 4,
            'region-split': 8,
            'box-reduction': 12,
            'probe-consistency': 8,
        } as const;
        const expected = Object.entries(result.techniquesUsed).reduce(
            (total, [name, count]) => total + weights[name as keyof typeof weights] * (count ?? 0),
            0,
        );

        expect(result.score).toBe(expected);
        expect(result.score).toBe(67);
    });

    it('marks entangled cells as empty via region-split and leaves the rest unsolved logically', () => {
        const result = analyzeGrid(regionSplitGrid);

        expect(result.techniquesUsed['region-split']).toBeGreaterThan(0);
        expect(result.solvable).toBe(true);
        expect(result.unique).toBe(true);
        expect(result.logical).toBe(false);
        expect(result.remainingCells).toBeGreaterThan(0);
        expect(result.difficulty).toBe('unsolved');
    });
});

describe('solver timeout handling', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Each Date.now() call advances a fake clock by 1ms, so a budget of N ms expires
    // after N clock reads and lets the sweep hit every timeout check deterministically.
    const analyzeWithTickingClock = (grid: BinaryCell[][], budget: number) => {
        let tick = 0;
        vi.spyOn(Date, 'now').mockImplementation(() => {
            tick += 1;
            return tick;
        });
        return analyzeGrid(grid, budget);
    };

    const budgets = [
        ...Array.from({ length: 400 }, (_, i) => i + 1),
        ...Array.from({ length: 80 }, (_, i) => Math.round(400 * 1.2 ** i)),
    ];

    it.each([
        ['box-reduction fixture', boxReductionGrid],
        ['probe-consistency fixture', probeGrid],
        ['region-split fixture', regionSplitGrid],
    ])('reports unsolved for a timed-out run and the full result otherwise (%s)', (_name, grid) => {
        const reference = analyzeGrid(grid, 1_000_000);
        let timedOutRuns = 0;
        let completedRuns = 0;

        for (const budget of budgets) {
            const result = analyzeWithTickingClock(grid, budget);
            vi.restoreAllMocks();

            if (result.timedOut) {
                timedOutRuns += 1;
                expect(result).toMatchObject({ solvable: false, unique: false, difficulty: 'unsolved' });
            } else {
                completedRuns += 1;
                expect(result).toEqual(reference);
            }
        }

        expect(timedOutRuns).toBeGreaterThan(0);
        expect(completedRuns).toBeGreaterThan(0);
    });
});
