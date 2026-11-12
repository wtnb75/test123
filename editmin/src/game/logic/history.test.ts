import { describe, expect, it } from 'vitest';
import { canPlaceMine, canSetStart, toBoardText, zoneHasMine } from './board';
import {
    MAX_SIZE,
    MIN_SIZE,
    UNDO_LIMIT,
    clampSize,
    clearMines,
    copySnapshot,
    emptyHistory,
    hasAnyMine,
    historyButtonState,
    historyKeyAction,
    recordMove,
    redo,
    resizeSnapshot,
    snapshotsEqual,
    undo,
    type BoardSnapshot,
    type History,
    type HistoryKeyEvent
} from './history';

/** A snapshot from the mines given as [row, col] pairs. */
function board(width: number, height: number, mines: [number, number][], start: [number, number] | null): BoardSnapshot {
    const flags = Array.from({ length: width * height }, () => false);
    for (const [y, x] of mines) {
        flags[y * width + x] = true;
    }
    return { width, height, mines: flags, startIndex: start === null ? null : start[0] * width + start[1] };
}

const mineIndexes = (s: BoardSnapshot): number[] => s.mines.flatMap((m, i) => (m ? [i] : []));

/** An empty 12 x 12 board with the mines at `indexes`. */
function withMines(indexes: number[]): BoardSnapshot {
    const mines = Array.from({ length: 144 }, (_, i) => indexes.includes(i));
    return { width: 12, height: 12, mines, startIndex: null };
}

describe('history parameters of the spec', () => {
    it('keeps 100 moves, and board sides 2 to 50', () => {
        expect(UNDO_LIMIT).toBe(100);
        expect(MIN_SIZE).toBe(2);
        expect(MAX_SIZE).toBe(50);
    });
});

describe('resizeSnapshot (hand-counted examples, 5 x 4 board, index = row * width + col)', () => {
    const source = board(5, 4, [[0, 4], [3, 2], [2, 0]], [0, 0]);

    it('has the mines at indexes 4, 17, 10 and the start at 0', () => {
        expect(mineIndexes(source)).toEqual([4, 10, 17]);
        expect(source.startIndex).toBe(0);
    });

    it('3 x 3 keeps only the mine at (2,0), now index 6, and the start at 0', () => {
        const next = resizeSnapshot(source, 3, 3);
        expect(next.width).toBe(3);
        expect(next.height).toBe(3);
        expect(mineIndexes(next)).toEqual([6]);
        expect(next.startIndex).toBe(0);
    });

    it('5 x 2 keeps only the mine at (0,4), index 4, and the start at 0', () => {
        const next = resizeSnapshot(source, 5, 2);
        expect(mineIndexes(next)).toEqual([4]);
        expect(next.startIndex).toBe(0);
    });

    it('7 x 5 moves the mines to 4, 14, 23, keeps the start and leaves the new part empty', () => {
        const next = resizeSnapshot(source, 7, 5);
        expect(next.mines).toHaveLength(35);
        expect(mineIndexes(next)).toEqual([4, 14, 23]);
        expect(next.startIndex).toBe(0);
    });

    it('releases a start cell that falls outside and keeps one that stays inside', () => {
        const edge = board(5, 4, [[0, 0]], [3, 4]);
        expect(edge.startIndex).toBe(19);
        const shrunk = resizeSnapshot(edge, 4, 4);
        expect(shrunk.startIndex).toBeNull();
        expect(mineIndexes(shrunk)).toEqual([0]);
        expect(resizeSnapshot(edge, 6, 5).startIndex).toBe(22);
    });

    it('releases a start cell below the new last row', () => {
        expect(resizeSnapshot(board(5, 4, [], [3, 1]), 5, 3).startIndex).toBeNull();
    });

    it('keeps no start cell when there was none', () => {
        expect(resizeSnapshot(board(5, 4, [], null), 8, 8).startIndex).toBeNull();
    });

    it('does not change the source and returns its own arrays', () => {
        const before = copySnapshot(source);
        const same = resizeSnapshot(source, 5, 4);
        expect(source).toEqual(before);
        expect(same).toEqual(source);
        expect(same.mines).not.toBe(source.mines);
    });

    it('matches an independent (row, col) oracle on every size from 2 x 2 to 7 x 7', () => {
        const base = board(4, 3, [[0, 0], [0, 3], [2, 1], [1, 2]], [2, 3]);
        let checked = 0;
        let kept = 0;
        for (let w = 2; w <= 7; w += 1) {
            for (let h = 2; h <= 7; h += 1) {
                const next = resizeSnapshot(base, w, h);
                for (let y = 0; y < h; y += 1) {
                    for (let x = 0; x < w; x += 1) {
                        const inOld = y < 3 && x < 4;
                        const expected = inOld && [[0, 0], [0, 3], [2, 1], [1, 2]].some(([my, mx]) => my === y && mx === x);
                        if (next.mines[y * w + x] !== expected) {
                            expect.fail(`size ${w}x${h}: cell (${y},${x}) is ${next.mines[y * w + x]}, expected ${expected}`);
                        }
                        checked += 1;
                        kept += expected ? 1 : 0;
                    }
                }
                const startKept = h >= 3 && w >= 4;
                if ((next.startIndex !== null) !== startKept) {
                    expect.fail(`size ${w}x${h}: start ${next.startIndex}`);
                }
                if (next.startIndex !== null && next.startIndex !== 2 * w + 3) {
                    expect.fail(`size ${w}x${h}: start moved to ${next.startIndex}`);
                }
            }
        }
        expect(checked).toBeGreaterThan(0);
        expect(kept).toBeGreaterThan(0);
    });
});

