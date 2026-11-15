import { describe, expect, it } from 'vitest';
import { createBinaryBoard, resizeBinaryBoard } from './board';
import { applyEditClick, applyEditDrag, getDragRange } from './editOps';
import { generateColHints, generateRowHints } from './hints';
import {
    UNDO_LIMIT,
    canRedo,
    canUndo,
    createHistory,
    decideHistoryKey,
    layoutEditRow,
    recordMove,
    redoMove,
    snapshotToBoard,
    snapshotsEqual,
    takeSnapshot,
    undoMove,
    type BoardSnapshot,
    type History,
    type HistoryKeyInput,
} from './history';
import { exportPBM, importPBM } from './pbm';
import { analyzePuzzle } from './solver';
import type { BinaryCell } from './types';

/** An empty board with the given cells (x, y) filled. */
function boardWith(width: number, height: number, filled: Array<[number, number]>): BinaryCell[][] {
    const board = createBinaryBoard(width, height, 0);
    for (const [x, y] of filled) {
        board[y][x] = 1;
    }
    return board;
}

function filledCells(snapshot: BoardSnapshot): string[] {
    const cells: string[] = [];
    snapshot.cells.forEach((row, y) => row.forEach((cell, x) => {
        if (cell === 1) {
            cells.push(`${x},${y}`);
        }
    }));
    return cells;
}

/** Applies a move to the live board the way the Scene does: snapshot, edit, record. */
function move(history: History, board: BinaryCell[][] | (() => BinaryCell[][]), edit: () => void, limit?: number): History {
    // a getter lets an edit replace the whole board (clear, resize, import)
    const current = (): BinaryCell[][] => (typeof board === 'function' ? board() : board);
    const before = takeSnapshot(current());
    edit();
    return recordMove(history, before, takeSnapshot(current()), limit);
}

describe('snapshots', () => {
    it('keeps its cells when the live board is edited afterwards', () => {
        const board = boardWith(5, 5, [[0, 0]]);
        const snapshot = takeSnapshot(board);
        board[0][0] = 0;
        board[1][1] = 1;
        expect(filledCells(snapshot)).toEqual(['0,0']);
    });

    it('hands out a copy of its cells so editing the live board cannot change the snapshot', () => {
        const snapshot = takeSnapshot(boardWith(5, 5, [[2, 2]]));
        const live = snapshotToBoard(snapshot);
        live[2][2] = 0;
        expect(filledCells(snapshot)).toEqual(['2,2']);
    });

    it('records width and height from the board', () => {
        const snapshot = takeSnapshot(createBinaryBoard(7, 6, 0));
        expect([snapshot.width, snapshot.height]).toEqual([7, 6]);
    });

    it('treats boards of different size as different even if all cells are empty', () => {
        expect(snapshotsEqual(takeSnapshot(createBinaryBoard(5, 5, 0)), takeSnapshot(createBinaryBoard(5, 6, 0)))).toBe(false);
        expect(snapshotsEqual(takeSnapshot(createBinaryBoard(5, 5, 0)), takeSnapshot(createBinaryBoard(6, 5, 0)))).toBe(false);
    });

    it('treats boards that differ in one cell as different', () => {
        expect(snapshotsEqual(takeSnapshot(boardWith(5, 5, [[4, 4]])), takeSnapshot(createBinaryBoard(5, 5, 0)))).toBe(false);
        expect(snapshotsEqual(takeSnapshot(boardWith(5, 5, [[4, 4]])), takeSnapshot(boardWith(5, 5, [[4, 4]])))).toBe(true);
    });
});

