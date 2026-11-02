// Helpers for tests only: hand-made boards and controlled randomness.
import type { Board, Pos, Rng } from './board';

/**
 * A board whose every cell has its own number (10 + row × 100 + col): it has no match and no move, so a test can
 * stamp a few cells and know exactly which matches and moves exist.
 */
export function uniqueBoard(rows: number, cols: number): Board {
    return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => 10 + r * 100 + c));
}

/** Writes `color` into the given cells and returns the board. */
export function stamp(board: Board, color: number, cells: [number, number][]): Board {
    for (const [r, c] of cells) board[r][c] = color;
    return board;
}

export const pos = (r: number, c: number): Pos => ({ r, c });

/** A small deterministic generator (LCG) in [0, 1) for seeded random inputs. */
export function seeded(seed: number): Rng {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/**
 * Returns the given values one by one, then falls back to `rest` (a seeded stream by default). Pushing values
 * after a Round is built lets a test choose the colours of the next refills.
 */
export function controlled(seed = 1): { rng: Rng; next: (...values: number[]) => void; pending: () => number } {
    const queue: number[] = [];
    const rest = seeded(seed);
    return {
        rng: () => (queue.length > 0 ? (queue.shift() as number) : rest()),
        next: (...values) => queue.push(...values),
        pending: () => queue.length,
    };
}

/** Copies `rows` into `board` in place (the Round keeps its own board object). */
export function setBoard(board: Board, rows: Board): void {
    for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) board[r][c] = rows[r][c];
}
