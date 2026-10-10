import type { Cell, Grid } from './types';

/**
 * Pop-in effects that no longer match the board. A pop-in belongs to one block, but is kept by cell
 * ("x,y" -> the kind that appeared there). When a move pushes that block away (or another block onto
 * the cell), the cell no longer holds that kind and its pop-in must be dropped.
 */
export function stalePopKeys(pops: ReadonlyMap<string, { kind: Cell }>, grid: Grid): string[] {
    const stale: string[] = [];
    pops.forEach((pop, k) => {
        const [x, y] = k.split(',').map(Number);
        if (grid[y][x] !== pop.kind) stale.push(k);
    });
    return stale;
}
