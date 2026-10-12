import { afterEach, describe, expect, it } from 'vitest';
import { P } from '../params';
import { planPlacement, planRandom, rankPlacements } from './ai';
import { clearLines, createGrid, lockPiece, type Grid } from './board';
import { KIND_COUNT, shapeCells } from './pieces';
import { Round } from './round';

const I = 0;
const O = 1;
const TOP_OUT_SCORE = -1_000_000;

/** Deterministic PRNG (mulberry32). */
const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Returns the given values in order (then 0) and records how many were consumed. */
const scripted = (values: number[]): { rng: () => number; used: () => number } => {
    let i = 0;
    return { rng: () => values[i++] ?? 0, used: () => Math.min(i, values.length) };
};

const params = P as unknown as Record<string, number>;
const originals = { rate: P.AI_MISTAKE_RATE, topK: P.AI_TOP_K };
afterEach(() => {
    params.AI_MISTAKE_RATE = originals.rate;
    params.AI_TOP_K = originals.topK;
});

const fillRows = (grid: Grid, rows: number[], except: number[] = []): void => {
    for (const r of rows) {
        for (let c = 0; c < P.COLS; c++) {
            if (!except.includes(c)) grid[r][c] = 2;
        }
    }
};

const rangeRows = (from: number, to: number): number[] =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('rankPlacements', () => {
    it('lists every rotation x column that fits the field', () => {
        // I: widths 4,1,4,1 -> 7+10+7+10; O: width 2 in all four -> 4 x 9; T: widths 3,2,3,2 -> 8+9+8+9.
        expect(rankPlacements(createGrid(), I, 0)).toHaveLength(34);
        expect(rankPlacements(createGrid(), O, 0)).toHaveLength(36);
        expect(rankPlacements(createGrid(), 2, 0)).toHaveLength(34);
    });

    it('sorts best first with ties kept in generation order (rotation, then column)', () => {
        // Empty field, I piece, open column 0: a flat I at columns 1-4 or 6-9 scores -1 (one step of height).
        const ranked = rankPlacements(createGrid(), I, 0);
        expect(ranked.slice(0, 4).map((o) => o.score)).toEqual([-1, -1, -1, -1]);
        expect(ranked.slice(0, 4).map((o) => [o.plan.rot, o.plan.col])).toEqual([[0, 1], [0, 6], [2, 1], [2, 6]]);
        expect(ranked[4].score).toBeLessThan(-1);
        expect(ranked[0].plan).toEqual({ kind: I, rot: 0, col: 1, row: P.ROWS - 1 });
    });

    it('keeps away from the open column when it can', () => {
        // O piece, open column 0: best are columns 1-2 and 8-9, each scoring -2 (a step of height 2).
        const ranked = rankPlacements(createGrid(), O, 0);
        const best = ranked.filter((o) => o.score === ranked[0].score);
        expect(ranked[0].score).toBe(-2);
        expect(best).toHaveLength(8);
        expect(best.every((o) => o.plan.col === 1 || o.plan.col === 8)).toBe(true);
    });

    it('prefers filling a gap without holes over covering it', () => {
        // Rows 18-19 are full except column 4. Open column is 9.
        const grid = createGrid();
        fillRows(grid, [18, 19], [4]);
        const ranked = rankPlacements(grid, I, 9);
        // Vertical I in the gap completes rows 18 and 19 (+3 each); the rest of the heights differ by 2 + 2.
        expect(ranked[0].score).toBe(2);
        expect(ranked[0].plan).toEqual({ kind: I, rot: 1, col: 4, row: 16 });
        // Bridging the gap with a flat I at columns 2-5 leaves two holes (-8 each) and two 1-high steps.
        const bridge = ranked.find((o) => o.plan.rot === 0 && o.plan.col === 2);
        expect(bridge?.score).toBe(-2 * P.AI_HOLES_W - 2 * P.AI_BUMP_W);
    });

    it('puts placements that stack past TOP_OUT_ROW last at the top-out score', () => {
        // Rows 2-19 are full except column 0; only the vertical I in column 0 stays inside the field.
        const grid = createGrid();
        fillRows(grid, rangeRows(2, 19), [0]);
        const ranked = rankPlacements(grid, I, 9);
        const safe = ranked.filter((o) => o.score > TOP_OUT_SCORE);
        expect(safe.map((o) => [o.plan.rot, o.plan.col, o.plan.row])).toEqual([[1, 0, 16], [3, 0, 16]]);
        expect(ranked.slice(2).every((o) => o.score === TOP_OUT_SCORE && o.plan.row < P.TOP_OUT_ROW)).toBe(true);
    });

    it('treats a landing whose top edge is exactly TOP_OUT_ROW as safe', () => {
        // Rows 3-19 full: a flat I lands on row 2 = TOP_OUT_ROW, which is allowed.
        const grid = createGrid();
        fillRows(grid, rangeRows(3, 19));
        const flat = rankPlacements(grid, I, 9).find((o) => o.plan.rot === 0 && o.plan.col === 0);
        expect(flat?.plan.row).toBe(P.TOP_OUT_ROW);
        expect(flat?.score).toBeGreaterThan(TOP_OUT_SCORE);
    });
});

