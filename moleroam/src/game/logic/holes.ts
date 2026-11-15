import { PARAMS } from '../params';
import { LANDSCAPE, type Layout } from './layout';

/**
 * Which grid positions have an open hole (docs/spec/moving-holes.md). Exactly `openHoleCount` are open at
 * any time; a shift closes some (never one with a pop) and opens as many other positions.
 */
export interface HoleState {
    /** `open[i]` is true while position i has a hole (the opened-but-still-growing ones count as open). */
    readonly open: boolean[];
    /** Game time before which a just-opened hole takes no pop (position -> time); empty entries are free. */
    readonly lockedUntil: Map<number, number>;
    /** How many shifts have happened; the next one is due at `(shifts + 1) * holeShiftIntervalMs`. */
    shifts: number;
}

/** What one shift did, for the view: the positions that closed and the ones that opened, and when. */
export interface HoleShift {
    at: number;
    closed: number[];
    opened: number[];
}

/** Index into a list of `length` items from a random value in [0, 1) (1 is tolerated). */
const pick = (length: number, rand: () => number): number => Math.min(length - 1, Math.floor(rand() * length));

/** Take `count` distinct items out of `items` (ascending order, consumed), one `pick` draw each. */
const takeSome = (items: number[], count: number, rand: () => number): number[] => {
    const taken: number[] = [];
    for (let i = 0; i < count && items.length > 0; i++) taken.push(items.splice(pick(items.length, rand), 1)[0]);
    return taken;
};

const isLocked = (state: HoleState, hole: number, now: number): boolean => now < (state.lockedUntil.get(hole) ?? -Infinity);

/** The first state: `openHoleCount` of the layout's positions open, the rest closed, chosen with `rand`. */
export const initHoles = (rand: () => number, layout: Layout = LANDSCAPE): HoleState => {
    const total = layout.cols * layout.rows;
    const positions = Array.from({ length: total }, (_, i) => i);
    const closed = takeSome(positions, Math.max(0, total - PARAMS.openHoleCount), rand);
    const open = new Array<boolean>(total).fill(true);
    for (const i of closed) open[i] = false;
    return { open, lockedUntil: new Map(), shifts: 0 };
};

/** Time of the next shift. */
export const nextShiftAt = (state: HoleState): number => (state.shifts + 1) * PARAMS.holeShiftIntervalMs;

/**
 * One update's worth of shifting: when the game time has reached the next shift time, close up to `holeShiftCount`
 * open holes that have no pop (`popHoles` = holes of the pops that exist) and open as many closed positions (not
 * the ones just closed). At most one shift per update; null when none is due. `now` is the time the shift happens.
 */
export const stepHoles = (state: HoleState, now: number, popHoles: readonly number[], rand: () => number): HoleShift | null => {
    if (now < nextShiftAt(state)) return null;
    state.shifts++;
    const busy = new Set(popHoles);
    const candidates: number[] = [];
    state.open.forEach((isOpen, i) => {
        if (isOpen && !busy.has(i)) candidates.push(i);
    });
    const closed = takeSome(candidates, PARAMS.holeShiftCount, rand);
    for (const i of closed) state.open[i] = false;
    const justClosed = new Set(closed);
    const shut: number[] = [];
    state.open.forEach((isOpen, i) => {
        if (!isOpen && !justClosed.has(i)) shut.push(i);
    });
    const opened = takeSome(shut, closed.length, rand);
    for (const i of opened) {
        state.open[i] = true;
        state.lockedUntil.set(i, now + PARAMS.holeTransitionMs);
    }
    return { at: now, closed, opened };
};

/** A hole that can take a new pop as far as the shifting goes: open, and not still opening. */
export const isUsable = (state: HoleState, hole: number, now: number): boolean => state.open[hole] === true && !isLocked(state, hole, now);

/** The positions that take no new pop right now (closed or still opening); pops in use are counted separately. */
export const blockedHoles = (state: HoleState, now: number): number[] => {
    const blocked: number[] = [];
    state.open.forEach((_, i) => {
        if (!isUsable(state, i, now)) blocked.push(i);
    });
    return blocked;
};
