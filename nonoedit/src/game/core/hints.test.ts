import { describe, expect, it } from 'vitest';
import { generateColHints, generateRowHints } from './hints';

describe('hints', () => {
    it('generates row and column hints', () => {
        const board = [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0],
        ] as const;

        expect(generateRowHints(board.map((r) => [...r]))).toEqual([[1], [3], [5], [3], [1]]);
        expect(generateColHints(board.map((r) => [...r]))).toEqual([[1], [3], [5], [3], [1]]);
    });

    it('uses zero marker for empty lines', () => {
        const board = [
            [0, 0, 0],
            [1, 0, 1],
            [0, 0, 0],
        ] as const;

        expect(generateRowHints(board.map((r) => [...r]))).toEqual([[0], [1, 1], [0]]);
    });
});
