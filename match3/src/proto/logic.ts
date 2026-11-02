// Pure match-3 rules (no Phaser). Board is indexed [row][col]; row 0 is the top.
export type Cell = number | null;
export type Board = Cell[][];
export type Pos = { r: number; c: number };
export type Rng = () => number;

export function randomColor(colors: number, rng: Rng): number {
    return Math.floor(rng() * colors);
}

export function isAdjacent(a: Pos, b: Pos): boolean {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function swapCells(board: Board, a: Pos, b: Pos): void {
    const t = board[a.r][a.c];
    board[a.r][a.c] = board[b.r][b.c];
    board[b.r][b.c] = t;
}

/** All cells that belong to a horizontal or vertical run of 3 or more. */
export function findMatches(board: Board): Pos[] {
    const rows = board.length;
    const cols = board[0].length;
    const hit = new Set<number>();
    const mark = (r: number, c: number) => hit.add(r * cols + c);
    for (let r = 0; r < rows; r++) {
        let run = 1;
        for (let c = 1; c <= cols; c++) {
            const same = c < cols && board[r][c] !== null && board[r][c] === board[r][c - 1];
            if (same) { run++; continue; }
            if (run >= 3) for (let k = 1; k <= run; k++) mark(r, c - k);
            run = 1;
        }
    }
    for (let c = 0; c < cols; c++) {
        let run = 1;
        for (let r = 1; r <= rows; r++) {
            const same = r < rows && board[r][c] !== null && board[r][c] === board[r - 1][c];
            if (same) { run++; continue; }
            if (run >= 3) for (let k = 1; k <= run; k++) mark(r - k, c);
            run = 1;
        }
    }
    return [...hit].map((i) => ({ r: Math.floor(i / cols), c: i % cols }));
}

/** First adjacent pair whose swap makes a match, or null when stuck. */
export function findValidMove(board: Board): [Pos, Pos] | null {
    const rows = board.length;
    const cols = board[0].length;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const a = { r, c };
                const b = { r: r + dr, c: c + dc };
                if (b.r >= rows || b.c >= cols) continue;
                swapCells(board, a, b);
                const ok = findMatches(board).length > 0;
                swapCells(board, a, b);
                if (ok) return [a, b];
            }
        }
    }
    return null;
}

export function hasValidMove(board: Board): boolean {
    return findValidMove(board) !== null;
}

/** A full board with no existing match and at least one valid move. */
export function createBoard(rows: number, cols: number, colors: number, rng: Rng): Board {
    for (;;) {
        // Unfilled cells stay null, which findMatches ignores.
        const board: Board = Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                do {
                    board[r][c] = randomColor(colors, rng);
                } while (findMatches(board).length > 0);
            }
        }
        if (hasValidMove(board)) return board;
    }
}

export type Fall = { c: number; from: number; to: number };

/** Gravity: drop cells into empty slots. Returns the moves; mutates board. */
export function collapse(board: Board): Fall[] {
    const rows = board.length;
    const cols = board[0].length;
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

/** Fill empty cells with random colors. Returns the new cells. */
export function refill(board: Board, colors: number, rng: Rng): Pos[] {
    const added: Pos[] = [];
    for (let c = 0; c < board[0].length; c++) {
        for (let r = 0; r < board.length; r++) {
            if (board[r][c] === null) {
                board[r][c] = randomColor(colors, rng);
                added.push({ r, c });
            }
        }
    }
    return added;
}

/** Shuffle until the board has no match and at least one valid move. */
export function shuffleBoard(board: Board, rng: Rng): void {
    const rows = board.length;
    const cols = board[0].length;
    const flat = board.flat();
    for (;;) {
        for (let i = flat.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [flat[i], flat[j]] = [flat[j], flat[i]];
        }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) board[r][c] = flat[r * cols + c];
        if (findMatches(board).length === 0 && hasValidMove(board)) return;
    }
}

/**
 * Score for clearing `cleared` cells at once at the `chain`-th step (1-based).
 * Every cell beyond the third adds `bonusPerExtra` before the chain multiplier.
 */
export function scoreFor(cleared: number, chain: number, perGem: number, bonusPerExtra: number): number {
    const bonus = Math.max(0, cleared - 3) * bonusPerExtra;
    return (cleared * perGem + bonus) * chain;
}
