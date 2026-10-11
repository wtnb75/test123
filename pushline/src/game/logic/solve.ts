import { PARAMS } from '../params';
import { cloneGrid, colFull, DIR_LIST, DIRS, inBounds, rowFull } from './grid';
import { EMPTY, FIXED, MOVABLE, type Dir, type Grid } from './types';

/** Required optimum (moves to the first clear) of a newly generated board at a given score. */
export const targetSolve = (score: number): number =>
    Math.min(PARAMS.solveMax, PARAMS.solveBase + Math.floor(score / PARAMS.solveGrowEvery));

const encode = (grid: Grid, x: number, y: number): string => `${x},${y}|${grid.map((r) => r.join('')).join('')}`;

/** A search state. `parent` / `dir` are kept only when the path is wanted (see `search`). */
interface Node {
    grid: Grid;
    x: number;
    y: number;
    parent: Node | null;
    dir: Dir | null;
}

/** The moves from the root to `node`, followed by `last` (the move that completed the line). */
function pathTo(node: Node, last: Dir): Dir[] {
    const path: Dir[] = [last];
    for (let n: Node | null = node; n?.dir; n = n.parent) path.push(n.dir);
    return path.reverse();
}

/**
 * Breadth-first search for the fewest moves from the player's position to the first line clear.
 * Returns the number of moves (and, with `trackPath`, the moves themselves), or null when no clear
 * exists within `limit` moves or the search hit `nodeCap` states (callers treat both as "not within
 * the limit"). Without `trackPath` no parent links are kept, so earlier levels can be collected: this
 * is the board generator's hot path.
 */
function search(
    grid: Grid,
    px: number,
    py: number,
    limit: number,
    nodeCap: number,
    trackPath: boolean,
): { depth: number; path: Dir[] | null } | null {
    let frontier: Node[] = [{ grid, x: px, y: py, parent: null, dir: null }];
    const seen = new Set<string>([encode(grid, px, py)]);
    let nodes = 0;
    for (let depth = 1; depth <= limit; depth++) {
        const next: Node[] = [];
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
                    if (rowFull(g, by) || colFull(g, bx)) return { depth, path: trackPath ? pathTo(cur, dir) : null };
                }
                const k = encode(g, nx, ny);
                if (seen.has(k)) continue;
                seen.add(k);
                if (++nodes > nodeCap) return null;
                next.push({ grid: g, x: nx, y: ny, parent: trackPath ? cur : null, dir: trackPath ? dir : null });
            }
        }
        if (next.length === 0) return null;
        frontier = next;
    }
    return null;
}

/** The fewest moves to the first line clear, or null when there is none in reach. */
export const minClearMoves = (
    grid: Grid,
    px: number,
    py: number,
    limit: number,
    nodeCap: number = PARAMS.solveNodeCap,
): number | null => search(grid, px, py, limit, nodeCap, false)?.depth ?? null;

/** The shortest sequence of moves to the first line clear, or null (same limits as `minClearMoves`). */
export const minClearPlan = (
    grid: Grid,
    px: number,
    py: number,
    limit: number,
    nodeCap: number = PARAMS.solveNodeCap,
): Dir[] | null => search(grid, px, py, limit, nodeCap, true)?.path ?? null;
