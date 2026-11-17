// Pushing a chain of movable blocks (docs/spec/chain-push.md): rules, taps, undo, bonus and the solvers.
import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { takeHint } from './hint';
import { findPath } from './path';
import { canUndo, createState, move, tapOutcome, undo } from './rules';
import { minClearLine, minClearMoves, minClearPlan } from './solve';
import { board, depsOf, EMPTY_ROWS, oracleMin, oracleMinOf, oracleMinOneBlock, render, seeded } from './testkit';
import type { Dir } from './types';

// Example 3 of the spec: pushing `oo` right lands the head on (3, 2) and completes column 3.
const EXAMPLE = ['...o.', '...o.', '@oo..', '...o.', '...x.', '...o.'];

const row = (rows: string[], y: number): string => rows[y];

describe('move: a chain of movable blocks', () => {
    it('example 1: pushes two blocks right by one cell and costs one move and one spent move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@oo..']);
        const res = move(s, 'right', depsOf(1));
        expect(res).toMatchObject({ moved: true, pushed: true });
        expect(row(render(s), 5)).toBe('.@oo.');
        expect([s.px, s.py, s.moves, s.spent]).toEqual([1, 5, 19, 1]);
    });

    it('pushes a chain of three, and the character takes the first cell', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@ooo.']);
        expect(move(s, 'right', depsOf(1)).moved).toBe(true);
        expect(row(render(s), 5)).toBe('.@ooo');
    });

    it.each<[Dir, string[], string[]]>([
        ['up', ['.....', '.....', '..o..', '..o..', '..@..', '.....'], ['.....', '..o..', '..o..', '..@..', '.....', '.....']],
        ['down', ['.....', '..@..', '..o..', '..o..', '.....', '.....'], ['.....', '.....', '..@..', '..o..', '..o..', '.....']],
        ['left', ['.....', '.....', '.....', '.....', '.....', '..oo@'], ['.....', '.....', '.....', '.....', '.....', '.oo@.']],
        ['right', ['.....', '.....', '.....', '.....', '.....', '.@oo.'], ['.....', '.....', '.....', '.....', '.....', '..@oo']],
    ])('pushes a chain of two toward %s', (dir, before, after) => {
        const s = board(before);
        expect(move(s, dir, depsOf(1)).moved).toBe(true);
        expect(render(s)).toEqual(after);
    });

    it('example 2: does not move when a fixed block or the board edge follows the chain', () => {
        for (const rows of ['@oox.', '@oooo'].map((r) => ['.....', '.....', '.....', '.....', '.....', r])) {
            const s = board(rows);
            expect(move(s, 'right', depsOf(1)).moved).toBe(false);
            expect(render(s)).toEqual(rows);
            expect([s.moves, s.spent, s.history.length]).toEqual([20, 0, 0]);
        }
    });

    it('treats blocks that are not next to each other as separate: only the first one moves', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@o.o.']);
        move(s, 'right', depsOf(1));
        expect(row(render(s), 5)).toBe('.@oo.');
    });

    it('is not stopped by a fixed block beside the chain', () => {
        const s = board(['.....', '.....', '.....', '.....', '..x..', '@oo..']);
        expect(move(s, 'right', depsOf(1)).moved).toBe(true);
        expect(render(s).slice(4).join('/')).toBe('..x../.@oo.');
    });

    it('example 3: a chain push that completes a column clears it (the fixed block too) for one line', () => {
        const s = board(EXAMPLE);
        const res = move(s, 'right', depsOf(3));
        expect(res.clearedCols).toEqual([3]);
        expect(res.clearedRows).toEqual([]);
        expect(res.cleared).toHaveLength(6);
        expect(s.score).toBe(1);
        expect(s.moves).toBe(20 - 1 + PARAMS.movesPerLine); // no shortest known: no bonus
        expect(s.history).toEqual([]);
    });

    it('a vertical chain push that completes a row clears that row (and only it)', () => {
        const s = board(['.....', 'oo.oo', '..o..', '..o..', '..@..', '.....']);
        const res = move(s, 'up', depsOf(2));
        expect(res.clearedRows).toEqual([1]);
        expect(res.clearedCols).toEqual([]);
        expect(s.score).toBe(1);
        expect(res.cleared).toHaveLength(5);
    });

    it('does not clear the row of a horizontal chain push: the cell the character left stays empty', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@oo.o']);
        const res = move(s, 'right', depsOf(1));
        expect(row(render(s), 5)).toBe('.@ooo');
        expect(res.clearedRows).toEqual([]);
        expect(s.score).toBe(0);
    });

    it('judges only the line through the cell the head block lands on, not the cells the other blocks moved into', () => {
        // column 2 is already full (it cannot arise in play; it makes the judged cells visible) and it runs through
        // the chain's inner block at (2, 5); the push only lands the head on (3, 5), so only column 3 / row 5 are judged
        // (neither is full) and the full column 2 is left alone
        const s = board(['..o..', '..o..', '..o..', '..o..', '..o..', '@oo..']);
        const res = move(s, 'right', depsOf(1));
        expect(res.moved).toBe(true);
        expect(res.clearedCols).toEqual([]);
        expect(res.clearedRows).toEqual([]);
        expect(s.score).toBe(0);
    });

    it('earns the shortest bonus when the chain push clears within the shortest moves', () => {
        const s = board(EXAMPLE, { shortest: 1 });
        const res = move(s, 'right', depsOf(3));
        expect(res.bonus).toBe(true);
        expect(s.moves).toBe(20 - 1 + PARAMS.movesPerLine + PARAMS.shortestBonus);
    });

    it('undoes a chain push in one step: the blocks and the character are back, one move is given back', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@oo..']);
        move(s, 'right', depsOf(1));
        expect(canUndo(s)).toBe(true);
        expect(undo(s)).toBe(true);
        expect(render(s)).toEqual(['.....', '.....', '.....', '.....', '.....', '@oo..']);
        expect(s.moves).toBe(20);
        expect(s.spent).toBe(1); // going back does not give the spent move back
        expect(s.history).toEqual([]);
    });
});

