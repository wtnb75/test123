// Which move the hint points at (docs/spec.md "ヒントの手"). Pure: no Phaser, no randomness, the board is not changed.
import { type Board, type Kinds, type Pos, swapPartners } from './board';
import { planClear } from './special';

function swapIn<T>(grid: T[][], a: Pos, b: Pos): void {
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
}

/**
 * The hint's move: among the moves that clear something, the one whose lower stone sits on the lowest row (largest
 * row number); then the one that counts the most stones in its first clear (special-stone and colour-stone effects
 * included); then the first in search order (top row, left to right, right partner before the one below).
 * The count is taken as if the earlier stone of the pair had been picked first. Returns null when stuck.
 */
export function findHint(board: Board, kinds: Kinds): [Pos, Pos] | null {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const trial = board.map((row) => [...row]);
    const trialKinds = kinds.map((row) => [...row]);
    let best: { move: [Pos, Pos]; row: number; count: number } | null = null;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const a = { r, c };
            for (const b of swapPartners(a, rows, cols)) {
                if (b.r * cols + b.c < r * cols + c) continue; // each pair once, from its earlier stone
                swapIn(trial, a, b);
                swapIn(trialKinds, a, b);
                const plan = planClear(trial, trialKinds, [a, b]);
                swapIn(trial, a, b);
                swapIn(trialKinds, a, b);
                if (!plan) continue;
                const row = Math.max(a.r, b.r);
                // Strictly better only: a tie keeps the earlier move in search order.
                if (!best || row > best.row || (row === best.row && plan.count > best.count)) {
                    best = { move: [a, b], row, count: plan.count };
                }
            }
        }
    }
    return best ? best.move : null;
}
