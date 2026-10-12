import { describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from './logic';

// The search is replaced, so the test decides what the shortest solution of every drawn board is.
const search = vi.hoisted(() => ({ calls: 0, result: null as unknown }));

vi.mock('./logic', async (importOriginal) => {
    const original = await importOriginal<typeof import('./logic')>();

    return {
        ...original,
        findShortestSolutionFromOptions: () => {
            search.calls += 1;
            return search.result;
        }
    };
});

const { createDemoPuzzle, DEMO_ATTEMPTS } = await import('./titleDemo');
const { OPERATION_POOL } = await import('./logic');

const entry = (operation: (typeof OPERATION_POOL)[number] | null): HistoryEntry => ({ operation, resultValue: 30, options: [] });

describe('createDemoPuzzle: the acceptance of a board and the fallback', () => {
    it('解が見つからないまま 200 回探したら、最初の手の最初の候補 1 つで目標値になる問題にする（スキップでない手は 1 個）', () => {
        search.calls = 0;
        search.result = null;
        const puzzle = createDemoPuzzle(() => 0);

        expect(search.calls).toBe(DEMO_ATTEMPTS);
        expect(puzzle.initial).toBe(1);

        const first = puzzle.slots[0].options[0];
        expect(puzzle.target).toBe(first.apply(puzzle.initial));
        expect(puzzle.path).toHaveLength(1);
        expect(puzzle.path[0].operation).toBe(first);
        expect(puzzle.path[0].resultValue).toBe(puzzle.target);
    });

    it('スキップでない手が 1 個の解は採用されない（200 回とも却下してフォールバック）', () => {
        search.calls = 0;
        search.result = [entry(null), entry(OPERATION_POOL[0])];
        createDemoPuzzle(() => 0);

        expect(search.calls).toBe(200);
    });

    it('スキップでない手がちょうど 2 個の解は、1 回目で採用される（2 個以上が条件）', () => {
        search.calls = 0;
        search.result = [entry(OPERATION_POOL[0]), entry(null), entry(OPERATION_POOL[1])];
        const puzzle = createDemoPuzzle(() => 0);

        expect(search.calls).toBe(1);
        expect(puzzle.path).toBe(search.result);
    });
});
