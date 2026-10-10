// Whole runs: play the shortest clearing sequence found by an independent search, round after round,
// and check that every new board can be cleared again (the spec's "盤面の生成" guarantee in play).
import { describe, expect, it } from 'vitest';
import { fixedTarget } from './fixed';
import { fullLineExists } from './grid';
import { createState, move } from './rules';
import { count, depsOf, oracleSolve, render } from './testkit';
import { FIXED } from './types';

describe('playing 10 clears in a row', () => {
    it('always leaves a board that can be cleared again, on 200 seeds', () => {
        const SEEDS = 200;
        const ROUNDS = 10;
        let played = 0;
        let stuck = 0;
        let fixedShort = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
            const deps = depsOf(seed);
            const s = createState(deps);
            for (let round = 1; round <= ROUNDS; round++) {
                s.moves = 999; // the number of moves is not what is being tested here
                const path = oracleSolve(render(s), 40, 600000);
                if (path === null) {
                    stuck++;
                    break;
                }
                const scoreBefore = s.score;
                path.forEach((dir) => move(s, dir, deps));
                if (s.score !== scoreBefore + 1) {
                    expect.fail(`seed ${seed}, round ${round}: the shortest path did not clear exactly one line`);
                }
                if (fullLineExists(s.grid)) expect.fail(`seed ${seed}, round ${round}: a completed line after the clear`);
                if (s.grid[s.py][s.px] !== 0) expect.fail(`seed ${seed}, round ${round}: a block on the character`);
                if (count(s.grid, FIXED) < fixedTarget(s.score)) fixedShort++;
                played++;
            }
        }
        // after a clear the fixed blocks reach their target, except where no cell can take one
        // (measured with the current rule; it was 12% with the old "all empty cells connected" rule)
        expect(fixedShort / played).toBeLessThanOrEqual(0.05);
        expect(played).toBe(SEEDS * ROUNDS); // no run ended early: the vacuous case is excluded
        expect(stuck).toBe(0); // step 11 ("nothing added") never left a board without a clear
    }, 600000);
});
