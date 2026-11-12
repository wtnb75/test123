// Pure rules of the edit history (docs/spec/undo-history.md): undo / redo of whole-board states, the board resize that
// keeps the overlapping mines and the start cell, clearing all mines, and the history keys. No DOM, no Phaser;
// arguments are never mutated (every returned snapshot holds its own arrays).

/** The most moves the undo side keeps; the oldest is dropped beyond it. */
export const UNDO_LIMIT = 100;

/** The smallest and largest board side (cells). */
export const MIN_SIZE = 2;
export const MAX_SIZE = 50;

/** The whole editable state of the board: size, mines (row-major, length = width * height) and the start cell. */
export type BoardSnapshot = {
    width: number;
    height: number;
    mines: boolean[];
    startIndex: number | null;
};

/** `past`: states to go back to (the last one is the next undo). `future`: states to go forward to (the last is the next redo). */
export type History = {
    past: BoardSnapshot[];
    future: BoardSnapshot[];
};

export function emptyHistory(): History {
    return { past: [], future: [] };
}

export function copySnapshot(snapshot: BoardSnapshot): BoardSnapshot {
    return { ...snapshot, mines: [...snapshot.mines] };
}

export function snapshotsEqual(a: BoardSnapshot, b: BoardSnapshot): boolean {
    return (
        a.width === b.width &&
        a.height === b.height &&
        a.startIndex === b.startIndex &&
        a.mines.length === b.mines.length &&
        a.mines.every((mine, i) => mine === b.mines[i])
    );
}

/** Keeps the newest `limit` states. */
function trimmed(states: BoardSnapshot[], limit: number): BoardSnapshot[] {
    return states.length > limit ? states.slice(states.length - limit) : states;
}

/**
 * Records a move from `before` to `after`: the state before is pushed on the undo side and the redo side is dropped.
 * A move that changes nothing is not recorded and leaves both sides as they are.
 */
export function recordMove(history: History, before: BoardSnapshot, after: BoardSnapshot, limit = UNDO_LIMIT): History {
    if (snapshotsEqual(before, after)) {
        return history;
    }
    return { past: trimmed([...history.past, copySnapshot(before)], limit), future: [] };
}

export type HistoryStep = { history: History; snapshot: BoardSnapshot };

/** Goes back one move: the new current state, with `current` pushed on the redo side. Null when nothing to undo. */
export function undo(history: History, current: BoardSnapshot, limit = UNDO_LIMIT): HistoryStep | null {
    const target = history.past[history.past.length - 1];
    if (target === undefined) {
        return null;
    }
    return {
        history: { past: history.past.slice(0, -1), future: trimmed([...history.future, copySnapshot(current)], limit) },
        snapshot: copySnapshot(target)
    };
}

/** Goes forward one move: the new current state, with `current` pushed on the undo side. Null when nothing to redo. */
export function redo(history: History, current: BoardSnapshot, limit = UNDO_LIMIT): HistoryStep | null {
    const target = history.future[history.future.length - 1];
    if (target === undefined) {
        return null;
    }
    return {
        history: { past: trimmed([...history.past, copySnapshot(current)], limit), future: history.future.slice(0, -1) },
        snapshot: copySnapshot(target)
    };
}

/** A requested side as the board side: not a finite number keeps `current`, else floored into [MIN_SIZE, MAX_SIZE]. */
export function clampSize(requested: number, current: number): number {
    const side = Number.isFinite(requested) ? Math.floor(requested) : current;
    return Math.max(MIN_SIZE, Math.min(MAX_SIZE, side));
}

/**
 * The board at a new size: a mine stays at its (row, col) when that cell exists in the new board, the new part is empty.
 * The start cell stays at its (row, col) when it is still inside the new board, else it is released (null).
 */
export function resizeSnapshot(snapshot: BoardSnapshot, width: number, height: number): BoardSnapshot {
    const mines: boolean[] = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            mines.push(y < snapshot.height && x < snapshot.width ? snapshot.mines[y * snapshot.width + x] : false);
        }
    }
    let startIndex: number | null = null;
    if (snapshot.startIndex !== null) {
        const y = Math.floor(snapshot.startIndex / snapshot.width);
        const x = snapshot.startIndex % snapshot.width;
        startIndex = y < height && x < width ? y * width + x : null;
    }
    return { width, height, mines, startIndex };
}

/** The board without any mine; the size and the start cell stay. */
export function clearMines(snapshot: BoardSnapshot): BoardSnapshot {
    return { ...snapshot, mines: snapshot.mines.map(() => false) };
}

export function hasAnyMine(snapshot: Pick<BoardSnapshot, 'mines'>): boolean {
    return snapshot.mines.some((mine) => mine);
}

export type HistoryKeyEvent = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
};

export type HistoryKeyAction = 'undo' | 'redo';

/**
 * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y (Shift or not) redo. Nothing while typing in an input,
 * during the play, or with Alt held.
 */
export function historyKeyAction(event: HistoryKeyEvent, typingInInput: boolean, playing: boolean): HistoryKeyAction | null {
    if (typingInInput || playing || event.altKey || !(event.ctrlKey || event.metaKey)) {
        return null;
    }
    const key = (event.key ?? '').toLowerCase();
    if (key === 'z') {
        return event.shiftKey ? 'redo' : 'undo';
    }
    return key === 'y' ? 'redo' : null;
}

export type HistoryButtonState = {
    undoEnabled: boolean;
    redoEnabled: boolean;
    clearEnabled: boolean;
};

/** Which of the three buttons are enabled: not during the play; undo / redo need a move, clear needs a mine. */
export function historyButtonState(history: History, mineAny: boolean, playing: boolean): HistoryButtonState {
    return {
        undoEnabled: !playing && history.past.length > 0,
        redoEnabled: !playing && history.future.length > 0,
        clearEnabled: !playing && mineAny
    };
}
