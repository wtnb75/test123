import { describe, expect, it } from 'vitest';
import {
    applyEditClick,
    applyEditDrag,
    applyPlayClick,
    applyPlayDrag,
    decideAxis,
    getDragRange,
    type DragRange,
    type PlayInputMode,
} from './editOps';
import type { BinaryCell, PlayerCell } from './types';

/** Builds a binary board from rows of '#' (filled) and '.' (empty). */
function bin(...rows: string[]): BinaryCell[][] {
    return rows.map((row) => [...row].map((ch): BinaryCell => (ch === '#' ? 1 : 0)));
}

function binRows(board: BinaryCell[][]): string[] {
    return board.map((row) => row.map((cell) => (cell === 1 ? '#' : '.')).join(''));
}

/** Builds a player board from rows of '?' (unknown), '#' (filled) and 'x' (marked). */
function play(...rows: string[]): PlayerCell[][] {
    return rows.map((row) => [...row].map((ch): PlayerCell => (ch === '#' ? 'filled' : ch === 'x' ? 'marked' : 'unknown')));
}

function playRows(board: PlayerCell[][]): string[] {
    return board.map((row) => row.map((cell) => (cell === 'filled' ? '#' : cell === 'marked' ? 'x' : '?')).join(''));
}

function hLine(y: number, minX: number, maxX: number): DragRange {
    return { minX, maxX, minY: y, maxY: y, targetX: maxX, targetY: y };
}

function vLine(x: number, minY: number, maxY: number): DragRange {
    return { minX: x, maxX: x, minY, maxY, targetX: x, targetY: maxY };
}

describe('decideAxis', () => {
    const start = { x: 3, y: 3 };

    it('stays undecided while the pointer is still on the start cell', () => {
        expect(decideAxis(null, start, { x: 3, y: 3 })).toBeNull();
    });

    it('picks horizontal when the horizontal distance is larger', () => {
        expect(decideAxis(null, start, { x: 6, y: 4 })).toBe('horizontal');
    });

    it('picks vertical when the vertical distance is larger', () => {
        expect(decideAxis(null, start, { x: 4, y: 6 })).toBe('vertical');
    });

    it('picks horizontal when both distances are equal (diagonal tie)', () => {
        expect(decideAxis(null, start, { x: 5, y: 5 })).toBe('horizontal');
        expect(decideAxis(null, start, { x: 1, y: 1 })).toBe('horizontal');
    });

    it('picks vertical for a pure vertical move and horizontal for a pure horizontal move', () => {
        expect(decideAxis(null, start, { x: 3, y: 0 })).toBe('vertical');
        expect(decideAxis(null, start, { x: 0, y: 3 })).toBe('horizontal');
    });

    it('keeps an axis that is already decided even if the pointer moves the other way', () => {
        expect(decideAxis('horizontal', start, { x: 3, y: 9 })).toBe('horizontal');
        expect(decideAxis('vertical', start, { x: 9, y: 3 })).toBe('vertical');
    });
});

describe('getDragRange', () => {
    const start = { x: 2, y: 4 };

    it('covers only the start cell before an axis is decided and the pointer has not left it', () => {
        expect(getDragRange(null, start, { x: 2, y: 4 })).toEqual({
            minX: 2, maxX: 2, minY: 4, maxY: 4, targetX: 2, targetY: 4,
        });
    });

    it('pins y to the start row on a horizontal axis, to the right', () => {
        expect(getDragRange('horizontal', start, { x: 6, y: 9 })).toEqual({
            minX: 2, maxX: 6, minY: 4, maxY: 4, targetX: 6, targetY: 4,
        });
    });

    it('pins y to the start row on a horizontal axis, to the left', () => {
        expect(getDragRange('horizontal', start, { x: 0, y: 1 })).toEqual({
            minX: 0, maxX: 2, minY: 4, maxY: 4, targetX: 0, targetY: 4,
        });
    });

    it('pins x to the start column on a vertical axis, downwards', () => {
        expect(getDragRange('vertical', start, { x: 8, y: 7 })).toEqual({
            minX: 2, maxX: 2, minY: 4, maxY: 7, targetX: 2, targetY: 7,
        });
    });

    it('pins x to the start column on a vertical axis, upwards', () => {
        expect(getDragRange('vertical', start, { x: 0, y: 1 })).toEqual({
            minX: 2, maxX: 2, minY: 1, maxY: 4, targetX: 2, targetY: 1,
        });
    });

    it('collapses to the start cell when a horizontal drag returns to the start column', () => {
        expect(getDragRange('horizontal', start, { x: 2, y: 8 })).toEqual({
            minX: 2, maxX: 2, minY: 4, maxY: 4, targetX: 2, targetY: 4,
        });
    });
});

describe('applyEditClick', () => {
    it('turns an empty cell black and reports one change', () => {
        const board = bin('...', '...');
        expect(applyEditClick(board, 1, 1)).toBe(1);
        expect(binRows(board)).toEqual(['...', '.#.']);
    });

    it('turns a black cell white and reports one change', () => {
        const board = bin('###', '###');
        expect(applyEditClick(board, 2, 0)).toBe(1);
        expect(binRows(board)).toEqual(['##.', '###']);
    });
});