describe('tapOutcome and walking with chains', () => {
    it('pushes when the tapped neighbour starts a chain that can move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@oo.']);
        expect(tapOutcome(s, 2, 5)).toEqual({ kind: 'push', dir: 'right' });
    });

    it('fails when the chain cannot move (a fixed block, or the edge, follows it)', () => {
        expect(tapOutcome(board(['.....', '.....', '.....', '.....', '.....', '.@oox']), 2, 5)).toEqual({ kind: 'fail' });
        expect(tapOutcome(board(['.....', '.....', '.....', '.....', '.....', '.@ooo']), 2, 5)).toEqual({ kind: 'fail' });
    });

    it('fails for the second block of a chain: it is not next to the character', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@oo.']);
        expect(tapOutcome(s, 3, 5)).toEqual({ kind: 'fail' });
    });

    it('a tap beyond a chain fails when there is no way round, and walks round it when there is', () => {
        const closed = board(['.....', '.....', '.....', '.....', 'xxxxx', '@oo..']);
        expect(tapOutcome(closed, 4, 5)).toEqual({ kind: 'fail' });
        const open = board(['.....', '.....', '.....', '.....', '.....', '@oo..']);
        const outcome = tapOutcome(open, 4, 5);
        expect(outcome.kind).toBe('walk');
        if (outcome.kind === 'walk') {
            expect(outcome.path).toHaveLength(6);
            outcome.path.forEach((dir) => move(open, dir, depsOf(1)));
            expect(row(render(open), 5)).toBe('.oo.@'); // the chain was not pushed by the walk
        }
    });

    it('never walks through a chain: no path to a cell only reachable by pushing it', () => {
        const t = board(['.....', '.....', '.....', '.....', 'xxxxx', '@oo..']);
        expect(findPath(t.grid, t.px, t.py, 4, 5)).toBeNull();
    });
});

