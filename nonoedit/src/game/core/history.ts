import type { BinaryCell } from './types';

/** How many moves the undo side keeps; older moves are dropped first. */
export const UNDO_LIMIT = 100;

/** A whole edit board (size and cells), copied so later edits to the live board cannot change it. */
export type BoardSnapshot = {
    width: number;
    height: number;
    cells: BinaryCell[][];
};

/** `undo` holds the board before each move (oldest first); `redo` holds boards that were undone (latest last). */
export type History = {
    undo: BoardSnapshot[];
    redo: BoardSnapshot[];
};

export type StepResult = {
    history: History;
    /** The board to show after the step */
    board: BoardSnapshot;
};

export function createHistory(): History {
    return { undo: [], redo: [] };
}

export function takeSnapshot(board: BinaryCell[][]): BoardSnapshot {
    const cells = board.map((row) => row.slice());
    return { width: cells[0]?.length ?? 0, height: cells.length, cells };
}

/** Deep copy of the snapshot's cells, ready to become the live board. */
function copySnapshot(snapshot: BoardSnapshot): BoardSnapshot {
    return { width: snapshot.width, height: snapshot.height, cells: snapshot.cells.map((row) => row.slice()) };
}

export function snapshotToBoard(snapshot: BoardSnapshot): BinaryCell[][] {
    return snapshot.cells.map((row) => row.slice());
}

export function snapshotsEqual(a: BoardSnapshot, b: BoardSnapshot): boolean {
    if (a.width !== b.width || a.height !== b.height) {
        return false;
    }
    for (let y = 0; y < a.height; y += 1) {
        for (let x = 0; x < a.width; x += 1) {
            if (a.cells[y][x] !== b.cells[y][x]) {
                return false;
            }
        }
    }
    return true;
}

function trim(stack: BoardSnapshot[], limit: number): BoardSnapshot[] {
    return stack.length > limit ? stack.slice(stack.length - limit) : stack;
}

/**
 * Records one move. A move that leaves the board unchanged is not recorded (history is returned as is);
 * otherwise the board before the move goes on the undo side and the redo side is cleared.
 */
export function recordMove(
    history: History,
    before: BoardSnapshot,
    after: BoardSnapshot,
    limit: number = UNDO_LIMIT,
): History {
    if (snapshotsEqual(before, after)) {
        return history;
    }
    return { undo: trim([...history.undo, before], limit), redo: [] };
}

export function canUndo(history: History): boolean {
    return history.undo.length > 0;
}

export function canRedo(history: History): boolean {
    return history.redo.length > 0;
}

/** Undoes the last move. `null` when there is nothing to undo. */
export function undoMove(history: History, current: BoardSnapshot): StepResult | null {
    if (!canUndo(history)) {
        return null;
    }
    const board = copySnapshot(history.undo[history.undo.length - 1]);
    return {
        board,
        history: {
            undo: history.undo.slice(0, -1),
            redo: [...history.redo, current],
        },
    };
}

/** Redoes the last undone move. `null` when there is nothing to redo. */
export function redoMove(history: History, current: BoardSnapshot, limit: number = UNDO_LIMIT): StepResult | null {
    if (!canRedo(history)) {
        return null;
    }
    const board = copySnapshot(history.redo[history.redo.length - 1]);
    return {
        board,
        history: {
            undo: trim([...history.undo, current], limit),
            redo: history.redo.slice(0, -1),
        },
    };
}

export type HistoryAction = 'undo' | 'redo';

export type HistoryKeyInput = {
    key: string;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
    /** The key's target is a text input element (`textarea`, `input`) */
    typing: boolean;
    playing: boolean;
    dragging: boolean;
};

export type HistoryKeyDecision = {
    action: HistoryAction | null;
    preventDefault: boolean;
};

const IGNORED: HistoryKeyDecision = { action: null, preventDefault: false };

/**
 * Maps a key press to undo / redo. `Z` undoes and `Y` redoes (Shift ignored); with Ctrl / Cmd,
 * Shift+Z also redoes. Does nothing while typing, playing, dragging or with Alt held.
 * Keys with Ctrl / Cmd call `preventDefault` so the browser's own undo does not run.
 */
export function decideHistoryKey(input: HistoryKeyInput): HistoryKeyDecision {
    if (input.alt || input.typing || input.playing || input.dragging) {
        return IGNORED;
    }
    const key = input.key.toLowerCase();
    const withModifier = input.ctrl || input.meta;
    let action: HistoryAction | null = null;
    if (key === 'z') {
        action = withModifier && input.shift ? 'redo' : 'undo';
    } else if (key === 'y') {
        action = 'redo';
    }
    if (action === null) {
        return IGNORED;
    }
    return { action, preventDefault: withModifier };
}

export type EditRowButtonId = 'resize' | 'play' | 'undo' | 'redo';

export type EditRowButton = { id: EditRowButtonId; x: number; y: number; width: number };

export type EditRowLayout = {
    buttons: EditRowButton[];
    /** How much taller the mobile panel gets when the history buttons wrap onto a second row */
    extraHeight: number;
};

const ROW_GAP = 8;
const SINGLE_ROW_WIDTHS: Record<EditRowButtonId, number> = { resize: 76, play: 64, undo: 72, redo: 72 };
const WRAPPED_WIDTH = 94;
/** Button height (44) plus a gap of 4 */
const WRAP_ROW_STEP = 48;

/**
 * Mobile "edit" tab, edit mode: Resize / Play / Undo / Redo in one row when `innerWidth` allows,
 * otherwise Undo / Redo on a second row. Offsets are relative to the panel's top-left inner corner.
 */
export function layoutEditRow(innerWidth: number): EditRowLayout {
    const order: EditRowButtonId[] = ['resize', 'play', 'undo', 'redo'];
    const total = order.reduce((sum, id) => sum + SINGLE_ROW_WIDTHS[id], 0) + ROW_GAP * (order.length - 1);
    if (innerWidth >= total) {
        let x = 0;
        const buttons = order.map((id) => {
            const button = { id, x, y: 0, width: SINGLE_ROW_WIDTHS[id] };
            x += SINGLE_ROW_WIDTHS[id] + ROW_GAP;
            return button;
        });
        return { buttons, extraHeight: 0 };
    }
    const step = WRAPPED_WIDTH + ROW_GAP;
    return {
        buttons: [
            { id: 'resize', x: 0, y: 0, width: WRAPPED_WIDTH },
            { id: 'play', x: step, y: 0, width: WRAPPED_WIDTH },
            { id: 'undo', x: 0, y: WRAP_ROW_STEP, width: WRAPPED_WIDTH },
            { id: 'redo', x: step, y: WRAP_ROW_STEP, width: WRAPPED_WIDTH },
        ],
        extraHeight: WRAP_ROW_STEP,
    };
}
