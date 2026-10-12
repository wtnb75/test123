// Pure game rules for the prototype (no Phaser imports).
import { P } from './params';

export type Grid = number[][];
export interface Cell { c: number; r: number }
export interface Piece { kind: number; rot: number; cells: Cell[]; col: number; y: number }
export interface Player { x: number; y: number; vy: number; onGround: boolean }
export interface Input { left: boolean; right: boolean; jump: boolean }

const EPS = 1e-6;

const BASE_SHAPES: number[][][] = [
    [[0, 0], [1, 0], [2, 0], [3, 0]], // I
    [[0, 0], [1, 0], [0, 1], [1, 1]], // O
    [[0, 0], [1, 0], [2, 0], [1, 1]], // T
    [[1, 0], [2, 0], [0, 1], [1, 1]], // S
    [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
    [[0, 0], [0, 1], [1, 1], [2, 1]], // J
    [[2, 0], [0, 1], [1, 1], [2, 1]], // L
];
export const KIND_COUNT = BASE_SHAPES.length;

export const createGrid = (rows: number = P.ROWS, cols: number = P.COLS): Grid =>
    Array.from({ length: rows }, () => Array<number>(cols).fill(0));

export const shapeCells = (kind: number, rotation: number): Cell[] => {
    let cells = BASE_SHAPES[kind].map(([c, r]) => ({ c, r }));
    for (let i = 0; i < rotation % 4; i++) {
        cells = cells.map(({ c, r }) => ({ c: -r, r: c }));
    }
    const minC = Math.min(...cells.map((x) => x.c));
    const minR = Math.min(...cells.map((x) => x.r));
    return cells.map(({ c, r }) => ({ c: c - minC, r: r - minR }));
};

export const isSolid = (grid: Grid, c: number, r: number): boolean => {
    if (c < 0 || c >= P.COLS || r >= grid.length) return true;
    if (r < 0) return false;
    return grid[r][c] !== 0;
};

export const canPlace = (grid: Grid, cells: Cell[], col: number, row: number): boolean =>
    cells.every(({ c, r }) => !isSolid(grid, col + c, row + r));

export const landingRow = (grid: Grid, piece: Piece): number => {
    let row = Math.floor(piece.y);
    while (canPlace(grid, piece.cells, piece.col, row + 1)) row++;
    return row;
};

export const lockPiece = (grid: Grid, piece: Piece, row: number): void => {
    for (const { c, r } of piece.cells) {
        const rr = row + r;
        if (rr >= 0 && rr < grid.length) grid[rr][piece.col + c] = piece.kind + 1;
    }
};

/**
 * Drops the piece by DROP_SPEED * dt in sub-steps (so a fast piece can't tunnel).
 * hit() is evaluated at every sub-step; crushed=true as soon as it matches.
 */
export const stepPiece = (
    grid: Grid, piece: Piece, dt: number, hit: (p: Piece) => boolean,
): { piece: Piece; lockedRow: number | null; crushed: boolean } => {
    let y = piece.y;
    let remaining = P.DROP_SPEED * dt;
    for (;;) {
        const base = Math.floor(y);
        if (!canPlace(grid, piece.cells, piece.col, base + 1)) {
            return { piece: { ...piece, y: base }, lockedRow: base, crushed: false };
        }
        const step = Math.min(remaining, 0.5);
        const newY = y + step;
        const newBase = Math.floor(newY);
        if (newBase > base && !canPlace(grid, piece.cells, piece.col, newBase + 1)) {
            const locked = { ...piece, y: newBase };
            return { piece: locked, lockedRow: newBase, crushed: hit(locked) };
        }
        y = newY;
        remaining -= step;
        if (hit({ ...piece, y })) return { piece: { ...piece, y }, lockedRow: null, crushed: true };
        if (remaining <= 1e-9) return { piece: { ...piece, y }, lockedRow: null, crushed: false };
    }
};

export interface Plan { kind: number; rot: number; col: number; row: number }

const evaluate = (grid: Grid, cells: Cell[], col: number, row: number, wellCol: number): number => {
    const g = grid.map((r) => r.slice());
    let wellCells = 0;
    for (const { c, r } of cells) {
        if (row + r >= 0) g[row + r][col + c] = 1;
        if (col + c === wellCol) wellCells++;
    }
    const lines = g.filter((r) => r.every((v) => v !== 0)).length;
    const heights = Array<number>(P.COLS).fill(0);
    let holes = 0;
    for (let c = 0; c < P.COLS; c++) {
        let seen = false;
        for (let r = 0; r < g.length; r++) {
            if (g[r][c] !== 0) {
                if (!seen) heights[c] = g.length - r;
                seen = true;
            } else if (seen) {
                holes++;
            }
        }
    }
    let bump = 0;
    for (let c = 0; c + 1 < P.COLS; c++) {
        if (c === wellCol || c + 1 === wellCol) continue;
        bump += Math.abs(heights[c] - heights[c + 1]);
    }
    return P.AI_LINES_W * lines - P.AI_HOLES_W * holes - P.AI_BUMP_W * bump - P.AI_WELL_W * wellCells;
};

/** Chooses a decent (not perfect) placement: flat, few holes, a well column kept open. */
export const planPlacement = (grid: Grid, kind: number, rng: () => number, wellCol: number): Plan => {
    const options: { plan: Plan; score: number }[] = [];
    for (let rot = 0; rot < 4; rot++) {
        const cells = shapeCells(kind, rot);
        const width = Math.max(...cells.map((x) => x.c)) + 1;
        for (let col = 0; col + width <= P.COLS; col++) {
            const probe: Piece = { kind, rot, cells, col, y: -4 };
            const row = landingRow(grid, probe);
            const top = row + Math.min(...cells.map((x) => x.r));
            const score = top < P.TOP_OUT_ROW ? -1e6 : evaluate(grid, cells, col, row, wellCol);
            options.push({ plan: { kind, rot, col, row }, score });
        }
    }
    options.sort((a, b) => b.score - a.score);
    const pick = Math.min(Math.floor(rng() * P.AI_TOP_K), options.length - 1);
    return options[pick].plan;
};

const rectHitsGrid = (grid: Grid, x: number, y: number): boolean => {
    const c0 = Math.floor(x);
    const c1 = Math.floor(x + P.PLAYER_W - EPS);
    const r0 = Math.floor(y);
    const r1 = Math.floor(y + P.PLAYER_H - EPS);
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            if (isSolid(grid, c, r)) return true;
        }
    }
    return false;
};

