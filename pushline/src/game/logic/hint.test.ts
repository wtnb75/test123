// The hint (docs/spec/hint.md): which line it lights, when it can be used, what it costs, and how it meets Undo and the bonus.
import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { Flow } from './flow';
import { hintAvailable, HintLight, takeHint } from './hint';
import { LANDSCAPE, PORTRAIT } from './layout';
import { canUndo, createState, move, undo } from './rules';
import { minClearLine, minClearPlan } from './solve';
import { board, depsOf, oracleSolve, render } from './testkit';

// Hand-worked in docs/spec/hint.md: the character at (4,2) pushes (4,3) down into (4,4); row y = 4 completes in 1 move
const ROW_BOARD = ['.....', '.....', '....@', '....o', 'oooo.', '.....'];
// the character at (2,5) pushes (1,5) left into (0,5); column x = 0 completes in 1 move
const COL_BOARD = ['o....', 'o....', 'o....', 'o....', 'o....', '.o@..'];
const NO_BLOCKS = ['.....', '.....', '.....', '.....', '.....', '..@..'];

const lineOf = (rows: string[]) => {
    const s = board(rows);
    return minClearLine(s.grid, s.px, s.py, PARAMS.maxMoves);
};

describe('minClearLine: the line the shortest way completes', () => {
    it('is row y = 4 for the hand-worked row board', () => {
        expect(lineOf(ROW_BOARD)).toEqual({ horizontal: true, index: 4 });
    });

    it('is column x = 0 for the hand-worked column board', () => {
        expect(lineOf(COL_BOARD)).toEqual({ horizontal: false, index: 0 });
    });

    it('is null when no line can be cleared (no blocks at all)', () => {
        expect(lineOf(NO_BLOCKS)).toBeNull();
    });

    it('finds the clear exactly at the limit (1 move) and nothing below it (0)', () => {
        const s = board(ROW_BOARD);
        expect(minClearLine(s.grid, s.px, s.py, 1)).toEqual({ horizontal: true, index: 4 });
        expect(minClearLine(s.grid, s.px, s.py, 0)).toBeNull();
    });

    it('is null when the search runs out of its node cap, and finds the same clear with the default cap', () => {
        // one step to the right first, then the push down: a 2-move clear, so the search must expand nodes first
        const rows = ['.....', '.....', '...@.', '....o', 'oooo.', '.....'];
        const s = board(rows);
        expect(oracleSolve(rows, PARAMS.maxMoves)?.length).toBe(2);
        expect(minClearLine(s.grid, s.px, s.py, PARAMS.maxMoves, 0)).toBeNull();
        expect(minClearLine(s.grid, s.px, s.py, PARAMS.maxMoves)).toEqual({ horizontal: true, index: 4 });
    });

    it('returns one of the two lines when a row and a column are both one push away', () => {
        // (2,2) pushes (1,2) left to fill column 0, or (2,3) down to fill row 4
        const rows = ['o....', 'o....', '.o@..', 'o.o..', 'oo.oo', 'o....'];
        expect(oracleSolve(rows, PARAMS.maxMoves)?.length).toBe(1);
        expect([{ horizontal: false, index: 0 }, { horizontal: true, index: 4 }]).toContainEqual(lineOf(rows));
    });

    it('names the line that the shortest plan actually completes, on 60 seeded boards (plan length checked against the oracle)', () => {
        let checked = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const s = createState(depsOf(seed));
            const line = minClearLine(s.grid, s.px, s.py, PARAMS.maxMoves);
            const plan = minClearPlan(s.grid, s.px, s.py, PARAMS.maxMoves);
            const oracle = oracleSolve(render(s), PARAMS.maxMoves);
            if (!line || !plan) expect.fail(`seed ${seed}: a generated board must have a clear (line ${JSON.stringify(line)})`);
            if (oracle?.length !== plan.length) expect.fail(`seed ${seed}: plan ${plan.length} moves, oracle ${oracle?.length ?? null}`);
            const last = plan.map((dir) => move(s, dir, depsOf(seed))).at(-1);
            const cleared = line.horizontal ? last?.clearedRows : last?.clearedCols;
            if (!cleared?.includes(line.index)) expect.fail(`seed ${seed}: the plan did not complete ${JSON.stringify(line)}`);
            checked += 1;
        }
        expect(checked).toBe(60); // guard against a vacuous run
    });
});

describe('hintAvailable', () => {
    it('needs the hint cost plus one moves: 3 is not enough, 4 is', () => {
        expect(hintAvailable(board(ROW_BOARD, { moves: 3 }))).toBe(false);
        expect(hintAvailable(board(ROW_BOARD, { moves: 4 }))).toBe(true);
        expect(PARAMS.hintMinMoves).toBe(PARAMS.hintCost + 1);
    });

    it('is false once the run is over, however many moves are left', () => {
        expect(hintAvailable(board(ROW_BOARD, { moves: 20, over: true }))).toBe(false);
    });

    it('does not depend on whether a clear is in reach (the button is not dimmed for "no answer")', () => {
        expect(hintAvailable(board(NO_BLOCKS, { moves: 20 }))).toBe(true);
    });
});