describe('planPlacement', () => {
    const ranked = rankPlacements(createGrid(), O, 0);

    it('picks the best of the top AI_TOP_K when the random number is 0', () => {
        const { rng } = scripted([0.9, 0]);
        expect(planPlacement(createGrid(), O, rng, 0)).toEqual(ranked[0].plan);
    });

    it('picks the AI_TOP_K-th candidate when the random number is close to 1', () => {
        const { rng } = scripted([0.9, 0.999]);
        expect(planPlacement(createGrid(), O, rng, 0)).toEqual(ranked[P.AI_TOP_K - 1].plan);
    });

    it('never goes beyond the top AI_TOP_K when not making a mistake', () => {
        for (const u2 of [0, 0.25, 0.49, 0.5, 0.75, 0.999999]) {
            const plan = planPlacement(createGrid(), O, scripted([0.5, u2]).rng, 0);
            const idx = ranked.findIndex((o) => o.plan.rot === plan.rot && o.plan.col === plan.col);
            expect(idx).toBeLessThan(P.AI_TOP_K);
        }
    });

    it('makes a mistake when the first roll is below AI_MISTAKE_RATE', () => {
        const { rng } = scripted([P.AI_MISTAKE_RATE - 0.001, 0.999]);
        expect(planPlacement(createGrid(), O, rng, 0)).toEqual(ranked[P.AI_MISTAKE_K - 1].plan);
    });

    it('does not make a mistake when the first roll equals AI_MISTAKE_RATE', () => {
        const { rng } = scripted([P.AI_MISTAKE_RATE, 0.999]);
        expect(planPlacement(createGrid(), O, rng, 0)).toEqual(ranked[P.AI_TOP_K - 1].plan);
    });

    it('takes the best candidate for a mistake roll of 0 and a second roll of 0', () => {
        expect(planPlacement(createGrid(), O, scripted([0, 0]).rng, 0)).toEqual(ranked[0].plan);
    });

    it('uses two random numbers when a safe placement exists', () => {
        const s = scripted([0.9, 0.1]);
        planPlacement(createGrid(), O, s.rng, 0);
        expect(s.used()).toBe(2);
    });

    it('never picks a placement that tops out while a safe one exists, whatever the rolls', () => {
        const grid = createGrid();
        fillRows(grid, rangeRows(2, 19), [0]);
        let checked = 0;
        for (const u1 of [0, 0.1, 0.19, 0.2, 0.5, 0.99]) {
            for (const u2 of [0, 0.3, 0.5, 0.99, 0.999999]) {
                const plan = planPlacement(grid, I, scripted([u1, u2]).rng, 9);
                expect(plan.col).toBe(0);
                expect(plan.row).toBe(16);
                checked++;
            }
        }
        expect(checked).toBe(30);
    });

    it('still returns a placement, with one random number, when every placement tops out', () => {
        const grid = createGrid();
        fillRows(grid, rangeRows(2, 19), [0]);
        const s = scripted([0.7]);
        const plan = planPlacement(grid, O, s.rng, 9);
        expect(s.used()).toBe(1);
        expect(plan.row).toBeLessThan(P.TOP_OUT_ROW);
    });

    it('copes with fewer candidates than the mistake pool', () => {
        const grid = createGrid();
        fillRows(grid, rangeRows(2, 19), [0]);
        // Only two safe candidates exist (< AI_MISTAKE_K): the index scales to those two.
        expect(planPlacement(grid, I, scripted([0, 0]).rng, 9)).toMatchObject({ rot: 1, col: 0, row: 16 });
        expect(planPlacement(grid, I, scripted([0, 0.999999]).rng, 9)).toMatchObject({ rot: 3, col: 0, row: 16 });
    });

    it('copes with fewer safe candidates than AI_TOP_K in a normal pick', () => {
        const grid = createGrid();
        fillRows(grid, rangeRows(2, 19), [0]);
        params.AI_TOP_K = 5;
        expect(planPlacement(grid, I, scripted([0.9, 0.999999]).rng, 9)).toMatchObject({ rot: 3, col: 0, row: 16 });
        expect(planPlacement(grid, I, scripted([0.9, 0]).rng, 9)).toMatchObject({ rot: 1, col: 0, row: 16 });
    });
});

