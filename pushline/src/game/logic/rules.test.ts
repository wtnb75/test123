import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { DIRS, DIR_LIST, fullLineExists } from './grid';
import { canUndo, createState, move, tapOutcome, undo } from './rules';
import { board, count, depsOf, EMPTY_ROWS, oracleMinOf, render, seeded } from './testkit';
import { FIXED, MOVABLE, type Dir } from './types';

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

// A row 5 that one push (down, from (4, 3) onto the block at (4, 4)) completes.
const ROW_CLEAR = ['.....', '.....', '.....', '....@', '....o', 'oooo.'];

describe('createState', () => {
    it('starts with the character at the bottom centre and the starting moves', () => {
        const s = createState(depsOf(1));
        expect([s.px, s.py]).toEqual([2, 5]);
        expect(s.moves).toBe(30);
        expect(s.score).toBe(0);
        expect(s.over).toBe(false);
        expect(s.history).toEqual([]);
    });

    it('places exactly three fixed blocks, never on the character, and no completed line', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const s = createState(depsOf(seed));
            if ([s.px, s.py, s.moves].join() !== '2,5,30') expect.fail(`seed ${seed}: start ${s.px},${s.py} moves ${s.moves}`);
            if (count(s.grid, FIXED) !== 3) expect.fail(`seed ${seed}: ${count(s.grid, FIXED)} fixed blocks`);
            if (s.grid[s.py][s.px] !== 0) expect.fail(`seed ${seed}: a block on the character`);
            if (fullLineExists(s.grid)) expect.fail(`seed ${seed}: a completed line at the start`);
            if (count(s.grid, MOVABLE) === 0) expect.fail(`seed ${seed}: no movable block`);
        }
    });

    it('gives a board from which a line can be cleared (checked by an independent search)', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const s = createState(depsOf(seed));
            if (oracleMinOf(s, 40, 600000) === null) expect.fail(`seed ${seed}: not clearable\n${render(s).join('\n')}`);
        }
    });
});

describe('move: plain steps', () => {
    it('steps into an empty cell, costs one move and records one undo step', () => {
        const s = board(EMPTY_ROWS);
        const res = move(s, 'up', depsOf(1));
        expect(res.moved).toBe(true);
        expect(res.pushed).toBe(false);
        expect([s.px, s.py]).toEqual([2, 4]);
        expect(s.moves).toBe(19);
        expect(s.history).toHaveLength(1);
    });

    it('does not step off the board', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@....']);
        const res = move(s, 'left', depsOf(1));
        expect(res.moved).toBe(false);
        expect([s.px, s.py, s.moves, s.history.length]).toEqual([0, 5, 20, 0]);
    });

    it('does not step into a fixed block', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.x@..']);
        expect(move(s, 'left', depsOf(1)).moved).toBe(false);
        expect([s.px, s.moves]).toEqual([2, 20]);
    });
});

describe('move: pushing', () => {
    it('pushes the block one cell and takes its place', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@o..']);
        const res = move(s, 'right', depsOf(1));
        expect(res.moved).toBe(true);
        expect(res.pushed).toBe(true);
        expect(render(s)[5]).toBe('..@o.');
        expect(s.moves).toBe(19);
    });

    it('pushes upward too', () => {
        const s = board(['.....', '.....', '.....', '.....', '..o..', '..@..']);
        expect(move(s, 'up', depsOf(1)).pushed).toBe(true);
        expect(render(s)[3]).toBe('..o..');
        expect(render(s)[4]).toBe('..@..');
    });

    it('cannot push a block above another block (two in a column)', () => {
        const s = board(['.....', '.....', '.....', '..o..', '..o..', '..@..']);
        expect(move(s, 'up', depsOf(1)).moved).toBe(false);
    });

    it('cannot push a block into another movable block', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@oo.']);
        expect(move(s, 'right', depsOf(1)).moved).toBe(false);
        expect(render(s)[5]).toBe('.@oo.');
        expect(s.moves).toBe(20);
        expect(s.history).toHaveLength(0);
    });

    it('cannot push a block into a fixed block', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@ox.']);
        expect(move(s, 'right', depsOf(1)).moved).toBe(false);
    });

    it('cannot push a block against the edge of the board', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '...@o']);
        expect(move(s, 'right', depsOf(1)).moved).toBe(false);
    });

    it('never pushes two blocks at once', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@oo..']);
        move(s, 'right', depsOf(1));
        expect(render(s)[5]).toBe('@oo..');
    });
});

