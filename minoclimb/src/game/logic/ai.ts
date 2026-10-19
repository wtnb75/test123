// The landing AI: decides where each mino will land. Pure logic, no Phaser.
import { P } from '../params';
import { landingRow, type Grid } from './board';
import { KIND_COUNT, ROTATION_COUNT, shapeCells, shapeWidth, type Cell } from './pieces';

export interface Plan {
    kind: number;
    rot: number;
    col: number;
    /** Landing row of the bounding box's top edge. */
    row: number;
}

/** Score given to a placement that would stack past TOP_OUT_ROW. */
const TOP_OUT_SCORE = -1_000_000;
/** Probe rows start this far above the field so every cell begins out of sight. */
export const PROBE_ROW = -4;

const evaluate = (grid: Grid, cells: readonly Cell[], col: number, row: number, wellCol: number): number => {
    const g = grid.map((r) => r.slice());
    let wellCells = 0;
    for (const { c, r } of cells) {
        if (row + r >= 0) g[row + r][col + c] = 1;
        if (col + c === wellCol) wellCells++;
    }
    const lines = g.filter((r) => r.every((v) => v !== 0)).length;
    const heights = Array<number>(P.COLS).fill(0);
    let holes = 0;
    for (let c = 0; c < P.COLS; c++) {
        let seen = false;
        for (let r = 0; r < P.ROWS; r++) {
            if (g[r][c] !== 0) {
                if (!seen) heights[c] = P.ROWS - r;
                seen = true;
            } else if (seen) {
                holes++;
            }
        }
    }
    let bump = 0;
    for (let c = 0; c + 1 < P.COLS; c++) {
        if (c === wellCol || c + 1 === wellCol) continue;
        bump += Math.abs(heights[c] - heights[c + 1]);
    }
    return P.AI_LINES_W * lines - P.AI_HOLES_W * holes - P.AI_BUMP_W * bump - P.AI_WELL_W * wellCells;
};

interface Option {
    plan: Plan;
    score: number;
}

/** Every (rotation, column) placement of `kind`, best first. Ties keep generation order. */
export const rankPlacements = (grid: Grid, kind: number, wellCol: number): Option[] => {
    const options: Option[] = [];
    for (let rot = 0; rot < ROTATION_COUNT; rot++) {
        const cells = shapeCells(kind, rot);
        const width = shapeWidth(cells);
        for (let col = 0; col + width <= P.COLS; col++) {
            const row = landingRow(grid, cells, col, PROBE_ROW);
            const toppedOut = row < P.TOP_OUT_ROW;
            const score = toppedOut ? TOP_OUT_SCORE : evaluate(grid, cells, col, row, wellCol);
            options.push({ plan: { kind, rot, col, row }, score });
        }
    }
    // Array.prototype.sort is stable.
    return options.sort((a, b) => b.score - a.score);
};

/**
 * Picks a placement: usually one of the best AI_TOP_K; with probability AI_MISTAKE_RATE a "mistake"
 * from the best AI_MISTAKE_K instead. Placements that top out are only chosen when nothing else is left.
 * Consumes one random number (two when a non-topping-out placement exists and the mistake roll is made).
 */
export const planPlacement = (grid: Grid, kind: number, rng: () => number, wellCol: number): Plan => {
    const ranked = rankPlacements(grid, kind, wellCol);
    const safe = ranked.filter((o) => o.score > TOP_OUT_SCORE);
    const pool = safe.length > 0 ? safe : ranked;
    const mistake = safe.length > 0 && rng() < P.AI_MISTAKE_RATE;
    const k = Math.min(mistake ? P.AI_MISTAKE_K : P.AI_TOP_K, pool.length);
    return pool[Math.floor(rng() * k)].plan;
};

/** Plans a random kind of mino. */
export const planRandom = (grid: Grid, rng: () => number, wellCol: number): Plan =>
    planPlacement(grid, Math.floor(rng() * KIND_COUNT), rng, wellCol);