describe('clampSize', () => {
    it('rounds 100 down to 50 and 1 up to 2', () => {
        expect(clampSize(100, 12)).toBe(50);
        expect(clampSize(1, 12)).toBe(2);
    });

    it('keeps the boundary values 2 and 50 and floors fractions', () => {
        expect(clampSize(2, 12)).toBe(2);
        expect(clampSize(50, 12)).toBe(50);
        expect(clampSize(7.9, 12)).toBe(7);
    });

    it('keeps the current side for a value that is not a number', () => {
        expect(clampSize(Number.NaN, 12)).toBe(12);
        expect(clampSize(Number.POSITIVE_INFINITY, 9)).toBe(9);
    });

    it('turns 100 x 1 on a 5 x 4 board into 50 x 2 and keeps only the mine at (0,4)', () => {
        const source = board(5, 4, [[0, 4], [3, 2]], null);
        const next = resizeSnapshot(source, clampSize(100, 5), clampSize(1, 4));
        expect([next.width, next.height]).toEqual([50, 2]);
        expect(mineIndexes(next)).toEqual([4]);
    });
});

describe('clearMines and hasAnyMine', () => {
    it('removes every mine and keeps the size and the start cell', () => {
        const source = board(5, 4, [[0, 4], [3, 2], [3, 4]], [1, 1]);
        source.mines[0] = true; // a mine on the first cell too (index 0)
        const cleared = clearMines(source);
        expect(cleared.mines.every((m) => !m)).toBe(true);
        expect(hasAnyMine(cleared)).toBe(false);
        expect(cleared.width).toBe(5);
        expect(cleared.height).toBe(4);
        expect(cleared.startIndex).toBe(6);
        expect(hasAnyMine(source)).toBe(true);
    });

    it('reports an empty board as having no mine', () => {
        expect(hasAnyMine(board(3, 3, [], null))).toBe(false);
    });
});

describe('snapshotsEqual', () => {
    it('is true for equal states and false for any single difference', () => {
        const a = board(3, 3, [[1, 1]], [0, 0]);
        expect(snapshotsEqual(a, copySnapshot(a))).toBe(true);
        expect(snapshotsEqual(a, board(3, 3, [[1, 2]], [0, 0]))).toBe(false);
        expect(snapshotsEqual(a, board(3, 3, [[1, 1]], null))).toBe(false);
        expect(snapshotsEqual(a, board(3, 3, [[1, 1]], [0, 1]))).toBe(false);
        expect(snapshotsEqual(board(2, 3, [], null), board(3, 2, [], null))).toBe(false);
        expect(snapshotsEqual(board(2, 2, [], null), board(2, 3, [], null))).toBe(false);
    });
});