describe('the solvers follow the chain rule', () => {
    it('example 3: the shortest clear is one push to the right, which lights column 3', () => {
        const s = board(EXAMPLE);
        expect(minClearMoves(s.grid, s.px, s.py, 40)).toBe(1);
        expect(minClearPlan(s.grid, s.px, s.py, 40)).toEqual(['right']);
        expect(minClearLine(s.grid, s.px, s.py, 40)).toEqual({ horizontal: false, index: 3 });
        const hinted = board(EXAMPLE);
        expect(takeHint(hinted)).toEqual({ kind: 'used', line: { horizontal: false, index: 3 } });
        expect(hinted.moves).toBe(20 - PARAMS.hintCost);
    });

    it('example 3 needs more than one move without chains (old one-block rule, independent oracle)', () => {
        expect(oracleMinOneBlock(EXAMPLE, 40)).toBe(4);
        expect(oracleMin(EXAMPLE, 40)).toBe(1);
    });

    it('matches the independent oracle on seeded boards, and chains really shorten some of them', () => {
        let compared = 0;
        let shorter = 0;
        for (let seed = 1; seed <= 100; seed++) {
            const deps = depsOf(seed);
            const s = createState(deps);
            for (let round = 0; round < 8 && !s.over; round++) {
                const mine = minClearMoves(s.grid, s.px, s.py, PARAMS.maxMoves);
                const reference = oracleMinOf(s, PARAMS.maxMoves, 600000);
                if (mine !== reference) expect.fail(`seed ${seed} round ${round}: ${mine} vs oracle ${reference}\n${render(s).join('\n')}`);
                const old = oracleMinOneBlock(render(s), PARAMS.maxMoves, 600000);
                if (mine !== null && old !== null && mine < old) shorter++;
                compared++;
                const plan = minClearPlan(s.grid, s.px, s.py, PARAMS.maxMoves);
                const lit = minClearLine(s.grid, s.px, s.py, PARAMS.maxMoves);
                if (!plan) break;
                if (plan.length !== mine) expect.fail(`seed ${seed} round ${round}: plan ${plan.length} vs ${mine}`);
                s.moves = PARAMS.maxMoves;
                const results = plan.map((dir) => move(s, dir, deps));
                if (results.slice(0, -1).some((r) => r.clearedRows.length + r.clearedCols.length > 0)) {
                    expect.fail(`seed ${seed} round ${round}: a clear before the last move`);
                }
                const last = results[results.length - 1];
                if (last.clearedRows.length + last.clearedCols.length !== 1) expect.fail(`seed ${seed} round ${round}: no single clear on the last move`);
                // the lit line is the line that the shortest way completes
                const done = last.clearedRows.length > 0 ? { horizontal: true, index: last.clearedRows[0] } : { horizontal: false, index: last.clearedCols[0] };
                if (JSON.stringify(lit) !== JSON.stringify(done)) expect.fail(`seed ${seed} round ${round}: lit ${JSON.stringify(lit)}, cleared ${JSON.stringify(done)}`);
            }
        }
        expect(compared).toBeGreaterThan(200);
        expect(shorter).toBeGreaterThan(0);
    }, 120000);

    it('oracle sanity: allowing chains never makes the shortest clear longer, and changes some random boards', () => {
        const rng = seeded(99);
        let differing = 0;
        for (let i = 0; i < 400; i++) {
            const cells: string[] = Array.from({ length: 30 }, () => (rng() < 0.55 ? '.' : rng() < 0.75 ? 'o' : 'x'));
            cells[Math.floor(rng() * 30)] = '@';
            const rows = [0, 1, 2, 3, 4, 5].map((y) => cells.slice(y * 5, y * 5 + 5).join(''));
            const withChain = oracleMin(rows, 12, 200000);
            const without = oracleMinOneBlock(rows, 12, 200000);
            // every one-block solution is still a solution with chains, so chains never make it longer
            if (without !== null && (withChain === null || withChain > without)) expect.fail(`${rows.join('/')}: ${withChain} > ${without}`);
            if (withChain !== without) differing++;
        }
        expect(differing).toBeGreaterThan(0);
    });

    it('the empty board has no clear and the solver reports none', () => {
        const s = board(EMPTY_ROWS);
        expect(minClearMoves(s.grid, s.px, s.py, 40)).toBeNull();
    });
});
