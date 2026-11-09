// Pure rules of the editing board (docs/spec.md "技術要件"): the forbidden zone around the start cell,
// whether a start cell / a mine may be placed, and the board text. No DOM, no Phaser; arguments are never mutated.
import { getNeighbors, type BoardState } from './evaluateDifficulty';
import { adjacentMineCount } from './play';

/** The part of a board these rules read: size and mines (the start cell is passed on its own). */
export type Grid = Pick<BoardState, 'width' | 'height' | 'cells'>;

/** The start cell itself and its (up to 8) neighbours: no mine may stand here. */
export function forbiddenZone(startIndex: number, width: number, height: number): Set<number> {
    return new Set<number>([startIndex, ...getNeighbors(startIndex, width, height)]);
}

/** Whether any cell of the forbidden zone around `startIndex` already holds a mine. */
export function zoneHasMine(grid: Grid, startIndex: number): boolean {
    for (const i of forbiddenZone(startIndex, grid.width, grid.height)) {
        if (grid.cells[i].hasMine) {
            return true;
        }
    }
    return false;
}

/** A start cell can be set only when its forbidden zone holds no mine (an existing mine is never removed). */
export function canSetStart(grid: Grid, startIndex: number): boolean {
    return !zoneHasMine(grid, startIndex);
}

/** A mine can be toggled at `index` unless a start cell is set and `index` is in its forbidden zone. */
export function canPlaceMine(grid: Grid, startIndex: number | null, index: number): boolean {
    return startIndex === null || !forbiddenZone(startIndex, grid.width, grid.height).has(index);
}

/** The text of the board: one line per row, cells joined by a space; `X` start cell, `B` mine, else the adjacent mine count. */
export function toBoardText(grid: Grid, startIndex: number | null): string {
    const lines: string[] = [];
    for (let y = 0; y < grid.height; y += 1) {
        const row: string[] = [];
        for (let x = 0; x < grid.width; x += 1) {
            const index = y * grid.width + x;
            if (startIndex === index) {
                row.push('X');
            } else if (grid.cells[index].hasMine) {
                row.push('B');
            } else {
                row.push(String(adjacentMineCount(grid, index)));
            }
        }
        lines.push(row.join(' '));
    }
    return lines.join('\n');
}