describe('undo and redo', () => {
    it('goes back and forward over two mine moves, then a new move drops the redo side', () => {
        const s0 = withMines([]);
        const s1 = withMines([5]);
        const s2 = withMines([5, 6]);
        let history: History = recordMove(emptyHistory(), s0, s1);
        history = recordMove(history, s1, s2);

        const back = undo(history, s2);
        expect(back).not.toBeNull();
        expect(mineIndexes(back!.snapshot)).toEqual([5]);

        const forward = redo(back!.history, back!.snapshot);
        expect(mineIndexes(forward!.snapshot)).toEqual([5, 6]);

        const again = undo(forward!.history, forward!.snapshot)!;
        const s3 = withMines([5, 7]);
        const branched = recordMove(again.history, again.snapshot, s3);
        expect(branched.future).toEqual([]);
        expect(redo(branched, s3)).toBeNull();
        expect(mineIndexes(s3)).toEqual([5, 7]);
    });

    it('does nothing on an empty history', () => {
        expect(undo(emptyHistory(), withMines([1]))).toBeNull();
        expect(redo(emptyHistory(), withMines([1]))).toBeNull();
    });

    it('does not record a move that changes nothing, and keeps the redo side', () => {
        const s0 = withMines([]);
        const s1 = withMines([5]);
        const history = recordMove(emptyHistory(), s0, s1);
        const undone = undo(history, s1)!;
        expect(undone.history.future).toHaveLength(1);

        const same = recordMove(undone.history, undone.snapshot, copySnapshot(undone.snapshot));
        expect(same).toBe(undone.history);
        expect(same.past).toHaveLength(0);
        expect(same.future).toHaveLength(1);
        expect(redo(same, undone.snapshot)).not.toBeNull();
    });

    it('goes back over a resize that released the start cell and forward again', () => {
        const before = board(5, 4, [[0, 0]], [3, 4]);
        const after = resizeSnapshot(before, 4, 4);
        const history = recordMove(emptyHistory(), before, after);
        const back = undo(history, after)!;
        expect(back.snapshot).toEqual(before);
        const forward = redo(back.history, back.snapshot)!;
        expect(forward.snapshot).toEqual(after);
        expect(forward.snapshot.startIndex).toBeNull();
    });

    it('brings the mines back after a clear-all', () => {
        const before = board(4, 4, [[1, 1], [2, 2]], [0, 0]);
        const after = clearMines(before);
        const back = undo(recordMove(emptyHistory(), before, after), after)!;
        expect(mineIndexes(back.snapshot)).toEqual([5, 10]);
        expect(back.snapshot.startIndex).toBe(0);
    });

    it('goes back over a start cell move', () => {
        const before = board(4, 4, [], null);
        const after = { ...before, startIndex: 5 };
        const back = undo(recordMove(emptyHistory(), before, after), after)!;
        expect(back.snapshot.startIndex).toBeNull();
    });

    it('does not change its inputs and returns its own arrays', () => {
        const s0 = withMines([]);
        const s1 = withMines([5]);
        const history = recordMove(emptyHistory(), s0, s1);
        const pastBefore = history.past.map(copySnapshot);
        const current = copySnapshot(s1);
        const back = undo(history, current)!;
        expect(history.past).toEqual(pastBefore);
        expect(current).toEqual(s1);
        expect(back.snapshot.mines).not.toBe(history.past[0].mines);
        expect(history.future).toEqual([]);
    });
});

