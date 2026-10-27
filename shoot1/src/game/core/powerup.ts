import {
    BARRIER_BLINK_SEC, BARRIER_BREAK_SEC, GAME_HEIGHT, GAME_WIDTH,
    ITEM_BARRIER_RATE, ITEM_DROP_RATE, ITEM_FALL_SPEED, ITEM_OFFSCREEN_MARGIN, ITEM_RADIUS,
    MINE_INITIAL_COUNT, MINE_ITEM_MAX, PLAYER_RADIUS
} from './constants';
import { circlesOverlap } from './physics';
import type { MineState } from './mine';

// Items and the barrier (docs/spec/power-ups.md). Pure logic: the Scene draws and moves the objects.

export type ItemKind = 'mine' | 'barrier';

/**
 * The drop roll for one enemy a mine explosion removed: one draw decides whether it drops (below
 * `ITEM_DROP_RATE`), and only a drop draws again for the kind (below `ITEM_BARRIER_RATE` is a barrier).
 */
export function rollItemDrop(rand: () => number): ItemKind | null {
    if (rand() >= ITEM_DROP_RATE) return null;
    return rand() < ITEM_BARRIER_RATE ? 'barrier' : 'mine';
}

/** Spawn x for an item dropped at `x`: kept inside the screen by the item's radius. */
export function itemSpawnX(x: number): number {
    return Math.max(ITEM_RADIUS, Math.min(GAME_WIDTH - ITEM_RADIUS, x));
}

/** Item y after falling straight down for `dt` seconds. */
export function advanceItemY(y: number, dt: number): number {
    return y + ITEM_FALL_SPEED * dt;
}

/** True once an item has fallen past the bottom edge by `ITEM_OFFSCREEN_MARGIN` (exactly on it is still there). */
export function isItemGone(y: number): boolean {
    return y > GAME_HEIGHT + ITEM_OFFSCREEN_MARGIN;
}

/** The player picks an item up when the centres are closer than `ITEM_RADIUS + PLAYER_RADIUS` (exactly on it: not yet). */
export function itemTouchesPlayer(ix: number, iy: number, px: number, py: number): boolean {
    return circlesOverlap(ix, iy, ITEM_RADIUS, px, py, PLAYER_RADIUS);
}

/** Mine +1: one more mine, up to `MINE_ITEM_MAX` (nothing at the cap). Explosions still refill only up to `maxCount`. */
export function addMine(state: MineState): MineState {
    if (state.count >= MINE_ITEM_MAX) return state;
    return { ...state, count: state.count + 1 };
}

/** The HUD dots after "MINE: ": one filled per mine, empty ones only up to `MINE_INITIAL_COUNT` slots. */
export function mineDots(count: number): string {
    return '●'.repeat(count) + '○'.repeat(Math.max(0, MINE_INITIAL_COUNT - count));
}

export type BarrierState = {
    /** Holds a barrier that will absorb the next game-over cause. */
    owned: boolean;
    /** Seconds since the barrier broke (the grace window), or null outside the window. */
    graceElapsed: number | null;
};

export type FailureOutcome = 'gameover' | 'absorbed' | 'ignored';

export function createBarrierState(): BarrierState {
    return { owned: false, graceElapsed: null };
}

/** Picking a barrier up: held from now on (already holding one: nothing changes; the grace window goes on). */
export function pickUpBarrier(state: BarrierState): BarrierState {
    return state.owned ? state : { ...state, owned: true };
}

/** Float error in a sum of frame times (ten 0.1 s frames give 0.9999999999999999) must not move a boundary by a frame. */
const TIME_EPSILON = 1e-9;

/** Whether the grace window (the time right after the barrier broke) is running. */
export function isGraceActive(state: BarrierState): boolean {
    return state.graceElapsed !== null;
}

/** Advances the grace window by `dt`; it ends once the elapsed time reaches `BARRIER_BREAK_SEC`. */
export function advanceBarrier(state: BarrierState, dt: number): BarrierState {
    if (state.graceElapsed === null) return state;
    const elapsed = state.graceElapsed + dt;
    return { ...state, graceElapsed: elapsed + TIME_EPSILON >= BARRIER_BREAK_SEC ? null : elapsed };
}

/**
 * What a game-over cause (a bullet, a rush enemy, touching a mine, a blast) does now: nothing inside the grace
 * window; otherwise a held barrier absorbs it (the barrier breaks and the grace window starts); otherwise the game ends.
 */
export function resolveFailure(state: BarrierState): { state: BarrierState; outcome: FailureOutcome } {
    if (isGraceActive(state)) return { state, outcome: 'ignored' };
    if (state.owned) return { state: { owned: false, graceElapsed: 0 }, outcome: 'absorbed' };
    return { state, outcome: 'gameover' };
}

/** The player's opacity: dim and bright in turns every `BARRIER_BLINK_SEC` during the grace window (it starts dim). */
export function graceAlpha(graceElapsed: number | null): number {
    if (graceElapsed === null) return 1;
    return Math.floor(graceElapsed / BARRIER_BLINK_SEC + TIME_EPSILON) % 2 === 0 ? 0.4 : 1;
}
