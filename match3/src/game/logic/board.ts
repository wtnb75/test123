// Pure board rules (docs/spec.md "ルール"). No Phaser; randomness is injected as `rng: () => number` in [0, 1).
// The board is indexed [row][col]; row 0 is the top. A null cell is empty (only between a clear and the refill).
import { BOARD_MAX_TRIES, MATCH_MIN } from '../params';

export type Cell = number | null;
export type Board = Cell[][];
export interface Pos {
    r: number;
    c: number;
}
export type Rng = () => number;

export const samePos = (a: Pos, b: Pos): boolean => a.r === b.r && a.c === b.c;

export const inBoard = (p: Pos, rows: number, cols: number): boolean =>
    p.r >= 0 && p.r < rows && p.c >= 0 && p.c < cols;

/** A colour index: `floor(rng() × colors)`. */
export const randomColor = (colors: number, rng: Rng): number => Math.floor(rng() * colors);

/**
 * The stones `p` can be swapped with (up, down, left, right neighbours, in the order right, down, left, up).
 * This is the one place that decides who may swap with whom: a different swap rule replaces this function.
 */
export function swapPartners(p: Pos, rows: number, cols: number): Pos[] {
    const all = [
        { r: p.r, c: p.c + 1 },
        { r: p.r + 1, c: p.c },
        { r: p.r, c: p.c - 1 },
        { r: p.r - 1, c: p.c },
    ];
    return all.filter((q) => inBoard(q, rows, cols));
}

export const canSwap = (a: Pos, b: Pos, rows: number, cols: number): boolean =>
    inBoard(a, rows, cols) && swapPartners(a, rows, cols).some((q) => samePos(q, b));

export function swapCells(board: Board, a: Pos, b: Pos): void {
    const t = board[a.r][a.c];
    board[a.r][a.c] = board[b.r][b.c];
    board[b.r][b.c] = t;
}

/**
 * Every cell that belongs to a horizontal or vertical run of MATCH_MIN or more equal colours. A cell where a
 * row run and a column run cross is listed once. Empty (null) cells never match.
 */
export function findMatches(board: Board): Pos[] {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const hit = new Set<number>();
    const markRun = (end: number, run: number, at: (i: number) => Pos) => {
        if (run < MATCH_MIN) return;
        for (let k = 1; k <= run; k++) {
            const p = at(end - k);
            hit.add(p.r * cols + p.c);
        }
    };
    for (let r = 0; r < rows; r++) {
        let run = 1;
        for (let c = 1; c <= cols; c++) {
            if (c < cols && board[r][c] !== null && board[r][c] === board[r][c - 1]) {
                run++;
                continue;
            }
            markRun(c, run, (i) => ({ r, c: i }));
            run = 1;
        }
    }
    for (let c = 0; c < cols; c++) {
        let run = 1;
        for (let r = 1; r <= rows; r++) {
            if (r < rows && board[r][c] !== null && board[r][c] === board[r - 1][c]) {
                run++;
                continue;
            }
            markRun(r, run, (i) => ({ r: i, c }));
            run = 1;
        }
    }
    return [...hit].sort((x, y) => x - y).map((i) => ({ r: Math.floor(i / cols), c: i % cols }));
}

/**
 * The first swap that makes a match, or null when stuck. Order: stones top row first, left to right; for each
 * stone the partner to the right is tried before the one below. The board is left as it was.
 */
export function findMove(board: Board): [Pos, Pos] | null {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const a = { r, c };
            for (const b of swapPartners(a, rows, cols)) {
                if (b.r * cols + b.c < r * cols + c) continue; // each pair once, from its earlier stone
                swapCells(board, a, b);
                const ok = findMatches(board).length > 0;
                swapCells(board, a, b);
                if (ok) return [a, b];
            }
        }
    }
    return null;
}

export const hasMove = (board: Board): boolean => findMove(board) !== null;

/** A cell's colour is forbidden when it would complete a run with the already placed stones to its left / above. */
function forbiddenColors(board: Board, r: number, c: number): Set<number> {
    const bad = new Set<number>();
    const left1 = c >= 1 ? board[r][c - 1] : null;
    const left2 = c >= 2 ? board[r][c - 2] : null;
    if (left1 !== null && left1 === left2) bad.add(left1);
    const up1 = r >= 1 ? board[r - 1][c] : null;
    const up2 = r >= 2 ? board[r - 2][c] : null;
    if (up1 !== null && up1 === up2) bad.add(up1);
    return bad;
}

/**
 * A full board with no match and at least one move. Each cell takes the `floor(rng × n)`-th of the colours that
 * don't complete a run, so any rng finishes. Boards without a move are discarded (BOARD_MAX_TRIES is a safety net).
 */
export function createBoard(rows: number, cols: number, colors: number, rng: Rng): Board {
    let board: Board = [];
    for (let attempt = 0; attempt < BOARD_MAX_TRIES; attempt++) {
        board = Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const bad = forbiddenColors(board, r, c);
                const allowed = Array.from({ length: colors }, (_, i) => i).filter((i) => !bad.has(i));
                board[r][c] = allowed[Math.floor(rng() * allowed.length)];
            }
        }
        if (hasMove(board)) return board;
    }
    return board;
}

export interface Fall {
    c: number;
    from: number;
    to: number;
}

/** Gravity: stones sink to fill empty cells below them, keeping their order. Returns the moves; mutates the board. */
export function collapse(board: Board): Fall[] {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const falls: Fall[] = [];
    for (let c = 0; c < cols; c++) {
        let write = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
            const v = board[r][c];
            if (v === null) continue;
            if (r !== write) {
                board[write][c] = v;
                board[r][c] = null;
                falls.push({ c, from: r, to: write });
            }
            write--;
        }
    }
    return falls;
}

export interface Added extends Pos {
    color: number;
}

/** Fills empty cells with new colours, drawing rng column by column (left to right), each column top to bottom. */
export function refill(board: Board, colors: number, rng: Rng): Added[] {
    const added: Added[] = [];
    const cols = board.length > 0 ? board[0].length : 0;
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < board.length; r++) {
            if (board[r][c] !== null) continue;
            const color = randomColor(colors, rng);
            board[r][c] = color;
            added.push({ r, c, color });
        }
    }
    return added;
}

/**
 * Rearranges the stones until the board has no match and a move. After `maxTries` failed arrangements the board is
 * built anew instead (the colour mix changes). Returns true when it was rebuilt.
 */
export function shuffleBoard(board: Board, colors: number, rng: Rng, maxTries: number): boolean {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const flat = board.flat();
    for (let attempt = 0; attempt < maxTries; attempt++) {
        for (let i = flat.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [flat[i], flat[j]] = [flat[j], flat[i]];
        }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) board[r][c] = flat[r * cols + c];
        if (findMatches(board).length === 0 && hasMove(board)) return false;
    }
    const fresh = createBoard(rows, cols, colors, rng);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) board[r][c] = fresh[r][c];
    return true;
}