describe('planRandom', () => {
    it('chooses the mino kind from the first random number', () => {
        expect(planRandom(createGrid(), scripted([0, 0.9, 0]).rng, 0).kind).toBe(0);
        expect(planRandom(createGrid(), scripted([0.999, 0.9, 0]).rng, 0).kind).toBe(KIND_COUNT - 1);
    });
});

// --- Oracle: recompute each placement's score with a separately written routine. ---

const oracle = (
    grid: Grid, kind: number, rot: number, col: number, row: number, well: number,
): { score: number; lines: number; holes: number } => {
    const cells = shapeCells(kind, rot);
    const occupied = (r: number, c: number): boolean =>
        grid[r][c] !== 0 || cells.some((x) => col + x.c === c && row + x.r === r);

    let lines = 0;
    for (let r = 0; r < P.ROWS; r++) {
        let full = true;
        for (let c = 0; c < P.COLS; c++) full = full && occupied(r, c);
        if (full) lines++;
    }

    const heights: number[] = [];
    let holes = 0;
    for (let c = 0; c < P.COLS; c++) {
        let top = -1;
        for (let r = 0; r < P.ROWS && top < 0; r++) if (occupied(r, c)) top = r;
        heights.push(top < 0 ? 0 : P.ROWS - top);
        if (top >= 0) {
            for (let r = top + 1; r < P.ROWS; r++) if (!occupied(r, c)) holes++;
        }
    }

    let bump = 0;
    for (let c = 0; c < P.COLS - 1; c++) {
        if (c !== well && c + 1 !== well) bump += Math.abs(heights[c] - heights[c + 1]);
    }
    const wellCells = cells.filter((x) => col + x.c === well).length;
    return { score: 3 * lines - 8 * holes - 1 * bump - 1 * wellCells, lines, holes };
};

