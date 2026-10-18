// What the hovering mino looks like during its telegraph. Pure logic, no Phaser.
import { P } from '../params';
import { ROTATION_COUNT, shapeCells, shapeWidth, type Cell } from './pieces';
import type { Plan } from './ai';

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
