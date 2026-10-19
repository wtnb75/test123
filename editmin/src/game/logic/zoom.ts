// Pure logic of the board zoom (the zoom section of docs/spec.md). No DOM, no Phaser.

export const ZOOM_STEPS: readonly number[] = [6, 8, 12, 16, 24, 32, 48, 64];
export const ZOOM_DEFAULT = 32;
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];
/** Below this cell side the digits and "B" are not shown and mines are painted. */
export const COMPACT_CELL_PX = 20;
export const GRID_PADDING = 10;
export const WHEEL_ZOOM_INTERVAL_MS = 80;

export type ZoomDirection = 1 | -1;
export type ZoomAction = 'in' | 'out' | 'fit';

/** The next step above (+1) or below (-1) the current value; at the ends the value stays. */
export function nextZoom(current: number, direction: ZoomDirection): number {
    if (direction === 1) {
        return ZOOM_STEPS.find((step) => step > current) ?? current;
    }
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
        if (ZOOM_STEPS[i] < current) {
            return ZOOM_STEPS[i];
        }
    }
    return current;
}

/** The largest integer cell side that fits the whole board in the area (padding excluded), within the zoom limits. */
export function fitZoom(boardWidth: number, boardHeight: number, areaWidth: number, areaHeight: number): number {
    const side = Math.floor(
        Math.min((areaWidth - 2 * GRID_PADDING) / boardWidth, (areaHeight - 2 * GRID_PADDING) / boardHeight)
    );
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, side));
}

export function isCompact(cellSide: number): boolean {
    return cellSide < COMPACT_CELL_PX;
}

/** The largest scroll position (one axis) for `cells` cells of side `cellSide` in an area of `areaSize` px. */
export function maxScroll(cells: number, cellSide: number, areaSize: number): number {
    return Math.max(0, cells * cellSide + 2 * GRID_PADDING - areaSize);
}

/**
 * The scroll position (one axis) after the cell side changes from `oldSide` to `newSide`, so that the board point
 * under `anchor` (a position inside the scroll area) stays there; clamped to [0, max].
 */
export function anchoredScroll(
    scroll: number,
    anchor: number,
    oldSide: number,
    newSide: number,
    max: number
): number {
    const boardPoint = (scroll + anchor - GRID_PADDING) / oldSide;
    const next = boardPoint * newSide + GRID_PADDING - anchor;
    return Math.max(0, Math.min(max, next));
}

/** deltaY < 0 zooms in, > 0 zooms out, 0 does nothing. */
export function wheelDirection(deltaY: number): ZoomDirection | 0 {
    if (deltaY < 0) {
        return 1;
    }
    return deltaY > 0 ? -1 : 0;
}

/** Whether a wheel event at `now` may change the zoom: the first one, or at least the interval after the last change. */
export function wheelMayZoom(now: number, lastChangeAt: number | null): boolean {
    return lastChangeAt === null || now - lastChangeAt >= WHEEL_ZOOM_INTERVAL_MS;
}

export type ZoomKeyEvent = {
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
};

/** The zoom action of a key press, or null (also while typing in an input or with ctrl/meta/alt held). */
export function zoomKeyAction(event: ZoomKeyEvent, typingInInput: boolean): ZoomAction | null {
    if (typingInInput || event.ctrlKey || event.metaKey || event.altKey) {
        return null;
    }
    if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
        return 'in';
    }
    if (event.key === '-' || event.code === 'NumpadSubtract') {
        return 'out';
    }
    if (event.key === '0' || event.code === 'Numpad0') {
        return 'fit';
    }
    return null;
}
