import { describe, expect, it } from 'vitest';
import {
    __test__,
    evaluateDifficulty,
    rankFromScore,
    type BoardState
} from './evaluateDifficulty';

function boardFromMines(width: number, height: number, mineIndexes: number[], startIndex: number): BoardState {
    const mineSet = new Set(mineIndexes);
    return {
        width,
        height,
        startIndex,
        cells: Array.from({ length: width * height }, (_, i) => ({ hasMine: mineSet.has(i) }))
    };
}

describe('rankFromScore', () => {
    it('maps scores to fixed 4 ranks', () => {
        expect(rankFromScore(0)).toBe('Easy');
        expect(rankFromScore(24)).toBe('Easy');
        expect(rankFromScore(25)).toBe('Normal');
        expect(rankFromScore(49)).toBe('Normal');
        expect(rankFromScore(50)).toBe('Hard');
        expect(rankFromScore(74)).toBe('Hard');
        expect(rankFromScore(75)).toBe('Expert');
        expect(rankFromScore(100)).toBe('Expert');
    });
});

describe('evaluateDifficulty', () => {
    it('returns INVALID_BOARD for out-of-range dimensions', () => {
        const tooSmall = evaluateDifficulty({
            board: {
                width: 1,
                height: 3,
                startIndex: 0,
                cells: Array.from({ length: 3 }, () => ({ hasMine: false }))
            }
        });
        expect(tooSmall.ok).toBe(false);
        if (!tooSmall.ok) {
            expect(tooSmall.code).toBe('INVALID_BOARD');
        }

        const tooLarge = evaluateDifficulty({
            board: {
                width: 51,
                height: 2,
                startIndex: 0,
                cells: Array.from({ length: 102 }, () => ({ hasMine: false }))
            }
        });
        expect(tooLarge.ok).toBe(false);
        if (!tooLarge.ok) {
            expect(tooLarge.code).toBe('INVALID_BOARD');
        }
    });

    it('returns INVALID_BOARD when cells length is invalid', () => {
        const result = evaluateDifficulty({
            board: {
                width: 3,
                height: 3,
                startIndex: 0,
                cells: Array.from({ length: 8 }, () => ({ hasMine: false }))
            }
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('INVALID_BOARD');
        }
    });

    it('returns INVALID_START when startIndex is out of range', () => {
        const board = boardFromMines(3, 3, [], 9);
        const result = evaluateDifficulty({ board });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('INVALID_START');
        }
    });

    it('returns CONSTRAINT_VIOLATION when mine exists in start zone', () => {
        const board = boardFromMines(4, 4, [0], 5);
        const result = evaluateDifficulty({ board });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('CONSTRAINT_VIOLATION');
        }
    });

    it('is deterministic for same input', () => {
        const board = boardFromMines(5, 5, [4, 9, 14, 19], 20);
        const r1 = evaluateDifficulty({ board });
        const r2 = evaluateDifficulty({ board });
        expect(r1).toEqual(r2);
    });

    it('returns in-range evidence and boolean complement', () => {
        const board = boardFromMines(5, 5, [0, 4, 20, 24], 12);
        const result = evaluateDifficulty({ board });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.evidence.D).toBeGreaterThanOrEqual(0);
            expect(result.value.evidence.D).toBeLessThanOrEqual(100);
            expect(result.value.evidence.U).toBeGreaterThanOrEqual(0);
            expect(result.value.evidence.U).toBeLessThanOrEqual(1);
            expect(result.value.evidence.requiresGuess).toBe(!result.value.logicallySolvable);
            expect(['Easy', 'Normal', 'Hard', 'Expert']).toContain(result.value.rank);
        }
    });

    it('returns finite U value for valid boards', () => {
        const board = boardFromMines(3, 3, [8], 0);
        const result = evaluateDifficulty({ board });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Number.isFinite(result.value.evidence.U)).toBe(true);
        }
    });

    it('does not mark logically solvable when only hidden clues would resolve final mine', () => {
        const board = boardFromMines(6, 6, [2, 8, 12, 13, 14, 34], 0);
        const result = evaluateDifficulty({ board });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.logicallySolvable).toBe(false);
            expect(result.value.evidence.requiresGuess).toBe(true);
        }
    });
});

describe('internal helper coverage', () => {
    it('computes neighbors for corner and center', () => {
        expect(__test__.getNeighbors(0, 3, 3).sort((a, b) => a - b)).toEqual([1, 3, 4]);
        expect(__test__.getNeighbors(4, 3, 3).length).toBe(8);
    });

    it('detects start-zone mine presence', () => {
        const board = boardFromMines(3, 3, [0], 4);
        expect(__test__.hasMineInStartZone(board)).toBe(true);
    });

    it('applies basic and advanced rules with deterministic progress', () => {
        const board = boardFromMines(4, 4, [3, 12], 5);
        const clues = __test__.computeClues(board);

        const basic = __test__.runSolver(board, clues, false);
        const full = __test__.runSolver(board, clues, true);

        expect(full.basicSteps).toBeGreaterThanOrEqual(basic.basicSteps);
        expect(full.advancedSteps).toBeGreaterThanOrEqual(0);
        expect(full.maxChainDepth).toBeGreaterThanOrEqual(0);
    });

    it('finds a board where advanced inference contributes', () => {
        const width = 4;
        const height = 4;
        const startIndex = 15;
        let found = false;

        for (let mask = 0; mask < 1 << 12; mask += 1) {
            const mineIndexes: number[] = [];
            for (let i = 0; i < 12; i += 1) {
                if ((mask & (1 << i)) !== 0) {
                    mineIndexes.push(i);
                }
            }
            const board = boardFromMines(width, height, mineIndexes, startIndex);
            const clues = __test__.computeClues(board);
            const result = __test__.runSolver(board, clues, true);
            if (result.advancedSteps > 0) {
                found = true;
                break;
            }
        }

        expect(found).toBe(true);
    });

    it('finds a valid board with unresolved safe cells after basic-only solving', () => {
        const width = 5;
        const height = 5;
        const startIndex = 24;
        let found = false;

        for (let mask = 0; mask < 1 << 15; mask += 17) {
            const mineIndexes: number[] = [];
            for (let i = 0; i < 15; i += 1) {
                if ((mask & (1 << i)) !== 0) {
                    mineIndexes.push(i);
                }
            }
            const board = boardFromMines(width, height, mineIndexes, startIndex);
            const result = evaluateDifficulty({ board });
            if (!result.ok) {
                continue;
            }
            if (result.value.evidence.U > 0) {
                found = true;
                break;
            }
        }

        expect(found).toBe(true);
    });

    it('covers subset utility branches', () => {
        expect(__test__.isSubset([1, 2], [1, 2, 3])).toBe(true);
        expect(__test__.isSubset([1, 4], [1, 2, 3])).toBe(false);
        expect(__test__.isSubset([1, 2, 3], [1, 2])).toBe(false);
    });
});
