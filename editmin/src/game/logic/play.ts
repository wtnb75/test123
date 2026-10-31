// Pure rules of the play mode (docs/spec/play-test.md). Plays the board as it is and never changes it. No DOM, no Phaser.
import { getNeighbors, type BoardState } from './evaluateDifficulty';

export type PlayStatus = 'playing' | 'exploded' | 'cleared';

export type PlayState = {
    status: PlayStatus;
    /** One flag per cell, row-major: true once the cell is open. */
    opened: readonly boolean[];
};

export type StartPlayResult = { ok: true; state: PlayState } | { ok: false; reason: 'NO_START' };

export type OpenResult = { ok: true; state: PlayState } | { ok: false; reason: 'NOT_START_CELL' | 'ENDED' };

/** The number on a cell: the adjacent mines (0 on a mine-free neighbourhood). */
export function adjacentMineCount(board: BoardState, index: number): number {
    return getNeighbors(index, board.width, board.height).filter((n) => board.cells[n].hasMine).length;
}

/** Starts a play from the start cell: nothing is open yet. Needs a start cell (the play button is off without one). */
export function startPlay(board: BoardState | null): StartPlayResult {
    if (board === null) {
        return { ok: false, reason: 'NO_START' };
    }
    return { ok: true, state: { status: 'playing', opened: board.cells.map(() => false) } };
}

/**
 * Opens one cell. The first open must be the start cell (it has no mine next to it, so it cascades). An open cell
 * is left alone. A mine ends the play as exploded; a numbered cell stops the cascade; a zero cell opens its neighbours.
 * The play is cleared once every cell without a mine is open. The input state is not changed.
 */
export function openCell(board: BoardState, state: PlayState, index: number): OpenResult {
    if (state.status !== 'playing') {
        return { ok: false, reason: 'ENDED' };
    }
    if (state.opened[index]) {
        return { ok: true, state };
    }
    const anyOpen = state.opened.some((o) => o);
    if (!anyOpen && index !== board.startIndex) {
        return { ok: false, reason: 'NOT_START_CELL' };
    }

    const opened = [...state.opened];
    opened[index] = true;
    if (board.cells[index].hasMine) {
        return { ok: true, state: { status: 'exploded', opened } };
    }

    const queue = [index];
    while (queue.length > 0) {
        const current = queue.pop() as number;
        if (adjacentMineCount(board, current) !== 0) {
            continue;
        }
        for (const n of getNeighbors(current, board.width, board.height)) {
            if (!opened[n]) {
                opened[n] = true;
                queue.push(n);
            }
        }
    }

    const cleared = board.cells.every((cell, i) => cell.hasMine || opened[i]);
    return { ok: true, state: { status: cleared ? 'cleared' : 'playing', opened } };
}

export type PlayCellView = {
    opened: boolean;
    /** The text of the cell: a mine's "B" (shown once the play has ended), the number of an open cell, or nothing. */
    label: string;
    /** A mine shown at the end of the play (painted dark). */
    revealedMine: boolean;
};

/** What one cell shows during the play. Digits and "B" are hidden by size in the view, not here. */
export function playCellView(board: BoardState, state: PlayState, index: number): PlayCellView {
    const mine = board.cells[index].hasMine;
    const opened = state.opened[index];
    const revealedMine = state.status !== 'playing' && mine;
    if (revealedMine) {
        return { opened, label: 'B', revealedMine };
    }
    const count = opened && !mine ? adjacentMineCount(board, index) : 0;
    return { opened, label: count > 0 ? String(count) : '', revealedMine };
}