describe('move: line clears', () => {
    it('clears a completed row, scores 1 and recovers 12 moves', () => {
        const s = board(ROW_CLEAR);
        const res = move(s, 'down', depsOf(7));
        expect(res.clearedRows).toEqual([5]);
        expect(res.clearedCols).toEqual([]);
        expect(res.cleared.map(key).sort()).toEqual(['0,5', '1,5', '2,5', '3,5', '4,5']);
        expect(res.cleared.every((p) => p.kind === MOVABLE)).toBe(true);
        expect(s.score).toBe(1);
        expect(s.moves).toBe(20 - 1 + 12);
        expect(s.over).toBe(false);
    });

    it('clears a completed column', () => {
        const s = board(['....o', '....o', '....o', '....o', '....o', '..@o.']);
        const res = move(s, 'right', depsOf(7));
        expect(res.clearedCols).toEqual([4]);
        expect(res.clearedRows).toEqual([]);
        expect(res.cleared).toHaveLength(6);
        expect(s.score).toBe(1);
    });

    it('removes fixed blocks that are part of the completed line', () => {
        const s = board(['.....', '.....', '.....', '....@', '....o', 'oxoo.']);
        const res = move(s, 'down', depsOf(7));
        expect(res.cleared).toHaveLength(5);
        expect(res.cleared.filter((p) => p.kind === FIXED).map(key)).toEqual(['1,5']);
    });

    it('only judges the row and column the pushed block entered', () => {
        // row 0 is already complete but not touched by the push, so it stays
        const s = board(['xxxxx', '.....', '.....', '....@', '....o', 'oooo.']);
        const res = move(s, 'down', depsOf(7));
        expect(res.clearedRows).toEqual([5]);
        expect(s.grid[0].every((c) => c === FIXED)).toBe(true);
    });

    it('a push along a row that only moves a block inside it clears nothing (the vacated cell stays a gap)', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@o.oo']);
        const res = move(s, 'right', depsOf(7));
        expect(res.moved).toBe(true);
        expect(res.clearedRows).toEqual([]);
        expect(s.score).toBe(0);
        expect(render(s)[5]).toBe('.@ooo');
    });

    it('caps the recovered moves at the maximum', () => {
        const s = board(ROW_CLEAR, { moves: 35 });
        move(s, 'down', depsOf(7));
        expect(s.moves).toBe(PARAMS.maxMoves);
    });

    it('recovers exactly up to the maximum without going over', () => {
        const s = board(ROW_CLEAR, { moves: 29 });
        move(s, 'down', depsOf(7));
        expect(s.moves).toBe(40); // 29 - 1 + 12 = 40
    });

    it('survives with one move left when that move clears a line', () => {
        const s = board(ROW_CLEAR, { moves: 1 });
        move(s, 'down', depsOf(7));
        expect(s.moves).toBe(12);
        expect(s.over).toBe(false);
    });

    it('empties the undo history at a clear', () => {
        const s = board(ROW_CLEAR);
        move(s, 'left', depsOf(7));
        expect(s.history).toHaveLength(1);
        move(s, 'right', depsOf(7));
        move(s, 'down', depsOf(7));
        expect(s.score).toBe(1);
        expect(s.history).toHaveLength(0);
    });
});

