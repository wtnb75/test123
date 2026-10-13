// Whole runs with the easy-board floor (docs/spec/board-generation.md 完了条件): play the shortest clearing
// sequence round after round and judge every generated board with searches that are independent of the
// generator (the string-based oracle for the shortest clear and for "one block alone clears").
import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { fixedTarget } from './fixed';
import { floorMoves, hasSingleBlockClear } from './floor';
import { fullLineExists } from './grid';
import { createState, move } from './rules';
import { minClearPlan, targetSolve } from './solve';
import { count, depsOf, oracleMinOf, render, singleClearOracle } from './testkit';
import { EMPTY, FIXED } from './types';

const SEEDS = 100;
const ROUNDS = 12;

describe('playing 12 clears in a row with the floor', () => {
    it('keeps the boards from the 8th line on above the floor (at most 10% miss it) and exercises relocation', () => {
        let boards = 0;
        let miss = 0;
        let singleMiss = 0;
        let generations = 0;
        let relocatedGenerations = 0;
        let relocatedBlocks = 0;
        let relocatedMet = 0; // relocated generations whose board meets the floor
        for (let seed = 1; seed <= SEEDS; seed++) {
            const deps = depsOf(seed);
            const s = createState(deps);
            for (let round = 1; round <= ROUNDS; round++) {
                s.moves = 999; // the number of moves is not what is being tested
                const plan = minClearPlan(s.grid, s.px, s.py, 60);
                if (!plan) expect.fail(`seed ${seed}, round ${round}: no clear on the board\n${render(s).join('\n')}`);
                for (const dir of plan) {
                    const res = move(s, dir, deps);
                    if (res.clearedRows.length + res.clearedCols.length === 0) continue;
                    generations++;

                    // what the generation reported matches the board
                    if (fullLineExists(s.grid)) expect.fail(`seed ${seed}, round ${round}: a completed line`);
                    if (s.grid[s.py][s.px] !== EMPTY) expect.fail(`seed ${seed}, round ${round}: a block on the character`);
                    if (count(s.grid, FIXED) > fixedTarget(s.score)) expect.fail(`seed ${seed}, round ${round}: too many fixed blocks`);
                    for (const p of res.spawned) {
                        if (s.grid[p.y][p.x] !== p.kind) expect.fail(`seed ${seed}, round ${round}: a spawn that is not on the board`);
                    }
                    for (const m of res.relocated) {
                        if (s.grid[m.to.y][m.to.x] !== FIXED) expect.fail(`seed ${seed}, round ${round}: a relocation to a cell without a fixed block`);
                        if (!res.spawned.some((p) => p.x === m.to.x && p.y === m.to.y && p.kind === FIXED)) {
                            expect.fail(`seed ${seed}, round ${round}: the new cell of a relocation does not pop in`);
                        }
                    }
                    if (res.relocated.length > 0) {
                        relocatedGenerations++;
                        const rowsNow = render(s);
                        const shortestNow = oracleMinOf(s, 40, 600000);
                        if (shortestNow !== null && shortestNow >= floorMoves(targetSolve(s.score)) && !singleClearOracle(rowsNow)) {
                            relocatedMet++;
                        }
                    }
                    relocatedBlocks += res.relocated.length;

                    // the floor, from the 8th line on
                    if (s.score < 8) continue;
                    boards++;
                    const rows = render(s);
                    const shortest = oracleMinOf(s, 40, 600000);
                    if (shortest === null) expect.fail(`seed ${seed}, round ${round}: not clearable\n${rows.join('\n')}`);
                    const missesA = shortest < floorMoves(targetSolve(s.score));
                    const single = singleClearOracle(rows);
                    if (single !== hasSingleBlockClear(s.grid, s.px, s.py)) {
                        expect.fail(`seed ${seed}, round ${round}: (B) disagrees with the independent search\n${rows.join('\n')}`);
                    }
                    if (missesA || single) miss++;
                    if (single) singleMiss++;
                }
            }
        }
        expect(boards).toBeGreaterThanOrEqual(300); // the vacuous case is excluded
        // measured 6.8% (34 of 500 boards) with the spec's 3000 attempts; 10% is the spec's bound
        expect(miss / boards).toBeLessThanOrEqual(0.1);
        expect(singleMiss / boards).toBeLessThanOrEqual(0.1);
        // the relocation path ran, and it does help: some relocated boards meet the floor (measured: about
        // half of them; the share is not bounded)
        expect(relocatedGenerations).toBeGreaterThan(0);
        expect(relocatedMet).toBeGreaterThan(0);
        expect(relocatedBlocks).toBeLessThanOrEqual(relocatedGenerations * PARAMS.relocateMax * PARAMS.relocateCount);
        expect(generations).toBeGreaterThan(boards);
    }, 600000);
});
