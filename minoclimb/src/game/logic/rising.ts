// Rising rows (docs/spec/rising.md): from stage 2 on, a row with one hole pushes the field and the climber up.
// Pure logic, no Phaser.
import { P } from '../params';
import type { Grid } from './board';
import { isSolid } from './board';
import type { Cell } from './pieces';
import type { Player } from './player';

const EPS = 1e-9;
/** Slack for floating point error in the overlap test (the same as the climber's collision). */
const OVERLAP_EPS = 1e-6;

/** True when the rising rule is on for a Game that plays `stage`. */
export const risingEnabled = (stage: number): boolean => stage >= P.RISE_FROM_STAGE;

/** The hole column of one rise, from a random value in [0, 1). */
export const holeColumn = (value: number): number => Math.min(P.COLS - 1, Math.floor(value * P.COLS));

/** True once `elapsed` seconds have reached the rise interval (with slack for floating point error). */
export const riseDue = (elapsed: number): boolean => elapsed + EPS >= P.RISE_INTERVAL;

/**
 * Moves every row up by one and fills the bottom row with RISE_CELL cells except in `hole`. Returns true when a
 * cell now sits above TOP_OUT_ROW (the field is stacked too high). Row 0's content leaves the field.
 */
export const riseGrid = (grid: Grid, hole: number): boolean => {
    grid.shift();
    const bottom = Array<number>(P.COLS).fill(P.RISE_CELL);
    bottom[hole] = 0;
    grid.push(bottom);
    for (let r = 0; r < P.TOP_OUT_ROW; r++) {
        if (grid[r].some((v) => v !== 0)) return true;
    }
    return false;
};

/**
 * The climber after a rise: pushed up by the least amount (0..1 cell) that frees the body from the solid cells
 * of the risen field. Only the vertical position changes; speed, `onGround` and the kick memory stay.
 */
export const pushUpForRise = (grid: Grid, pl: Player): Player => {
    const feet = pl.y + P.PLAYER_H;
    const c0 = Math.floor(pl.x);
    const c1 = Math.floor(pl.x + P.PLAYER_W - OVERLAP_EPS);
    const r0 = Math.floor(pl.y);
    const r1 = Math.floor(feet - OVERLAP_EPS);
    let push = 0;
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            if (isSolid(grid, c, r)) push = Math.max(push, feet - r);
        }
    }
    return push === 0 ? pl : { ...pl, y: pl.y - push };
};

/** Cells and rows of this frame's events, as they are after the field moved up one row. */
export const cellsAfterRise = (cells: readonly Cell[]): Cell[] => cells.map(({ c, r }) => ({ c, r: r - 1 }));

/** What the warning marker shows: nothing, a lit row of triangles, or the dark half of the blink. */
export interface RiseMarker {
    readonly visible: boolean;
    readonly on: boolean;
}

const MARKER_HIDDEN: RiseMarker = { visible: false, on: false };
const MARKER_LIT: RiseMarker = { visible: true, on: true };
const MARKER_DARK: RiseMarker = { visible: true, on: false };

/** The marker for `elapsed` seconds on the rise timer (docs/spec/rising.md "せり上がりの合図"). */
export const riseMarker = (elapsed: number): RiseMarker => {
    const start = P.RISE_INTERVAL - P.RISE_WARN_TIME;
    if (elapsed + EPS < start) return MARKER_HIDDEN;
    const t = Math.max(0, elapsed - start + EPS);
    return Math.floor(t * 2 * P.RISE_BLINK_HZ) % 2 === 0 ? MARKER_LIT : MARKER_DARK;
};