describe('takeHint', () => {
    it('pays 3 moves and returns the line (20 -> 17); nothing else changes', () => {
        const s = board(ROW_BOARD, { moves: 20, spent: 2, shortest: 1 });
        const before = JSON.stringify({ ...s, moves: 0 });
        expect(takeHint(s)).toEqual({ kind: 'used', line: { horizontal: true, index: 4 } });
        expect(s.moves).toBe(17);
        expect(JSON.stringify({ ...s, moves: 0 })).toBe(before); // board, position, score, history, spent, shortest, bonusCount
    });

    it('works with 4 moves and leaves 1: the hint alone never ends the run', () => {
        const s = board(ROW_BOARD, { moves: 4 });
        expect(takeHint(s).kind).toBe('used');
        expect(s.moves).toBe(1);
        expect(s.over).toBe(false);
    });

    it('is unusable with 3 moves: the moves stay at 3', () => {
        const s = board(ROW_BOARD, { moves: 3 });
        expect(takeHint(s)).toEqual({ kind: 'unusable' });
        expect(s.moves).toBe(3);
    });

    it('is unusable once the run is over', () => {
        const s = board(ROW_BOARD, { moves: 10, over: true });
        expect(takeHint(s)).toEqual({ kind: 'unusable' });
        expect(s.moves).toBe(10);
    });

    it('is unusable, and charges nothing, when no clear is in reach', () => {
        const s = board(NO_BLOCKS, { moves: 20 });
        expect(takeHint(s)).toEqual({ kind: 'unusable' });
        expect(s.moves).toBe(20);
    });

    it('lights the line even when the shortest way is longer than the moves left after paying', () => {
        // the plan needs several moves; only 1 will be left
        const s = board(['.....', '.....', 'oo.oo', '..o..', '.....', '@....'], { moves: 4 });
        // 3 steps to (2,4), then the push up: 4 moves, while only 1 move is left after paying
        expect(oracleSolve(render(s), PARAMS.maxMoves)?.length).toBe(4);
        expect(takeHint(s)).toEqual({ kind: 'used', line: { horizontal: true, index: 2 } });
        expect(s.moves).toBe(1);
    });

    it('does not put the hint into the undo history', () => {
        const s = board(ROW_BOARD, { moves: 20 });
        takeHint(s);
        expect(s.history).toHaveLength(0);
        expect(canUndo(s)).toBe(false);
        expect(undo(s)).toBe(false);
        expect(s.moves).toBe(17);
    });
});

describe('HintLight: the press outcomes and when the lit line goes out', () => {
    const ROW = { horizontal: true, index: 4 };

    it('lights the line and pays 3 on the first press (20 -> 17)', () => {
        const s = board(ROW_BOARD, { moves: 20 });
        const light = new HintLight();
        expect(light.press(s, true)).toEqual({ kind: 'lit', line: ROW });
        expect(light.line).toEqual(ROW);
        expect(s.moves).toBe(17);
    });

    it('ignores a second press while lit: no payment, no shake', () => {
        const s = board(ROW_BOARD, { moves: 20 });
        const light = new HintLight();
        light.press(s, true);
        expect(light.press(s, true)).toEqual({ kind: 'ignore' });
        expect(s.moves).toBe(17);
    });

    it('asks for a shake when it cannot be used while playing (3 moves, or nothing in reach), without paying', () => {
        const few = board(ROW_BOARD, { moves: 3 });
        expect(new HintLight().press(few, true)).toEqual({ kind: 'shake' });
        expect(few.moves).toBe(3);
        const none = board(NO_BLOCKS, { moves: 20 });
        const light = new HintLight();
        expect(light.press(none, true)).toEqual({ kind: 'shake' });
        expect(none.moves).toBe(20);
        expect(light.line).toBeNull();
    });

    it('ignores the press in the ending phase, without a shake and without paying', () => {
        const s = board(ROW_BOARD, { moves: 20 });
        expect(new HintLight().press(s, false)).toEqual({ kind: 'ignore' });
        expect(s.moves).toBe(20);
    });

    it('ignores the press once the run is over', () => {
        const s = board(ROW_BOARD, { moves: 20, over: true });
        expect(new HintLight().press(s, true)).toEqual({ kind: 'ignore' });
    });

    it('goes out with a real move or a real Undo, and reports that it did', () => {
        const light = new HintLight();
        light.press(board(ROW_BOARD, { moves: 20 }), true);
        expect(light.onMoved()).toBe(true);
        expect(light.line).toBeNull();
        light.press(board(ROW_BOARD, { moves: 20 }), true);
        expect(light.onUndone()).toBe(true);
        expect(light.line).toBeNull();
    });

    it('reports nothing to redraw when it was not lit, and can be lit again afterwards', () => {
        const light = new HintLight();
        expect(light.onMoved()).toBe(false);
        expect(light.onUndone()).toBe(false);
        const s = board(ROW_BOARD, { moves: 20 });
        light.press(s, true);
        light.onMoved();
        expect(light.press(s, true)).toEqual({ kind: 'lit', line: ROW });
        expect(s.moves).toBe(14); // paid again: 20 - 3 - 3
    });

    it('stays lit when nothing calls it: a blocked input, a failed tap and an empty-history Undo do not call onMoved / onUndone', () => {
        const s = board(ROW_BOARD, { moves: 20 });
        const light = new HintLight();
        light.press(s, true);
        expect(move(s, 'right', depsOf(1)).moved).toBe(false); // the right edge: blocked, so the Scene never calls onMoved
        expect(undo(s)).toBe(false); // empty history: the Scene never calls onUndone
        expect(light.line).toEqual(ROW);
    });
});

