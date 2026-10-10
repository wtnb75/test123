import { PARAMS } from '../params';
import { cloneGrid, colFull, DIR_LIST, DIRS, inBounds, rowFull } from './grid';
import { EMPTY, FIXED, MOVABLE, type Grid } from './types';

/** Required optimum (moves to the first clear) of a newly generated board at a given score. */
export const targetSolve = (score: number): number =>
    Math.min(PARAMS.solveMax, PARAMS.solveBase + Math.floor(score / PARAMS.solveGrowEvery));

const encode = (grid: Grid, x: number, y: number): string => `${x},${y}|${grid.map((r) => r.join('')).join('')}`;

/**
 * Breadth-first search for the fewest moves from the player's position to the first line clear.
 * Returns that number, or null when no clear exists within `limit` moves or the search hit `nodeCap`
 * states (callers treat both as "not within the limit").
 */
export function minClearMoves(
    grid: Grid,
    px: number,
    py: number,
    limit: number,
    nodeCap: number = PARAMS.solveNodeCap,
): number | null {
    let frontier = [{ grid, x: px, y: py }];
    const seen = new Set<string>([encode(grid, px, py)]);
    let nodes = 0;
    for (let depth = 1; depth <= limit; depth++) {
        const next: typeof frontier = [];
        for (const cur of frontier) {
            for (const dir of DIR_LIST) {
                const nx = cur.x + DIRS[dir].x;
                const ny = cur.y + DIRS[dir].y;
                if (!inBounds(cur.grid, nx, ny) || cur.grid[ny][nx] === FIXED) continue;
                let g = cur.grid;
                if (g[ny][nx] === MOVABLE) {
                    const bx = nx + DIRS[dir].x;
                    const by = ny + DIRS[dir].y;
                    if (!inBounds(g, bx, by) || g[by][bx] !== EMPTY) continue;
                    g = cloneGrid(g);
                    g[by][bx] = MOVABLE;
                    g[ny][nx] = EMPTY;
                    if (rowFull(g, by) || colFull(g, bx)) return depth;
                }
                const k = encode(g, nx, ny);
                if (seen.has(k)) continue;
                seen.add(k);
                if (++nodes > nodeCap) return null;
                next.push({ grid: g, x: nx, y: ny });
            }
        }
        if (next.length === 0) return null;
        frontier = next;
    }
    return null;
}
