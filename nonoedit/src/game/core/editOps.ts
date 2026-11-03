import type { BinaryCell, PlayerCell } from './types';

export type DragAxis = 'horizontal' | 'vertical';

export type Point = { x: number; y: number };

export type DragRange = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    targetX: number;
    targetY: number;
};

export type PlayInputMode = 'fill' | 'mark';

/**
 * Decides the drag axis from the start cell and the current cell.
 * Once an axis is set it is kept; before that, a cell that differs from the start decides it
 * (horizontal wins ties).
 */
export function decideAxis(axis: DragAxis | null, start: Point, current: Point): DragAxis | null {
    if (axis !== null) {
        return axis;
    }
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    if (dx === 0 && dy === 0) {
        return null;
    }
    return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
}

/** The line segment a drag covers: the other coordinate is pinned to the start cell once the axis is set. */
export function getDragRange(axis: DragAxis | null, start: Point, current: Point): DragRange {
    const targetX = axis === 'vertical' ? start.x : current.x;
    const targetY = axis === 'horizontal' ? start.y : current.y;
    return {
        minX: Math.min(start.x, targetX),
        maxX: Math.max(start.x, targetX),
        minY: Math.min(start.y, targetY),
        maxY: Math.max(start.y, targetY),
        targetX,
        targetY,
    };
}

function forEachCell(range: DragRange, visit: (x: number, y: number) => void): void {
    for (let y = range.minY; y <= range.maxY; y += 1) {
        for (let x = range.minX; x <= range.maxX; x += 1) {
            visit(x, y);
        }
    }
}

/** Edit-mode click: toggles one cell. Returns the number of changed cells (always 1). */
export function applyEditClick(solution: BinaryCell[][], x: number, y: number): number {
    solution[y][x] = solution[y][x] === 1 ? 0 : 1;
    return 1;
}

/**
 * Edit-mode drag: if any cell in the range is empty, fills only the empty ones;
 * otherwise clears every filled cell. Returns the number of changed cells.
 */
export function applyEditDrag(solution: BinaryCell[][], range: DragRange): number {
    let anyEmpty = false;
    forEachCell(range, (x, y) => {
        if (solution[y][x] === 0) {
            anyEmpty = true;
        }
    });

    const from: BinaryCell = anyEmpty ? 0 : 1;
    const to: BinaryCell = anyEmpty ? 1 : 0;
    let changed = 0;
    forEachCell(range, (x, y) => {
        if (solution[y][x] === from) {
            solution[y][x] = to;
            changed += 1;
        }
    });
    return changed;
}

function playTarget(mode: PlayInputMode): PlayerCell {
    return mode === 'fill' ? 'filled' : 'marked';
}

/** Play-mode click: unknown becomes the mode's state, anything else returns to unknown. Returns 1. */
export function applyPlayClick(player: PlayerCell[][], x: number, y: number, mode: PlayInputMode): number {
    player[y][x] = player[y][x] === 'unknown' ? playTarget(mode) : 'unknown';
    return 1;
}

/**
 * Play-mode drag: if any cell is unknown, sets only the unknown ones to the mode's state;
 * else if every cell already has the mode's state, resets all of them to unknown;
 * otherwise changes nothing. Returns the number of changed cells.
 */
export function applyPlayDrag(player: PlayerCell[][], range: DragRange, mode: PlayInputMode): number {
    const target = playTarget(mode);
    let unknownCount = 0;
    let targetCount = 0;
    let total = 0;
    forEachCell(range, (x, y) => {
        total += 1;
        if (player[y][x] === 'unknown') {
            unknownCount += 1;
        } else if (player[y][x] === target) {
            targetCount += 1;
        }
    });

    let changed = 0;
    if (unknownCount > 0) {
        forEachCell(range, (x, y) => {
            if (player[y][x] === 'unknown') {
                player[y][x] = target;
                changed += 1;
            }
        });
        return changed;
    }

    if (targetCount === total) {
        forEachCell(range, (x, y) => {
            player[y][x] = 'unknown';
            changed += 1;
        });
    }
    return changed;
}