describe('placement scores against an independent oracle', () => {
    it('agree on every placement of random boards built by playing the AI', () => {
        let compared = 0;
        let withLines = 0;
        let withHoles = 0;
        for (let seed = 1; seed <= 12; seed++) {
            const rng = seeded(seed);
            const grid = createGrid();
            const well = new Round(rng).wellCol;
            for (let piece = 0; piece < 40; piece++) {
                const kind = Math.floor(rng() * KIND_COUNT);
                for (const o of rankPlacements(grid, kind, well)) {
                    if (o.score === TOP_OUT_SCORE) continue;
                    const { rot, col, row } = o.plan;
                    const expected = oracle(grid, kind, rot, col, row, well);
                    if (o.score !== expected.score) {
                        expect.fail(`seed ${seed} piece ${piece} kind ${kind} rot ${rot} col ${col}: ${o.score} != ${expected.score}`);
                    }
                    compared++;
                    if (expected.lines > 0) withLines++;
                    if (expected.holes > 0) withHoles++;
                }
                const plan = planPlacement(grid, kind, rng, well);
                if (plan.row < P.TOP_OUT_ROW) break;
                lockPiece(grid, { kind, rot: plan.rot, cells: shapeCells(kind, plan.rot), col: plan.col, y: plan.row }, plan.row);
                clearLines(grid);
            }
        }
        expect(compared).toBeGreaterThan(5000);
        expect(withHoles).toBeGreaterThan(100);
        expect(withLines).toBeGreaterThan(20);
    });
});

// --- Statistics (spec: テスト観点「着地 AI の統計」) ---

interface RunStats {
    topout: number;
    lines: number;
    reach: number;
    well: number;
}

const simulate = (seed: number): RunStats => {
    const rng = seeded(seed);
    const grid = createGrid();
    const well = new Round(rng).wellCol;
    let lines = 0;
    let reach = 500;
    for (let i = 1; i <= 500; i++) {
        const plan = planRandom(grid, rng, well);
        if (plan.row < P.TOP_OUT_ROW) return { topout: i, lines, reach, well };
        lockPiece(grid, { kind: plan.kind, rot: plan.rot, cells: shapeCells(plan.kind, plan.rot), col: plan.col, y: plan.row }, plan.row);
        lines += clearLines(grid).length;
        const top = grid.findIndex((r) => r.some((v) => v !== 0));
        if (reach === 500 && top >= 0 && P.ROWS - top >= 15) reach = i;
    }
    return { topout: 500, lines, reach, well };
};

const average = (runs: RunStats[], f: (r: RunStats) => number): number =>
    runs.reduce((sum, r) => sum + f(r), 0) / runs.length;

describe('landing AI statistics without a player (seeds 1-30)', () => {
    const runs = Array.from({ length: 30 }, (_, i) => simulate(i + 1));

    it('tops out after 50-100 minos on average', () => {
        const mean = average(runs, (r) => r.topout);
        expect(mean).toBeGreaterThanOrEqual(50);
        expect(mean).toBeLessThanOrEqual(100);
    });

    it('clears at least 8 rows per game on average', () => {
        expect(average(runs, (r) => r.lines)).toBeGreaterThanOrEqual(8);
    });

    it('reaches height 15 within 60 minos on average', () => {
        expect(average(runs, (r) => r.reach)).toBeLessThanOrEqual(60);
    });

    it('tops out before reaching height 15 in at most 5% of games', () => {
        const early = runs.filter((r) => r.reach >= r.topout).length;
        expect(early / runs.length).toBeLessThanOrEqual(0.05);
    });

    it('covers both open-column sides evenly enough', () => {
        const left = runs.filter((r) => r.well === 0).length;
        expect(left).toBeGreaterThanOrEqual(10);
        expect(runs.length - left).toBeGreaterThanOrEqual(10);
    });

    it('is not vacuous: games really top out and really clear rows', () => {
        expect(runs.every((r) => r.topout < 500)).toBe(true);
        expect(runs.filter((r) => r.lines > 0).length).toBeGreaterThan(20);
    });

    it('clears more rows without mistakes than with them (a wall with fewer steps)', () => {
        params.AI_MISTAKE_RATE = 0;
        const perfect = Array.from({ length: 30 }, (_, i) => simulate(i + 1));
        expect(average(perfect, (r) => r.lines)).toBeGreaterThan(average(runs, (r) => r.lines));
    });
});
