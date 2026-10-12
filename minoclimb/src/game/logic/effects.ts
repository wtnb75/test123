// Timing rules of the presentation effects. Pure logic, no Phaser.
import { P } from '../params';
import type { Cell } from './pieces';

/** Opacity of a flash `t` seconds after it started: 1 at t = 0, falling to exactly 0 at t = duration. */
export const flashAlpha = (t: number, duration: number): number => {
    if (t <= 0) return 1;
    if (t >= duration) return 0;
    return 1 - t / duration;
};

/**
 * Opacity of the operation hints after `t` seconds of play: 1 until HINT_TIME - HINT_FADE, then a
 * straight fade to exactly 0 at HINT_TIME.
 */
export const hintAlpha = (t: number): number => {
    const fadeStart = P.HINT_TIME - P.HINT_FADE;
    if (t <= fadeStart) return 1;
    if (t >= P.HINT_TIME) return 0;
    return (P.HINT_TIME - t) / P.HINT_FADE;
};

/**
 * Where field cells end up after the full rows `cleared` (ascending) are removed in the same frame:
 * cells in a cleared row are gone, the others move down one row per cleared row below them.
 */
export const cellsAfterClear = (cells: readonly Cell[], cleared: readonly number[]): Cell[] => {
    const moved: Cell[] = [];
    for (const { c, r } of cells) {
        if (cleared.includes(r)) continue;
        moved.push({ c, r: r + cleared.filter((row) => row > r).length });
    }
    return moved;
};
