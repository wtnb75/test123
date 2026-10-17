// Stuck-crumble (docs/spec/stuck-crumble.md): when the climber is sealed in a closed pocket, the cheapest
// wall cell blinks and then disappears, one cell at a time, until the pocket opens. Pure logic, no Phaser.
import { P } from '../params';
import type { Grid } from './board';
import type { Player } from './player';

const CELLS = P.ROWS * P.COLS;
const EPS = 1e-9;
/** Column and row offsets of the four neighbours (right, left, down, up). */
const DC = [1, -1, 0, 0] as const;
const DR = [0, 0, 1, -1] as const;

// Scratch buffers shared by the searches below, so a frame allocates nothing.
const pocket = new Uint8Array(CELLS);
const stack = new Int16Array(CELLS);
const level = new Int16Array(CELLS);

/** The cell holding the centre of the body, or -1 when it is above the board or inside a solid cell. */
const bodyCell = (grid: Grid, player: Player): number => {
    const c = Math.min(P.COLS - 1, Math.max(0, Math.floor(player.x + P.PLAYER_W / 2)));
    const r = Math.min(P.ROWS - 1, Math.floor(player.y + P.PLAYER_H / 2));
    if (r < 0 || grid[r][c] !== 0) return -1;
    return r * P.COLS + c;
};

/**
 * Marks in `pocket` the empty cells (up, down, left, right) connected to the body's cell. Returns true when
 * the pocket is sealed: it never reaches row 0, whose empty cells are open to the sky.
 */
const fillPocket = (grid: Grid, player: Player): boolean => {
    const start = bodyCell(grid, player);
    if (start < 0) return false;
    pocket.fill(0);
    let top = 0;
    stack[top++] = start;
    pocket[start] = 1;
    while (top > 0) {
        const k = stack[--top];
        const r = Math.floor(k / P.COLS);
        const c = k - r * P.COLS;
        if (r === 0) return false;
        for (let d = 0; d < 4; d++) {
            const nc = c + DC[d];
            const nr = r + DR[d];
            if (nc < 0 || nc >= P.COLS || nr < 0 || nr >= P.ROWS) continue;
            const n = nr * P.COLS + nc;
            if (pocket[n] === 1 || grid[nr][nc] !== 0) continue;
            pocket[n] = 1;
            stack[top++] = n;
        }
    }
    return true;
};

/**
 * True when the climber is shut in on all four sides by solid cells (no way up to row 0). The searches share
 * module-level scratch buffers that every call overwrites; nothing may keep them across calls.
 */
export const isSealed = (grid: Grid, player: Player): boolean => fillPocket(grid, player);

export interface CellPos {
    c: number;
    r: number;
}

/** True when a candidate (cost, under the feet, row, column) is preferred to the best so far. */
const beats = (
    cost: number, support: boolean, r: number, c: number,
    bestCost: number, bestSupport: boolean, best: CellPos,
): boolean => {
    if (cost !== bestCost) return cost < bestCost;
    if (support !== bestSupport) return !support;
    if (r !== best.r) return r < best.r;
    return c < best.c;
};

/**
 * Chooses the wall cell to remove, for the pocket last filled by `fillPocket`: among the solid cells touching
 * the pocket, the one whose cheapest way out (fewest solid cells to pass, itself included) is smallest.
 * Ties: not the cell under the climber's feet, then the higher row, then the lower column.
 */
