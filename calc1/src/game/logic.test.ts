import { describe, it, expect, vi } from 'vitest';
import {
    getDifficulty,
    pickOperations,
    applyOperation,
    checkWin,
    loadLevel,
    saveLevel,
    createTurnSlots,
    evaluateProgress,
    handleLossLevelChoice,
    findSolutionPath,
    findSolutionFromOptions,
    findShortestSolutionFromOptions,
    canReachTarget,
    OPERATION_POOL,
    DIFFICULTY_TABLE,
    LEVEL_STORAGE_KEY,
    OPTION_COUNT,
    ROUND_TIME_MS,
} from '../game/logic';

describe('constants', () => {
    it('uses 60 seconds for one play', () => {
        expect(ROUND_TIME_MS).toBe(60000);
    });

    it('uses four operation options per turn', () => {
        expect(OPTION_COUNT).toBe(4);
    });
});

describe('getDifficulty', () => {
    it('returns the first entry at level 1', () => {
        expect(getDifficulty(1)).toEqual(DIFFICULTY_TABLE[0]);
    });

    it('clamps values below level 1 to first entry', () => {
        expect(getDifficulty(0)).toEqual(DIFFICULTY_TABLE[0]);
    });

    it('caps at the last entry', () => {
        expect(getDifficulty(99)).toEqual(DIFFICULTY_TABLE[4]);
    });
});

describe('pickOperations', () => {
    it('returns count items with no duplicates', () => {
        const ops = pickOperations(OPERATION_POOL, OPTION_COUNT);
        expect(ops).toHaveLength(OPTION_COUNT);
        expect(new Set(ops.map((op) => op.label)).size).toBe(OPTION_COUNT);
    });

    it('is deterministic with injected rng', () => {
        const rng = vi.fn().mockReturnValue(0.25);
        const a = pickOperations(OPERATION_POOL, OPTION_COUNT, rng).map((op) => op.label);
        const b = pickOperations(OPERATION_POOL, OPTION_COUNT, rng).map((op) => op.label);
        expect(a).toEqual(b);
    });
});

describe('applyOperation / checkWin', () => {
    it('applies every operation in pool', () => {
        const expected = new Map<string, number>([
            ['+1', 8],
            ['+2', 9],
            ['+5', 12],
            ['+10', 17],
            ['-1', 6],
            ['-2', 5],
            ['-5', 2],
            ['×2', 14],
            ['×3', 21],
            ['×5', 35],
            ['/2', 3],
            ['/3', 2],
        ]);
        OPERATION_POOL.forEach((op) => {
            expect(applyOperation(7, op)).toBe(expected.get(op.label));
        });
    });

    it('supports division floor', () => {
        const div2 = OPERATION_POOL.find((o) => o.label === '/2');
        expect(div2).toBeDefined();
        expect(applyOperation(7, div2!)).toBe(3);
    });

    it('supports negative values', () => {
        const minus5 = OPERATION_POOL.find((o) => o.label === '-5');
        expect(minus5).toBeDefined();
        expect(applyOperation(3, minus5!)).toBe(-2);
    });

    it('checkWin only when exact match', () => {
        expect(checkWin(10, 10)).toBe(true);
        expect(checkWin(11, 10)).toBe(false);
    });
});

describe('loadLevel / saveLevel', () => {
    it('always starts from level 1', () => {
        expect(loadLevel({ getItem: () => '8' })).toBe(1);
    });

    it('saves level with expected storage key', () => {
        const setItem = vi.fn();
        saveLevel(4, { setItem });
        expect(setItem).toHaveBeenCalledWith(LEVEL_STORAGE_KEY, '4');
    });
});

describe('createTurnSlots', () => {
    it('creates slots with null selected and 4 options', () => {
        const slots = createTurnSlots(3, OPERATION_POOL, () => 0.1);
        expect(slots).toHaveLength(3);
        slots.forEach((slot) => {
            expect(slot.selected).toBeNull();
            expect(slot.options).toHaveLength(4);
            expect(new Set(slot.options.map((o) => o.label)).size).toBe(4);
        });
    });
});