describe('history of clicks', () => {
    it('undoes and redoes two clicks one at a time', () => {
        const board = createBinaryBoard(10, 10, 0);
        let history = createHistory();
        history = move(history, board, () => applyEditClick(board, 0, 0));
        history = move(history, board, () => applyEditClick(board, 1, 0));

        const undone = undoMove(history, takeSnapshot(board));
        expect(undone).not.toBeNull();
        expect(filledCells(undone!.board)).toEqual(['0,0']);

        const redone = redoMove(undone!.history, undone!.board);
        expect(filledCells(redone!.board)).toEqual(['0,0', '1,0']);
    });

    it('drops the redo side when a new move follows an undo', () => {
        const board = createBinaryBoard(10, 10, 0);
        let history = createHistory();
        history = move(history, board, () => applyEditClick(board, 0, 0));
        history = move(history, board, () => applyEditClick(board, 1, 0));

        const undone = undoMove(history, takeSnapshot(board))!;
        const live = snapshotToBoard(undone.board);
        const next = move(undone.history, live, () => applyEditClick(live, 2, 0));

        expect(canRedo(next)).toBe(false);
        expect(redoMove(next, takeSnapshot(live))).toBeNull();
        expect(filledCells(takeSnapshot(live))).toEqual(['0,0', '2,0']);
    });

    it('does nothing for undo and redo on an empty history', () => {
        const current = takeSnapshot(createBinaryBoard(5, 5, 0));
        expect(undoMove(createHistory(), current)).toBeNull();
        expect(redoMove(createHistory(), current)).toBeNull();
        expect(canUndo(createHistory())).toBe(false);
        expect(canRedo(createHistory())).toBe(false);
    });

    it('returns the same history for an unchanged board, so the redo side survives (real resize / clear cases are tested below)', () => {
        const board = createBinaryBoard(10, 10, 0);
        let history = createHistory();
        history = move(history, board, () => applyEditClick(board, 0, 0));
        const undone = undoMove(history, takeSnapshot(board))!;
        const live = snapshotToBoard(undone.board);

        // an edit that changes nothing
        const resized = move(undone.history, live, () => undefined);
        expect(resized).toBe(undone.history);
        expect(canRedo(resized)).toBe(true);
        expect(canUndo(resized)).toBe(false);
    });

    it('does not mutate the history it is given', () => {
        const board = createBinaryBoard(5, 5, 0);
        const history = createHistory();
        const next = move(history, board, () => applyEditClick(board, 0, 0));
        expect(history).toEqual({ undo: [], redo: [] });
        expect(next.undo).toHaveLength(1);
        const undone = undoMove(next, takeSnapshot(board))!;
        expect(next.undo).toHaveLength(1);
        expect(undone.history.undo).toHaveLength(0);
        expect(undone.history.redo).toHaveLength(1);
    });
});

describe('history is not mutated by steps', () => {
    it('leaves the history and the current snapshot untouched by undo and redo', () => {
        const board = createBinaryBoard(5, 5, 0);
        let history = createHistory();
        history = move(history, board, () => applyEditClick(board, 0, 0));
        history = move(history, board, () => applyEditClick(board, 1, 1));
        const current = takeSnapshot(board);
        const historyCopy = structuredClone(history);
        const currentCopy = structuredClone(current);

        const undone = undoMove(history, current)!;
        expect(history).toEqual(historyCopy);
        expect(current).toEqual(currentCopy);

        const undoneCopy = structuredClone(undone.history);
        const redone = redoMove(undone.history, undone.board)!;
        expect(undone.history).toEqual(undoneCopy);
        expect(filledCells(redone.board)).toEqual(['0,0', '1,1']);
        expect(canUndo(history)).toBe(true);
    });

    it('returns boards that are copies, so editing them cannot change the history', () => {
        const board = createBinaryBoard(5, 5, 0);
        const history = move(createHistory(), board, () => applyEditClick(board, 2, 2));
        const undone = undoMove(history, takeSnapshot(board))!;
        undone.board.cells[0][0] = 1;
        expect(history.undo[0].cells[0][0]).toBe(0);
        const redone = redoMove(undone.history, takeSnapshot(createBinaryBoard(5, 5, 0)))!;
        redone.board.cells[4][4] = 1;
        expect(undone.history.redo[0].cells[4][4]).toBe(0);
    });

    it('keeps the redo side after a real same-size resize following an undo', () => {
        let board = boardWith(10, 10, [[3, 3]]);
        let history = move(createHistory(), () => board, () => applyEditClick(board, 4, 4));
        const undone = undoMove(history, takeSnapshot(board))!;
        board = snapshotToBoard(undone.board);
        history = move(undone.history, () => board, () => {
            board = resizeBinaryBoard(board, 10, 10);
        });
        expect(canRedo(history)).toBe(true);
    });

    it('gives the same hints for an undone resize as for a freshly built board', () => {
        let board = boardWith(10, 10, [[9, 9], [0, 0], [4, 5]]);
        const history = move(createHistory(), () => board, () => {
            board = resizeBinaryBoard(board, 5, 5);
        });
        const restored = snapshotToBoard(undoMove(history, takeSnapshot(board))!.board);
        const fresh = boardWith(10, 10, [[9, 9], [0, 0], [4, 5]]);
        expect(generateRowHints(restored)).toEqual(generateRowHints(fresh));
        expect(generateColHints(restored)).toEqual(generateColHints(fresh));
    });
});

