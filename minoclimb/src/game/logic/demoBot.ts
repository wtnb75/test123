// The bot that plays the demo behind the Title (docs/spec/title-demo.md "ボットの振る舞い").
// A pure function of the Round's state and the run's elapsed time: no random numbers, no clock of its own.
import { P } from '../params';
import type { Grid } from './board';
import { shapeCells, shapeWidth } from './pieces';
import type { MoveInput, Player } from './player';
import type { Flow } from './round';

/** What the bot looks at: the field, the climber and the single mino that is announced or falling. */
export interface DemoSight {
    grid: Grid;
    player: Player;
    flow: Flow;
}

/** Right first, so that on equal cost the right one is kept. */
const ESCAPE_DIRS: readonly number[] = [1, -1];
/** Columns looked at when climbing, nearest first and the right one first. */
const CLIMB_OFFSETS: readonly number[] = [0, 1, -1, 2, -2];

/** Climbs and drops of at most this many rows can be walked (the climber jumps 2.3 cells high). */
const STEP_MAX = 2;

/** Heights of the columns, as the landing AI sees them: rows from the topmost cell down to the floor. */
export const columnHeights = (grid: Grid): number[] => {
    const heights = Array<number>(P.COLS).fill(0);
    for (let c = 0; c < P.COLS; c++) {
        for (let r = 0; r < P.ROWS; r++) {
            if (grid[r][c] !== 0) {
                heights[c] = P.ROWS - r;
                break;
            }
        }
    }
    return heights;
};

/** The columns the announced / falling mino will cover (its landing frame), or null when there is none. */
const minoColumns = (flow: Flow): { lo: number; hi: number } | null => {
    if (flow.kind === 'wait') return null;
    const { kind, rot, col } = flow.plan;
    return { lo: col, hi: col + shapeWidth(shapeCells(kind, rot)) - 1 };
};

/** The nearest column outside the mino that can be walked to (steps of at most 2 up or down). */
const escapeColumn = (
    heights: readonly number[], col: number, mino: { lo: number; hi: number },
): number | null => {
    let best: number | null = null;
    let bestCost = Infinity;
    // Right first, so that on equal cost the right one is kept.
    for (const dir of ESCAPE_DIRS) {
        let prev = col;
        for (let dist = 1; dist < P.COLS; dist++) {
            const c = col + dir * dist;
            if (c < 0 || c >= P.COLS) break;
            if (Math.abs(heights[c] - heights[prev]) > STEP_MAX) break;
            prev = c;
            if (c >= mino.lo && c <= mino.hi) continue;
            // Deep holes (3 or more rows) are never entered: a drop of that size is not a step.
            if (dist < bestCost) {
                best = c;
                bestCost = dist;
            }
            break;
        }
    }
    return best;
};

/** The column to climb to: the highest within two columns (step of at most 2), nearest, then right. */
const climbColumn = (
    heights: readonly number[], col: number, mino: { lo: number; hi: number } | null,
): number => {
    let best = col;
    for (const d of CLIMB_OFFSETS) {
        const c = col + d;
        if (c < 0 || c >= P.COLS) continue;
        if (mino && c >= mino.lo && c <= mino.hi) continue;
        if (heights[c] - heights[col] > STEP_MAX) continue;
        if (heights[c] > heights[best]) best = c;
    }
    return best;
};

/** The x the bot strolls to when there is nothing higher nearby (cell-boundary coordinates). */
export const roamTarget = (tSec: number): number =>
    P.DEMO_ROAM_CENTER + P.DEMO_ROAM_AMPLITUDE * Math.sin((2 * Math.PI * tSec) / P.DEMO_ROAM_PERIOD_S);

/** One frame of input. `tSec` is the seconds since the run was rebuilt. */
export const demoBot = (sight: DemoSight, tSec: number): MoveInput => {
    const { grid, player: pl, flow } = sight;
    const heights = columnHeights(grid);
    const col = Math.min(P.COLS - 1, Math.max(0, Math.floor(pl.x + P.PLAYER_W / 2)));
    const mino = minoColumns(flow);
    const move: MoveInput = { left: false, right: false, jump: false };

    const walk = (dir: number): void => {
        const ahead = col + dir;
        if (ahead < 0 || ahead >= P.COLS) return;
        move.right = dir > 0;
        move.left = dir < 0;
        const rise = heights[ahead] - heights[col];
        move.jump = pl.onGround && rise >= 1 && rise <= STEP_MAX;
    };

    // 1. get out of the way of the mino
    const overlaps = mino !== null
        && pl.x - P.DEMO_BODY_MARGIN < mino.hi + 1
        && pl.x + P.PLAYER_W + P.DEMO_BODY_MARGIN > mino.lo;
    if (mino !== null && overlaps) {
        if (col < mino.lo || col > mino.hi) {
            // The centre is already outside, but the body still reaches into the mino: step away inside
            // this column (turning back to the far column would make it shuffle on the spot).
            move.left = col < mino.lo;
            move.right = col > mino.hi;
            return move;
        }
        const target = escapeColumn(heights, col, mino);
        if (target !== null && target !== col) walk(target > col ? 1 : -1);
        return move;
    }

    // 2. climb, or 3. stroll when nothing higher is near
    const best = climbColumn(heights, col, mino);
    const centre = pl.x + P.PLAYER_W / 2;
    const targetX = best !== col ? best + 0.5 : roamTarget(tSec);
    let dir = 0;
    if (targetX - centre > P.DEMO_ARRIVE_TOL) dir = 1;
    else if (centre - targetX > P.DEMO_ARRIVE_TOL) dir = -1;
    if (dir === 0) return move;

    // 5. never walk into a hole we cannot climb out of, nor against a wall we cannot climb
    const ahead = col + dir;
    if (ahead < 0 || ahead >= P.COLS) return move;
    const rise = heights[ahead] - heights[col];
    if (rise <= -3 || rise >= 3) return move;
    if (mino && ahead >= mino.lo && ahead <= mino.hi) return move;
    walk(dir);
    return move;
};
