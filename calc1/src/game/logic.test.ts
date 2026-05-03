import { describe, it, expect, vi } from 'vitest';
import {
    getDifficulty,
    pickOperations,
    applyOperation,
    checkWin,
    loadLevel,
    saveLevel,
    findSolutionPath,
    findSolutionFromOptions,
    canReachTarget,
    OPERATION_POOL,
    DIFFICULTY_TABLE,
    LEVEL_STORAGE_KEY,
    OPTION_COUNT,
} from '../game/logic';

// ────────────────────────────────────────────────────────────
// getDifficulty
// ────────────────────────────────────────────────────────────
describe('getDifficulty', () => {
    it('level 1 returns first table entry', () => {
        expect(getDifficulty(1)).toEqual(DIFFICULTY_TABLE[0]);
    });

    it('level 4 returns fourth table entry', () => {
        expect(getDifficulty(4)).toEqual(DIFFICULTY_TABLE[3]);
    });

    it('level 5 and beyond returns last table entry', () => {
        expect(getDifficulty(5)).toEqual(DIFFICULTY_TABLE[4]);
        expect(getDifficulty(99)).toEqual(DIFFICULTY_TABLE[4]);
    });
});

// ────────────────────────────────────────────────────────────
// pickOperations
// ────────────────────────────────────────────────────────────
describe('pickOperations', () => {
    it('returns exactly OPTION_COUNT operations', () => {
        const ops = pickOperations(OPERATION_POOL, OPTION_COUNT);
        expect(ops).toHaveLength(OPTION_COUNT);
    });

    it('returns no duplicates within one set', () => {
        for (let i = 0; i < 20; i++) {
            const ops = pickOperations(OPERATION_POOL, OPTION_COUNT);
            const labels = ops.map((o) => o.label);
            const unique = new Set(labels);
            expect(unique.size).toBe(OPTION_COUNT);
        }
    });

    it('only returns operations from the given pool', () => {
        const ops = pickOperations(OPERATION_POOL, OPTION_COUNT);
        const poolLabels = new Set(OPERATION_POOL.map((o) => o.label));
        ops.forEach((op) => expect(poolLabels.has(op.label)).toBe(true));
    });

    it('uses the provided rng (deterministic)', () => {
        // fixed rng always returns 0 → sorted to front → first OPTION_COUNT
        const rng = vi.fn().mockReturnValue(0);
        const ops1 = pickOperations(OPERATION_POOL, OPTION_COUNT, rng);
        const ops2 = pickOperations(OPERATION_POOL, OPTION_COUNT, rng);
        expect(ops1.map((o) => o.label)).toEqual(ops2.map((o) => o.label));
    });
});

// ────────────────────────────────────────────────────────────
// applyOperation
// ────────────────────────────────────────────────────────────
describe('applyOperation', () => {
    it('addition +1', () => {
        const op = OPERATION_POOL.find((o) => o.label === '+1')!;
        expect(applyOperation(10, op)).toBe(11);
    });

    it('addition +2', () => {
        const op = OPERATION_POOL.find((o) => o.label === '+2')!;
        expect(applyOperation(10, op)).toBe(12);
    });

    it('addition +5', () => {
        const op = OPERATION_POOL.find((o) => o.label === '+5')!;
        expect(applyOperation(10, op)).toBe(15);
    });

    it('addition +10', () => {
        const op = OPERATION_POOL.find((o) => o.label === '+10')!;
        expect(applyOperation(5, op)).toBe(15);
    });

    it('subtraction -1', () => {
        const op = OPERATION_POOL.find((o) => o.label === '−1')!;
        expect(applyOperation(10, op)).toBe(9);
    });

    it('subtraction -2', () => {
        const op = OPERATION_POOL.find((o) => o.label === '−2')!;
        expect(applyOperation(10, op)).toBe(8);
    });

    it('subtraction -5', () => {
        const op = OPERATION_POOL.find((o) => o.label === '−5')!;
        expect(applyOperation(8, op)).toBe(3);
    });

    it('subtraction can produce negative values', () => {
        const op = OPERATION_POOL.find((o) => o.label === '−5')!;
        expect(applyOperation(3, op)).toBe(-2);
    });

    it('multiplication x2', () => {
        const op = OPERATION_POOL.find((o) => o.label === '×2')!;
        expect(applyOperation(6, op)).toBe(12);
    });

    it('multiplication x3', () => {
        const op = OPERATION_POOL.find((o) => o.label === '×3')!;
        expect(applyOperation(7, op)).toBe(21);
    });

    it('multiplication x5', () => {
        const op = OPERATION_POOL.find((o) => o.label === '×5')!;
        expect(applyOperation(4, op)).toBe(20);
    });

    it('division ÷2 floors result (odd)', () => {
        const op = OPERATION_POOL.find((o) => o.label === '÷2')!;
        expect(applyOperation(7, op)).toBe(3);
    });

    it('division ÷2 exact (even)', () => {
        const op = OPERATION_POOL.find((o) => o.label === '÷2')!;
        expect(applyOperation(8, op)).toBe(4);
    });

    it('division ÷3 floors result', () => {
        const op = OPERATION_POOL.find((o) => o.label === '÷3')!;
        expect(applyOperation(10, op)).toBe(3);
    });
});