describe('move: moves recovered by a clear (the "+N" shown to the player)', () => {
    it('is the full 12 when there is room', () => {
        const s = board(ROW_CLEAR, { moves: 20 });
        expect(move(s, 'down', depsOf(7)).recovered).toBe(12);
        expect(s.moves).toBe(31);
    });

    it('is the part that fits under the cap: 35 -> 34 after the step -> 40 gives 6', () => {
        const s = board(ROW_CLEAR, { moves: 35 });
        expect(move(s, 'down', depsOf(7)).recovered).toBe(6);
        expect(s.moves).toBe(40);
    });

    it('is 1 when the push is made at the cap: 40 -> 39 -> 40', () => {
        const s = board(ROW_CLEAR, { moves: 40 });
        expect(move(s, 'down', depsOf(7)).recovered).toBe(1);
    });

    it('is exactly 12 when the result lands on the cap (29 -> 28 -> 40)', () => {
        const s = board(ROW_CLEAR, { moves: 29 });
        expect(move(s, 'down', depsOf(7)).recovered).toBe(12);
    });

    it('is 0 for a move that clears nothing', () => {
        const s = board(EMPTY_ROWS);
        expect(move(s, 'up', depsOf(1)).recovered).toBe(0);
    });

    it('is 0 for a blocked move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@....']);
        expect(move(s, 'left', depsOf(1)).recovered).toBe(0);
    });
});

describe('canUndo', () => {
    it('is false at the start (empty history)', () => {
        expect(canUndo(board(EMPTY_ROWS))).toBe(false);
    });

    it('is true after a move', () => {
        const s = board(EMPTY_ROWS);
        move(s, 'up', depsOf(1));
        expect(canUndo(s)).toBe(true);
    });

    it('is false again once everything has been undone', () => {
        const s = board(EMPTY_ROWS);
        move(s, 'up', depsOf(1));
        undo(s);
        expect(canUndo(s)).toBe(false);
    });

    it('is false right after a clear (the history is emptied)', () => {
        const s = board(ROW_CLEAR);
        move(s, 'down', depsOf(7));
        expect(canUndo(s)).toBe(false);
    });

    it('is false when the run is over even with history left', () => {
        const s = board(EMPTY_ROWS, { moves: 1 });
        move(s, 'up', depsOf(1));
        expect(s.history).toHaveLength(1);
        expect(canUndo(s)).toBe(false);
    });
});

describe('move: after a clear', () => {
    it('leaves no completed line and keeps the character\'s cell free', () => {
        for (let seed = 1; seed <= 25; seed++) {
            const s = board(ROW_CLEAR);
            move(s, 'down', depsOf(seed));
            if (fullLineExists(s.grid)) expect.fail(`seed ${seed}: a completed line after the clear`);
            if (s.grid[s.py][s.px] !== 0) expect.fail(`seed ${seed}: a block on the character`);
        }
    });

    it('tops the fixed blocks up using the updated score', () => {
        // score 1 -> 2 at this clear: the target goes from 3 to 4 fixed blocks
        const s = board(['x....', '.....', '..x.x', '....@', '....o', 'oooo.'], { score: 1 });
        expect(count(s.grid, FIXED)).toBe(3);
        const res = move(s, 'down', depsOf(11));
        expect(count(s.grid, FIXED)).toBe(4);
        expect(res.spawned.filter((p) => p.kind === FIXED)).toHaveLength(1);
    });

    it('thins leftovers down to two and reports what it removed', () => {
        const s = board(['o.o.o', '.o.o.', '.....', '....@', '....o', 'oooo.']);
        const res = move(s, 'down', depsOf(5));
        // 5 leftover movable blocks, 2 are kept: 3 are thinned out and reported as pruned
        expect(res.pruned).toHaveLength(3);
        const prunedKeys = new Set(res.pruned.map(key));
        const originals = ['0,0', '2,0', '4,0', '1,1', '3,1'];
        expect(originals.filter((k) => prunedKeys.has(k))).toHaveLength(3);
        expect(originals.filter((k) => !prunedKeys.has(k)).every((k) => {
            const [x, y] = k.split(',').map(Number);
            return s.grid[y][x] === MOVABLE;
        })).toBe(true);
    });
});