describe('evaluateProgress', () => {
    it('keeps value when selected is skip', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        const slots = [
            { options: [plus1], selected: null },
        ];
        const state = evaluateProgress(5, 99, slots);
        expect(state.currentValue).toBe(5);
        expect(state.rows[0].value).toBe(5);
    });

    it('wins immediately and auto-skips following turns', () => {
        const plus2 = OPERATION_POOL.find((o) => o.label === '+2')!;
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        const slots = [
            { options: [plus2], selected: plus2 },
            { options: [plus1], selected: plus1 },
            { options: [plus1], selected: plus1 },
        ];
        const state = evaluateProgress(3, 5, slots);
        expect(state.won).toBe(true);
        expect(state.wonAtTurn).toBe(1);
        expect(state.rows[1].isAutoSkip).toBe(true);
        expect(state.rows[2].isAutoSkip).toBe(true);
    });

    it('stays not-won when no row reaches target', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        const slots = [
            { options: [plus1], selected: plus1 },
            { options: [plus1], selected: null },
        ];
        const state = evaluateProgress(1, 9, slots);
        expect(state.won).toBe(false);
        expect(state.wonAtTurn).toBeNull();
        expect(state.currentValue).toBe(2);
    });
});

describe('handleLossLevelChoice', () => {
    it('restart resets level and saves 1', () => {
        const setItem = vi.fn();
        const next = handleLossLevelChoice(4, 'restart', { setItem });
        expect(next).toBe(1);
        expect(setItem).toHaveBeenCalledWith(LEVEL_STORAGE_KEY, '1');
    });

    it('continue keeps current level', () => {
        const setItem = vi.fn();
        const next = handleLossLevelChoice(4, 'continue', { setItem });
        expect(next).toBe(4);
        expect(setItem).not.toHaveBeenCalled();
    });
});

describe('solver functions', () => {
    it('findSolutionPath returns empty when initial equals target', () => {
        expect(findSolutionPath(5, 5, OPERATION_POOL, 3)).toEqual([]);
    });

    it('findSolutionPath returns one-step solution when direct op exists', () => {
        const plus2 = OPERATION_POOL.find((o) => o.label === '+2')!;
        const result = findSolutionPath(1, 3, [plus2], 2);
        expect(result).not.toBeNull();
        expect(result![0].operation?.label).toBe('+2');
        expect(result![0].options).toEqual([plus2]);
    });

    it('findSolutionPath returns null when unreachable', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        expect(findSolutionPath(1, 100, [plus1], 2)).toBeNull();
    });

    it('findSolutionPath prunes overflowing branches', () => {
        const times5 = OPERATION_POOL.find((o) => o.label === '×5')!;
        const result = findSolutionPath(1_000_000, 5_000_000, [times5], 2);
        expect(result).toBeNull();
    });

    it('findSolutionFromOptions supports skip branch', () => {
        const minus1 = OPERATION_POOL.find((o) => o.label === '-1')!;
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        const result = findSolutionFromOptions(1, 2, [[minus1], [plus1]]);
        expect(result).not.toBeNull();
        expect(result![0].operation).toBeNull();
        expect(result![1].operation?.label).toBe('+1');
    });

    it('findSolutionFromOptions returns null when exhausted', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        expect(findSolutionFromOptions(1, 9, [[plus1]])).toBeNull();
    });

    it('findShortestSolutionFromOptions picks earliest reachable turn', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        const plus2 = OPERATION_POOL.find((o) => o.label === '+2')!;
        const result = findShortestSolutionFromOptions(1, 3, [[plus1], [plus2]]);
        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);
        expect(result![0].operation).toBeNull();
        expect(result![1].operation?.label).toBe('+2');
    });

    it('findShortestSolutionFromOptions supports skip and returns null if impossible', () => {
        const minus1 = OPERATION_POOL.find((o) => o.label === '-1')!;
        expect(findShortestSolutionFromOptions(5, 5, [[minus1]])).toEqual([]);
        expect(findShortestSolutionFromOptions(1, 99, [[minus1]])).toBeNull();
    });

    it('canReachTarget returns true for reachable target', () => {
        expect(canReachTarget(1, 3, OPERATION_POOL, 5)).toBe(true);
    });

    it('canReachTarget returns false for unreachable target', () => {
        const minus1 = OPERATION_POOL.find((o) => o.label === '-1')!;
        expect(canReachTarget(1, 100, [minus1], 3)).toBe(false);
    });
});
