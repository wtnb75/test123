import { describe, expect, it } from 'vitest';
import { createBinaryBoard, createPlayerBoard, cyclePlayerCell, filledMatch, resizeBinaryBoard, toggleBinaryCell } from './board';

describe('board', () => {
    it('creates clamped board size', () => {
        const board = createBinaryBoard(100, 1, 0);
        expect(board.length).toBe(5);
        expect(board[0].length).toBe(25);

        const withNan = createBinaryBoard(Number.NaN, Number.NaN, 1);
        expect(withNan.length).toBe(10);
        expect(withNan[0].length).toBe(10);
    });

    it('resizes board keeping old content', () => {
        const source = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ] as const;
        const next = resizeBinaryBoard(source.map((r) => [...r]), 5, 5);
        expect(next[0][0]).toBe(1);
        expect(next[1][1]).toBe(1);
        expect(next[2][2]).toBe(1);
        expect(next[4][4]).toBe(0);
    });

    it('cycles player cells unknown -> filled -> marked -> unknown', () => {
        expect(cyclePlayerCell('unknown')).toBe('filled');
        expect(cyclePlayerCell('filled')).toBe('marked');
        expect(cyclePlayerCell('marked')).toBe('unknown');
    });

    it('toggles binary cell value', () => {
        const board = createBinaryBoard(5, 5, 0);
        const once = toggleBinaryCell(board, 2, 2);
        expect(once[2][2]).toBe(1);
        const twice = toggleBinaryCell(once, 2, 2);
        expect(twice[2][2]).toBe(0);
    });

    it('clears when filled cells exactly match solution', () => {
        const solution = [
            [1, 0],
            [0, 1],
        ] as const;
        const player = createPlayerBoard(5, 5);
        player[0][0] = 'filled';
        player[1][1] = 'filled';
        player[0][1] = 'marked';
        player[1][0] = 'unknown';

        expect(filledMatch(solution.map((r) => [...r]), player)).toBe(true);

        player[0][1] = 'filled';
        expect(filledMatch(solution.map((r) => [...r]), player)).toBe(false);
    });
});