describe('move: ending the run', () => {
    it('ends when a plain move uses the last move', () => {
        const s = board(EMPTY_ROWS, { moves: 1 });
        move(s, 'up', depsOf(1));
        expect(s.moves).toBe(0);
        expect(s.over).toBe(true);
    });

    it('ends when a push that clears nothing uses the last move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@o..'], { moves: 1 });
        const res = move(s, 'right', depsOf(1));
        expect(res.pushed).toBe(true);
        expect(res.clearedRows).toEqual([]);
        expect(s.moves).toBe(0);
        expect(s.over).toBe(true);
    });

    it('does nothing after the run is over', () => {
        const s = board(EMPTY_ROWS, { moves: 5, over: true });
        const res = move(s, 'up', depsOf(1));
        expect(res.moved).toBe(false);
        expect([s.px, s.py, s.moves]).toEqual([2, 5, 5]);
    });
});

describe('undo', () => {
    it('restores the board, the position and the moves of the last step', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.@o..']);
        move(s, 'right', depsOf(1));
        expect(undo(s)).toBe(true);
        expect(render(s)[5]).toBe('.@o..');
        expect(s.moves).toBe(20);
        expect(s.history).toHaveLength(0);
    });

    it('goes back one step per call', () => {
        const s = board(EMPTY_ROWS);
        move(s, 'up', depsOf(1));
        move(s, 'up', depsOf(1));
        undo(s);
        expect([s.px, s.py, s.moves]).toEqual([2, 4, 19]);
        undo(s);
        expect([s.px, s.py, s.moves]).toEqual([2, 5, 20]);
    });

    it('does nothing with an empty history', () => {
        const s = board(EMPTY_ROWS);
        expect(undo(s)).toBe(false);
        expect([s.px, s.py, s.moves]).toEqual([2, 5, 20]);
    });

    it('does nothing after the run is over and keeps the history', () => {
        const s = board(EMPTY_ROWS, { moves: 1 });
        move(s, 'up', depsOf(1));
        expect(s.over).toBe(true);
        expect(undo(s)).toBe(false);
        expect(s.history).toHaveLength(1);
        expect(s.moves).toBe(0);
    });

    it('leaves the score alone', () => {
        const s = board(EMPTY_ROWS, { score: 4 });
        move(s, 'up', depsOf(1));
        undo(s);
        expect(s.score).toBe(4);
    });

    it('keeps at most the history cap, dropping the oldest steps', () => {
        const s = board(EMPTY_ROWS);
        const deps = depsOf(1, undefined, 3);
        const dirs: Dir[] = ['up', 'left', 'down', 'right', 'up'];
        dirs.forEach((d) => move(s, d, deps));
        expect(s.history).toHaveLength(3);
        // the 3 kept steps are the last three; undoing them all lands after the first two moves
        undo(s);
        undo(s);
        undo(s);
        expect([s.px, s.py, s.moves]).toEqual([1, 4, 18]);
        expect(undo(s)).toBe(false);
    });
});

describe('tapOutcome', () => {
    it('does nothing for the character\'s own cell', () => {
        expect(tapOutcome(board(EMPTY_ROWS), 2, 5)).toEqual({ kind: 'none' });
    });

    it('walks to a reachable empty cell with the shortest path', () => {
        const out = tapOutcome(board(EMPTY_ROWS), 2, 3);
        expect(out).toEqual({ kind: 'walk', path: ['up', 'up'] });
    });

    it('fails for an empty cell that is walled off', () => {
        const s = board(['.....', '.....', '.....', '.....', 'ooooo', '..@..']);
        expect(tapOutcome(s, 2, 2)).toEqual({ kind: 'fail' });
    });

    it('pushes an adjacent movable block that can move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.o@..']);
        expect(tapOutcome(s, 1, 5)).toEqual({ kind: 'push', dir: 'left' });
    });

    it('fails for an adjacent movable block that cannot move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', 'oo@..']);
        expect(tapOutcome(s, 1, 5)).toEqual({ kind: 'fail' });
    });

    it('fails for a movable block that is not adjacent', () => {
        const s = board(['.....', '.....', '.....', '.....', '.o...', '..@..']);
        expect(tapOutcome(s, 1, 4)).toEqual({ kind: 'fail' }); // diagonal
        const t = board(['.....', '.....', '.....', '.....', '.....', 'o.@..']);
        expect(tapOutcome(t, 0, 5)).toEqual({ kind: 'fail' }); // two cells away
    });

    it('fails for a fixed block', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '.x@..']);
        expect(tapOutcome(s, 1, 5)).toEqual({ kind: 'fail' });
    });
});

