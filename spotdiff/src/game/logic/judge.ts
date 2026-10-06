import type { Diff } from './generate';

/** Index of the first undiscovered difference whose hit circle contains the point, or -1 (a miss). */
export const judgeClick = (diffs: readonly Diff[], found: ReadonlySet<number>, x: number, y: number): number => {
    for (let i = 0; i < diffs.length; i++) {
        if (found.has(i)) continue;
        if (Math.hypot(diffs[i].x - x, diffs[i].y - y) <= diffs[i].r) return i;
    }
    return -1;
};
