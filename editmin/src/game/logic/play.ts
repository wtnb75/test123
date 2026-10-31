// Pure rules of the play mode (docs/spec/play-test.md). Plays the board as it is and never changes it. No DOM, no Phaser.
import { getNeighbors, type BoardState } from './evaluateDifficulty';

export type PlayStatus = 'playing' | 'exploded' | 'cleared';

export type PlayState = {
    status: PlayStatus;
    /** One flag per cell, row-major: true once the cell is open. */
    opened: readonly boolean[];
    /** One flag per cell, row-major: true while the player has a flag on the (closed) cell. */
    flagged: readonly boolean[];
};

export type StartPlayResult = { ok: true; state: PlayState } | { ok: false; reason: 'NO_START' };

export type OpenResult = { ok: true; state: PlayState } | { ok: false; reason: 'ENDED' | 'FLAGGED' };

export type FlagResult = { ok: true; state: PlayState } | { ok: false; reason: 'ENDED' };

export const FLAG_LABEL = '⚑';

/** The number on a cell: the adjacent mines (0 on a mine-free neighbourhood). */
export function adjacentMineCount(board: BoardState, index: number): number {
    return getNeighbors(index, board.width, board.height).filter((n) => board.cells[n].hasMine).length;
}

/** Opens `index` and, through zero cells, their closed unflagged neighbours. Mutates `opened` (a copy owned by the caller). */
function cascadeOpen(board: BoardState, opened: boolean[], flagged: readonly boolean[], index: number): void {
    opened[index] = true;
    const queue = [index];
    while (queue.length > 0) {
        const current = queue.pop() as number;
        if (adjacentMineCount(board, current) !== 0) {
            continue;
        }
        for (const n of getNeighbors(current, board.width, board.height)) {
            if (!opened[n] && !flagged[n]) {
                opened[n] = true;
                queue.push(n);
            }
        }
    }
}

function statusAfterOpen(board: BoardState, opened: readonly boolean[]): PlayStatus {
    return board.cells.every((cell, i) => cell.hasMine || opened[i]) ? 'cleared' : 'playing';
}

/**
 * Starts a play with the start cell already open (it has no mine next to it, so it cascades). Needs a start cell
 * (the play button is off without one). A board without mines is cleared by this alone.
 */
export function startPlay(board: BoardState | null): StartPlayResult {
    if (board === null) {
        return { ok: false, reason: 'NO_START' };
    }
    const opened = board.cells.map(() => false);
    const flagged = board.cells.map(() => false);
    cascadeOpen(board, opened, flagged, board.startIndex);
    return { ok: true, state: { status: statusAfterOpen(board, opened), opened, flagged } };
}

/**
 * Opens one cell. An open cell is left alone; a flagged cell is refused (take the flag off first). A mine ends the
 * play as exploded; a numbered cell stops the cascade; a zero cell opens its unflagged neighbours. The play is
 * cleared once every cell without a mine is open. The input state is not changed.
 */
export function openCell(board: BoardState, state: PlayState, index: number): OpenResult {
    if (state.status !== 'playing') {
        return { ok: false, reason: 'ENDED' };
    }
    if (state.opened[index]) {
        return { ok: true, state };
    }
    if (state.flagged[index]) {
        return { ok: false, reason: 'FLAGGED' };
    }

    const opened = [...state.opened];
    if (board.cells[index].hasMine) {
        opened[index] = true;
        return { ok: true, state: { ...state, status: 'exploded', opened } };
    }
    cascadeOpen(board, opened, state.flagged, index);
    return { ok: true, state: { ...state, status: statusAfterOpen(board, opened), opened } };
}

/** Puts a flag on a closed cell, or takes it off. An open cell is left alone; nothing changes once the play has ended. */
export function toggleFlag(state: PlayState, index: number): FlagResult {
    if (state.status !== 'playing') {
        return { ok: false, reason: 'ENDED' };
    }
    if (state.opened[index]) {
        return { ok: true, state };
    }
    const flagged = [...state.flagged];
    flagged[index] = !flagged[index];
    return { ok: true, state: { ...state, flagged } };
}

export type PlayCellView = {
    opened: boolean;
    /** The text of the cell: a mine's "B" (shown once the play has ended), a flag, the number of an open cell, or nothing. */
    label: string;
    /** A mine shown at the end of the play (painted dark). */
    revealedMine: boolean;
    /** A flag on a closed cell (a revealed mine shows as a mine instead). */
    flagged: boolean;
};

/** What one cell shows during the play. Digits, "B" and the flag character are hidden by size in the view, not here. */
export function playCellView(board: BoardState, state: PlayState, index: number): PlayCellView {
    const mine = board.cells[index].hasMine;
    const opened = state.opened[index];
    const revealedMine = state.status !== 'playing' && mine;
    if (revealedMine) {
        return { opened, label: 'B', revealedMine, flagged: false };
    }
    const flagged = state.flagged[index] && !opened;
    if (flagged) {
        return { opened, label: FLAG_LABEL, revealedMine, flagged };
    }
    const count = opened && !mine ? adjacentMineCount(board, index) : 0;
    return { opened, label: count > 0 ? String(count) : '', revealedMine, flagged };
}
