// What the hovering mino looks like during its telegraph. Pure logic, no Phaser.
import { P } from '../params';
import { ROTATION_COUNT, shapeCells, shapeWidth, type Cell } from './pieces';
import { PROBE_ROW, type Plan } from './ai';
import { landingRow, type Grid, type Piece } from './board';

export interface TelegraphView {
    rot: number;
    cells: readonly Cell[];
    col: number;
}

/**
 * How many 90-degree turns (0-3) the mino makes before it stops. Derived from the plan alone (no randomness,
 * so the landing AI's random sequence is untouched): the same plan always spins the same way.
 */
export const turnCount = (plan: Plan): number =>
    (3 * plan.kind + 5 * plan.rot + 7 * plan.col) % ROTATION_COUNT;

/** Number of turns still to come after `t` seconds, out of `turns` (0 once the last turn time has passed). */
export const remainingTurns = (turns: number, t: number): number =>
    turns - P.ROTATE_TIMES[turns].filter((at) => t >= at - 1e-9).length;

/** The mino spins into its final orientation; its column is pulled in so it never leaves the field. */
export const telegraphView = (plan: Plan, t: number): TelegraphView => {
    const rot = (plan.rot - remainingTurns(turnCount(plan), t) + ROTATION_COUNT) % ROTATION_COUNT;
    const cells = shapeCells(plan.kind, rot);
    const col = Math.min(plan.col, P.COLS - shapeWidth(cells));
    return { rot, cells, col };
};

export interface FrameView {
    cells: readonly Cell[];
    col: number;
    row: number;
}

/** From this time on (the last turn of any mino) the frame sits at the landing the AI chose. */
const FRAME_SETTLED_T = Math.max(...P.ROTATE_TIMES.flat());

/**
 * The landing frame during the telegraph: it follows the displayed mino, landing where that shape would stop
 * if dropped straight down at its displayed column. At the settled time (and for a mino that never turns)
 * it is exactly the AI's chosen landing, even if a crumble changed the board since.
 */
export const frameView = (grid: Grid, plan: Plan, t: number): FrameView => {
    if (turnCount(plan) === 0 || t >= FRAME_SETTLED_T - 1e-9) {
        return { cells: shapeCells(plan.kind, plan.rot), col: plan.col, row: plan.row };
    }
    const view = telegraphView(plan, t);
    return { cells: view.cells, col: view.col, row: landingRow(grid, view.cells, view.col, PROBE_ROW) };
};

/**
 * The landing frame while the mino falls. On its planned column it sits at the AI's landing. While a pause sways the
 * mino to another column, the frame moves with it and lands where that column would stop the mino.
 */
export const dropFrameView = (grid: Grid, piece: Piece, plan: Plan): FrameView => {
    if (piece.col === plan.col) return { cells: piece.cells, col: plan.col, row: plan.row };
    return { cells: piece.cells, col: piece.col, row: landingRow(grid, piece.cells, piece.col, Math.floor(piece.y)) };
};