describe('history limit', () => {
    it('keeps only the last 3 moves when the limit is 3', () => {
        const board = createBinaryBoard(10, 10, 0);
        let history = createHistory();
        for (let x = 0; x < 4; x += 1) {
            history = move(history, board, () => applyEditClick(board, x, 0), 3);
        }
        expect(history.undo).toHaveLength(3);

        let current = takeSnapshot(board);
        const seen: string[][] = [];
        for (let i = 0; i < 3; i += 1) {
            const step = undoMove(history, current)!;
            history = step.history;
            current = step.board;
            seen.push(filledCells(current));
        }
        // after "a" (x=0), the board is the oldest state reachable
        expect(seen[2]).toEqual(['0,0']);
        expect(undoMove(history, current)).toBeNull();
    });

    it('allows 100 undos after 101 moves with the default limit', () => {
        expect(UNDO_LIMIT).toBe(100);
        const board = createBinaryBoard(25, 25, 0);
        let history = createHistory();
        for (let i = 0; i < 101; i += 1) {
            history = move(history, board, () => applyEditClick(board, i % 25, Math.floor(i / 25)));
        }
        expect(history.undo).toHaveLength(100);
        let current = takeSnapshot(board);
        let undone = 0;
        for (let step = undoMove(history, current); step !== null; step = undoMove(history, current)) {
            history = step.history;
            current = step.board;
            undone += 1;
        }
        expect(undone).toBe(100);
    });

    it('trims the undo side when a redo pushes past the limit', () => {
        const a = takeSnapshot(boardWith(5, 5, [[0, 0]]));
        const b = takeSnapshot(boardWith(5, 5, [[1, 1]]));
        const c = takeSnapshot(boardWith(5, 5, [[2, 2]]));
        const history: History = { undo: [a, b], redo: [c] };
        const redone = redoMove(history, takeSnapshot(createBinaryBoard(5, 5, 0)), 2)!;
        expect(redone.history.undo).toHaveLength(2);
        expect(redone.history.undo[0]).toBe(b);
        expect(redone.board).toEqual(c);
        expect(redone.board).not.toBe(c);
        expect(redone.board.cells).not.toBe(c.cells);
    });
});

