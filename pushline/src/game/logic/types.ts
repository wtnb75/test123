/** 0 = empty, 1 = movable block, 2 = fixed block. The player is never stored in the grid. */
export type Cell = 0 | 1 | 2;
export const EMPTY: Cell = 0;
export const MOVABLE: Cell = 1;
export const FIXED: Cell = 2;

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Grid = Cell[][];
export type Rng = () => number;

export interface Pt {
    x: number;
    y: number;
}

export interface KindPt extends Pt {
    kind: Cell;
}

/** One undo step: the board right before a move. */
export interface Snapshot {
    grid: Grid;
    px: number;
    py: number;
    moves: number;
}

export interface State {
    grid: Grid;
    px: number;
    py: number;
    moves: number;
    score: number;
    over: boolean;
    /** Undo history since the last line clear (oldest first). */
    history: Snapshot[];
}

/** Injected randomness and clock (and an optional history cap) so rules stay reproducible in tests. */
export interface Deps {
    rng: Rng;
    now: () => number;
    maxUndo?: number;
}

/** What one accepted move changed, for the Scene to play effects for. */
export interface MoveResult {
    moved: boolean;
    pushed: boolean;
    clearedRows: number[];
    clearedCols: number[];
    /** Blocks that vanished with a cleared line (movable and fixed). */
    cleared: KindPt[];
    /** Leftover movable blocks thinned out while spawning. */
    pruned: KindPt[];
    /** Blocks that newly appeared (fixed top-up and spawned movable blocks). */
    spawned: KindPt[];
    /** Moves actually gained by this move's line clears (after the cap); 0 when nothing was cleared. */
    recovered: number;
}

export interface LineRef {
    horizontal: boolean;
    index: number;
}

export type TapOutcome =
    | { kind: 'walk'; path: Dir[] }
    | { kind: 'push'; dir: Dir }
    | { kind: 'fail' }
    | { kind: 'none' };