describe('moves that change nothing are not recorded', () => {
    it('clear-all on a board without mines and a same-size resize leave the history as it is', () => {
        const empty = board(4, 4, [], [0, 0]);
        const history = recordMove(emptyHistory(), withMines([]), withMines([3]));
        expect(recordMove(history, empty, clearMines(empty))).toBe(history);
        const filled = board(4, 4, [[3, 3]], [0, 0]);
        expect(recordMove(history, filled, resizeSnapshot(filled, 4, 4))).toBe(history);
    });

    it('redo and recordMove do not change their inputs', () => {
        const before = withMines([1]);
        const after = withMines([1, 2]);
        const history: History = { past: [withMines([])], future: [withMines([7])] };
        const futureBefore = history.future.map(copySnapshot);
        const pastBefore = history.past.map(copySnapshot);
        const recorded = recordMove(history, before, after);
        redo(history, after);
        expect(history.future).toEqual(futureBefore);
        expect(history.past).toEqual(pastBefore);
        expect(recorded.past[recorded.past.length - 1].mines).not.toBe(before.mines);
        expect(mineIndexes(before)).toEqual([1]);
    });
});

describe('the history limit', () => {
    it('with limit 3, four moves leave only the states after a, b and c: three undos, the fourth does nothing', () => {
        const states = [0, 1, 2, 3, 4].map((n) => withMines(Array.from({ length: n }, (_, i) => i)));
        let history = emptyHistory();
        for (let i = 0; i < 4; i += 1) {
            history = recordMove(history, states[i], states[i + 1], 3);
        }
        expect(history.past).toHaveLength(3);

        let current = states[4];
        const reached: number[] = [];
        for (let i = 0; i < 3; i += 1) {
            const step = undo(history, current, 3)!;
            history = step.history;
            current = step.snapshot;
            reached.push(mineIndexes(current).length);
        }
        expect(reached).toEqual([3, 2, 1]);
        expect(undo(history, current, 3)).toBeNull();
    });

    it('with the default limit, 101 moves allow exactly 100 undos', () => {
        let history = emptyHistory();
        let current = withMines([]);
        for (let i = 0; i < 101; i += 1) {
            const next = withMines(Array.from({ length: i + 1 }, (_, k) => k));
            history = recordMove(history, current, next);
            current = next;
        }
        let undone = 0;
        for (let step = undo(history, current); step !== null; step = undo(history, current)) {
            history = step.history;
            current = step.snapshot;
            undone += 1;
        }
        expect(undone).toBe(100);
        expect(mineIndexes(current)).toEqual([0]);
    });

    it('redo pushes the current state on the undo side within the limit', () => {
        const a = withMines([1]);
        const b = withMines([2]);
        const c = withMines([3]);
        const history: History = { past: [a, b], future: [c] };
        const step = redo(history, withMines([4]), 2)!;
        expect(step.history.past).toHaveLength(2);
        expect(mineIndexes(step.history.past[0])).toEqual([2]);
        expect(mineIndexes(step.history.past[1])).toEqual([4]);
        expect(mineIndexes(step.snapshot)).toEqual([3]);
    });

    it('undo pushes the current state on the redo side within the limit', () => {
        const history: History = { past: [withMines([1])], future: [withMines([8]), withMines([9])] };
        const step = undo(history, withMines([5]), 2)!;
        expect(step.history.future).toHaveLength(2);
        expect(mineIndexes(step.history.future[0])).toEqual([9]);
        expect(mineIndexes(step.history.future[1])).toEqual([5]);
    });
});

describe('historyKeyAction', () => {
    const press = (key: string, mods: Partial<HistoryKeyEvent> = {}): HistoryKeyEvent => ({
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...mods
    });

    it('Ctrl+Z and Cmd+Z undo', () => {
        expect(historyKeyAction(press('z', { ctrlKey: true }), false, false)).toBe('undo');
        expect(historyKeyAction(press('z', { metaKey: true }), false, false)).toBe('undo');
    });

    it('Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y and Ctrl+Shift+Y redo', () => {
        expect(historyKeyAction(press('Z', { ctrlKey: true, shiftKey: true }), false, false)).toBe('redo');
        expect(historyKeyAction(press('z', { metaKey: true, shiftKey: true }), false, false)).toBe('redo');
        expect(historyKeyAction(press('y', { ctrlKey: true }), false, false)).toBe('redo');
        expect(historyKeyAction(press('Y', { ctrlKey: true, shiftKey: true }), false, false)).toBe('redo');
        expect(historyKeyAction(press('y', { metaKey: true }), false, false)).toBe('redo');
    });

    it('does nothing for Z or Y without Ctrl or Cmd, and for other keys', () => {
        expect(historyKeyAction(press('z'), false, false)).toBeNull();
        expect(historyKeyAction(press('y', { shiftKey: true }), false, false)).toBeNull();
        expect(historyKeyAction(press('x', { ctrlKey: true }), false, false)).toBeNull();
    });

    it('does nothing while typing in an input, during the play, or with Alt held', () => {
        expect(historyKeyAction(press('z', { ctrlKey: true }), true, false)).toBeNull();
        expect(historyKeyAction(press('z', { ctrlKey: true }), false, true)).toBeNull();
        expect(historyKeyAction(press('z', { ctrlKey: true, altKey: true }), false, false)).toBeNull();
    });

    it('does not throw for an event without a key', () => {
        const odd = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false } as unknown as HistoryKeyEvent;
        expect(historyKeyAction(odd, false, false)).toBeNull();
    });
});