describe('what counts as one move', () => {
    it('undoes one straight drag of four cells in a single step', () => {
        const board = createBinaryBoard(10, 10, 0);
        const range = getDragRange('horizontal', { x: 0, y: 0 }, { x: 3, y: 0 });
        const history = move(createHistory(), board, () => applyEditDrag(board, range));
        expect(filledCells(takeSnapshot(board))).toHaveLength(4);
        const undone = undoMove(history, takeSnapshot(board))!;
        expect(filledCells(undone.board)).toEqual([]);
    });

    it('brings back the filled cells when a clear is undone and clears again on redo', () => {
        let board = boardWith(10, 10, [[1, 1], [2, 2], [3, 3]]);
        const history = move(createHistory(), () => board, () => {
            board = createBinaryBoard(10, 10, 0);
        });
        const undone = undoMove(history, takeSnapshot(board))!;
        expect(filledCells(undone.board)).toEqual(['1,1', '2,2', '3,3']);
        const redone = redoMove(undone.history, undone.board)!;
        expect(filledCells(redone.board)).toEqual([]);
    });

    it('does not record a clear of an empty board', () => {
        let board = createBinaryBoard(10, 10, 0);
        const history = move(createHistory(), () => board, () => {
            board = createBinaryBoard(10, 10, 0);
        });
        expect(canUndo(history)).toBe(false);
    });

    it('restores the cells cut off by a resize when it is undone', () => {
        let board = boardWith(10, 10, [[9, 9], [0, 0]]);
        const history = move(createHistory(), () => board, () => {
            board = resizeBinaryBoard(board, 5, 5);
        });
        expect([board.length, board[0].length]).toEqual([5, 5]);
        expect(filledCells(takeSnapshot(board))).toEqual(['0,0']);

        const undone = undoMove(history, takeSnapshot(board))!;
        expect([undone.board.width, undone.board.height]).toEqual([10, 10]);
        expect(filledCells(undone.board)).toEqual(['0,0', '9,9']);

        const redone = redoMove(undone.history, undone.board)!;
        expect([redone.board.width, redone.board.height]).toEqual([5, 5]);
        expect(filledCells(redone.board)).toEqual(['0,0']);
    });

    it('does not record a resize to the same size', () => {
        let board = boardWith(10, 10, [[3, 3]]);
        const history = move(createHistory(), () => board, () => {
            board = resizeBinaryBoard(board, 10, 10);
        });
        expect(canUndo(history)).toBe(false);
    });

    it('restores the previous board when an import is undone and ignores an identical import', () => {
        let board = boardWith(10, 10, [[4, 4]]);
        const source = boardWith(5, 5, [[0, 0], [1, 1]]);
        const sourceAnalysis = analyzePuzzle(source, generateRowHints(source), generateColHints(source));
        const imported = importPBM(exportPBM(source, sourceAnalysis)).puzzle.solution;
        const history = move(createHistory(), () => board, () => {
            board = imported;
        });
        expect([board.length, board[0].length]).toEqual([5, 5]);
        const undone = undoMove(history, takeSnapshot(board))!;
        expect([undone.board.width, undone.board.height]).toEqual([10, 10]);
        expect(filledCells(undone.board)).toEqual(['4,4']);

        const same = move(createHistory(), () => board, () => {
            board = snapshotToBoard(takeSnapshot(board));
        });
        expect(canUndo(same)).toBe(false);
    });
});

describe('regression: boards restored from history match fresh ones', () => {
    it('gives the same hints, PBM text and analysis as a board built from scratch', () => {
        const target = [[0, 0], [1, 0], [1, 1], [2, 2], [4, 3]] as Array<[number, number]>;
        const board = createBinaryBoard(5, 5, 0);
        let history = createHistory();
        for (const [x, y] of target) {
            history = move(history, board, () => applyEditClick(board, x, y));
        }
        let current = takeSnapshot(board);
        for (let i = 0; i < 3; i += 1) {
            const step = undoMove(history, current)!;
            history = step.history;
            current = step.board;
        }
        for (let i = 0; i < 3; i += 1) {
            const step = redoMove(history, current)!;
            history = step.history;
            current = step.board;
        }
        const restored = snapshotToBoard(current);
        const fresh = boardWith(5, 5, target);
        expect(restored).toEqual(fresh);
        expect(generateRowHints(restored)).toEqual(generateRowHints(fresh));
        expect(generateColHints(restored)).toEqual(generateColHints(fresh));
        const rows = generateRowHints(fresh);
        const cols = generateColHints(fresh);
        const analysis = analyzePuzzle(fresh, rows, cols);
        expect(analyzePuzzle(restored, rows, cols)).toEqual(analysis);
        expect(exportPBM(restored, analysis)).toBe(exportPBM(fresh, analysis));
    });
});

