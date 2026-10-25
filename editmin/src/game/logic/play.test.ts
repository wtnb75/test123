import { describe, expect, it } from 'vitest';
import type { BoardState } from './evaluateDifficulty';
import { adjacentMineCount, openCell, playCellView, startPlay } from './play';

/** A board with mines at the given row-major indices and the start at `start`. */
const boardOf = (width: number, height: number, mines: number[], start: number): BoardState => ({
    width,
    height,
    startIndex: start,
    cells: Array.from({ length: width * height }, (_, i) => ({ hasMine: mines.includes(i) }))
});

const openedIndices = (opened: readonly boolean[]): number[] =>
    opened.flatMap((o, i) => (o ? [i] : []));

describe('startPlay', () => {
    it('does not start without a start cell', () => {
        expect(startPlay(null)).toEqual({ ok: false, reason: 'NO_START' });
    });

    it('starts with every cell closed', () => {
        const result = startPlay(boardOf(2, 2, [3], 0));
        expect(result).toEqual({ ok: true, state: { status: 'playing', opened: [false, false, false, false] } });
    });
});

describe('openCell: the first open', () => {
    it('refuses a cell other than the start before anything is open, and leaves the play as it was', () => {
        const board = boardOf(5, 5, [24], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        expect(openCell(board, state.state, 12)).toEqual({ ok: false, reason: 'NOT_START_CELL' });
        expect(state.state.opened.some((o) => o)).toBe(false);
    });

    it('a mine is never the start, so the start opens first on every board', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        expect(openCell(board, state.state, 3)).toEqual({ ok: false, reason: 'NOT_START_CELL' });
    });
});

describe('openCell: the cascade', () => {
    it('opens the whole board from the start when only one mine is at the far corner, and clears at once', () => {
        // 5 x 5, mine at (4,4): every other cell is reached through zero cells, so 24 cells open.
        const board = boardOf(5, 5, [24], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const result = openCell(board, state.state, 0);
        if (!result.ok) throw new Error('expected the start to open');
        expect(result.state.status).toBe('cleared');
        expect(openedIndices(result.state.opened)).toHaveLength(24);
        expect(result.state.opened[24]).toBe(false);
    });

    it('stops at numbered cells: a 2 x 5 board with a wall of mines in column 2 opens only the right side', () => {
        // mines at (0,2) and (1,2); start (0,4). The opened cells are (0,4), (0,3), (1,3), (1,4); (0,3) and (1,3) show 2.
        const board = boardOf(5, 2, [2, 7], 4);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const result = openCell(board, state.state, 4);
        if (!result.ok) throw new Error('expected the start to open');
        expect(result.state.status).toBe('playing');
        expect(openedIndices(result.state.opened)).toEqual([3, 4, 8, 9]);
    });

    it('does not open a mine by the cascade', () => {
        const board = boardOf(5, 2, [2, 7], 4);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const result = openCell(board, state.state, 4);
        if (!result.ok) throw new Error('expected the start to open');
        expect(result.state.opened[2]).toBe(false);
        expect(result.state.opened[7]).toBe(false);
    });

    it('an empty board is cleared by the start open', () => {
        const board = boardOf(2, 2, [], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const result = openCell(board, state.state, 0);
        if (!result.ok) throw new Error('expected the start to open');
        expect(result.state.status).toBe('cleared');
    });
});

describe('openCell: ending the play', () => {
    it('clears only when the last safe cell is open (one short is still playing)', () => {
        // 2 x 2 with a mine at (1,1). The start (0,0) shows 1, so each safe cell is opened one by one.
        const board = boardOf(2, 2, [3], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const first = openCell(board, state.state, 0);
        if (!first.ok) throw new Error('expected the start to open');
        expect(first.state.status).toBe('playing');
        const second = openCell(board, first.state, 1);
        if (!second.ok) throw new Error('expected a numbered cell to open');
        expect(second.state.status).toBe('playing');
        const last = openCell(board, second.state, 2);
        if (!last.ok) throw new Error('expected the last cell to open');
        expect(last.state.status).toBe('cleared');
    });

    it('opening a mine explodes the play, and later opens are ignored', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const start = openCell(board, state.state, 0);
        if (!start.ok) throw new Error('expected the start to open');
        const boom = openCell(board, start.state, 3);
        if (!boom.ok) throw new Error('expected the mine to open');
        expect(boom.state.status).toBe('exploded');
        expect(openCell(board, boom.state, 1)).toEqual({ ok: false, reason: 'ENDED' });
    });

    it('a cleared play ignores later opens', () => {
        const board = boardOf(2, 2, [], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const cleared = openCell(board, state.state, 0);
        if (!cleared.ok) throw new Error('expected the start to open');
        expect(openCell(board, cleared.state, 1)).toEqual({ ok: false, reason: 'ENDED' });
    });

    it('opening a cell that is already open changes nothing', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const start = openCell(board, state.state, 0);
        if (!start.ok) throw new Error('expected the start to open');
        expect(openCell(board, start.state, 0)).toEqual({ ok: true, state: start.state });
    });

    it('does not change the input state', () => {
        const board = boardOf(5, 5, [24], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const before = [...state.state.opened];
        openCell(board, state.state, 0);
        expect(state.state.opened).toEqual(before);
        expect(state.state.status).toBe('playing');
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
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        const result = openCell(board, state.state, 4);
        if (!result.ok) throw new Error('expected the start to open');
        expect(playCellView(board, result.state, 0)).toEqual({ opened: false, label: '', revealedMine: false });
        expect(playCellView(board, result.state, 3)).toEqual({ opened: true, label: '2', revealedMine: false });
        expect(playCellView(board, result.state, 4)).toEqual({ opened: true, label: '', revealedMine: false });
    });

    it('a closed mine shows nothing until the play ends, then shows "B" and is revealed', () => {
        const board = boardOf(2, 2, [3], 0);
        const state = startPlay(board);
        if (!state.ok) throw new Error('expected a started play');
        expect(playCellView(board, state.state, 3)).toEqual({ opened: false, label: '', revealedMine: false });
        const start = openCell(board, state.state, 0);
        if (!start.ok) throw new Error('expected the start to open');
        const boom = openCell(board, start.state, 3);
        if (!boom.ok) throw new Error('expected the mine to open');
        expect(playCellView(board, boom.state, 3)).toEqual({ opened: true, label: 'B', revealedMine: true });
    });
});