describe('hint and Undo', () => {
    it('gives back only the 1 of the undone move: 20 -> move 19 -> hint 16 -> undo 17', () => {
        const s = board(['.....', '.....', '....@', '....o', 'oooo.', '.....'], { moves: 20 });
        const rowsBefore = render(s);
        expect(move(s, 'left', depsOf(1)).moved).toBe(true);
        expect(s.moves).toBe(19);
        expect(takeHint(s).kind).toBe('used');
        expect(s.moves).toBe(16);
        expect(undo(s)).toBe(true);
        expect(s.moves).toBe(17);
        expect(render(s)).toEqual(rowsBefore);
    });

    it('without a hint, Undo still returns the moves to what they were before the move', () => {
        const s = board(ROW_BOARD, { moves: 20 });
        move(s, 'left', depsOf(1));
        move(s, 'left', depsOf(1));
        undo(s);
        expect(s.moves).toBe(19);
        undo(s);
        expect(s.moves).toBe(20);
    });

    it('two hints between moves are both kept paid after the undo', () => {
        const s = board(ROW_BOARD, { moves: 30 });
        move(s, 'left', depsOf(1)); // 29
        expect(takeHint(s).kind).toBe('used'); // 26
        move(s, 'left', depsOf(1)); // 25
        expect(takeHint(s).kind).toBe('used'); // 22
        undo(s);
        expect(s.moves).toBe(23);
        undo(s);
        expect(s.moves).toBe(24);
    });
});

describe('hint and the shortest-clear bonus', () => {
    it('does not count the hint in the spent moves: hint (20 -> 17), then the 1-move clear earns the bonus (17 - 1 + 11 + 4 = 31)', () => {
        const s = board(ROW_BOARD, { moves: 20, shortest: 1 });
        takeHint(s);
        expect(s.spent).toBe(0);
        const res = move(s, 'down', depsOf(1));
        expect(res.clearedRows).toEqual([4]);
        expect(res.bonus).toBe(true);
        expect(res.recovered).toBe(15);
        expect(s.moves).toBe(31);
        expect(s.score).toBe(1);
        expect(s.bonusCount).toBe(1);
    });

    it('still gives only the base recovery for a detour after a hint', () => {
        const s = board(ROW_BOARD, { moves: 20, shortest: 1 });
        takeHint(s);
        move(s, 'left', depsOf(1));
        move(s, 'right', depsOf(1));
        const res = move(s, 'down', depsOf(1));
        expect(res.clearedRows).toEqual([4]);
        expect(res.bonus).toBe(false);
        expect(s.moves).toBe(17 - 3 + 11);
    });
});

describe('the hint button in the pointer flow', () => {
    it('is reported as a hint action and the press is not a tap or swipe', () => {
        const flow = new Flow();
        const b = PORTRAIT.hintButton;
        expect(flow.pointerDown(1, b.x + b.w / 2, b.y + b.h / 2, PORTRAIT)).toEqual({ kind: 'hint' });
        expect(flow.pointerUp(1, b.x + b.w / 2, b.y + b.h / 2)).toEqual({ kind: 'none' });
    });

    it('does nothing when the run is ending', () => {
        const flow = new Flow();
        flow.beginEnding(0);
        const b = LANDSCAPE.hintButton;
        expect(flow.pointerDown(1, b.x + b.w / 2, b.y + b.h / 2, LANDSCAPE)).toEqual({ kind: 'none' });
    });
});

describe('hint button size on the smallest phones (docs/spec.md 4.6)', () => {
    const scale = (w: number, h: number, l: typeof PORTRAIT) => Math.min(w / l.viewW, h / l.viewH);

    it('is at least 44 px in each portrait screen the spec names, and in landscape 800 x 360', () => {
        const cases: [number, number, typeof PORTRAIT][] = [[375, 550, PORTRAIT], [390, 844, PORTRAIT], [800, 360, LANDSCAPE]];
        cases.forEach(([w, h, l]) => {
            const k = scale(w, h, l);
            [l.undoButton, l.hintButton, l.quitButton].forEach((b) => {
                expect(b.w * k).toBeGreaterThanOrEqual(44);
                expect(b.h * k).toBeGreaterThanOrEqual(44);
            });
        });
    });

    it('is exempt on landscape 667 x 310, where 80 px shrinks to about 41 px (the H key covers it)', () => {
        expect(LANDSCAPE.hintButton.h * scale(667, 310, LANDSCAPE)).toBeLessThan(44);
    });
});
