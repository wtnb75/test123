import { PARAMS } from '../params';
import { countKind, fullLineExists, key, pick, reachableFrom } from './grid';
import { EMPTY, FIXED, type Grid, type KindPt, type Pt, type Rng, type State } from './types';

/** How many fixed blocks the board should hold at a given score. */
export const fixedTarget = (score: number): number =>
    Math.min(PARAMS.maxFixed, PARAMS.initialFixed + Math.floor(score / PARAMS.fixedGrowEvery));

/**
 * Whether a fixed block may go on `p`: it must not cut the character off from any empty cell it could
 * reach before (the cell itself aside), and it must not complete a line. Enclosed pockets the character
 * never reached don't take part, so they can't stall the top-up.
 */
function canTakeFixed(grid: Grid, px: number, py: number, reachableBefore: Set<string>, p: Pt): boolean {
    grid[p.y][p.x] = FIXED;
    const reachableAfter = reachableFrom(grid, px, py);
    const completesLine = fullLineExists(grid);
    grid[p.y][p.x] = EMPTY;
    if (completesLine) return false;
    const own = key(p.x, p.y);
    for (const k of reachableBefore) if (k !== own && !reachableAfter.has(k)) return false;
    return true;
}

/** Top fixed blocks up to the target, each on a random empty cell that `canTakeFixed` allows. */
export function topUpFixed(state: State, rng: Rng): KindPt[] {
    const placed: KindPt[] = [];
    const { grid } = state;
    const target = fixedTarget(state.score);
    while (countKind(grid, FIXED) < target) {
        const empties: Pt[] = [];
        grid.forEach((row, y) => row.forEach((cell, x) => {
            if (cell === EMPTY && !(x === state.px && y === state.py)) empties.push({ x, y });
        }));
        const reachableBefore = reachableFrom(grid, state.px, state.py);
        const valid = empties.filter((p) => canTakeFixed(grid, state.px, state.py, reachableBefore, p));
        if (valid.length === 0) break;
        const p = pick(valid, rng);
        grid[p.y][p.x] = FIXED;
        placed.push({ ...p, kind: FIXED });
    }
    return placed;
}