export const createPlayer = (): Player => ({
    x: P.COLS / 2 - P.PLAYER_W / 2,
    y: P.ROWS - P.PLAYER_H - EPS,
    vy: 0,
    onGround: true,
});

export const stepPlayer = (grid: Grid, pl: Player, input: Input, dt: number): Player => {
    let { x, y, vy } = pl;
    let onGround = false;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
        const nx = x + dir * P.WALK_SPEED * dt;
        if (!rectHitsGrid(grid, nx, y)) {
            x = nx;
        } else if (dir > 0) {
            x = Math.floor(nx + P.PLAYER_W) - P.PLAYER_W - EPS;
        } else {
            x = Math.floor(nx) + 1 + EPS;
        }
    }

    if (input.jump && pl.onGround) vy = -P.JUMP_V;
    vy += P.GRAVITY * dt;
    const ny = y + vy * dt;
    if (!rectHitsGrid(grid, x, ny)) {
        y = ny;
    } else if (vy > 0) {
        y = Math.floor(ny + P.PLAYER_H) - P.PLAYER_H - EPS;
        vy = 0;
        onGround = true;
    } else {
        y = Math.floor(ny) + 1 + EPS;
        vy = 0;
    }
    return { x, y, vy, onGround };
};

export const pieceCrushesPlayer = (piece: Piece, pl: Player): boolean =>
    piece.cells.some(({ c, r }) => {
        const left = piece.col + c;
        const top = piece.y + r;
        return pl.x < left + 1 && pl.x + P.PLAYER_W > left && pl.y < top + 1 && pl.y + P.PLAYER_H > top;
    });

export const reachedGoal = (pl: Player): boolean => pl.y + P.PLAYER_H <= P.GOAL_ROW + 0.01;

export const toppedOut = (lockedRow: number): boolean => lockedRow < P.TOP_OUT_ROW;

/** Removes full rows; returns the cleared row indices (ascending). Rows above fall down. */
export const clearLines = (grid: Grid): number[] => {
    const cleared: number[] = [];
    grid.forEach((row, r) => {
        if (row.every((v) => v !== 0)) cleared.push(r);
    });
    for (const r of cleared) {
        grid.splice(r, 1);
        grid.unshift(Array<number>(P.COLS).fill(0));
    }
    return cleared;
};

/** Players above a cleared row ride the stack down by one row per cleared row below their feet. */
export const shiftPlayerForClears = (pl: Player, cleared: number[]): Player => {
    const feet = pl.y + P.PLAYER_H;
    const drop = cleared.filter((r) => feet <= r + 0.01).length;
    return drop === 0 ? pl : { ...pl, y: pl.y + drop };
};
