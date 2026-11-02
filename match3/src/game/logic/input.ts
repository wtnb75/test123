// Pointer and keyboard input rules for the board (docs/spec.md "操作仕様"). Pure: the Scene feeds events in and
// carries out the swap a call returns (if any). Whether input is accepted at all is the Scene's decision.
import { CELL, COLS, CURSOR_START, ROWS, SWIPE_RATIO } from '../params';
import { type Pos, canSwap, inBoard, samePos } from './board';
import type { Rect } from './layout';

/** The cell under a screen point, or null outside the board. */
export function cellAt(x: number, y: number, rect: Rect): Pos | null {
    const c = Math.floor((x - rect.x) / CELL);
    const r = Math.floor((y - rect.y) / CELL);
    return inBoard({ r, c }, ROWS, COLS) ? { r, c } : null;
}

export type SwipeResult = 'pending' | { to: Pos | null };

/**
 * A press that moved: 'pending' until the longer axis moved CELL × SWIPE_RATIO; then the neighbour in that
 * direction (the x axis wins a tie), or `to: null` when it lies outside the board.
 */
export function swipe(from: Pos, dx: number, dy: number): SwipeResult {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * SWIPE_RATIO) return 'pending';
    const to =
        Math.abs(dx) >= Math.abs(dy)
            ? { r: from.r, c: from.c + Math.sign(dx) }
            : { r: from.r + Math.sign(dy), c: from.c };
    return { to: inBoard(to, ROWS, COLS) ? to : null };
}

export interface InputState {
    selected: Pos | null;
    cursor: Pos;
    cursorVisible: boolean;
    /** The last stone touched with a pointer (where the keyboard cursor reappears). */
    lastTouched: Pos | null;
}

export interface InputOutcome {
    state: InputState;
    /** A swap to attempt (success or not decided by the board). */
    swap?: [Pos, Pos];
}

export const initialInput = (): InputState => ({
    selected: null,
    cursor: { ...CURSOR_START },
    cursorVisible: false,
    lastTouched: null,
});

/** A tap on a stone: swap with the selected neighbour, otherwise (re)select it. Hides the cursor. */
export function tapStone(state: InputState, pos: Pos): InputOutcome {
    const base = { ...state, cursorVisible: false, lastTouched: pos };
    if (state.selected && canSwap(state.selected, pos, ROWS, COLS)) {
        return { state: { ...base, selected: null }, swap: [state.selected, pos] };
    }
    return { state: { ...base, selected: pos } };
}

/** A pointer used off the board: it only hides the cursor. */
export const touchOutside = (state: InputState): InputState => ({ ...state, cursorVisible: false });

/** A swipe from `from` (it clears the selection; the swap, if any, is attempted by the caller). */
export const swipeFrom = (state: InputState, from: Pos): InputState => ({
    ...state,
    selected: null,
    cursorVisible: false,
    lastTouched: from,
});

const ARROWS: Record<string, { dr: number; dc: number }> = {
    ArrowUp: { dr: -1, dc: 0 },
    ArrowDown: { dr: 1, dc: 0 },
    ArrowLeft: { dr: 0, dc: -1 },
    ArrowRight: { dr: 0, dc: 1 },
};

export const isBoardKey = (key: string): boolean => key in ARROWS || key === ' ' || key === 'Enter' || key === 'Escape';

const clampPos = (p: Pos): Pos => ({
    r: Math.min(Math.max(p.r, 0), ROWS - 1),
    c: Math.min(Math.max(p.c, 0), COLS - 1),
});

/**
 * A key on the board. While the cursor is hidden the key only shows it (on the selected stone, else the last
 * touched one, else CURSOR_START). Then: arrows move the cursor, or swap the selected stone with that neighbour;
 * Space / Enter select (or unselect) the cursor's stone; Escape unselects.
 */
export function pressKey(state: InputState, key: string): InputOutcome {
    if (!isBoardKey(key)) return { state };
    if (!state.cursorVisible) {
        const at = state.selected ?? state.lastTouched ?? { ...CURSOR_START };
        return { state: { ...state, cursor: at, cursorVisible: true } };
    }
    if (key === 'Escape') return { state: { ...state, selected: null } };
    if (key === ' ' || key === 'Enter') {
        const same = state.selected !== null && samePos(state.selected, state.cursor);
        return { state: { ...state, selected: same ? null : { ...state.cursor } } };
    }
    const { dr, dc } = ARROWS[key];
    if (!state.selected) {
        return { state: { ...state, cursor: clampPos({ r: state.cursor.r + dr, c: state.cursor.c + dc }) } };
    }
    const from = state.selected;
    const to = { r: from.r + dr, c: from.c + dc };
    if (!canSwap(from, to, ROWS, COLS)) return { state };
    return { state: { ...state, selected: null, cursor: from }, swap: [from, to] };
}
