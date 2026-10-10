import { PARAMS } from '../params';
import { EMPTY, type Cell, type Dir, type Grid, type Pt, type Rng } from './types';

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

export const inBounds = (grid: Grid, x: number, y: number): boolean =>
    y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;

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
