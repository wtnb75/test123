// What the hovering mino looks like during its telegraph. Pure logic, no Phaser.
import { P } from '../params';
import { ROTATION_COUNT, shapeCells, shapeWidth, type Cell } from './pieces';
import type { Plan } from './ai';

export interface TelegraphView {
    rot: number;
    cells: readonly Cell[];
    col: number;
}

/** Number of 90-degree turns still to come after `t` seconds (3 at the start, 0 from ROTATE_STEP * 3 on). */
export const remainingTurns = (t: number): number =>
    Math.max(0, ROTATION_COUNT - 1 - Math.floor(t / P.ROTATE_STEP + 1e-9));

/** The mino spins into its final orientation; its column is pulled in so it never leaves the field. */
export const telegraphView = (plan: Plan, t: number): TelegraphView => {
    const rot = (plan.rot - remainingTurns(t) + ROTATION_COUNT) % ROTATION_COUNT;
    const cells = shapeCells(plan.kind, rot);
    const col = Math.min(plan.col, P.COLS - shapeWidth(cells));
    return { rot, cells, col };
};