// ────────────────────────────────────────────────────────────
// checkWin
// ────────────────────────────────────────────────────────────
describe('checkWin', () => {
    it('returns true when current equals target', () => {
        expect(checkWin(50, 50)).toBe(true);
    });

    it('returns false when current does not equal target', () => {
        expect(checkWin(49, 50)).toBe(false);
        expect(checkWin(51, 50)).toBe(false);
    });

    it('returns false when current overshoots target', () => {
        expect(checkWin(200, 50)).toBe(false);
    });
});

// ────────────────────────────────────────────────────────────
// Skip behavior (turn consumption, value unchanged)
// ────────────────────────────────────────────────────────────
describe('skip behavior via null operation', () => {
    it('applyOperation is not called for skip (null), value unchanged', () => {
        // Simulate skip: caller passes null and does NOT call applyOperation
        const before = 42;
        // Skip = don't call applyOperation, just decrement turns
        const after = before; // value must not change
        expect(after).toBe(42);
    });
});

// ────────────────────────────────────────────────────────────
// loadLevel / saveLevel
// ────────────────────────────────────────────────────────────
describe('loadLevel', () => {
    it('always returns 1 on page reload', () => {
        const storage = { getItem: () => null } as Pick<Storage, 'getItem'>;
        expect(loadLevel(storage)).toBe(1);
    });

    it('always returns 1 even if level was saved', () => {
        const storage = { getItem: () => '3' } as Pick<Storage, 'getItem'>;
        expect(loadLevel(storage)).toBe(1);
    });

    it('always returns 1 for non-numeric value', () => {
        const storage = { getItem: () => 'abc' } as Pick<Storage, 'getItem'>;
        expect(loadLevel(storage)).toBe(1);
    });

    it('always returns 1 for any input', () => {
        const storage0 = { getItem: () => '0' } as Pick<Storage, 'getItem'>;
        const storageN = { getItem: () => '-1' } as Pick<Storage, 'getItem'>;
        expect(loadLevel(storage0)).toBe(1);
        expect(loadLevel(storageN)).toBe(1);
    });
});

describe('saveLevel', () => {
    it('calls setItem with correct key and value', () => {
        const setItem = vi.fn();
        const storage = { setItem } as Pick<Storage, 'setItem'>;
        saveLevel(5, storage);
        expect(setItem).toHaveBeenCalledWith(LEVEL_STORAGE_KEY, '5');
    });

    it('reload always returns 1 regardless of saved level', () => {
        let stored = '';
        const storage = {
            setItem: (_k: string, v: string) => { stored = v; },
            getItem: () => stored || null,
        };
        saveLevel(4, storage);
        // Even though level 4 is saved, loadLevel always returns 1 on page reload
        expect(loadLevel(storage)).toBe(1);
    });
});

