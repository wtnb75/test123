import {
    COST_PLAIN,
    COST_SWAMP,
    GOAL_COL,
    GRID_COLS,
    GRID_ROWS,
    INITIAL_ROCKS,
    INITIAL_SWAMPS,
    START_COL
} from './config';

/** What stands on a cell: nothing, a wall or a turret. Terrain is separate and never changes. */
export type CellKind = 'empty' | 'wall' | 'turret';
export type Terrain = 'plain' | 'rock' | 'swamp';

export interface CellPos {
    col: number;
    row: number;
}

export interface Board {
    cols: number;
    rows: number;
    cells: CellKind[];
    terrain: Terrain[];
    start: CellPos;
    goal: CellPos;
}

// Neighbour order doubles as the tie-break priority: down, left, right, up.
const DIRS: readonly CellPos[] = [
    { col: 0, row: 1 },
    { col: -1, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: -1 }
];

export const UNREACHABLE = -1;

/** The game's terrain: the fixed rocks and swamps, everything else plain. */
export function initialTerrain(): Terrain[] {
    const terrain = new Array<Terrain>(GRID_COLS * GRID_ROWS).fill('plain');
    for (const [row, col] of INITIAL_ROCKS) terrain[row * GRID_COLS + col] = 'rock';
    for (const [row, col] of INITIAL_SWAMPS) terrain[row * GRID_COLS + col] = 'swamp';
    return terrain;
}

/** A board with no buildings; without `terrain` every cell is plain (the terrain-less board tests use). */
export function createBoard(cols = GRID_COLS, rows = GRID_ROWS, terrain?: readonly Terrain[]): Board {
    return {
        cols,
        rows,
        cells: new Array<CellKind>(cols * rows).fill('empty'),
        terrain: terrain ? [...terrain] : new Array<Terrain>(cols * rows).fill('plain'),
        start: { col: START_COL, row: 0 },
        goal: { col: GOAL_COL, row: rows - 1 }
    };
}

export function inBounds(board: Board, col: number, row: number): boolean {
    return col >= 0 && col < board.cols && row >= 0 && row < board.rows;
}

export function indexOf(board: Board, col: number, row: number): number {
    return row * board.cols + col;
}

export function getCell(board: Board, col: number, row: number): CellKind {
    return board.cells[indexOf(board, col, row)];
}

export function getTerrain(board: Board, col: number, row: number): Terrain {
    return board.terrain[indexOf(board, col, row)];
}

export function setCell(board: Board, col: number, row: number, kind: CellKind): void {
    board.cells[indexOf(board, col, row)] = kind;
}

export function isStart(board: Board, col: number, row: number): boolean {
    return board.start.col === col && board.start.row === row;
}

export function isGoal(board: Board, col: number, row: number): boolean {
    return board.goal.col === col && board.goal.row === row;
}

/** A cell enemies can walk on: no building and not a rock. */
function isOpen(board: Board, idx: number): boolean {
    return board.cells[idx] === 'empty' && board.terrain[idx] !== 'rock';
}

function cellCost(board: Board, idx: number): number {
    return board.terrain[idx] === 'swamp' ? COST_SWAMP : COST_PLAIN;
}

/** Time weight of the step between two neighbouring open cells: the sum of both cell costs. */
function stepWeight(board: Board, a: number, b: number): number {
    return cellCost(board, a) + cellCost(board, b);
}

/**
 * Weighted walking distance from the goal to every open cell (plain-plain steps weigh 2, with a swamp 3 or 4);
 * UNREACHABLE for blocked or cut-off cells.
 */
export function distanceField(board: Board): number[] {
    const dist = new Array<number>(board.cells.length).fill(UNREACHABLE);
    const done = new Array<boolean>(board.cells.length).fill(false);
    dist[indexOf(board, board.goal.col, board.goal.row)] = 0;
    for (;;) {
        let idx = -1;
        for (let i = 0; i < dist.length; i++) {
            if (!done[i] && dist[i] !== UNREACHABLE && (idx === -1 || dist[i] < dist[idx])) idx = i;
        }
        if (idx === -1) return dist;
        done[idx] = true;
        const col = idx % board.cols;
        const row = Math.floor(idx / board.cols);
        for (const d of DIRS) {
            const nc = col + d.col;
            const nr = row + d.row;
            if (!inBounds(board, nc, nr)) continue;
            const nIdx = indexOf(board, nc, nr);
            if (done[nIdx] || !isOpen(board, nIdx)) continue;
            const nd = dist[idx] + stepWeight(board, idx, nIdx);
            if (dist[nIdx] === UNREACHABLE || nd < dist[nIdx]) dist[nIdx] = nd;
        }
    }
}

/** Fastest path from start to goal (both inclusive), or null when the goal is unreachable. */
export function findPath(board: Board): CellPos[] | null {
    const dist = distanceField(board);
    let col = board.start.col;
    let row = board.start.row;
    let cur = indexOf(board, col, row);
    if (dist[cur] === UNREACHABLE) return null;
    const path: CellPos[] = [{ col, row }];
    while (dist[cur] > 0) {
        for (const d of DIRS) {
            const nc = col + d.col;
            const nr = row + d.row;
            if (!inBounds(board, nc, nr)) continue;
            const nIdx = indexOf(board, nc, nr);
            if (dist[nIdx] !== UNREACHABLE && dist[nIdx] + stepWeight(board, cur, nIdx) === dist[cur]) {
                col = nc;
                row = nr;
                cur = nIdx;
                break;
            }
        }
        path.push({ col, row });
    }
    return path;
}

export function hasPath(board: Board): boolean {
    return distanceField(board)[indexOf(board, board.start.col, board.start.row)] !== UNREACHABLE;
}
