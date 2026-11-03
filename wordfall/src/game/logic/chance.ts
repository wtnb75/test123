// Which falling letters are worth aiming at, and how the cue pulses (docs/spec/multi-complete.md). Pure: the
// Scene only draws what these return.
import {
    NEAR_MAX_SHORT,
    REACH_HALO_ALPHA_MAX,
    REACH_HALO_ALPHA_MIN,
    REACH_PULSE_MS,
    REACH_PULSE_SCALE,
    REACH_ROW_RIM_ALPHA_MIN,
    TRAY_CAPACITY,
} from '../params';
import { canComplete, consume, matchedMask } from './tray';
import type { Word } from './words';

export interface CueState {
    /** Letters whose pick would complete two or more of the words on screen at once. */
    reach: ReadonlySet<string>;
    /** Rows (ascending) that complete when one of the `reach` letters is picked. */
    reachRows: readonly number[];
    /** Letters that two or more words nearly need (never a `reach` letter). */
    near: ReadonlySet<string>;
}

export const NO_CUE: CueState = { reach: new Set(), reachRows: [], near: new Set() };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The rows the current words alone would complete if `tray` were the tray: top row first, each completion
 * using the keep rule against the words still waiting. A completed row is not replaced (a lower bound of what
 * really happens, where a new word can only make more letters stay).
 */
function rowsCompleted(tray: readonly string[], targets: readonly Word[]): number[] {
    let rest = [...tray];
    const live = targets.map((t, row) => ({ en: t.en, row }));
    const rows: number[] = [];
    for (;;) {
        const i = live.findIndex((w) => canComplete(rest, w.en));
        if (i < 0) return rows;
        const [done] = live.splice(i, 1);
        rows.push(done.row);
        rest = consume(rest, done.en, live.map((w) => w.en));
    }
}

/** The cue for this tray and these words; no letter is `reach` when the tray is full (the pick would be refused). */
export function cueState(tray: readonly string[], targets: readonly Word[], capacity = TRAY_CAPACITY): CueState {
    const reach = new Set<string>();
    const rows = new Set<number>();
    if (tray.length < capacity) {
        for (const c of ALPHABET) {
            const done = rowsCompleted([...tray, c], targets);
            if (done.length < 2) continue;
            reach.add(c);
            done.forEach((r) => rows.add(r));
        }
    }
    const wanting = new Map<string, number>();
    for (const t of targets) {
        const mask = matchedMask(tray, t.en);
        const missing = [...t.en].filter((_, i) => !mask[i]);
        if (missing.length === 0 || missing.length > NEAR_MAX_SHORT) continue;
        for (const c of new Set(missing)) wanting.set(c, (wanting.get(c) ?? 0) + 1);
    }
    const near = new Set([...wanting].filter(([c, n]) => n >= 2 && !reach.has(c)).map(([c]) => c));
    return { reach, reachRows: [...rows].sort((a, b) => a - b), near };
}

/** The reach pulse `ms` after the reach set became non-empty: a triangle wave, 0 at 0, 1 at half a period. */
export function pulse(ms: number, period = REACH_PULSE_MS): number {
    const phase = (((ms % period) + period) % period) / period;
    return phase < 0.5 ? phase * 2 : (1 - phase) * 2;
}

/** Tile size multiplier of a reach letter at pulse value `p`. */
export const reachScale = (p: number): number => 1 + (REACH_PULSE_SCALE - 1) * p;

/** Opacity of a reach letter's halo at pulse value `p`. */
export const haloAlpha = (p: number): number => REACH_HALO_ALPHA_MIN + (REACH_HALO_ALPHA_MAX - REACH_HALO_ALPHA_MIN) * p;

/** Opacity of a reach row's frame at pulse value `p`. */
export const rowRimAlpha = (p: number): number => 1 - (1 - REACH_ROW_RIM_ALPHA_MIN) * p;

/** The clock of the reach pulse after a cue change: restarts at 0 when the set becomes non-empty, dropped (-1) when empty. */
export function nextReachClock(prevClock: number, reach: ReadonlySet<string>): number {
    if (reach.size === 0) return -1;
    return prevClock < 0 ? 0 : prevClock;
}
