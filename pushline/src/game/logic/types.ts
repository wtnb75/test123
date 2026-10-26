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

/** One fixed block moved by the board generation. */
export interface Relocation {
    from: Pt;
    to: Pt;
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
    /** Cells actually moved since the current board appeared (Undo does not take any back). */
    spent: number;
    /** Fewest moves to clear the current board when it appeared; null when it could not be measured. */
    shortest: number | null;
    /** Clears of this run that earned the shortest-clear bonus. */
    bonusCount: number;
}

/** Injected randomness and clock (and an optional history cap) so rules stay reproducible in tests. */
export interface Deps {
    rng: Rng;
    now: () => number;
    maxUndo?: number;
    /** Line count at which the board grows (default PARAMS.growLines); the Title demo passes Infinity. */
    growLines?: number;
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
    /**
     * Fixed blocks that were moved to another cell by the board generation, from their cell before this
     * clear to the new one. The new cell is also in `spawned`; a block placed by this clear's top-up and
     * moved again is not listed here (it just appears at the new cell).
     */
    relocated: Relocation[];
    /** Moves actually gained by this move's line clears (after the cap); 0 when nothing was cleared. */
    recovered: number;
    /** Whether this move's clear earned the shortest-clear bonus (also when the cap swallowed it). */
    bonus: boolean;
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
