import type { BinaryCell } from './types';

const lineHints = (line: BinaryCell[]): number[] => {
    const result: number[] = [];
    let run = 0;

    for (const cell of line) {
        if (cell === 1) {
            run += 1;
        } else if (run > 0) {
            result.push(run);
            run = 0;
        }
    }
    if (run > 0) {
        result.push(run);
    }
    return result.length > 0 ? result : [0];
};

export const generateRowHints = (board: BinaryCell[][]): number[][] => board.map((row) => lineHints(row));

export const generateColHints = (board: BinaryCell[][]): number[][] => {
    const height = board.length;
    const width = board[0]?.length ?? 0;
    const columns: number[][] = [];

    for (let x = 0; x < width; x += 1) {
        const col: BinaryCell[] = [];
        for (let y = 0; y < height; y += 1) {
            col.push(board[y][x]);
        }
        columns.push(lineHints(col));
    }
    return columns;
};