describe('decideHistoryKey', () => {
    const base: HistoryKeyInput = {
        key: 'z',
        ctrl: false,
        meta: false,
        shift: false,
        alt: false,
        typing: false,
        playing: false,
        dragging: false,
    };
    const press = (patch: Partial<HistoryKeyInput>) => decideHistoryKey({ ...base, ...patch });

    it('undoes on z and Z and redoes on y and Y without modifiers', () => {
        expect(press({ key: 'z' }).action).toBe('undo');
        expect(press({ key: 'Z', shift: true }).action).toBe('undo');
        expect(press({ key: 'y' }).action).toBe('redo');
        expect(press({ key: 'Y', shift: true }).action).toBe('redo');
    });

    it('does not prevent the default for keys without Ctrl or Cmd', () => {
        expect(press({ key: 'z' }).preventDefault).toBe(false);
        expect(press({ key: 'y' }).preventDefault).toBe(false);
    });

    it('undoes on Ctrl+z and Cmd+z', () => {
        expect(press({ key: 'z', ctrl: true })).toEqual({ action: 'undo', preventDefault: true });
        expect(press({ key: 'z', meta: true })).toEqual({ action: 'undo', preventDefault: true });
    });

    it('redoes on Ctrl+Shift+Z, Cmd+Shift+z, Ctrl+y and Ctrl+Shift+y', () => {
        expect(press({ key: 'Z', ctrl: true, shift: true })).toEqual({ action: 'redo', preventDefault: true });
        expect(press({ key: 'z', meta: true, shift: true })).toEqual({ action: 'redo', preventDefault: true });
        expect(press({ key: 'y', ctrl: true })).toEqual({ action: 'redo', preventDefault: true });
        expect(press({ key: 'y', ctrl: true, shift: true })).toEqual({ action: 'redo', preventDefault: true });
    });

    it('does nothing while Alt is held', () => {
        expect(press({ alt: true })).toEqual({ action: null, preventDefault: false });
        expect(press({ alt: true, ctrl: true })).toEqual({ action: null, preventDefault: false });
    });

    it('does nothing and keeps the browser default while typing, playing or dragging', () => {
        for (const patch of [{ typing: true }, { playing: true }, { dragging: true }]) {
            expect(press({ ...patch, ctrl: true })).toEqual({ action: null, preventDefault: false });
            expect(press({ ...patch, key: 'y' })).toEqual({ action: null, preventDefault: false });
        }
    });

    it('ignores unrelated keys even with Ctrl', () => {
        expect(press({ key: 'x' })).toEqual({ action: null, preventDefault: false });
        expect(press({ key: 'x', ctrl: true })).toEqual({ action: null, preventDefault: false });
    });
});

describe('layoutEditRow', () => {
    it('puts all four buttons on one row from 308px of inner width', () => {
        const layout = layoutEditRow(308);
        expect(layout.extraHeight).toBe(0);
        expect(layout.buttons.map((b) => b.id)).toEqual(['resize', 'play', 'undo', 'redo']);
        expect(layout.buttons.every((b) => b.y === 0)).toBe(true);
        const last = layout.buttons[3];
        expect(last.x + last.width).toBe(308);
    });

    it('keeps buttons apart and at least 44px wide on one row', () => {
        const { buttons } = layoutEditRow(331);
        for (let i = 1; i < buttons.length; i += 1) {
            expect(buttons[i].x).toBeGreaterThanOrEqual(buttons[i - 1].x + buttons[i - 1].width + 8);
        }
        expect(buttons.every((b) => b.width >= 44)).toBe(true);
    });

    it('wraps undo and redo onto a second row below 308px and grows the panel', () => {
        const layout = layoutEditRow(307);
        expect(layout.extraHeight).toBe(48);
        const byId = Object.fromEntries(layout.buttons.map((b) => [b.id, b]));
        expect(byId.resize.y).toBe(0);
        expect(byId.play.y).toBe(0);
        expect(byId.undo.y).toBe(48);
        expect(byId.redo.y).toBe(48);
        expect(byId.redo.x + byId.redo.width).toBeLessThanOrEqual(307);
        expect(layout.buttons.every((b) => b.width >= 44)).toBe(true);
    });
});
