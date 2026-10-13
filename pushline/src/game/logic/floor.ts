// The easy-board floor and the relocation of fixed blocks (docs/spec/board-generation.md "簡単さの下限",
// "押せないブロックの置き直し"). Pure functions over a grid; the generator in spawn.ts decides when to use them.
import { PARAMS } from '../params';
import { cloneGrid, DIR_LIST, DIRS, fullLineExists, inBounds, key, pick, reachableFrom } from './grid';
import { EMPTY, FIXED, MOVABLE, type Grid, type Pt, type Relocation, type Rng } from './types';

/** (A) The fewest moves a board may need to clear a line, for a given target. */
export const floorMoves = (target: number): number => Math.max(PARAMS.floorMin, target - PARAMS.floorGap);

/**
 * Whether pushing `block` alone (every other block is a wall; the character only walks) can complete a
 * line. A line is complete the way the rules say: only the row and the column through the cell the block
 * was pushed into count, other blocks are filled cells, and the character's cell is empty.
 */
function clearsAlone(grid: Grid, px: number, py: number, block: Pt): boolean {
    const rows = grid.length;
    const cols = grid[0].length;
    const cells = rows * cols;
    const enc = (x: number, y: number, bx: number, by: number) => (y * cols + x) * cells + by * cols + bx;
    const free = (x: number, y: number) => grid[y][x] === EMPTY || (x === block.x && y === block.y);
    const filled = (x: number, y: number, tx: number, ty: number) =>
        (x === tx && y === ty) || (grid[y][x] !== EMPTY && !(x === block.x && y === block.y));
    const completes = (tx: number, ty: number): boolean => {
        let row = true;
        for (let x = 0; x < cols && row; x++) row = filled(x, ty, tx, ty);
        if (row) return true;
        let col = true;
        for (let y = 0; y < rows && col; y++) col = filled(tx, y, tx, ty);
        return col;
    };

    const seen = new Uint8Array(cells * cells);
    const queue: number[] = [enc(px, py, block.x, block.y)];
    seen[queue[0]] = 1;
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        const pos = Math.floor(s / cells);
        const at = s % cells;
        const x = pos % cols;
        const y = Math.floor(pos / cols);
        const bx = at % cols;
        const by = Math.floor(at / cols);
        for (const dir of DIR_LIST) {
            const nx = x + DIRS[dir].x;
            const ny = y + DIRS[dir].y;
            if (!inBounds(grid, nx, ny)) continue;
            let next: number;
            if (nx === bx && ny === by) {
                const tx = bx + DIRS[dir].x;
                const ty = by + DIRS[dir].y;
                if (!inBounds(grid, tx, ty) || !free(tx, ty)) continue;
                if (completes(tx, ty)) return true;
                next = enc(nx, ny, tx, ty);
            } else if (free(nx, ny)) {
                next = enc(nx, ny, bx, by);
            } else {
                continue;
            }
            if (!seen[next]) {
                seen[next] = 1;
                queue.push(next);
            }
        }
    }
    return false;
}

/** (B) True when some single movable block clears a line on its own (the board is "too easy"). */
export function hasSingleBlockClear(grid: Grid, px: number, py: number): boolean {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            if (grid[y][x] === MOVABLE && clearsAlone(grid, px, py, { x, y })) return true;
        }
    }
    return false;
}

export interface Relocated {
    grid: Grid;
    moves: Relocation[];
}

/**
 * Moves up to `PARAMS.relocateCount` fixed blocks to other empty cells, one at a time, each judged on the
 * board as it is then. A block that already moved (`moved`: its current cell) is left alone and the cells
 * moved from (`vacated`, plus the ones vacated here) are never a destination. A destination must not cut
 * the character off from any cell reachable before (the two cells involved aside) and must not complete a
 * line. Returns null when nothing could be moved.
 */
export function relocateFixed(
    grid: Grid,
    px: number,
    py: number,
    rng: Rng,
    moved: ReadonlySet<string>,
    vacated: ReadonlySet<string>,
): Relocated | null {
    const g = cloneGrid(grid);
    const banned = new Set(vacated);
    const moves: Relocation[] = [];

    const blocks: Pt[] = [];
    g.forEach((row, y) => row.forEach((cell, x) => {
        if (cell === FIXED && !moved.has(key(x, y))) blocks.push({ x, y });
    }));
    for (let i = blocks.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    for (const from of blocks) {
        if (moves.length >= PARAMS.relocateCount) break;
        const before = reachableFrom(g, px, py);
        const fromKey = key(from.x, from.y);
        const targets: Pt[] = [];
        g[from.y][from.x] = EMPTY;
        g.forEach((row, y) => row.forEach((cell, x) => {
            const k = key(x, y);
            if (cell !== EMPTY || (x === px && y === py) || k === fromKey || banned.has(k)) return;
            g[y][x] = FIXED;
            let ok = !fullLineExists(g);
            if (ok) {
                const after = reachableFrom(g, px, py);
                for (const r of before) {
                    if (r !== fromKey && r !== k && !after.has(r)) {
                        ok = false;
                        break;
                    }
                }
            }
            g[y][x] = EMPTY;
            if (ok) targets.push({ x, y });
        }));
        if (targets.length === 0) {
            g[from.y][from.x] = FIXED;
            continue;
        }
        const to = pick(targets, rng);
        g[to.y][to.x] = FIXED;
        banned.add(fromKey);
        moves.push({ from, to });
    }
    return moves.length > 0 ? { grid: g, moves } : null;
}
