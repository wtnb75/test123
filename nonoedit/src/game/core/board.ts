import type { BinaryCell, PlayerCell } from './types';

export const clampSize = (value: number): number => {
    if (Number.isNaN(value)) {
        return 10;
    }
    return Math.max(5, Math.min(25, Math.floor(value)));
};

export const createBinaryBoard = (width: number, height: number, fill: BinaryCell = 0): BinaryCell[][] => {
    const w = clampSize(width);
    const h = clampSize(height);
    return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
};

export const createPlayerBoard = (width: number, height: number, fill: PlayerCell = 'unknown'): PlayerCell[][] => {
    const w = clampSize(width);
    const h = clampSize(height);
    return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
};

export const cloneBinaryBoard = (board: BinaryCell[][]): BinaryCell[][] => board.map((row) => row.slice() as BinaryCell[]);

export const resizeBinaryBoard = (board: BinaryCell[][], width: number, height: number): BinaryCell[][] => {
    const w = clampSize(width);
    const h = clampSize(height);
    const next = createBinaryBoard(w, h, 0);

    for (let y = 0; y < Math.min(h, board.length); y += 1) {
        for (let x = 0; x < Math.min(w, board[0]?.length ?? 0); x += 1) {
            next[y][x] = board[y][x];
        }
    }
    return next;
};

export const toggleBinaryCell = (board: BinaryCell[][], x: number, y: number): BinaryCell[][] => {
    const next = cloneBinaryBoard(board);
    next[y][x] = next[y][x] === 1 ? 0 : 1;
    return next;
};

export const cyclePlayerCell = (value: PlayerCell): PlayerCell => {
    if (value === 'unknown') {
        return 'filled';
    }
    if (value === 'filled') {
        return 'marked';
    }
    return 'unknown';
};

export const filledMatch = (solution: BinaryCell[][], player: PlayerCell[][]): boolean => {
    for (let y = 0; y < solution.length; y += 1) {
        for (let x = 0; x < solution[0].length; x += 1) {
            const playerFilled = player[y][x] === 'filled';
            const solutionFilled = solution[y][x] === 1;
            if (playerFilled !== solutionFilled) {
                return false;
            }
        }
    }
    return true;
};