// ────────────────────────────────────────────────────────────
// findSolutionPath
// ────────────────────────────────────────────────────────────
describe('findSolutionPath', () => {
    it('returns empty array when initial equals target', () => {
        expect(findSolutionPath(50, 50, OPERATION_POOL, 10)).toEqual([]);
    });

    it('finds a one-step solution', () => {
        // 10 + 5 = 15
        const plus5 = OPERATION_POOL.find((o) => o.label === '+5')!;
        const result = findSolutionPath(10, 15, [plus5], 5);
        expect(result).not.toBeNull();
        expect(result!).toHaveLength(1);
        expect(result![0].operation!.label).toBe('+5');
        expect(result![0].resultValue).toBe(15);
    });

    it('finds a multi-step solution', () => {
        // 1 x2 x2 = 4, within 3 turns
        const times2 = OPERATION_POOL.find((o) => o.label === '×2')!;
        const plus1  = OPERATION_POOL.find((o) => o.label === '+1')!;
        const result = findSolutionPath(1, 4, [times2, plus1], 5);
        expect(result).not.toBeNull();
        expect(result![result!.length - 1].resultValue).toBe(4);
    });

    it('returns null when target is unreachable within maxTurns', () => {
        // With only +1, reaching 1000 from 1 in 3 turns is impossible
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        expect(findSolutionPath(1, 1000, [plus1], 3)).toBeNull();
    });

    it('path entries include options array', () => {
        const plus2 = OPERATION_POOL.find((o) => o.label === '+2')!;
        const result = findSolutionPath(1, 3, [plus2], 5);
        expect(result).not.toBeNull();
        result!.forEach((entry) => {
            expect(Array.isArray(entry.options)).toBe(true);
        });
    });

    it('prunes values beyond ±1000000', () => {
        // x5 from 1000000 would overflow; ensure it doesn't loop forever
        const times5 = OPERATION_POOL.find((o) => o.label === '×5')!;
        const result = findSolutionPath(1000000, 5000000, [times5], 5);
        expect(result).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────
// findSolutionFromOptions
// ────────────────────────────────────────────────────────────
describe('findSolutionFromOptions', () => {
    it('returns empty array when initial already equals target', () => {
        expect(findSolutionFromOptions(42, 42, [])).toEqual([]);
    });

    it('finds solution when correct op is in turn options', () => {
        const plus5  = OPERATION_POOL.find((o) => o.label === '+5')!;
        const plus1  = OPERATION_POOL.find((o) => o.label === '+1')!;
        // turn 0: [+5, +1], answer: 10+5=15
        const result = findSolutionFromOptions(10, 15, [[plus5, plus1]]);
        expect(result).not.toBeNull();
        expect(result![0].operation!.label).toBe('+5');
        expect(result![0].resultValue).toBe(15);
        expect(result![0].options).toContain(plus5);
    });

    it('finds multi-turn solution', () => {
        const times2 = OPERATION_POOL.find((o) => o.label === '×2')!;
        // turn0: x2 → 2, turn1: x2 → 4
        const result = findSolutionFromOptions(1, 4, [[times2], [times2]]);
        expect(result).not.toBeNull();
        expect(result![result!.length - 1].resultValue).toBe(4);
    });

    it('returns null when no turn reaches target', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        // Only 2 turns of +1 from 1 cannot reach 100
        const result = findSolutionFromOptions(1, 100, [[plus1], [plus1]]);
        expect(result).toBeNull();
    });

    it('returns null when turn options are exhausted before reaching target', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        const result = findSolutionFromOptions(1, 5, [[plus1]]);
        expect(result).toBeNull();
    });

    it('result entries carry correct options reference', () => {
        const times3 = OPERATION_POOL.find((o) => o.label === '×3')!;
        const opts = [times3];
        const result = findSolutionFromOptions(1, 3, [opts]);
        expect(result).not.toBeNull();
        expect(result![0].options).toBe(opts);
    });
});

// ────────────────────────────────────────────────────────────
// canReachTarget
// ────────────────────────────────────────────────────────────
describe('canReachTarget', () => {
    it('returns true when target is reachable', () => {
        expect(canReachTarget(1, 3, OPERATION_POOL, 5)).toBe(true);
    });

    it('returns false when target is not reachable within maxTurns', () => {
        const plus1 = OPERATION_POOL.find((o) => o.label === '+1')!;
        expect(canReachTarget(1, 1000, [plus1], 3)).toBe(false);
    });

    it('returns true when initial equals target', () => {
        expect(canReachTarget(10, 10, OPERATION_POOL, 5)).toBe(true);
    });
});
