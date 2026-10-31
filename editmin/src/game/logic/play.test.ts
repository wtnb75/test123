import { describe, expect, it } from 'vitest';
import type { BoardState } from './evaluateDifficulty';
import { adjacentMineCount, FLAG_LABEL, openCell, playCellView, startPlay, toggleFlag, type PlayState } from './play';

/** A board with mines at the given row-major indices and the start at `start`. */
const boardOf = (width: number, height: number, mines: number[], start: number): BoardState => ({
    width,
    height,
    startIndex: start,
    cells: Array.from({ length: width * height }, (_, i) => ({ hasMine: mines.includes(i) }))
});

const openedIndices = (opened: readonly boolean[]): number[] =>
    opened.flatMap((o, i) => (o ? [i] : []));

const started = (board: BoardState): PlayState => {
    const result = startPlay(board);
    if (!result.ok) throw new Error('expected a started play');
    return result.state;
};

const opening = (board: BoardState, state: PlayState, index: number): PlayState => {
    const result = openCell(board, state, index);
    if (!result.ok) throw new Error(`expected cell ${index} to open`);
    return result.state;
};

const flagging = (state: PlayState, index: number): PlayState => {
    const result = toggleFlag(state, index);
    if (!result.ok) throw new Error(`expected a flag toggle on cell ${index}`);
    return result.state;
};

describe('startPlay', () => {
    it('does not start without a start cell', () => {
        expect(startPlay(null)).toEqual({ ok: false, reason: 'NO_START' });
    });

    it('starts with the start cell already open and no flags', () => {
        // 2 x 2, mine at (1,1): the start (0,0) shows 1, so only it opens.
        const state = started(boardOf(2, 2, [3], 0));
        expect(state).toEqual({
            status: 'playing',
            opened: [true, false, false, false],
            flagged: [false, false, false, false]
        });
    });

    it('opens the whole board from the start when only one mine is at the far corner, and clears at once', () => {
        // 5 x 5, mine at (4,4): every other cell is reached through zero cells, so 24 cells open.
        const state = started(boardOf(5, 5, [24], 0));
        expect(state.status).toBe('cleared');
        expect(openedIndices(state.opened)).toHaveLength(24);
        expect(state.opened[24]).toBe(false);
    });

    it('stops at numbered cells: a 2 x 5 board with a wall of mines in column 2 opens only the right side', () => {
        // mines at (0,2) and (1,2); start (0,4). The opened cells are (0,4), (0,3), (1,3), (1,4); (0,3) and (1,3) show 2.
        const state = started(boardOf(5, 2, [2, 7], 4));
        expect(state.status).toBe('playing');
        expect(openedIndices(state.opened)).toEqual([3, 4, 8, 9]);
    });

    it('does not open a mine by the cascade', () => {
        const state = started(boardOf(5, 2, [2, 7], 4));
        expect(state.opened[2]).toBe(false);
        expect(state.opened[7]).toBe(false);
    });

    it('an empty board is cleared by the start alone', () => {
        expect(started(boardOf(2, 2, [], 0)).status).toBe('cleared');
    });
});

describe('openCell', () => {
    it('clears only when the last safe cell is open (one short is still playing)', () => {
        // 2 x 2 with a mine at (1,1). The start (0,0) shows 1, so each other safe cell is opened one by one.
        const board = boardOf(2, 2, [3], 0);
        const first = started(board);
        expect(first.status).toBe('playing');
        const second = opening(board, first, 1);
        expect(second.status).toBe('playing');
        expect(opening(board, second, 2).status).toBe('cleared');
    });

    it('opening a mine explodes the play, and later opens are ignored', () => {
        const board = boardOf(2, 2, [3], 0);
        const boom = opening(board, started(board), 3);
        expect(boom.status).toBe('exploded');
        expect(openCell(board, boom, 1)).toEqual({ ok: false, reason: 'ENDED' });
    });

    it('a cleared play ignores later opens', () => {
        const board = boardOf(2, 2, [], 0);
        expect(openCell(board, started(board), 1)).toEqual({ ok: false, reason: 'ENDED' });
    });

    it('opening a cell that is already open changes nothing', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = started(board);
        expect(openCell(board, state, 0)).toEqual({ ok: true, state });
    });

    it('does not change the input state', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = started(board);
        const before = { opened: [...state.opened], flagged: [...state.flagged] };
        opening(board, state, 1);
        expect({ opened: [...state.opened], flagged: [...state.flagged] }).toEqual(before);
        expect(state.status).toBe('playing');
    });

    it('refuses a flagged cell, even a mine, and leaves the play as it was', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = flagging(started(board), 3);
        expect(openCell(board, state, 3)).toEqual({ ok: false, reason: 'FLAGGED' });
        expect(state.status).toBe('playing');
        expect(state.opened[3]).toBe(false);
    });

    it('opens a cell again once its flag is taken off', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = flagging(flagging(started(board), 1), 1);
        expect(opening(board, state, 1).opened[1]).toBe(true);
    });

    it('a cascade does not open a flagged cell, and the play is not cleared until it is opened', () => {
        // 1 x 3 with a mine at (0,2): the start (0,0) shows 0 and would open (0,1); a flag on (0,1) stops that.
        // The play begins from the start with no flags, so flag first on a fresh state of the same board.
        const board = boardOf(3, 1, [2], 0);
        const fresh: PlayState = { status: 'playing', opened: [false, false, false], flagged: [false, true, false] };
        const state = opening(board, fresh, 0);
        expect(state.opened).toEqual([true, false, false]);
        expect(state.status).toBe('playing');
        const cleared = opening(board, flagging(state, 1), 1);
        expect(cleared.status).toBe('cleared');
    });
});

