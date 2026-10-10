import { DIR_LIST, DIRS, inBounds, key } from './grid';
import { EMPTY, type Dir, type Grid, type Pt } from './types';

/**
 * Shortest walk over empty cells (no pushing) from (px, py) to (tx, ty).
 * Returns [] for the player's own cell, and null when the target is outside the board,
 * holds a block, or can't be reached.
 */
export function findPath(grid: Grid, px: number, py: number, tx: number, ty: number): Dir[] | null {
    if (!inBounds(grid, tx, ty) || grid[ty][tx] !== EMPTY) return null;
    const cameFrom = new Map<string, { from: string; dir: Dir }>();
    const seen = new Set<string>([key(px, py)]);
    const queue: Pt[] = [{ x: px, y: py }];
    for (let head = 0; head < queue.length; head++) {
        const cur = queue[head];
        if (cur.x === tx && cur.y === ty) {
            const path: Dir[] = [];
            let k = key(tx, ty);
            for (let step = cameFrom.get(k); step; step = cameFrom.get(k)) {
                path.unshift(step.dir);
                k = step.from;
            }
            return path;
        }
        for (const dir of DIR_LIST) {
            const nx = cur.x + DIRS[dir].x;
            const ny = cur.y + DIRS[dir].y;
            if (!inBounds(grid, nx, ny) || grid[ny][nx] !== EMPTY || seen.has(key(nx, ny))) continue;
            seen.add(key(nx, ny));
            cameFrom.set(key(nx, ny), { from: key(cur.x, cur.y), dir });
            queue.push({ x: nx, y: ny });
        }
    }
    return null;
}