const chooseCell = (grid: Grid, player: Player): CellPos | null => {
    // Cost to get out: 0 for every empty cell outside the pocket, 1 for a solid cell in row 0 (the sky is
    // above it), otherwise one more than its cheapest neighbour. Breadth-first from the cost-0 cells.
    // `stack` is free to reuse as the queue here.
    level.fill(-1);
    let head = 0;
    let tail = 0;
    for (let r = 0; r < P.ROWS; r++) {
        for (let c = 0; c < P.COLS; c++) {
            const k = r * P.COLS + c;
            if (pocket[k] === 0 && grid[r][c] === 0) {
                level[k] = 0;
                stack[tail++] = k;
            }
        }
    }
    for (let c = 0; c < P.COLS; c++) {
        if (grid[0][c] !== 0 && level[c] < 0) {
            level[c] = 1;
            stack[tail++] = c;
        }
    }
    while (head < tail) {
        const k = stack[head++];
        const r = Math.floor(k / P.COLS);
        const c = k - r * P.COLS;
        for (let d = 0; d < 4; d++) {
            const nc = c + DC[d];
            const nr = r + DR[d];
            if (nc < 0 || nc >= P.COLS || nr < 0 || nr >= P.ROWS) continue;
            const n = nr * P.COLS + nc;
            if (level[n] >= 0 || pocket[n] === 1) continue;
            level[n] = level[k] + 1;
            stack[tail++] = n;
        }
    }

    const supportRow = player.onGround ? Math.floor(player.y + P.PLAYER_H + P.GOAL_TOL) : -1;
    const lo = Math.floor(player.x);
    const hi = Math.floor(player.x + P.PLAYER_W - 1e-6);
    let best: CellPos | null = null;
    let bestLevel = 0;
    let bestSupport = false;
    for (let r = 0; r < P.ROWS; r++) {
        for (let c = 0; c < P.COLS; c++) {
            if (pocket[r * P.COLS + c] === 0) continue;
            for (let d = 0; d < 4; d++) {
                const nc = c + DC[d];
                const nr = r + DR[d];
                if (nc < 0 || nc >= P.COLS || nr < 0 || nr >= P.ROWS || grid[nr][nc] === 0) continue;
                const lv = level[nr * P.COLS + nc];
                if (lv < 1) continue;
                const support = nr === supportRow && nc >= lo && nc <= hi;
                if (best === null || beats(lv, support, nr, nc, bestLevel, bestSupport, best)) {
                    best = { c: nc, r: nr };
                    bestLevel = lv;
                    bestSupport = support;
                }
            }
        }
    }
    return best;
};

/** The wall cell that would crumble for a climber sealed in, or null when not sealed. For tests and tools. */
export const pickCrumbleCell = (grid: Grid, player: Player): CellPos | null =>
    fillPocket(grid, player) ? chooseCell(grid, player) : null;

export interface CrumbleTarget extends CellPos {
    /** Seconds since the warning started (0 on the frame it started). */
    t: number;
}

/** The sealed-in timer and the warning of one round. */
export class Crumble {
    /** Seconds spent sealed in since the last crumble (counted while no warning runs). */
    sealedFor = 0;
    /** The cell that is blinking now, or null. */
    target: CrumbleTarget | null = null;
    /** Cells that have crumbled so far. */
    removed = 0;

    /** Advances one frame, for the board and climber as they are at the end of the frame. */
    step(grid: Grid, player: Player, dt: number): void {
        if (!fillPocket(grid, player)) {
            this.sealedFor = 0;
            this.target = null;
            return;
        }
        const target = this.target;
        if (target === null) {
            this.sealedFor += dt;
            if (this.sealedFor + EPS < P.STUCK_TIME) return;
            const cell = chooseCell(grid, player);
            if (cell !== null) this.target = { c: cell.c, r: cell.r, t: 0 };
            return;
        }
        target.t += dt;
        if (target.t + EPS >= P.CRUMBLE_TIME) {
            grid[target.r][target.c] = 0;
            this.removed++;
            this.target = null;
            this.sealedFor = 0;
        }
    }

    /** Follows the blinking cell through cleared rows (ascending): it moves down, or the warning restarts if its row went. */
    followClears(cleared: readonly number[]): void {
        const target = this.target;
        if (target === null) return;
        if (cleared.includes(target.r)) {
            this.target = null;
            return;
        }
        let below = 0;
        for (const row of cleared) if (row > target.r) below++;
        target.r += below;
    }
}