describe('toggleFlag', () => {
    it('puts a flag on a closed cell and takes it off the next time', () => {
        const state = started(boardOf(2, 2, [3], 0));
        const on = flagging(state, 3);
        expect(on.flagged).toEqual([false, false, false, true]);
        expect(flagging(on, 3).flagged).toEqual([false, false, false, false]);
    });

    it('does not put a flag on an open cell', () => {
        const state = started(boardOf(2, 2, [3], 0));
        expect(toggleFlag(state, 0)).toEqual({ ok: true, state });
    });

    it('ignores flags once the play has ended', () => {
        const board = boardOf(2, 2, [3], 0);
        const boom = opening(board, started(board), 3);
        expect(toggleFlag(boom, 1)).toEqual({ ok: false, reason: 'ENDED' });
    });

    it('does not change the input state and keeps the other cells', () => {
        const state = started(boardOf(2, 2, [3], 0));
        const next = flagging(state, 2);
        expect(state.flagged).toEqual([false, false, false, false]);
        expect(next.opened).toEqual(state.opened);
        expect(next.status).toBe('playing');
    });
});

describe('adjacentMineCount', () => {
    it('counts the mines in the 8 neighbours, at a corner, an edge and the centre', () => {
        // mines at (0,0), (0,1) and (1,2)
        const board = boardOf(3, 3, [0, 1, 5], 8);
        expect(adjacentMineCount(board, 4)).toBe(3); // centre (1,1) sees all three
        expect(adjacentMineCount(board, 2)).toBe(2); // corner (0,2) sees (0,1) and (1,2)
        expect(adjacentMineCount(board, 6)).toBe(0); // corner (2,0) sees none
    });
});

describe('playCellView', () => {
    it('shows nothing for a closed cell, the number of an open cell, and nothing for an open zero cell', () => {
        const board = boardOf(5, 2, [2, 7], 4);
        const state = started(board);
        expect(playCellView(board, state, 0)).toEqual({ opened: false, label: '', revealedMine: false, flagged: false });
        expect(playCellView(board, state, 3)).toEqual({ opened: true, label: '2', revealedMine: false, flagged: false });
        expect(playCellView(board, state, 8)).toEqual({ opened: true, label: '2', revealedMine: false, flagged: false });
        expect(playCellView(board, state, 9)).toEqual({ opened: true, label: '', revealedMine: false, flagged: false });
    });

    it('shows an open zero cell as empty', () => {
        const board = boardOf(3, 1, [], 0);
        expect(playCellView(board, started(board), 0)).toEqual({ opened: true, label: '', revealedMine: false, flagged: false });
    });

    it('a closed mine shows nothing until the play ends, then shows "B" and is revealed', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = started(board);
        expect(playCellView(board, state, 3)).toEqual({ opened: false, label: '', revealedMine: false, flagged: false });
        const boom = opening(board, state, 3);
        expect(playCellView(board, boom, 3)).toEqual({ opened: true, label: 'B', revealedMine: true, flagged: false });
    });

    it('a flag shows the flag character on a closed cell', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = flagging(started(board), 2);
        expect(playCellView(board, state, 2)).toEqual({ opened: false, label: FLAG_LABEL, revealedMine: false, flagged: true });
    });

    it('after the end, a flagged mine shows as a mine and a flagged safe cell keeps its flag', () => {
        const board = boardOf(2, 2, [3], 0);
        const flaggedBoth = flagging(flagging(started(board), 3), 2);
        const boom: PlayState = { ...flaggedBoth, status: 'exploded' };
        expect(playCellView(board, boom, 3)).toEqual({ opened: false, label: 'B', revealedMine: true, flagged: false });
        expect(playCellView(board, boom, 2)).toEqual({ opened: false, label: FLAG_LABEL, revealedMine: false, flagged: true });
    });
});
