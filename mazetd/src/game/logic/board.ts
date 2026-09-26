import { GOAL_COL, GRID_COLS, GRID_ROWS, START_COL } from './config';

export type CellKind = 'empty' | 'wall' | 'turret';

export interface CellPos {
    col: number;
    row: number;
}

export interface Board {
    cols: number;
    rows: number;
    cells: CellKind[];
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

export function createBoard(cols = GRID_COLS, rows = GRID_ROWS): Board {
    return {
        cols,
        rows,
        cells: new Array<CellKind>(cols * rows).fill('empty'),
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

export function setCell(board: Board, col: number, row: number, kind: CellKind): void {
    board.cells[indexOf(board, col, row)] = kind;
}

export function isStart(board: Board, col: number, row: number): boolean {
    return board.start.col === col && board.start.row === row;
}

export function isGoal(board: Board, col: number, row: number): boolean {
    return board.goal.col === col && board.goal.row === row;
}

/** BFS step counts from the goal to every walkable cell; UNREACHABLE for blocked or cut-off cells. */
export function distanceField(board: Board): number[] {
    const dist = new Array<number>(board.cells.length).fill(UNREACHABLE);
    const goalIdx = indexOf(board, board.goal.col, board.goal.row);
    dist[goalIdx] = 0;
    const queue: number[] = [goalIdx];
    for (let head = 0; head < queue.length; head++) {
        const idx = queue[head];
        const col = idx % board.cols;
        const row = Math.floor(idx / board.cols);
        for (const d of DIRS) {
            const nc = col + d.col;
            const nr = row + d.row;
            if (!inBounds(board, nc, nr)) continue;
            const nIdx = indexOf(board, nc, nr);
            if (dist[nIdx] !== UNREACHABLE || board.cells[nIdx] !== 'empty') continue;
            dist[nIdx] = dist[idx] + 1;
            queue.push(nIdx);
        }
    }
    return dist;
}

/** Shortest path from start to goal (both inclusive), or null when the goal is unreachable. */
export function findPath(board: Board): CellPos[] | null {
    const dist = distanceField(board);
    let col = board.start.col;
    let row = board.start.row;
    let current = dist[indexOf(board, col, row)];
    if (current === UNREACHABLE) return null;
    const path: CellPos[] = [{ col, row }];
    while (current > 0) {
        for (const d of DIRS) {
            const nc = col + d.col;
            const nr = row + d.row;
            if (inBounds(board, nc, nr) && dist[indexOf(board, nc, nr)] === current - 1) {
                col = nc;
                row = nr;
                break;
            }
        }
        current--;
        path.push({ col, row });
    }
    return path;
}

export function hasPath(board: Board): boolean {
    return distanceField(board)[indexOf(board, board.start.col, board.start.row)] !== UNREACHABLE;
}