describe('historyButtonState', () => {
    const some: History = { past: [withMines([1])], future: [withMines([2])] };

    it('enables each button when its move or mine exists and the play is off', () => {
        expect(historyButtonState(some, true, false)).toEqual({ undoEnabled: true, redoEnabled: true, clearEnabled: true });
    });

    it('disables undo, redo and clear when there is nothing to do', () => {
        expect(historyButtonState(emptyHistory(), false, false)).toEqual({
            undoEnabled: false,
            redoEnabled: false,
            clearEnabled: false
        });
    });

    it('enables only the button whose condition holds', () => {
        expect(historyButtonState({ past: some.past, future: [] }, false, false)).toEqual({
            undoEnabled: true,
            redoEnabled: false,
            clearEnabled: false
        });
        expect(historyButtonState({ past: [], future: some.future }, true, false)).toEqual({
            undoEnabled: false,
            redoEnabled: true,
            clearEnabled: true
        });
    });

    it('disables all three during the play', () => {
        expect(historyButtonState(some, true, true)).toEqual({ undoEnabled: false, redoEnabled: false, clearEnabled: false });
    });
});

describe('regression: the board rules give the hand-counted answers after undo, redo and resize', () => {
    const asGrid = (s: BoardSnapshot) => ({
        width: s.width,
        height: s.height,
        cells: s.mines.map((hasMine) => ({ hasMine }))
    });
    // 5 x 4 board, mines at (0,4) and (2,0), start at (0,0); counted by hand.
    const TEXT_5X4 = 'X 0 0 1 B\n1 1 0 1 1\nB 1 0 0 0\n1 1 0 0 0';
    // The same board cut to 3 x 3: only the mine at (2,0) stays.
    const TEXT_3X3 = 'X 0 0\n1 1 0\nB 1 0';

    it('gives the same board text, start-cell and mine placement answers for an undone, a redone and a resized board', () => {
        const before = board(5, 4, [[0, 4], [2, 0]], [0, 0]);
        const resized = resizeSnapshot(before, 3, 3);
        const history = recordMove(emptyHistory(), before, resized);
        const undone = undo(history, resized)!;
        const redone = redo(undone.history, undone.snapshot)!;

        expect(toBoardText(asGrid(before), before.startIndex)).toBe(TEXT_5X4);
        expect(toBoardText(asGrid(undone.snapshot), undone.snapshot.startIndex)).toBe(TEXT_5X4);
        expect(toBoardText(asGrid(redone.snapshot), redone.snapshot.startIndex)).toBe(TEXT_3X3);
        expect(toBoardText(asGrid(resized), resized.startIndex)).toBe(TEXT_3X3);

        for (const s of [undone.snapshot, redone.snapshot, resized]) {
            const grid = asGrid(s);
            expect(zoneHasMine(grid, s.startIndex!)).toBe(false);
            expect(canSetStart(grid, s.startIndex!)).toBe(true);
            expect(canPlaceMine(grid, s.startIndex, 1)).toBe(false);
            expect(canPlaceMine(grid, s.startIndex, grid.cells.length - 1)).toBe(true);
        }
    });
});
