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
    nextReachedLevel,
    levelAfterClear,
    isRoundOpen,
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

    it('gives the spec values for Lv.1 to Lv.5', () => {
        expect(getDifficulty(1)).toEqual({ initialValueMin: 1, initialValueMax: 5, targetMin: 20, targetMax: 50, maxTurns: 12 });
        expect(getDifficulty(2)).toEqual({ initialValueMin: 1, initialValueMax: 10, targetMin: 50, targetMax: 100, maxTurns: 10 });
        expect(getDifficulty(3)).toEqual({ initialValueMin: 1, initialValueMax: 15, targetMin: 80, targetMax: 150, maxTurns: 9 });
        expect(getDifficulty(4)).toEqual({ initialValueMin: 1, initialValueMax: 20, targetMin: 100, targetMax: 200, maxTurns: 8 });
        expect(getDifficulty(5)).toEqual({ initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 8 });
    });

    it('gives 7 turns at Lv.6 with the Lv.5 initial and target ranges', () => {
        expect(getDifficulty(6)).toEqual({ initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 7 });
    });

    it('gives 6 turns at Lv.7 with the Lv.5 initial and target ranges', () => {
        expect(getDifficulty(7)).toEqual({ initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 6 });
    });

    it('keeps 6 turns for every level past Lv.7', () => {
        expect(getDifficulty(99)).toEqual({ initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 6 });
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

    it('keeps the saved level under the calcRushLevel key (existing players keep their level)', () => {
        expect(LEVEL_STORAGE_KEY).toBe('calcRushLevel');
    });
});

describe('nextReachedLevel', () => {
    it('a clear to a higher level raises the reached level', () => {
        expect(nextReachedLevel(3, 4)).toBe(4);
    });

    it('a clear to a level below the reached one does not lower it', () => {
        expect(nextReachedLevel(4, 3)).toBe(4);
    });

    it('the first clear of a run (reached 1, clear to 2) gives 2', () => {
        expect(nextReachedLevel(1, 2)).toBe(2);
    });
});

describe('levelAfterClear', () => {
    it('a clear on Lv.1 goes to Lv.2', () => {
        expect(levelAfterClear(1)).toBe(2);
    });

    it('a clear on Lv.6 goes to Lv.7 (the first level with a fixed move count)', () => {
        expect(levelAfterClear(6)).toBe(7);
    });
});

describe('isRoundOpen', () => {
    it('input at exactly the deadline is still accepted (the time left is 0 and the same input counts)', () => {
        expect(isRoundOpen(60000, 60000)).toBe(true);
    });

    it('input 1 ms after the deadline is rejected', () => {
        expect(isRoundOpen(60001, 60000)).toBe(false);
    });

    it('input well before the deadline is accepted', () => {
        expect(isRoundOpen(1000, 60000)).toBe(true);
    });
});

describe('candidate options', () => {
    it('every candidate of every slot comes from the operation pool (no undefined operation)', () => {
        const slots = createTurnSlots(12, OPERATION_POOL, () => 0.37);
        slots.forEach((slot) => {
            slot.options.forEach((op) => {
                expect(OPERATION_POOL).toContain(op);
            });
        });
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