describe('applyEditDrag', () => {
    it('fills only the empty cells of a mixed line and reports their number', () => {
        const board = bin('#.#..');
        expect(applyEditDrag(board, hLine(0, 0, 4))).toBe(3);
        expect(binRows(board)).toEqual(['#####']);
    });

    it('clears every cell of a fully black line and reports the line length', () => {
        const board = bin('.###.');
        expect(applyEditDrag(board, hLine(0, 1, 3))).toBe(3);
        expect(binRows(board)).toEqual(['.....']);
    });

    it('fills a fully empty line', () => {
        const board = bin('.....');
        expect(applyEditDrag(board, hLine(0, 1, 2))).toBe(2);
        expect(binRows(board)).toEqual(['.##..']);
    });

    it('treats a single black cell as a clear and a single empty cell as a fill', () => {
        const board = bin('#.');
        expect(applyEditDrag(board, hLine(0, 0, 0))).toBe(1);
        expect(applyEditDrag(board, hLine(0, 1, 1))).toBe(1);
        expect(binRows(board)).toEqual(['.#']);
    });

    it('works on a vertical line and leaves cells outside the range unchanged', () => {
        const board = bin('#.#', '..#', '#.#');
        expect(applyEditDrag(board, vLine(1, 0, 2))).toBe(3);
        expect(binRows(board)).toEqual(['###', '.##', '###']);
    });

    it('does not touch cells beside a fully black line that is cleared', () => {
        const board = bin('###', '#.#', '###');
        expect(applyEditDrag(board, vLine(0, 0, 2))).toBe(3);
        expect(binRows(board)).toEqual(['.##', '..#', '.##']);
    });
});

describe('applyPlayClick', () => {
    it.each<[PlayInputMode, PlayerCell]>([
        ['fill', 'filled'],
        ['mark', 'marked'],
    ])('sets an unknown cell to the %s state and reports one change', (mode, expected) => {
        const board = play('??');
        expect(applyPlayClick(board, 1, 0, mode)).toBe(1);
        expect(board[0][1]).toBe(expected);
        expect(board[0][0]).toBe('unknown');
    });

    it.each<PlayInputMode>(['fill', 'mark'])('returns a filled or marked cell to unknown in %s mode', (mode) => {
        const board = play('#x');
        expect(applyPlayClick(board, 0, 0, mode)).toBe(1);
        expect(applyPlayClick(board, 1, 0, mode)).toBe(1);
        expect(playRows(board)).toEqual(['??']);
    });
});

describe('applyPlayDrag', () => {
    it('fill mode sets only the unknown cells to filled and keeps marked cells', () => {
        const board = play('?x?#?');
        expect(applyPlayDrag(board, hLine(0, 0, 4), 'fill')).toBe(3);
        expect(playRows(board)).toEqual(['#x###']);
    });

    it('mark mode sets only the unknown cells to marked and keeps filled cells', () => {
        const board = play('?x?#?');
        expect(applyPlayDrag(board, hLine(0, 0, 4), 'mark')).toBe(3);
        expect(playRows(board)).toEqual(['xxx#x']);
    });

    it('sets a lone unknown cell even when every other cell is already filled or marked', () => {
        const board = play('#?x');
        expect(applyPlayDrag(board, hLine(0, 0, 2), 'fill')).toBe(1);
        expect(playRows(board)).toEqual(['##x']);
        const single = play('x?');
        expect(applyPlayDrag(single, hLine(0, 0, 1), 'mark')).toBe(1);
        expect(playRows(single)).toEqual(['xx']);
    });

    it('fill mode resets a fully filled line to unknown and counts every cell', () => {
        const board = play('?###?');
        expect(applyPlayDrag(board, hLine(0, 1, 3), 'fill')).toBe(3);
        expect(playRows(board)).toEqual(['?????']);
    });

    it('mark mode resets a fully marked line to unknown and counts every cell', () => {
        const board = play('?xx??');
        expect(applyPlayDrag(board, hLine(0, 1, 2), 'mark')).toBe(2);
        expect(playRows(board)).toEqual(['?????']);
    });

    it('changes nothing in fill mode for a fully marked line', () => {
        const board = play('xxx');
        expect(applyPlayDrag(board, hLine(0, 0, 2), 'fill')).toBe(0);
        expect(playRows(board)).toEqual(['xxx']);
    });

    it('changes nothing in mark mode for a fully filled line', () => {
        const board = play('###');
        expect(applyPlayDrag(board, hLine(0, 0, 2), 'mark')).toBe(0);
        expect(playRows(board)).toEqual(['###']);
    });

    it.each<PlayInputMode>(['fill', 'mark'])('changes nothing in %s mode for a line mixing filled and marked with no unknown', (mode) => {
        const board = play('#x#');
        expect(applyPlayDrag(board, hLine(0, 0, 2), mode)).toBe(0);
        expect(playRows(board)).toEqual(['#x#']);
    });

    it('a single-cell range behaves like a drag, not a click: a marked cell is kept in fill mode', () => {
        const board = play('x');
        expect(applyPlayDrag(board, hLine(0, 0, 0), 'fill')).toBe(0);
        expect(playRows(board)).toEqual(['x']);
    });

    it('a single-cell range resets a filled cell in fill mode and a marked cell in mark mode', () => {
        const filled = play('#');
        const marked = play('x');
        expect(applyPlayDrag(filled, hLine(0, 0, 0), 'fill')).toBe(1);
        expect(applyPlayDrag(marked, hLine(0, 0, 0), 'mark')).toBe(1);
        expect(playRows(filled)).toEqual(['?']);
        expect(playRows(marked)).toEqual(['?']);
    });

    it('a single-cell range keeps a filled cell in mark mode', () => {
        const board = play('#');
        expect(applyPlayDrag(board, hLine(0, 0, 0), 'mark')).toBe(0);
        expect(playRows(board)).toEqual(['#']);
    });

    it('works on a vertical line and leaves cells outside the range unchanged', () => {
        const board = play('#??', '???', '?x?');
        expect(applyPlayDrag(board, vLine(1, 0, 2), 'fill')).toBe(2);
        expect(playRows(board)).toEqual(['##?', '?#?', '?x?']);
    });
});
