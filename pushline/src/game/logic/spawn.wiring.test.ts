// How generateBlocks uses the optimum of each candidate: the search result is scripted, so the choice
// among candidates (and the stop at the first one that reaches the target) is observable.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./solve', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./solve')>();
    return { ...actual, minClearMoves: vi.fn() };
});

import { PARAMS } from '../params';
import { move } from './rules';
import { minClearMoves } from './solve';
import { generateBlocks } from './spawn';
import { board, count, cutOffAfter, depsOf, EMPTY_ROWS, frozenClock, render, seeded } from './testkit';
import { MOVABLE } from './types';

const search = vi.mocked(minClearMoves);

/** Makes the n-th search return values[n] (1 once the script is used up). */
function script(values: (number | null)[]) {
    let i = 0;
    search.mockImplementation(() => (i < values.length ? values[i++] : 1));
}

/** The board generated at score 0 with a scripted search; target 6, so any value below 6 misses it. */
function generatedWith(values: (number | null)[], seed = 3, now: () => number = frozenClock): string {
    script(values);
    const s = board(EMPTY_ROWS);
    generateBlocks(s, seeded(seed), [], now);
    return render(s).join('/');
}

beforeEach(() => {
    search.mockReset();
});

describe('generateBlocks: choosing among candidates that miss the target', () => {
    it.each([
        ['the first', [5, 3, 4], [null]],
        ['the second', [3, 5, 4], [1, null]],
        ['the third', [3, 4, 5], [1, 1, null]],
    ] as const)('uses %s candidate when it has the longest optimum', (_which, scripted, pickByTarget) => {
        expect(generatedWith([...scripted])).toBe(generatedWith([...pickByTarget]));
    });

    it('the three candidates really differ (the comparison above is not vacuous)', () => {
        const first = generatedWith([null]);
        const second = generatedWith([1, null]);
        const third = generatedWith([1, 1, null]);
        expect(new Set([first, second, third]).size).toBe(3);
    });

    it('keeps the earlier of two equally hard candidates', () => {
        expect(generatedWith([4, 4, 3])).toBe(generatedWith([null]));
    });

    it('stops at the first candidate that reaches the target and ignores later ones', () => {
        // the third candidate would reach the target as well, but the second one has already ended the search
        expect(generatedWith([2, null, null, 5])).toBe(generatedWith([1, null]));
    });

    it('uses a candidate, not the single-push fallback, when none reaches the target', () => {
        script([]); // every search answers 1
        const s = board(EMPTY_ROWS);
        generateBlocks(s, seeded(3), [], frozenClock);
        // a candidate holds the line, a feeder and two decoys: at least 7 blocks; the fallback holds 5 or 6
        expect(count(s.grid, MOVABLE)).toBeGreaterThanOrEqual(7);
    });

    it('uses the best candidate so far when the time limit cuts the search short', () => {
        expect(PARAMS.spawnAttempts).toBeGreaterThan(3);
        script([]);
        const clock = cutOffAfter(40); // 39 attempts run, most of them produce a candidate
        const s = board(EMPTY_ROWS);
        generateBlocks(s, seeded(3), [], clock.now);
        expect(clock.readings()).toBe(41);
        expect(count(s.grid, MOVABLE)).toBeGreaterThanOrEqual(7);
    });
});

describe('generateBlocks after a line clear', () => {
    it('asks the search for the target of the updated score (limit 6 at 2 lines, not 5)', () => {
        script([null]);
        const s = board(['.....', '.....', '.....', '....@', '....o', 'oooo.'], { score: 1 });
        move(s, 'down', depsOf(5));
        expect(s.score).toBe(2);
        const limits = search.mock.calls.map((call) => call[3]);
        expect(limits.length).toBeGreaterThan(0);
        expect(new Set(limits)).toEqual(new Set([6])); // targetSolve(2) = 7, limit = 7 - 1
    });
});
