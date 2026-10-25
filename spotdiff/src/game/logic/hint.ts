import type { Diff } from './generate';

/** The difference the HINT shows: the undiscovered one with the smallest index, or null when none is left. */
export const hintTarget = (diffs: readonly Diff[], found: ReadonlySet<number>): number | null => {
    for (let i = 0; i < diffs.length; i++) {
        if (!found.has(i)) return i;
    }
    return null;
};

/** Whether a canvas point is inside the HINT's hit square (centre cx, cy; side length `side`; edges count). */
export const inHintSquare = (x: number, y: number, cx: number, cy: number, side: number): boolean =>
    Math.abs(x - cx) <= side / 2 && Math.abs(y - cy) <= side / 2;
