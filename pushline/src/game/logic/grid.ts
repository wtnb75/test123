import { PARAMS } from '../params';
import { EMPTY, MOVABLE, type Cell, type Dir, type Grid, type Pt, type Rng } from './types';

export const DIRS: Record<Dir, Pt> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

export const DIR_LIST: Dir[] = ['up', 'down', 'left', 'right'];

export const key = (x: number, y: number): string => `${x},${y}`;

export const emptyGrid = (cols = PARAMS.cols, rows = PARAMS.rows): Grid =>
    Array.from({ length: rows }, () => Array<Cell>(cols).fill(EMPTY));

export const cloneGrid = (grid: Grid): Grid => grid.map((row) => row.slice());

/** Adds empty columns on the right, in place, up to `cols` (the grown board; the rows keep their identity). */
export function widenGrid(grid: Grid, cols: number): void {
    grid.forEach((row) => {
        while (row.length < cols) row.push(EMPTY);
    });
}

export const inBounds = (grid: Grid, x: number, y: number): boolean =>
    y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;

/**
 * Pushing a chain (docs/spec/chain-push.md): `(x, y)` is the first movable block of a run going in
 * direction `d`. Returns the empty in-bounds cell right after the run (where the head block lands), or
 * null when the run is blocked (a fixed block or the board edge follows it, so nothing can be pushed).
 */
export function chainEnd(grid: Grid, x: number, y: number, d: Pt): Pt | null {
    let ex = x;
    let ey = y;
    while (inBounds(grid, ex, ey) && grid[ey][ex] === MOVABLE) {
        ex += d.x;
        ey += d.y;
    }
    return inBounds(grid, ex, ey) && grid[ey][ex] === EMPTY ? { x: ex, y: ey } : null;
}

export const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

export const countKind = (grid: Grid, kind: Cell): number =>
    grid.reduce((n, row) => n + row.filter((c) => c === kind).length, 0);

export const rowFull = (grid: Grid, y: number): boolean => grid[y].every((c) => c !== EMPTY);

export const colFull = (grid: Grid, x: number): boolean => grid.every((row) => row[x] !== EMPTY);

/** Any row or column completely filled (the player's cell is empty, so it never counts as filled). */
export const fullLineExists = (grid: Grid): boolean =>
    grid.some((_, y) => rowFull(grid, y)) || grid[0].some((_, x) => colFull(grid, x));

/** Cells ("x,y") reachable from (px, py) over empty cells only. */
export function reachableFrom(grid: Grid, px: number, py: number): Set<string> {
    const seen = new Set<string>([key(px, py)]);
    const queue: Pt[] = [{ x: px, y: py }];
    for (let head = 0; head < queue.length; head++) {
        const cur = queue[head];
        for (const dir of DIR_LIST) {
            const nx = cur.x + DIRS[dir].x;
            const ny = cur.y + DIRS[dir].y;
            if (inBounds(grid, nx, ny) && grid[ny][nx] === EMPTY && !seen.has(key(nx, ny))) {
                seen.add(key(nx, ny));
                queue.push({ x: nx, y: ny });
            }
        }
    }
    return seen;
}