// ---- oracle: a separately written step function on plain strings ------------------------------

/** Reference semantics of one step on an ASCII board (player as '@'). */
function reference(rows: string[], dir: Dir) {
    const g = rows.map((r) => [...r.replace('@', '.')]);
    const py = rows.findIndex((r) => r.includes('@'));
    const px = rows[py].indexOf('@');
    const nx = px + DIRS[dir].x;
    const ny = py + DIRS[dir].y;
    const at = (x: number, y: number) => g[y]?.[x];
    if (at(nx, ny) === undefined || at(nx, ny) === 'x') return { moved: false };
    let dest: [number, number] | null = null;
    if (at(nx, ny) === 'o') {
        const bx = nx + DIRS[dir].x;
        const by = ny + DIRS[dir].y;
        if (at(bx, by) !== '.') return { moved: false };
        g[by][bx] = 'o';
        g[ny][nx] = '.';
        dest = [bx, by];
    }
    const rowDone = dest !== null && g[dest[1]].every((c) => c !== '.');
    const colDone = dest !== null && g.every((r) => r[dest![0]] !== '.');
    return { moved: true, g, px: nx, py: ny, cleared: rowDone || colDone };
}

describe('move against a reference implementation', () => {
    it('matches on random boards, covering blocked, plain, pushed and clearing moves', () => {
        const rng = seeded(12345);
        const outcomes = { blocked: 0, plain: 0, pushed: 0, cleared: 0 };
        for (let i = 0; i < 1500; i++) {
            // random board, with the player on a random cell
            const cells: string[] = Array.from({ length: 30 }, () => {
                const r = rng();
                return r < 0.5 ? '.' : r < 0.8 ? 'o' : 'x';
            });
            const p = Math.floor(rng() * 30);
            cells[p] = '@';
            const rows = [0, 1, 2, 3, 4, 5].map((y) => cells.slice(y * 5, y * 5 + 5).join(''));
            const s = board(rows);
            if (fullLineExists(s.grid)) continue;
            const dir = DIR_LIST[Math.floor(rng() * 4)];
            const ref = reference(rows, dir);
            const res = move(s, dir, depsOf(i + 1));

            if (res.moved !== ref.moved) expect.fail(`board ${rows.join('/')} ${dir}: moved ${res.moved}, expected ${ref.moved}`);
            if (!ref.moved) {
                outcomes.blocked++;
                continue;
            }
            if (ref.cleared) {
                outcomes.cleared++;
                if (res.clearedRows.length + res.clearedCols.length === 0) expect.fail(`board ${rows.join('/')} ${dir}: no clear`);
                continue;
            }
            if (res.clearedRows.length + res.clearedCols.length !== 0) expect.fail(`board ${rows.join('/')} ${dir}: unexpected clear`);
            outcomes[res.pushed ? 'pushed' : 'plain']++;
            const expected = ref.g!.map((r, y) => r.map((c, x) => (x === ref.px && y === ref.py ? '@' : c)).join(''));
            if (render(s).join('/') !== expected.join('/')) {
                expect.fail(`board ${rows.join('/')} ${dir}: got ${render(s).join('/')}, expected ${expected.join('/')}`);
            }
            if (s.moves !== 19) expect.fail(`board ${rows.join('/')} ${dir}: moves ${s.moves}`);
        }
        expect(outcomes.blocked).toBeGreaterThan(0);
        expect(outcomes.plain).toBeGreaterThan(0);
        expect(outcomes.pushed).toBeGreaterThan(0);
        expect(outcomes.cleared).toBeGreaterThan(0);
    });
});
